"""Checks for downloader boundaries, pagination, and missing-data handling."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('get_data', Path(__file__).resolve().parents[1] / 'get_data.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class DownloaderTests(unittest.TestCase):
    def test_local_month_boundaries_across_dst(self):
        start, end = module.month_bounds('2026-03', 'America/Los_Angeles')
        self.assertEqual(start.isoformat(), '2026-03-01T08:00:00+00:00')
        self.assertEqual(end.isoformat(), '2026-04-01T07:00:00+00:00')
        self.assertEqual((end - start).total_seconds() / 3600, 743)
        self.assertEqual(module.month_bounds('2026-12', 'UTC')[1].year, 2027)
        with self.assertRaises(ValueError):
            module.month_bounds('2026-13', 'UTC')

    def test_pagination_and_truncation(self):
        pages = [{'total': '3', 'data': [{'n': 1}, {'n': 2}]}, {'total': '3', 'data': [{'n': 3}]}]
        offsets = []
        def fetch(params):
            offsets.append(params['offset'])
            return pages.pop(0)
        with patch.object(module, 'request_page', side_effect=fetch):
            self.assertEqual(len(module.download('CAL', '2026-01', 'test-key')), 3)
        self.assertEqual(offsets, [0, 2])
        with patch.object(module, 'request_page', return_value={'total': '1', 'data': []}):
            with self.assertRaisesRegex(ValueError, 'empty page'):
                module.download('CAL', '2026-01', 'test-key')
        with patch.object(module, 'request_page', side_effect=[{'total': '2', 'data': [{}]}, {'total': '3', 'data': [{}]}]):
            with self.assertRaisesRegex(ValueError, 'changed'):
                module.download('CAL', '2026-01', 'test-key')

    def test_preparation_preserves_zero_and_negative_omits_missing_rejects_duplicates(self):
        def row(period, value):
            return {'respondent': 'CAL', 'period': period, 'fueltype': 'BAT', 'type-name': 'Battery', 'value': value, 'value-units': 'megawatthours'}
        rows = [row('2026-01-01T08', '0'), row('2026-01-01T09', '-2.5'), row('2026-01-01T10', ''), row('2026-01-01T11', None), row('2026-01-01T07', '10')]
        data = module.prepare(rows, 'CAL', '2026-01')
        self.assertEqual(data['records'], [['2026-01-01T08', 'BAT', 0], ['2026-01-01T09', 'BAT', -2.5]])
        self.assertEqual(data['omittedNonNumeric'], 2)
        self.assertEqual(data['completeDays'], 0)
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            module.prepare([rows[0], rows[0]], 'CAL', '2026-01')

if __name__ == '__main__':
    unittest.main()
