#!/usr/bin/env python3
"""
scripts/extract_horas.py — Extrae datos de Horas.xlsx a js/horas-data.js

Uso:
    python3 scripts/extract_horas.py [ruta_al_xlsx]

Si no se especifica ruta, busca Horas.xlsx en el directorio del proyecto.
"""
import sys, os, json, zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

NS = {'ss': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
DAYS_ES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
MONTHS_N = ['AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE','ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO']

def find_xlsx():
    base = Path(__file__).parent.parent
    for p in [base/'Horas.xlsx', Path.home()/'proyectos'/'reporte'/'Horas.xlsx']:
        if p.exists(): return p
    raise FileNotFoundError('No se encontró Horas.xlsx. Usa: python3 scripts/extract_horas.py /ruta/Horas.xlsx')

def cell_val(cell, strings):
    t = cell.get('t',''); v = cell.find('ss:v', NS)
    if v is not None and v.text is not None:
        if t == 's': return strings[int(v.text)]
        if t == 'b': return 'TRUE' if v.text=='1' else 'FALSE'
        val = v.text.strip()
        try:
            f = float(val)
            return str(int(f)) if f==int(f) else str(round(f,2))
        except: return val
    return ''

def is_day(val): return any(val.startswith(d+' ') for d in DAYS_ES)
def day_num(d):
    for p in d['day'].split(' '):
        if p.isdigit(): return int(p)
    return 999

def parse(path):
    with zipfile.ZipFile(path,'r') as z:
        ss = ET.fromstring(z.read('xl/sharedStrings.xml'))
        strings = [''.join(p.text or '' for p in si.findall('.//ss:t',NS)) for si in ss.findall('.//ss:si',NS)]

        wb = ET.fromstring(z.read('xl/workbook.xml'))
        rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        rmap = {r.get('Id'):r.get('Target') for r in rels.findall('.//{http://schemas.openxmlformats.org/package/2006/relationships}Relationship')}

        all_data = {}
        for sheet in wb.findall('.//ss:sheet', NS):
            name = sheet.get('name')
            if name=='PLANTILLA': continue
            rid = sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            target = rmap.get(rid,'')
            if not target: continue
            fp = f'xl/{target}' if not target.startswith('xl/') else target
            try: sx = ET.fromstring(z.read(fp))
            except: continue

            rows = {}
            for row in sx.findall('.//ss:row',NS):
                rn = int(row.get('r',0))
                rc = {(''.join(c for c in cell.get('r','') if c.isalpha())): cell_val(cell, strings) for cell in row.findall('ss:c',NS)}
                rc = {k:v for k,v in rc.items() if v}
                if rc: rows[rn] = rc

            tasks = []
            for rnum in range(2,9):
                row=rows.get(rnum,{}); task=row.get('B','').strip()
                if not task or any(task==m or task.startswith(m) for m in ['Tareas']+MONTHS_N): continue
                he=row.get('C','').strip()
                if he: tasks.append({'task':task,'horas_emp':he,'horas_est':row.get('D','').strip(),'horas_dif':row.get('E','').strip()})

            days=[]; cur={'left':None,'right':None}
            def finish(s):
                if cur[s]:
                    d=cur[s]
                    if d['day'] and d['day']!='-': days.append({'day':d['day'],'entries':d['entries'],'total':d['total']})
                    cur[s]=None

            for rnum in sorted(rows.keys()):
                if rnum<9: continue
                row=rows[rnum]
                b=row.get('B','').strip(); c=row.get('C','').strip(); d=row.get('D','').strip(); e=row.get('E','').strip()
                g=row.get('G','').strip(); h=row.get('H','').strip(); ii=row.get('I','').strip(); j=row.get('J','').strip()
                if is_day(b):
                    finish('left'); cur['left']={'day':b,'entries':[],'total':''}
                    if is_day(g): finish('right'); cur['right']={'day':g,'entries':[],'total':''}
                elif b=='Horas totales':
                    if cur['left']: cur['left']['total']=c; finish('left')
                    if g=='Horas totales' and cur['right']: cur['right']['total']=h; finish('right')
                else:
                    if cur['left'] and b and b!='-' and c and c!='-': cur['left']['entries'].append({'task':b,'horas':c,'horario':d,'nota':e})
                    if cur['right'] and g and g!='-' and h and h!='-': cur['right']['entries'].append({'task':g,'horas':h,'horario':ii,'nota':j})

            finish('left'); finish('right')
            days.sort(key=day_num)
            th = sum(float(e['horas']) for day in days for e in day['entries'] if e['horas'].replace('.','',1).lstrip('-').isdigit())
            print(f'  ✅ {name}: {len(tasks)} tareas, {len(days)} días, ~{th:.1f}h')
            all_data[name] = {'tasks':tasks,'days':days}
    return all_data

def main():
    xlsx = Path(sys.argv[1]) if len(sys.argv)>1 else find_xlsx()
    print(f'📖 Leyendo: {xlsx}')
    data = parse(xlsx)
    out = Path(__file__).parent.parent / 'js' / 'horas-data.js'
    js = f"// AUTO-GENERATED — NO EDITAR MANUALMENTE\n// Regenerar: python3 scripts/extract_horas.py\n// Fuente: {xlsx.name}\n'use strict';\nconst HORAS_DATA = {json.dumps(data, ensure_ascii=False, indent=2)};\n"
    out.write_text(js, encoding='utf-8')
    print(f'✅ Generado: {out}')
    print(f'   Meses: {list(data.keys())}')

if __name__=='__main__':
    main()
