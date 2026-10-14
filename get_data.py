"""Download EIA hourly regional generation into small, versioned region/month files.

Python 3.9+ standard library only. See src/assignments/week-08/README.md.
The key stays in EIA_API_KEY or ignored .env.local; it is never published.
"""
import argparse
import calendar
import csv
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
API = 'https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/'
REGIONS = {
    'CAL': ('California', 'America/Los_Angeles', 'Los Angeles'),
    'CAR': ('Carolinas', 'America/New_York', 'New York'),
    'CENT': ('Central', 'America/Chicago', 'Chicago'),
    'FLA': ('Florida', 'America/New_York', 'New York'),
    'MIDA': ('Mid-Atlantic', 'America/New_York', 'New York'),
    'MIDW': ('Midwest', 'America/Chicago', 'Chicago'),
    'NE': ('New England', 'America/New_York', 'New York'),
    'NW': ('Northwest', 'America/Los_Angeles', 'Los Angeles'),
    'NY': ('New York', 'America/New_York', 'New York'),
    'SE': ('Southeast', 'America/New_York', 'New York'),
    'SW': ('Southwest', 'America/Phoenix', 'Phoenix'),
    'TEN': ('Tennessee', 'America/Chicago', 'Chicago'),
    'TEX': ('Texas', 'America/Chicago', 'Chicago'),
}


def month_bounds(month, zone):
    if not re.fullmatch(r'\d{4}-\d{2}', month):
        raise ValueError('Months must use YYYY-MM.')
    year, number = map(int, month.split('-'))
    start = datetime(year, number, 1, tzinfo=ZoneInfo(zone))
    end = datetime(year + (number == 12), number % 12 + 1, 1, tzinfo=ZoneInfo(zone))
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def read_key():
    if os.environ.get('EIA_API_KEY'):
        return os.environ['EIA_API_KEY']
    path = ROOT / '.env.local'
    if path.exists():
        for line in path.read_text().splitlines():
            if line.startswith('EIA_API_KEY='):
                return line.split('=', 1)[1].strip().strip('\"\'')
    raise ValueError('Set EIA_API_KEY or put EIA_API_KEY=your_key in .env.local.')


def request_page(params):
    for attempt in range(5):
        try:
            with urlopen(API + '?' + urlencode(params), timeout=90) as response:
                payload = json.load(response)
            if 'response' not in payload:
                raise ValueError('EIA returned an API error. Check your key and request parameters.')
            return payload['response']
        except HTTPError as error:
            # Do not print the exception or URL: they contain the API key.
            if error.code not in (429, 500, 502, 503, 504) or attempt == 4:
                raise ValueError(f'EIA request failed (HTTP {error.code}).') from None
        except (URLError, TimeoutError):
            if attempt == 4:
                raise ValueError('EIA request failed after retries; check network access.') from None
        time.sleep(2 ** attempt)


def download(area, month, key):
    start, end = month_bounds(month, REGIONS[area][1])
    params = {
        'api_key': key, 'frequency': 'hourly', 'data[0]': 'value',
        'facets[respondent][]': area,
        'start': start.strftime('%Y-%m-%dT%H'),
        'end': (end - timedelta(hours=1)).strftime('%Y-%m-%dT%H'),
        'sort[0][column]': 'period', 'sort[0][direction]': 'asc',
        'sort[1][column]': 'respondent', 'sort[1][direction]': 'asc',
        'sort[2][column]': 'fueltype', 'sort[2][direction]': 'asc',
        'offset': 0, 'length': 5000,
    }
    rows, expected = [], None
    while True:
        payload = request_page(params)
        total = int(payload['total'])
        if expected is not None and total != expected:
            raise ValueError('EIA changed its row count during pagination; retry the download.')
        expected = total
        batch = payload['data']
        if not batch and len(rows) < total:
            raise ValueError('EIA returned an empty page before download completed.')
        rows.extend(batch)
        print(f'{area} {month}: {len(rows):,}/{total:,} reports', flush=True)
        if len(rows) >= total:
            if len(rows) != total:
                raise ValueError('EIA returned more rows than its reported total.')
            return rows
        params['offset'] = len(rows)


