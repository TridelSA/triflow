import json,re,unicodedata,collections
F=json.load(open('fournisseurs-careoffice.json'))['fournisseurs']
P=json.load(open('pieces-triflow.json'))['pieces']
def nz(s): return unicodedata.normalize('NFD',s).encode('ascii','ignore').decode().lower()
SUF=r'\b(ag|sa|gmbh|s\.?r\.?l\.?|sarl|ltd|inc|co|kg|sas|bv|spa|ab|oy)\b\.?'
def core(n):
    c=re.sub(SUF,'',nz(n)); c=re.sub(r'[^a-z0-9&+ -]',' ',c); return re.sub(r'\s+',' ',c).strip()
long={}; acro={}
for n in F:
    c=core(n)
    if len(c)>=4: long.setdefault(c,n)
    else:
        a=re.sub(SUF,'',n,flags=re.I).strip()
        if re.fullmatch(r'[A-Z0-9&]{2,4}',a): acro.setdefault(a,n)
RL=re.compile(r'(?<![a-z0-9])('+'|'.join(sorted(map(re.escape,long),key=len,reverse=True))+r')(?![a-z0-9])')
RA=re.compile(r'(?<![A-Za-z0-9])('+'|'.join(sorted(map(re.escape,acro),key=len,reverse=True))+r')(?![A-Za-z0-9])')
cnt=collections.Counter(); npieces=0; ex=collections.defaultdict(list)
for p in P:
    raw=' '.join([p['notes'],p['designation']]); txt=nz(raw)
    found={long[m] for m in RL.findall(txt)}|{acro[m] for m in RA.findall(raw)}
    if found: npieces+=1
    for n in found: cnt[n]+=1; ex[n].append(raw[:70].replace('\n',' '))
print('pieces with match',npieces,'suppliers matched',len(cnt)); print(cnt.most_common(50))
print('acros',list(acro))
for n,_ in cnt.most_common(50)[:25]: print(n,'|',ex[n][0])
