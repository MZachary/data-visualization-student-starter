"""Rebuild the browser dataset from the saved official XLSX; Python standard library only."""
from pathlib import Path
import collections
import hashlib
import json
import xml.etree.ElementTree as ET
import zipfile

HERE = Path(__file__).resolve().parent
SOURCE = HERE / 'reptile_checklist_2026_06.xlsx'
OUTPUT = HERE.parents[3] / 'public/data/week-07/reptiles.json'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(SOURCE) as archive:
    strings = [''.join(node.itertext()) for node in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', NS)]
    rows = ET.fromstring(archive.read('xl/worksheets/sheet1.xml')).findall('s:sheetData/s:row', NS)
    records = []
    for row in rows[1:]:
        cells = {}
        for cell in row:
            value = cell.findtext('s:v', '', NS)
            cells[''.join(filter(str.isalpha, cell.attrib['r']))] = strings[int(value)] if cell.get('t') == 's' else value
        assert all(cells.get(key) for key in ('B', 'C', 'E', 'F', 'H')), cells
        records.append([cells['B'].strip(), cells['E'].strip(), cells['F'].strip(), cells['C'].strip(), cells['H']])
records.sort()
assert len({record[0] for record in records}) == len(records)
assert len({record[4] for record in records}) == len(records)
assert len(records) == 12650
# A genus must have one parent; fail rather than silently assign conflicting taxa.
parents = collections.defaultdict(set)
for name, group, family, *_ in records:
    parents[name.split()[0]].add((group, family))
assert all(len(value) == 1 for value in parents.values())
data = {
    'source': 'https://www.reptile-database.org/data/reptile_checklist_2026_06.xlsx',
    'snapshot': '2026-06-17', 'retrieved': '2026-10-07',
    'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'columns': ['species', 'group', 'family', 'authority', 'sourceId'],
    'records': records,
}
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Saved {len(records):,} species, {len(parents):,} genera, {len({r[2] for r in records})} families.')
print(collections.Counter(r[1] for r in records))