def prepare(rows, area, month):
    name, zone, clock = REGIONS[area]
    start, end = month_bounds(month, zone)
    records, fuels, seen = [], {}, set()
    missing = 0
    for row in rows:
        if row['respondent'] != area:
            continue
        stamp = datetime.strptime(row['period'], '%Y-%m-%dT%H').replace(tzinfo=timezone.utc)
        if not start <= stamp < end:
            continue
        fuel = row['fueltype']
        if not fuel or row['value-units'] != 'megawatthours':
            raise ValueError('Unexpected fuel code or units in EIA data.')
        key = (row['period'], fuel)
        if key in seen:
            raise ValueError(f'Duplicate timestamp/fuel in {area} {month}.')
        seen.add(key)
        fuels[fuel] = row['type-name']
        raw = row.get('value')
        try:
            value = float(raw) if raw is not None and str(raw).strip() else float('nan')
        except (ValueError, TypeError):
            value = float('nan')
        if not math.isfinite(value):
            missing += 1
            continue
        records.append([row['period'], fuel, int(value) if value.is_integer() else value])
    if not records:
        raise ValueError(f'No numeric reports for {area} {month}.')
    records.sort(key=lambda row: (row[0], row[1]))
    dates = {}
    for period, _, _ in records:
        local = datetime.strptime(period, '%Y-%m-%dT%H').replace(tzinfo=timezone.utc).astimezone(ZoneInfo(zone))
        dates.setdefault(local.strftime('%Y-%m-%d'), set()).add(local.hour)
    return {
        'schemaVersion': 1, 'area': area, 'name': name, 'month': month,
        'zone': zone, 'clock': clock, 'units': 'MWh',
        'source': API, 'retrieved': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'columns': ['periodUTC', 'fuel', 'value'], 'fuels': dict(sorted(fuels.items())),
        'calendarDays': calendar.monthrange(start.astimezone(ZoneInfo(zone)).year, int(month[5:]))[1],
        'reportedDays': len(dates), 'completeDays': sum(len(hours) == 24 for hours in dates.values()),
        'omittedNonNumeric': missing, 'records': records,
    }


def write_json(path, value):
    content = json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n'
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(content)
    temporary.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--months', nargs='+', required=True, help='Local calendar months, e.g. 2026-01 2026-07')
    parser.add_argument('--regions', nargs='+', choices=REGIONS, default=list(REGIONS))
    parser.add_argument('--output', type=Path, default=ROOT / 'public/data/week-08')
    parser.add_argument('--csv', type=Path, help='Prepare a saved CSV instead of calling EIA; partial months remain labeled.')
    parser.add_argument('--refresh', action='store_true', help='Fetch again even if a region/month is already saved.')
    args = parser.parse_args()
    for month in args.months:
        month_bounds(month, 'UTC')
    manifest_path = args.output / 'manifest.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {'schemaVersion': 1, 'datasets': []}
    datasets = {(item['area'], item['month']): item for item in manifest['datasets']}
    csv_rows = list(csv.DictReader(args.csv.open())) if args.csv else None
    key = None if args.csv else read_key()
    for month in sorted(set(args.months)):
        for area in dict.fromkeys(args.regions):
            old = datasets.get((area, month))
            if old and (args.output / old['file']).exists() and not args.refresh:
                print(f'{area} {month}: using saved file', flush=True)
                continue
            rows = csv_rows if csv_rows is not None else download(area, month, key)
            data = prepare(rows, area, month)
            if args.csv:
                data['source'] = 'Saved EIA CSV: ' + args.csv.name
                data['retrieved'] = None  # Preparation time is not an API retrieval time.
            content = json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n'
            digest = hashlib.sha256(content.encode()).hexdigest()[:12]
            file = f'{area}/{month}-{digest}.json'
            write_json(args.output / file, data)
            datasets[(area, month)] = {
                k: data[k] for k in ('area', 'name', 'month', 'zone', 'clock', 'calendarDays', 'reportedDays', 'completeDays', 'retrieved')
            } | {'file': file, 'bytes': len(content.encode()), 'rows': len(data['records'])}
            # Publish a complete shard before its manifest entry. A failed later request
            # leaves all previous downloads usable and resumable; old files stay valid.
            manifest['datasets'] = sorted(datasets.values(), key=lambda item: (item['area'], item['month']))
            write_json(manifest_path, manifest)
    print(f'Saved {len(datasets)} region/month files to {args.output}', flush=True)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, OSError) as error:
        # Avoid URL-bearing tracebacks; HTTP errors are sanitized in request_page.
        print(f'Download stopped: {error}', file=sys.stderr)
        sys.exit(1)
