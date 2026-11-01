import json,re,collections,statistics,datetime as dt
import sys
d=json.load(open(sys.argv[1] if len(sys.argv)>1 else 'travaux-full.json')); J=[j for j in d['journals'] if not j.get('annule') and not str(j.get('etat') or '').startswith('Annul')]
print('journaux',len(d['journals']),'sans annulés',len(J))
import os
NOTES=json.load(open('travaux-notes.json')) if os.path.exists('travaux-notes.json') else {}
def fixpdf(t):
    L=[l for l in str(t or '').split('\n') if not re.match(r"\s*(Utilisateur:.*Imprimé le|Tridel SA\s*$|RAPPORT D'ACTIVITE\s*$)",l)]
    out=[]
    for l in L:
        if out and out[-1].endswith(' '): out[-1]=out[-1].rstrip()+' '+l.strip()
        else: out.append(l)
    t='\n'.join(x.rstrip() for x in out)
    t=re.sub(r'[ \t]+([,.;:!?])(?=\s|$)',r'\1',t); t=re.sub(r'(\w)- (\w)',r'\1-\2',t)
    return re.sub(r'[ \t]{2,}',' ',t).strip()
for j in J:
    n=NOTES.get(str(j['id']))
    if not n: continue
    note=n.get('notice') or ''
    cut=re.search(r"\n(Prestations de tiers|Type de ressources|Ressources humaines|Documentation)\n",'\n'+note)
    presta=note[cut.start():] if cut else ''
    note=note[:cut.start()-1] if cut else note
    if not (j.get('cr') or '').strip() and note.strip(): j['cr']=fixpdf(note)
    if presta: j['presta']=presta
    raw=[re.sub(r'\s*Utilisateur:.*$','',m) for m in (n.get('mat') or []) if m.strip() and not re.match(r"\s*(Utilisateur:|Tridel SA|RAPPORT D'ACTIVITE|Matériel$|Article$|Quantité$|Prix |Date$)",m)]
    raw=[m for m in raw if m.strip()]; qty=[q.replace(',00','').replace(',',',') for q in (n.get('qty') or [])]
    items=[]
    for m in raw:
        if items and (re.match(r'^[a-zà-ÿ°()\-/,.]',m) or len(items)>=len(qty) and qty): items[-1]+=' '+m
        else: items.append(m)
    if items: j['mat']=[(qty[i]+' × ' if i<len(qty) and len(items)==len(qty) else '')+x for i,x in enumerate(items)]
for j in J:
    if isinstance(j.get('man'),dict): j['man']=j['man'].get('id')
    if str(j.get('type') or '').startswith('{'): j['type']=''
clean=lambda s: re.sub(r'\n{3,}','\n\n',re.sub(r'[ \t]+\n','\n',str(s or '').replace('\r',''))).strip()
ST={'Bouclé financièrement':'terminee','Bouclé techniquement':'terminee','Terminé':'terminee','Bouclé et facturé':'terminee','Annoncé':'ouverte','Planifié':'ouverte','Libéré':'ouverte','En attente':'ouverte','En exécution':'encours','Interrompu':'encours'}
day=lambda s: (s or '')[:10]
byman=collections.defaultdict(list)
for j in J:
    if j['man']: byman[j['man']].append(j)
rec_man={m:v for m,v in byman.items() if len(v)>=2}
STD=[1,2,3,4,6,12,24,36,48,60]
def hint(t):
    t=t.lower()
    for k,f in [('semestriel',{'n':6,'unite':'mois'}),('trimestriel',{'n':3,'unite':'mois'}),('mensuel',{'n':1,'unite':'mois'}),('annuel',{'n':1,'unite':'an'})]:
        if k in t: return f
def freq(dates):
    ds=sorted(dt.date.fromisoformat(x) for x in set(dates))
    if len(ds)<2: return {'n':1,'unite':'an'}
    gaps=[(b-a).days for a,b in zip(ds,ds[1:]) if (b-a).days>20]
    if not gaps: return {'n':1,'unite':'an'}
    g=statistics.median(gaps)/30.4; m=min(STD,key=lambda x:(abs(x-g),-x))
    return {'n':m//12,'unite':'an'} if m>=12 else {'n':m,'unite':'mois'}
def addm(iso,f):
    y,mo,da=map(int,iso.split('-')); n=f['n']*(12 if f['unite']=='an' else 1); mo+=n; y+=(mo-1)//12; mo=(mo-1)%12+1
    return f"{y:04d}-{mo:02d}-{min(da,28):02d}"
today=dt.date.today().isoformat()
taches=[]; rapports=[]
for m,v in rec_man.items():
    done=[j for j in v if ST.get(j['etat'])=='terminee']; todo=[j for j in v if ST.get(j['etat'])!='terminee']
    ref=max(v,key=lambda j:j['id'])
    f=hint(ref['des']) or freq([day(j['d1']) for j in done] or [day(j['d1']) for j in v])
    if todo: nxt=min(day(j['d1']) for j in todo)
    else:
        nxt=addm(max(day(j['d1']) for j in done),f)
        while nxt<today: nxt=addm(nxt,f)
    taches.append({'key':f'M{m}','titre':clean(ref['des']).split('\n')[0],'description':clean(ref['met']),'kks':ref['kks'],'obj':ref['obj'],'inter':ref['inter'],'freq':f,'prochaine':nxt,'derniere':max((day(j['d1']) for j in done),default=''),**({} if todo else {'arch':True})})
    for j in todo: j['_skip']=True
    for j in done: j['_tache']=f'M{m}'
for j in J:
    if j.get('_skip'): continue
    st=ST.get(j['etat'],'terminee')
    if st!='terminee' and not j.get('_tache'):
        # travail pas encore fait : tâche ponctuelle
        desc='\n\n'.join(x for x in [clean(j['met']), clean(j['cr'])] if x)
        taches.append({'key':f'J{j["id"]}','titre':clean(j['des']).split('\n')[0],'description':desc,'kks':j['kks'],'obj':j['obj'],'inter':j['inter'],'freq':{'n':1,'unite':'once'},'prochaine':day(j['d1']) or today,'derniere':'','statutCO':j['etat'],'dem':j['dem']})
        continue
    titre=clean(j['des']); first=titre.split('\n')[0]; rest='\n'.join(titre.split('\n')[1:]).strip()
    constat='\n'.join(x for x in [f"Demande de {j['dem']}" if j['dem'] else '', rest, clean(j['met'])] if x)
    rapports.append({'num':f"CO-{j['id']}",'date':day(j['d1']) or '2000-01-01','type':j['type'] if j['type'] and j['type']!='Aucun' else '','statut':'terminee','titre':first or '(sans titre)','kks':j['kks'],'obj':j['obj'],'constat':constat,'travaux':'\n\n'.join(x for x in [clean(j['cr']), ('Matériel utilisé :\n'+'\n'.join('· '+m for m in j['mat'])) if j.get('mat') else ''] if x),'duree':j['h'] or '','inter':j['inter'],'tache':j.get('_tache')})
out={'source':'CareOffice','exported':d['exported'],'taches':taches,'rapports':rapports}
json.dump(out,open('travaux-triflow.json','w'),ensure_ascii=False)
print('taches',len(taches),'recurrentes',sum(1 for t in taches if t['freq']['unite']!='once'),'rapports',len(rapports))
for t in taches[:12]: print(t['key'],t['freq'],t['prochaine'],t['titre'][:50],t['kks'],t['inter'][:1])
