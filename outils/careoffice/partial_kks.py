import json,re,collections,sys
d=json.load(open('pieces-triflow.json')); P=d['pieces']
kks={}
for line in open('/mnt/user-data/uploads/Downloads/kks-careoffice.txt',encoding='utf-8-sig'):
    if re.match(r'^\W*#',line) or not line.strip(): continue
    parts=re.split(r'[\t;]',line.strip()); kks[re.sub(r'\s+','',parts[0]).upper()]=parts[1] if len(parts)>1 else ''
BASE=set('ABCEGHLMNPQSUZ')
RX=re.compile(r'(?<![A-Z0-9])((?:[0-2]\s*(?:/|\+|ET|,|-)\s*)*[0-2])\s?([A-Z]{3})\s?(\d{2})(?!\s?[A-Z]{2}\s?\d{3})(?![0-9])')
part=collections.Counter(); exist=collections.Counter(); per={}
for p in P:
    txt=' '.join(str(p.get(k) or '') for k in ('designation','notes','refFab')).upper()
    cs=set()
    for m in RX.finditer(txt):
        if m.group(2)[0] not in BASE: continue
        for u in re.findall(r'[0-2]',m.group(1)):
            c=u+m.group(2)+m.group(3); cs.add(c)
    for c in cs:
        part[c]+=1
        if c in kks: exist[c]+=1
    if cs: per[p['ref']]=sorted(cs)
print('pieces avec code partiel',len(per),'codes distincts',len(part),'existent dans KKS',len(exist),'liens possibles',sum(exist.values()))
miss=[c for c in part if c not in kks]; print('absents',len(miss),miss[:30])
print([(r,c) for r,c in list(per.items())[:10]])
print({c:kks[c] for c in list(exist)[:10]})
