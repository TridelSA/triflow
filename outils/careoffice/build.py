exec(open('/home/claude/gmao/import/conv.py').read())
stocks=collections.defaultdict(list)
for s in d['st']:
    if s['app'] and s['loc'] in loc: stocks[s['app']].append(s)
UNIT={'pièce':'pce','p':'pce','piece':'pce','1 pièce':'pce','1':'pce','unité':'pce','pce':'pce','pcs':'pce','set':'jeu','set de 2':'jeu','jeu':'jeu','m':'m','kg':'kg','l':'l','litre':'l','rouleau':'rouleau','boîte':'boîte'}
clean=lambda x: re.sub(r'[ \t]+',' ',str(x).replace('\r','')).strip() if x not in (None,'') else ''
pieces=[]; newk={}; nostock=0
for a in sorted(d['art'],key=lambda a:a['id']):
    des=' '.join(x for x in [clean(a['d1']),clean(a['d2'])] if x) or f"Article {a['id']}"
    four=[f for f in a['four'] if f.get('nom')]
    main=four[0] if four else None
    u=clean(a['unit']).lower(); unite=UNIT.get(u, u or 'pce')
    txt=' | '.join(str(x) for x in [a['d1'],a['d2'],a['dl'],a['sap'],a['nfa'],a['rem'],*a['re']] if x)
    ks=find_kks(txt)
    for m in RX.finditer(txt.upper()):
        units=re.findall(r'[0-2]',m.group(1) or ''); base=m.group(2)+m.group(3)+m.group(4)+m.group(5)
        if units and not any(u+base in K for u in units):
            for u in units:
                c=u+base; newk.setdefault(c,des); ks.append(c)
    linked={k.replace(' ','') for k in ks}
    def strip(v):
        v=clean(v)
        if not v: return ''
        def sub(m):
            units=re.findall(r'[0-2]',m.group(1) or ''); base=m.group(2)+m.group(3)+m.group(4)+m.group(5)
            cands=[u+base for u in (units or '012')]
            return ' ' if any(c in linked for c in cands) else m.group(0)
        out=RX.sub(sub, v.upper()) if RX.search(v.upper()) else None
        if out is None: return v
        # rebuild keeping original case outside removed spans
        res=[]; last=0; vu=v.upper()
        for m in RX.finditer(vu):
            units=re.findall(r'[0-2]',m.group(1) or ''); base=m.group(2)+m.group(3)+m.group(4)+m.group(5)
            if any(c in linked for c in [u+base for u in (units or '012')]):
                res.append(v[last:m.start()]); last=m.end()
        res.append(v[last:]); r=''.join(res)
        r=re.sub(r'(-[A-Z0-9]+)(?=\s|$)','',r) if not re.search(r'[a-zA-Z]{3,}',re.sub(r'-[A-Z0-9]+','',r)) else r
        return '' if re.fullmatch(r'[\s/,;+\-|.()]*(et)?[\s/,;+\-|.()]*',r,re.I) else re.sub(r'\s{2,}',' ',r).strip(' /,;+|')
    notes=[]
    if strip(a['dl']): notes.append('Application : '+strip(a['dl']))
    if strip(a['sap']) and clean(a['sap'])!=clean(a['dl']): notes.append('Désignation libre : '+strip(a['sap']))
    if strip(a['nfa']): notes.append('N° / repère : '+strip(a['nfa']))
    for i,r in enumerate(a['re']):
        if strip(r) and not re.fullmatch(r'\d',strip(r)): notes.append(f'Attribut {i+1} : '+strip(r))
    for f in four[1:]: notes.append(f"Autre fournisseur : {f['nom']}"+(f" (réf. {clean(f['ref'])})" if clean(f.get('ref')) else ''))
    if strip(a['rem']): notes.append('Remarques : '+strip(a['rem']))
    st=[]
    for s in stocks.get(a['id'],[]):
        c=code(s['loc'])
        if c: st.append({'lieu':c,'qte':s['q'] or 0})
    if not st: nostock+=1
    pieces.append({'ref':str(a['id']),'designation':des,'fabricant':main['nom'] if main else '','fournisseur':main['nom'] if main else '',
        'refFab':clean(a['nin']) or (clean(main.get('ref')) if main else ''),'unite':unite,'stockMin':a['qmi'] or 0,'notes':'\n'.join(notes),'kks':list(dict.fromkeys(ks)),'stock':st})
H=json.load(open('/mnt/user-data/uploads/Downloads/historique-careoffice.json'))
LAB={6:'Virement d’emplacement',8:'Sortie aux déchets',11:'Sortie sur rapport d’activité',13:'Sortie sur rapport planifié',14:'Sortie non planifiée',15:'Entrée de marchandise',40:'Inventaire (quantité comptée)',41:'Perte sur inventaire',42:'Plus-value sur inventaire'}
def pcode(path):
    parts=[x.strip().replace('/','-') for x in str(path or '').split('/')]
    if parts and parts[0]=='Tridel': parts=parts[1:]
    parts=[x for x in parts if x]
    if len(parts)>=2 and re.fullmatch(r'[A-Z]\d',parts[0]):
        m=re.match(r'^(\d+)\b',parts[1])
        if m: return ' / '.join([f"{parts[0]}.{m.group(1)}"]+parts[2:])
    return ' / '.join(parts)
histo=collections.defaultdict(list); skipped=0
for h in H:
    if h['an'] or h['ty'] not in LAB or not h['a']: skipped+=1; continue
    q=h['q'] or 0; ty=h['ty']
    if ty in (8,11,13,14,15,41): q=-q
    neutral = ty in (6,40)
    line={'d':h['d'].replace(' ','T'),'q':abs(q) if neutral else q,'t':LAB[ty],'lieu':pcode(h['l'])}
    if neutral: line['n']=1
    if h['who']: line['w']=h['who']
    if h['des']: line['t']+=' · '+clean(h['des'])
    histo[str(h['a'])].append(line)
refs={p['ref'] for p in pieces}
histo={k:sorted(v,key=lambda x:x['d'],reverse=True) for k,v in histo.items() if k in refs}
print('histo pieces',len(histo),'lines',sum(map(len,histo.values())),'skipped',skipped)
out={'source':'CareOffice','exported':d['exported'],'pieces':pieces,'newKks':[{'code':c,'designation':f'(repris des articles) {v}'} for c,v in newk.items()],'histo':histo}
json.dump(out,open('/home/claude/gmao/import/pieces-triflow.json','w'),ensure_ascii=False)
print(len(pieces),'nostock',nostock,'withkks',sum(1 for p in pieces if p['kks']),'newkks',len(newk))
print(collections.Counter(p['unite'] for p in pieces).most_common(12))
print(json.dumps(next(p for p in pieces if p['ref']=='8176'),ensure_ascii=False,indent=1))
