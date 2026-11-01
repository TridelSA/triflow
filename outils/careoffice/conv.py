import json,re,collections
d=json.load(open('/mnt/user-data/uploads/Downloads/articles-careoffice.json'))
loc={l['id']:l for l in d['loc']}
def nm(i):
    l=loc[i]; des=l['des']
    if des in (None,'','null'): des=str(l['nin'] or '')
    return des.replace('/','-').strip()
def code(lid):
    ids=[int(i) for i in loc[lid]['path'].split('/')[1:] if int(i) in loc]
    parts=[nm(i) for i in ids]
    if not parts: return None
    if len(parts)>=2 and re.fullmatch(r'[A-Z]\d',parts[0]):
        m=re.match(r'^(\d+)\b\s*(.*)$',parts[1])
        num=m.group(1) if m else (str(loc[ids[1]]['nin']) if re.fullmatch(r'\d+',str(loc[ids[1]]['nin'] or '')) else None)
        if num: return ' / '.join([f"{parts[0]}.{num}"]+parts[2:])
    return ' / '.join(parts)
norm=lambda s: re.sub(r'\s*/\s*',' / ',re.sub(r'\s+',' ',s.strip().lower()))
fl=[l.split(';')[0] for l in open('/home/claude/gmao/emplacements-careoffice.txt',encoding='utf-8').read().splitlines() if l.strip()]
fset={norm(x):x for x in fl}
locals_={norm(x.split(' / ')[0]) for x in fl}
K={}
for l in open('/mnt/user-data/uploads/Downloads/kks-careoffice.txt',encoding='utf-8-sig').read().splitlines():
    c=l.split(';')[0]
    if l.startswith('#') or re.fullmatch(r'[A-Z]{1,3}',c): continue
    K[c.replace(' ','').upper()]=c
RX=re.compile(r'(?<![A-Z0-9])((?:[0-2]\s*(?:/|\+|et|,|-)\s*)*[0-2])?\s?([A-Z]{3})\s?(\d{2})\s?([A-Z]{2})\s?(\d{3})(?![0-9])')
def find_kks(text):
    out=[]
    if not text: return out
    t=text.upper()
    for m in RX.finditer(t):
        units=re.findall(r'[0-2]',m.group(1) or '')
        base=m.group(2)+m.group(3)+m.group(4)+m.group(5)
        cands=[u+base for u in units] if units else [u+base for u in '012']
        for c in cands:
            if c in K and K[c] not in out: out.append(K[c])
    return out
