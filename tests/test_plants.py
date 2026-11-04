"""Guard the inventory fuel crosswalk and preserve the distinction between fuel and storage."""
import importlib.util
from pathlib import Path
import sys
import unittest

DATA = Path(__file__).resolve().parents[1] / 'src/assignments/week-11/data'
sys.path.insert(0, str(DATA))
spec = importlib.util.spec_from_file_location('prepare_plants', DATA / 'prepare.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PlantFuelTests(unittest.TestCase):
    def test_storage_and_purchased_steam(self):
        for source, mover, expected in [('MWH', 'BA', 'BAT'), ('MWH', 'FW', 'OES'), ('WAT', 'PS', 'PS'), ('WAT', 'HY', 'WAT'), ('PUR', 'ST', 'OTH')]:
            self.assertEqual(module.fuel({'Q': source, 'R': mover}), expected)

    def test_biomass_is_not_integrated_solar_or_wind(self):
        for source in ['WDS', 'LFG', 'BLQ', 'MSW', 'OBL']:
            self.assertEqual(module.fuel({'Q': source, 'R': 'ST'}), 'OTH')
        with self.assertRaises(ValueError):
            module.fuel({'Q': 'NEW_UNKNOWN_SOURCE', 'R': 'ST'})
