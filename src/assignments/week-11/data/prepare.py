"""Prepare the saved September 2026 EIA inventory. Python standard library only."""
from pathlib import Path
import collections, hashlib, json, math
from xlsx import sheets
HERE = Path(__file__).resolve().parent
OUT = HERE.parents[3] / 'public/data/week-11/plants.json'
REGIONS = {'CAL','CAR','CENT','FLA','MIDA','MIDW','NE','NW','NY','SE','SW','TEN','TEX'}
FUEL_GROUPS = {
 'SUN':'SUN','WND':'WND','NG':'NG','NUC':'NUC','WAT':'WAT','GEO':'GEO',
 **dict.fromkeys(['BIT','SUB','LIG','WC','RC','SGC'],'COL'),
 **dict.fromkeys(['DFO','RFO','JF','KER','WO','PC'],'OIL'),
 **dict.fromkeys(['AB','BLQ','MSW','OBS','WDS'],'OTH'),
 **dict.fromkeys(['LFG','OBG','OBL','WDL'],'OTH'),
 **dict.fromkeys(['BFG','OG','PG','WH','OTH','H2'],'OTH'),
}
def fuel(row):
 if row['R']=='PS': return 'PS'
 if row['Q']=='MWH': return 'BAT' if row['R']=='BA' else 'OES'
 if row['Q']=='PUR': return 'OTH'  # Purchased steam, not stored electricity.
 if row['Q'] not in FUEL_GROUPS: raise ValueError('Unmapped fuel '+row['Q'])
 return FUEL_GROUPS[row['Q']]
def main():
 inventory=HERE/'september_generator2026.xlsx'
 reference=HERE/'EIA930_Reference_Tables.xlsx'
 bas={r['A']:r for r in sheets(reference)['BAs'][1:] if r.get('A')}
 plants={}; seen=set(); excluded=collections.Counter(); unmatched=collections.Counter()
 workbook=sheets(inventory)
 assert 'September 2026' in workbook['Operating'][0]['A']
 header=workbook['Operating'][2]
 for column,label in {'C':'Plant ID','I':'Balancing Authority Code','M':'Nameplate Capacity (MW)','Q':'Energy Source Code','R':'Prime Mover Code','W':'Status','AJ':'Latitude','AK':'Longitude'}.items():
  assert header[column]==label,(column,header[column])
 rows=workbook['Operating'][3:]
 for row in rows:
  if not row.get('C','').isdigit(): continue
  if row.get('W')!='(OP) Operating': excluded['nonOperatingGenerators']+=1; continue
  if row['G'] in ('AK','HI','PR'): excluded['outsideLower48Generators']+=1; continue
  try: lat,lon,capacity=map(float,(row['AJ'],row['AK'],row['M']))
  except (ValueError,KeyError): excluded['invalidLocationOrCapacityGenerators']+=1; continue
  if not all(map(math.isfinite,[lat,lon,capacity])) or not (24<=lat<=50 and -125<=lon<=-66) or capacity<0:
   excluded['invalidLocationOrCapacityGenerators']+=1; continue
  key=(row['C'],row['K']); assert key not in seen,key; seen.add(key)
  ba=row['I']; ref=bas.get(ba,{})
  # Retired/unknown authorities are not silently assigned to a present-day successor.
  region=ref.get('D') if ref.get('D') in REGIONS and ref.get('I')=='Yes' else None
  if region is None: unmatched[ba or '(missing)']+=1
  plant=plants.setdefault(row['C'],dict(id=row['C'],name=row['D'],state=row['G'],county=row['H'],lat=lat,lon=lon,segments={}))
  assert abs(plant['lat']-lat)<0.01 and abs(plant['lon']-lon)<0.01,key
  segment=plant['segments'].setdefault((region,ba,fuel(row)),dict(region=region,ba=ba,fuel=fuel(row),mw=0,generators=0))
  segment['mw']+=capacity;segment['generators']+=1
 for plant in plants.values():
  plant['segments']=list(plant['segments'].values())
  for segment in plant['segments']: segment['mw']=round(segment['mw'],3)
 data=dict(snapshot='2026-09',source='https://www.eia.gov/electricity/data/eia860m/',reference='https://www.eia.gov/electricity/930-content/EIA930_Reference_Tables.xlsx',
  hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [inventory,reference]},excluded=dict(excluded),unmatchedAuthorities=dict(unmatched),
  plants=sorted(plants.values(),key=lambda p:int(p['id'])))
 OUT.write_text(json.dumps(data,separators=(',',':'))+'\n')
 print('Plants:',len(plants),'generators:',len(seen),'excluded:',dict(excluded),'unmatched:',dict(unmatched))
if __name__=='__main__': main()
