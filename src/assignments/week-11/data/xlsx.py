import zipfile,xml.etree.ElementTree as E,posixpath
N={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
def sheets(path):
 with zipfile.ZipFile(path) as z:
  strings=[''.join(e.itertext()) for e in E.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',N)] if 'xl/sharedStrings.xml' in z.namelist() else []
  rel={e.get('Id'):e.get('Target') for e in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
  result={}
  for sheet in E.fromstring(z.read('xl/workbook.xml')).findall('s:sheets/s:sheet',N):
   target=rel[sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')]
   target=target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/'+target)
   rows=[]
   for row in E.fromstring(z.read(target)).findall('s:sheetData/s:row',N):
    cells={}
    for c in row:
     v=c.findtext('s:v','',N)
     if c.get('t')=='s': v=strings[int(v)] if v else ''
     if c.get('t')=='inlineStr': v=''.join(c.find('s:is',N).itertext())
     cells[''.join(filter(str.isalpha,c.get('r')))]=v
    rows.append(cells)
   result[sheet.get('name')]=rows
  return result
if __name__=='__main__':
 import sys
 for name,rows in sheets(sys.argv[1]).items(): print(name,len(rows),rows[:3])
