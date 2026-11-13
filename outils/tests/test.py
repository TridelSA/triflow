#!/usr/bin/env python3
"""
Tests automatiques de TriFlow (navigateur réel, fausse base, données inventées).

    pip install playwright && playwright install chromium   # une seule fois
    python3 outils/tests/test.py            # depuis la racine du dépôt
    python3 outils/tests/test.py --captures # garde aussi des captures dans outils/tests/captures/

Le script lance un petit serveur local, ouvre index.html avec une fausse base Supabase
(supabase-factice.js) et un faux Planning Tridel (personnes inventées), crée quelques fiches,
fait le tour des pages sur ordinateur et sur téléphone, vérifie quelques parcours
et s'arrête en erreur à la moindre erreur JavaScript.
"""
import asyncio, datetime, functools, http.server, json, os, sys, threading

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ICI = os.path.dirname(os.path.abspath(__file__))
CAPTURES = '--captures' in sys.argv
REFERENCE = '--reference' in sys.argv          # enregistre les captures actuelles comme nouvelle référence
STRICT = '--strict' in sys.argv                # échoue si une capture a changé par rapport à la référence
if REFERENCE: CAPTURES = True
REF_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reference')
# Date et heure figées (le temps avance mille fois moins vite) : les captures sont comparables d'un jour à l'autre
HEURE_FIXE = '2026-11-04T09:30:00'
PORT = 8799

def serveur():
    class Muet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Muet, directory=RACINE)
    s = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s

def faux_planning(annee):
    """Planning Tridel inventé : quelques personnes par groupe, codes sur toute l'année."""
    groupes = {'Électricien': ['ALPHA', 'BRAVO'], 'Automaticien': ['CHARLIE'], 'Mécanicien': ['DELTA', 'ECHO', 'FOXTROT'],
               'Intendance': ['GOLF', 'HOTEL'], 'Chauffeurs-grutiers': ['INDIA'], 'Cadres': ['JULIETT', 'TESTEUR']}
    d0 = datetime.date(annee, 1, 1); jours = [(d0 + datetime.timedelta(i)) for i in range(366) if (d0 + datetime.timedelta(i)).year == annee]
    emp = []
    for g, noms in groupes.items():
        for i, n in enumerate(noms):
            pl = {}
            for d in jours:
                if d.weekday() >= 5: continue
                code = 'R'
                if n == 'ECHO': code = 'VA'                       # en vacances toute l'année : masqué du planning
                elif n == 'BRAVO' and d.weekday() == 2: code = 'MC'
                elif n == 'DELTA' and d.weekday() < 2: code = 'RM'
                pl[d.isoformat()] = code
            emp.append({'nom': n, 'categorie': g, 'planning': pl, 'commentaires': {}})
    return json.dumps({'annee': annee, 'employes': emp})

async def main():
    from playwright.async_api import async_playwright
    srv = serveur()
    factice = open(os.path.join(ICI, 'supabase-factice.js'), encoding='utf-8').read()
    erreurs, echecs = [], []
    if CAPTURES: os.makedirs(os.path.join(ICI, 'captures'), exist_ok=True)
    def ok(cond, msg):
        print(('  ✓ ' if cond else '  ✗ ') + msg)
        if not cond: echecs.append(msg)
    async with async_playwright() as p:
        b = await p.chromium.launch(**({"executable_path": "/opt/pw-browsers/chromium"} if os.path.isfile("/opt/pw-browsers/chromium") else {}))
        pg = await b.new_page(viewport={'width': 1300, 'height': 820})
        pg.on('pageerror', lambda e: erreurs.append(str(e)))
        await pg.add_init_script(f"""(() => {{ const R = Date, base = new R('{HEURE_FIXE}').getTime(), t0 = R.now();
          class D extends R {{ constructor(...a) {{ super(...(a.length ? a : [base + Math.floor((R.now() - t0) / 1000)])); }} static now() {{ return base + Math.floor((R.now() - t0) / 1000); }} }}
          window.Date = D; }})()""")
        await pg.route('**/supabase.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=factice))
        await pg.route('**/planning/planning-*.json', lambda r: r.fulfill(status=200, content_type='application/json', body=faux_planning(int(r.request.url.split('planning-')[1][:4]))))
        await pg.route('**/jsQR*', lambda r: r.fulfill(status=200, content_type='application/javascript', body='window.jsQR=()=>null;'))
        async def capture(nom):
            if CAPTURES: await pg.screenshot(path=os.path.join(ICI, 'captures', nom + '.png'))
        async def aller(js, nom, attente=600):
            await pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close())")
            await pg.evaluate(js); await pg.wait_for_timeout(attente); await capture(nom)

        print('Connexion')
        await pg.goto(f'http://127.0.0.1:{PORT}/'); await pg.wait_for_timeout(400)
        await pg.evaluate("localStorage.clear(); localStorage.setItem('tf-welcome', '1')"); await pg.reload(); await pg.wait_for_timeout(500)
        # Créer mon compte : réservé à @tridelsa.ch ; mot de passe oublié
        await pg.click('#gate [data-mode=signup]'); await pg.fill('#login input[name=email]', 'pirate@gmail.com'); await pg.fill('#login input[name=pw]', 'motdepasse123'); await pg.click('#login button'); await pg.wait_for_timeout(200)
        ok(await pg.evaluate("/réservé aux adresses @tridelsa/.test($('#gate .dlg-err').textContent) && !(__srv.mails || []).length"), 'inscription : adresse hors @tridelsa.ch refusée')
        await pg.fill('#login input[name=email]', 'jean.dupont@tridelsa.ch'); await pg.fill('#login input[name=pw]', 'motdepasse123'); await pg.click('#login button'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("__srv.mails?.[0]?.[0] === 'signup' && !!$('#gate .gate-ok')"), 'inscription : e-mail d’activation envoyé')
        await pg.click('#gate [data-mode=forgot]'); await pg.fill('#login input[name=email]', 'jean.dupont@tridelsa.ch'); await pg.click('#login button'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("__srv.mails?.[1]?.[0] === 'reset' && !!$('#gate .gate-ok')"), 'mot de passe oublié : lien envoyé')
        await capture('connexion')
        # Adresse sans accès (hors @tridelsa.ch, non confirmée) : refusée, déconnectée
        await pg.evaluate("window.__noAccess = true")
        await pg.fill('#login input[name=email]', 'test.testeur@exemple.ch'); await pg.fill('#login input[name=pw]', 'secret'); await pg.click('#login button'); await pg.wait_for_timeout(1200)
        ok(await pg.evaluate("!CLOUD.user && /pas accès/.test($('#gate .dlg-err').textContent)"), 'adresse sans accès : refusée')
        await pg.evaluate("window.__noAccess = false")
        await pg.fill('#login input[name=email]', 'test.testeur@exemple.ch'); await pg.fill('#login input[name=pw]', 'secret'); await pg.click('#login button')
        await pg.wait_for_timeout(2000)
        ok(await pg.evaluate("!!CLOUD.user"), 'connecté à la fausse base')
        ok(await pg.evaluate("db.personnes.length > 5"), 'personnel repris du faux Planning Tridel')
        ok(await pg.evaluate("personFromEmail('test.testeur@exemple.ch')?.nom === 'TESTEUR'"), 'personne reconnue par son e-mail')
        ok(await pg.evaluate("canDel()"), 'un cadre peut supprimer définitivement')
        ok(await pg.evaluate("(window.__cadre = false, CLOUD.cadre = false, !canDel())"), 'la liste des cadres de la base fait foi')
        await pg.evaluate("delete window.__cadre; delete CLOUD.cadre")
        await pg.evaluate("passwordDialog()"); await pg.fill('dialog[open] input[name=pw]', 'nouveau-mdp-1'); await pg.fill('dialog[open] input[name=pw2]', 'nouveau-mdp-1'); await pg.click('dialog[open] button[type=submit]'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("__srv.newPw === 'nouveau-mdp-1' && !document.querySelector('dialog[open]')"), 'changer mon mot de passe')

        print('Données de test')
        await pg.evaluate("""tx(() => {
          db.salles.push({id:'s1', code:'E9.99', nom:'Magasin test'}); db.lieux.push({id:'l1', salleId:'s1', code:'A / 1 / 2'});
          db.kks.push({id:'k1', code:'0ABC10AA001', designation:'Pompe de test'});
          db.pieces.push({id:'p1', ref:'90001', designation:'Contacteur 24V', fabricant:'Marque', unite:'pce', stockMin:2, notes:'', kks:['k1'], stock:[{lieuId:'l1', qte:5}]});
          db.taches.push({id:'t1', titre:'Graissage des paliers', kksId:'k1', assign:{type:'groupe', v:'Mécanicien'}, freq:{n:1, unite:'mois'}, prochaine:isoAdd(todayISO(), -3), actif:true, kind:'rec'});
          db.taches.push({id:'t2', titre:'Changer le néon', kksId:'', assign:{type:'groupe', v:'Électricien'}, freq:{n:1, unite:'once'}, prochaine:'', actif:true, kind:'petit', prio:'haute'});
          db.interventions.push({id:'i1', num:nextNum(todayISO()), date:todayISO(), type:'', statut:'terminee', titre:'Remplacement joint', kksId:'k1', constat:'', travaux:'Joint remplacé', duree:'', intervenants:[], pieces:[]});
        })""")
        await pg.wait_for_timeout(800)
        await pg.evaluate("tx(() => addStock(getPiece('p1'), 'l1', -2, 'Sortie test', ''))"); await pg.wait_for_timeout(800)
        ok(await pg.evaluate("getPiece('p1').stock[0].qte === 3"), 'sortie de stock')
        rows = await pg.evaluate("JRN.query({}).then(r => r.map(e => e.txt))")
        ok(any('a sorti 2' in t for t in rows), 'sortie notée dans l’historique')

        await pg.evaluate("quickMove(getPiece('p1'))"); await pg.wait_for_timeout(250)
        await pg.select_option('dialog[open] select[name=rap]', 'i1'); await pg.click('dialog[open] button.qm-out'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("getPiece('p1').stock[0].qte === 2 && getInt('i1').pieces.some(x => x.pieceId === 'p1' && x.qte === 1)"), 'sortie rapide liée au rapport (pièces consommées)')
        await pg.evaluate("quickMove(getPiece('p1'))"); await pg.wait_for_timeout(250)
        await pg.click('dialog[open] .qm-step [data-q=\"1\"]'); await pg.click('dialog[open] button.qm-in'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("getPiece('p1').stock[0].qte === 4"), 'entrée rapide avec le bouton +')
        await pg.evaluate("__srv.offline = true; tx(() => { getPiece('p1').notes = 'hors ligne'; })"); await pg.wait_for_timeout(700)
        ok(await pg.evaluate("CLOUD.state === 'offline' && IDB.get(CLOUD.pendKey()).then(x => !!x?.db)"), 'hors ligne : modification gardée sur l’appareil')
        await pg.evaluate("__srv.offline = false; dispatchEvent(new Event('online'))"); await pg.wait_for_timeout(900)
        ok(await pg.evaluate("CLOUD.state === 'ok' && [...__srv.rows.values()].some(r => r.data?.notes === 'hors ligne')"), 'retour du réseau : modification envoyée')
        await pg.evaluate("""(async () => { const c = document.createElement('canvas'); c.width = 20; c.height = 20; const b = await new Promise(ok => c.toBlob(ok, 'image/png'));
          const ph = await photoUpload(new File([b], 'x.png', {type:'image/png'}), 'pieces'); tx(() => { getPiece('p1').photos = [ph]; }); go('pieces', 'p1'); })()"""); await pg.wait_for_timeout(600)
        ok(await pg.evaluate("!!document.querySelector('#detail .ph-th img[src^=\"data:\"]') && !!document.querySelector('#list .ph-row')"), 'photo d’une pièce : envoyée, affichée dans la fiche et la liste')
        # Métier : demande, points à contrôler, cause de panne, pièces de l'équipement
        await pg.evaluate("signalDialog()"); await pg.wait_for_timeout(200)
        await pg.fill('dialog[open] input[name=titre]', 'Fuite sous la pompe'); await pg.click('dialog[open] .prio-o:has(input[name=grp])'); await pg.click('dialog[open] button[type=submit]'); await pg.wait_for_timeout(400)
        ok(await pg.evaluate("db.taches.some(t => t.titre === 'Fuite sous la pompe' && t.demande && !t.demande.ok && t.kind === 'petit')"), 'signaler un problème : demande créée')
        await pg.evaluate("const t = db.taches.find(t => t.titre === 'Fuite sous la pompe'); go('taches', t.id)"); await pg.wait_for_timeout(300)
        await pg.click('#detail [data-act=dem-ok]'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("db.taches.find(t => t.titre === 'Fuite sous la pompe').demande.ok === true"), 'demande acceptée par un cadre')
        await pg.evaluate("tx(() => db.taches.push({id:'t9', titre:'Contrôle pompe', kksId:'k1', assign:{type:'groupe', v:'Mécanicien'}, freq:{n:1, unite:'mois'}, prochaine:isoAdd(todayISO(), 20), actif:true, kind:'rec', rapport:'oui', points:['Niveau d’huile', 'Bruit anormal']})); interventionDialog(null, null, get('taches', 't9'))"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("document.querySelectorAll('dialog[open] input[name=pt]').length === 2"), 'rapport : points à contrôler en cases')
        ok(await pg.evaluate("!!document.querySelector('dialog[open] .pl-sugg [data-sugg=p1]')"), 'rapport : pièces de l’équipement proposées')
        await pg.evaluate("document.querySelector('dialog[open] details.more').open = true"); await pg.click('dialog[open] input[name=pt][value=\"0\"]')
        await pg.click('dialog[open] .sp:has(input[name=cause][value=Fuite])'); await pg.click('dialog[open] button[type=submit]'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("db.interventions.some(i => i.tacheId === 't9' && i.cause === 'Fuite' && i.points.length === 2 && i.points[0].ok && !i.points[1].ok)"), 'rapport : cause et points enregistrés')
        # Arrêt de l'usine (révision)
        await pg.evaluate("S.tf='arret'; go('taches'); newTacheDialog()"); await pg.wait_for_timeout(200)
        ok(await pg.evaluate("document.querySelector('dialog[open] input[name=arret]').checked"), 'arrêt : case cochée depuis l’onglet Arrêt')
        await pg.fill('dialog[open] input[name=titre]', 'Ramonage chaudière'); await pg.click('dialog[open] button[type=submit]'); await pg.wait_for_timeout(400)
        ok(await pg.evaluate("db.taches.some(t => t.titre === 'Ramonage chaudière' && t.arret === true) && tKey(db.taches.find(t => t.titre === 'Ramonage chaudière')) === 'arret'"), 'arrêt : travail créé dans « Pour l’arrêt »')
        ok(await pg.evaluate("S.tf === 'arret' && /Ramonage/.test($('#list').textContent) && !!$('.arr-bar') && /Arrêt/.test($('.fchips').textContent)"), 'arrêt : pastille, bandeau et liste')
        ok(await pg.evaluate("/Travaux de l’arrêt/.test(tachesSheetHTML()) && /Ramonage/.test(tachesSheetHTML())"), 'arrêt : liste à imprimer')
        await pg.evaluate("ACT['arret-dates']()"); await pg.wait_for_timeout(200)
        await pg.evaluate("const f=document.querySelector('dialog[open] form'); f.elements.du.value=todayISO(); f.elements.au.value=isoAdd(todayISO(), 10)")
        await pg.click('dialog[open] button[type=submit]'); await pg.wait_for_timeout(400)
        ok(await pg.evaluate("arretOn() && tKey(db.taches.find(t => t.titre === 'Ramonage chaudière')) === 'semaine'"), 'arrêt : pendant l’arrêt, ses travaux passent dans « Cette semaine »')
        await pg.evaluate("finishTask(db.taches.find(t => t.titre === 'Ramonage chaudière'))"); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("arretFait(db.taches.find(t => t.titre === 'Ramonage chaudière')) && /0 à faire · 1 fait/.test($('.arr-bar').textContent)"), 'arrêt : avancement à jour')
        await capture('ordi-travaux-arret')
        await pg.evaluate("tx(() => { delete db.reglages.arret; db.taches = db.taches.filter(t => t.titre !== 'Ramonage chaudière'); }); S.tf=''")
        # Historique du stock repris de CareOffice (Journal des écritures)
        ok(await pg.evaluate("""(() => { const r = coJournalRows([
            {"N° d'écriture": 45195, "Date d'écriture": '10.06.2026 10:42', "Type d'écriture": 'Entrée de marchandise', "Qté de la transaction": -2, 'Remarque': '', 'Code article': '90001'},
            {"N° d'écriture": 43499, "Date d'écriture": '30.09.2025 16:29', "Type d'écriture": 'Plus-value sur inventaire', "Qté de la transaction": 1, 'Remarque': '', 'Code article': '90001'},
            {"N° d'écriture": 43498, "Date d'écriture": '30.09.2025 16:29', "Type d'écriture": 'Inventaire', "Qté de la transaction": 4, 'Remarque': '', 'Code article': '90001'}]);
          return r.length === 3 && r[0].line.q === 2 && r[0].line.d === '2026-06-10T10:42' && r[1].line.q === 1 && r[2].line.n === 1 && r[2].line.q === 4; })()"""), 'CareOffice : écritures lues avec le bon signe')
        hj = os.path.join(ICI, 'captures', 'histo-test.json')
        open(hj, 'w', encoding='utf-8').write(json.dumps([{'a': '90001', 'ty': 15, 'q': -3, 'd': '2024-07-31 07:22', 'l': 'Tridel/E9/99 Magasin', 'who': 'Testeur', 'des': '', 'an': 0}]))
        await pg.evaluate("importHistoDialog()"); await pg.set_input_files('dialog[open] input[name=file]', hj); await pg.wait_for_timeout(400)
        await pg.click('dialog[open] button[type=submit]'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("get('histo', 'p1')?.l.some(l => l.q === 3 && /Entrée de marchandise/.test(l.t))"), 'CareOffice : historique du stock importé')
        await pg.evaluate("importHistoDialog()"); await pg.set_input_files('dialog[open] input[name=file]', hj); await pg.wait_for_timeout(400)
        await pg.click('dialog[open] button[type=submit]'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("get('histo', 'p1').l.filter(l => l.q === 3).length === 1"), 'CareOffice : pas de doublon à la 2e importation')
        # « Intervenant CareOffice : Ofatec » → Pour qui ? / Intervenants (onglet Entreprises)
        await pg.evaluate("""tx(() => { db.taches.push({id:'tco', titre:'Révision pompe', description:'Contrôler.\\n\\nIntervenant CareOffice : Ofatec', kksId:'', assign:{type:'groupe', v:''}, freq:{n:1, unite:'an'}, prochaine:isoAdd(todayISO(), 90), actif:true, kind:'rec'});
          db.interventions.push({id:'ico', num:'R26-900', date:todayISO(), type:'', statut:'terminee', titre:'Révision', kksId:'', constat:'Intervenant CareOffice : Ofatec', travaux:'', intervenants:[], pieces:[]}); coInterMigrate(db); })""")
        ok(await pg.evaluate("(t => t.assign.type === 'four' && t.assign.v === 'Ofatec' && t.description === 'Contrôler.' && db.listes.fournisseurs.includes('Ofatec'))(get('taches', 'tco'))"), 'CareOffice : intervenant entreprise rangé dans « Pour qui ? »')
        ok(await pg.evaluate("(i => i.intervenants.includes('four:Ofatec') && !i.constat)(get('interventions', 'ico'))"), 'CareOffice : intervenant entreprise rangé dans le rapport')
        await pg.evaluate("interventionDialog(null, null, get('taches', 'tco'))"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("document.querySelector('dialog[open] [data-psel] [aria-selected=true]')?.textContent.includes('Entreprises') ?? true"), 'rapport depuis un travail d’entreprise : onglet Entreprises')
        await pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close()); tx(() => { db.taches = db.taches.filter(t => t.id !== 'tco'); db.interventions = db.interventions.filter(i => i.id !== 'ico'); })")
        # Modifications : cadres seulement
        ok(await pg.evaluate("(CLOUD.cadre = false, jrnBlock('x') === '') && (CLOUD.cadre = true, jrnBlock('x') !== '')"), 'Modifications : réservé aux cadres')
        await pg.evaluate("delete CLOUD.cadre")
        # Case Planning de l'accueil : qui afficher
        await pg.evaluate("S.opt='accueil'; go('options')"); await pg.wait_for_timeout(300)
        await capture('ordi-options-accueil')
        await pg.select_option('select[data-change=accPlan]', 'g:Électricien'); await pg.wait_for_timeout(300)
        await pg.evaluate("go('accueil')"); await pg.wait_for_timeout(400)
        ok(await pg.evaluate("accPlan().label === 'Électricien' && document.querySelectorAll('.bt-l .bt-plist li').length > 0"), 'accueil : planning d’un corps de métier choisi')
        ok(await pg.evaluate("db.reglages.comptes[meKey()].accPlan === 'g:Électricien' && !db.reglages.accPlan"), 'réglages du compte : gardés avec le compte (tous les appareils)')
        await pg.evaluate("S.opt='compte'; go('options')"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("[...document.querySelectorAll('.prefs-t th')].some(th => /Planning de l.accueil/.test(th.textContent)) && /Électricien/.test($('.prefs-t').textContent)"), 'Mon compte : tableau des réglages')
        await pg.evaluate("setPref('accPlan', '')")
        # Deux postes modifient la même fiche en même temps : fusion, sans recharger la page ni rien perdre
        await pg.evaluate("""(() => { const k = 'config|main', r = __srv.rows.get(k); const d = JSON.parse(JSON.stringify(r.data)); d.reglages.qrBase = 'https://autre-poste.example/'; __srv.rows.set(k, {...r, data: d, rev: r.rev + 1});
          const p = __srv.rows.get('pieces|p1'); const pd = JSON.parse(JSON.stringify(p.data)); pd.notes = 'note venue d’un autre poste'; __srv.rows.set('pieces|p1', {...p, data: pd, rev: p.rev + 1}); })()""")
        await pg.evaluate("window.__reloads = 0; const la = CLOUD.loadAll.bind(CLOUD); CLOUD.loadAll = () => (window.__reloads++, la()); setPref('pside', false); tx(() => { getPiece('p1').stockMin = 3; })")
        await pg.wait_for_timeout(1500)
        ok(await pg.evaluate("""(() => { const c = __srv.rows.get('config|main').data, p = __srv.rows.get('pieces|p1').data;
          return window.__reloads === 0 && c.reglages.qrBase === 'https://autre-poste.example/' && c.reglages.comptes[meKey()].pside === false && p.notes === 'note venue d’un autre poste' && p.stockMin === 3 && db.reglages.qrBase === 'https://autre-poste.example/'; })()"""), 'conflit entre deux postes : fusion sans rechargement ni perte')
        await pg.evaluate("setPref('pside', true); tx(() => { db.reglages.qrBase = ''; getPiece('p1').stockMin = 2; getPiece('p1').notes = ''; })"); await pg.wait_for_timeout(800)
        print('Pages (ordinateur)')
        for js, nom in [("go('accueil')", 'accueil'), ("S.sel.pieces=null; go('pieces')", 'pieces'), ("go('pieces','p1')", 'piece'),
                        ("go('taches','t2')", 'travaux-afaire'), ("S.statut='actives'; go('interventions')", 'travaux-encours'),
                        ("go('interventions','i1')", 'rapport'), ("go('planning')", 'planning'), ("go('kks')", 'installation'),
                        ("S.opt='historique'; go('options')", 'options-historique'), ("S.opt='roles'; go('options')", 'options-roles'),
                        ("S.opt='personnes'; go('options')", 'options-personnes')]:
            await aller(js, 'ordi-' + nom)
        ok(await pg.evaluate("S.pweek === planWeek()"), 'le planning s’ouvre sur la semaine suivante')
        ok(await pg.evaluate("(n => n.getBoundingClientRect().left < innerWidth / 2)(document.querySelector('#nav'))"), 'ordinateur : menu à gauche du bandeau')
        ok(await pg.evaluate("(go('interventions'), !/\\(s\\)/.test(document.body.innerText))"), 'pas de « (s) » dans les textes')
        await aller("go('accueil')", 'ordi-accueil', 900)
        ok(await pg.evaluate("document.querySelectorAll('.bento > .btile').length === 5 && !document.querySelector('.kpis')"), 'accueil : une carte par page')
        ok(await pg.evaluate("![...document.querySelectorAll('[data-act=scan]')].some(b => b.offsetParent) && !!document.querySelector('.md-scan.desk-only')?.offsetParent"), 'ordinateur : pas de Scanner, « Sortir une pièce » à la place')
        ok(await pg.evaluate("/Graissage/.test(document.querySelector('.bt-w')?.textContent || '')"), 'accueil : travaux urgents dans la carte Travaux')
        ok(await pg.evaluate("/Aujourd/.test(document.querySelector('#hband')?.textContent || '') && document.querySelector('#hsub')?.textContent === 'Accueil'"), 'en-tête : nom de la page et bandeau du jour')
        await pg.evaluate("document.querySelector('.bt-l .bt-go').click()"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("S.view === 'planning'"), 'accueil : la carte Planning ouvre le planning')
        await pg.evaluate("S.pour=''; go('accueil')")
        print('Parcours')
        ok(await pg.evaluate("document.querySelectorAll('#nav [data-view=taches]').length === 1 && !document.querySelector('#nav [data-view=interventions]')"), 'une seule entrée « Travaux » dans la navigation')
        await aller("go('taches'); newTacheDialog()", 'dialogue-nouveau-travail', 300)
        ok(await pg.evaluate("!document.querySelector('dialog[open] [data-once]').hidden && document.querySelector('dialog[open] [data-rec]').hidden && document.querySelector('dialog[open] input[name=quand][value=asap]').checked"), 'nouveau travail : « dès que possible » par défaut')
        await pg.fill('dialog[open] input[name=titre]', 'Petit travail de test')
        await pg.click('dialog[open] .sp:has(input[name=who][value="g:Électricien"])'); await pg.click('dialog[open] .sp:has(input[name=quand][value=date])'); await pg.click('dialog[open] [data-pd="1"]')
        ok(await pg.evaluate("/Électricien/.test($('dialog[open] [data-sum]').textContent) && /pour le/.test($('dialog[open] [data-sum]').textContent)"), 'nouveau travail : résumé en une phrase')
        await pg.click('dialog[open] button[type=submit]'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("db.taches.some(t => t.titre === 'Petit travail de test' && t.kind === 'petit' && t.prio === 'normale' && t.rapport === 'oui' && t.assign.v === 'Électricien' && t.prochaine === isoAdd(todayISO(), 1))"), 'création d’un travail : pastilles Pour qui / Quand, rapport « Oui » par défaut')
        await pg.evaluate("newTacheDialog()"); await pg.wait_for_timeout(200)
        await pg.fill('dialog[open] input[name=titre]', 'Changer une ampoule'); await pg.click('dialog[open] .sp:has(input[name=quand][value=rec])'); await pg.click('dialog[open] .sp:has(input[name=unite][value=semaine])')
        await pg.click('dialog[open] .tchip:has(input[name=norap])'); await capture('dialogue-travail-revient'); await pg.click('dialog[open] button[type=submit]'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("db.taches.some(t => t.titre === 'Changer une ampoule' && t.kind === 'rec' && t.freq.unite === 'semaine' && t.rapport === 'non')"), 'création d’un travail qui revient, sans rapport')
        n_int = await pg.evaluate("db.interventions.length")
        await pg.evaluate("doTache(db.taches.find(t => t.titre === 'Changer une ampoule'))"); await pg.wait_for_timeout(400)
        ok(await pg.evaluate(f"!document.querySelector('dialog[open]') && db.interventions.length === {n_int} && db.taches.find(t => t.titre === 'Changer une ampoule').faits.length === 1"), '« Jamais de rapport » : coché directement')
        await aller("go('taches','t2'); doTache(get('taches','t2'))", 'dialogue-rapport-ou-pas', 300)
        ok(await pg.evaluate("document.querySelectorAll('dialog[open] [data-r]').length === 2"), 'C’est fait : on demande s’il faut un rapport')
        await pg.click('dialog[open] [data-r=non]'); await pg.wait_for_timeout(400)
        ok(await pg.evaluate(f"get('taches','t2').actif === false && get('taches','t2').faits.length === 1 && db.interventions.length === {n_int}"), '« Non, juste cocher » : fait sans rapport')
        await aller("S.statut='terminee'; go('interventions')", 'ordi-travaux-fait')
        ok(await pg.evaluate("!!document.querySelector('#list [data-id=\"t:t2\"]') && !!document.querySelector('#list [data-id=i1]')"), 'onglet « Fait » : rapports et travaux sans rapport')
        await pg.click('#list [data-id="t:t2"]'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("document.querySelector('#detail .pd-title')?.textContent === 'Changer le néon'"), 'fiche d’un travail fait sans rapport')
        await pg.evaluate("S.sel.taches='t1'; go('taches','t1')"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("document.querySelector('#detail .pd-title + .equip-hero')?.textContent.includes('Pompe de test')"), 'travail : équipement juste sous le titre')
        await pg.evaluate("doTache(get('taches','t1'))"); await pg.wait_for_timeout(300)
        await pg.check('dialog[open] input[name=keep]'); await pg.click('dialog[open] [data-r=oui]'); await pg.wait_for_timeout(400)
        ok(await pg.evaluate("get('taches','t1').rapport === 'oui' && !!document.querySelector('dialog[open] input[name=titre]')?.value"), '« Oui, faire un rapport » + retenir : le rapport s’ouvre')
        await pg.click('dialog[open] button[type=submit]'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate(f"db.interventions.length === {n_int + 1} && get('taches','t1').prochaine > todayISO()"), 'rapport enregistré, la tâche passe à la date suivante')
        await pg.click('#main [data-act=wtab][data-w=encours]'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("S.view === 'interventions' && S.statut === 'actives'"), 'onglet « En cours »')
        await aller("go('planning')", 'planning-2')
        ok(await pg.evaluate("document.querySelectorAll('.wkgrid th.pn').length > 3"), 'planning affiché')
        ok(await pg.evaluate("![...document.querySelectorAll('.wkgrid th.pn')].some(x => x.textContent.includes('ECHO'))"), 'personne en vacances masquée du planning')
        await pg.evaluate("tx(() => db.taches.push({id:'t3', titre:'Contrôle éclairage', kksId:'', assign:{type:'groupe', v:'Électricien'}, freq:{n:1, unite:'once'}, prochaine:'', actif:true, kind:'petit', prio:'haute'})); S.pside = true; render()"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("[...document.querySelectorAll('.pside [data-act=plan-met]')].map(b => b.textContent.replace(/\\s*\\d+$/, '').trim()).join('|') === 'Tout|Électricien|Automaticien|Mécanicien|Intendance'"), 'À planifier : pastilles par métier')
        await pg.evaluate("ACT['plan-print']({f:'a3'})"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("document.querySelectorAll('dialog[open] .pcheck .pc-row').length >= 3"), 'planning : liste de contrôle avant impression')
        await pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close())")
        await pg.click('.pside [data-act=plan-met][data-m=elec]'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("[...document.querySelectorAll('.pside .ps-t')].every(c => tMet(get('taches', c.dataset.tid)) === 'elec') && document.querySelectorAll('.pside .ps-t').length > 0 && !!document.querySelector('.wkgrid tr.pg.on .m-elec')"), 'tri Électricité : liste filtrée et groupe éclairé dans la grille')
        await capture('planning-metier')
        await pg.evaluate("S.pmet = ''; render()")
        who = await pg.evaluate("db.personnes.find(p => p.nom === 'ALPHA').id"); mon = await pg.evaluate("S.pweek")
        await pg.click(f'.wkgrid .pc[data-who="{who}"][data-date="{mon}"]'); await pg.keyboard.type('Texte de test'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(400)
        ok(await pg.evaluate(f"db.plan.some(x => x.who === '{who}' && x.text === 'Texte de test')"), 'saisie directe dans le planning')
        await aller("S.sel.pieces=null; go('pieces'); locDialog('')", 'dialogue-emplacements', 300)
        ok(await pg.evaluate("document.querySelectorAll('dialog[open] .loc-i').length >= 1"), 'recherche par emplacement')
        await aller("go('interventions'); interventionDialog(null)", 'dialogue-rapport', 300)
        ok(await pg.evaluate("!!document.querySelector('dialog[open] [data-padd]') && !document.querySelector('dialog[open] [data-pgrid]')"), 'intervenants par recherche seule')

        print('Pages (téléphone)')
        await pg.set_viewport_size({'width': 390, 'height': 844})
        await pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close()); S.sel.taches=null; go('taches')"); await pg.wait_for_timeout(300)
        await pg.evaluate("""(() => { const r = document.querySelector('#list [data-act=do-tache][data-id=t1]').closest('tr, li'), b = r.getBoundingClientRect(), y = b.top + b.height / 2;
          const ev = (t, x, el) => (el || document).dispatchEvent(new PointerEvent(t, {pointerType:'touch', clientX:x, clientY:y, bubbles:true, isPrimary:true}));
          ev('pointerdown', 40, r.querySelector('td, span, b') || r); ev('pointermove', 80); ev('pointermove', 200); ev('pointerup', 200); })()""")
        await pg.wait_for_timeout(500)
        ok(await pg.evaluate("document.querySelectorAll('dialog[open]').length === 1 && /C.est fait|rapport/.test(document.querySelector('dialog[open] h2').textContent)"), 'glisser un travail vers la droite : « C’est fait »')
        await pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close())")
        for js, nom in [("go('accueil')", 'accueil'), ("S.sel.pieces=null; go('pieces')", 'pieces'), ("S.sel.taches=null; go('taches')", 'travaux'), ("S.sel.interventions=null; S.statut='terminee'; go('interventions')", 'travaux-fait'),
                        ("go('interventions','i1')", 'rapport'), ("go('planning')", 'planning'), ("go('accueil'); quickMove(getPiece('p1'))", 'sortie-rapide')]:
            await aller(js, 'tel-' + nom)
        print('Premier chargement sur un nouveau poste')
        await pg.set_viewport_size({'width': 1300, 'height': 820})
        await pg.evaluate("localStorage.setItem('__slow', '2500'); IDB.del(CLOUD.cacheKey())"); await pg.wait_for_timeout(200)
        await pg.reload(); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("CLOUD.loading === true && !!document.querySelector('.loadcard') && document.body.dataset.view === 'accueil'"), 'nouveau poste : « Chargement des données… » affiché, menu en place')
        await capture('chargement-nouveau-poste')
        await pg.click('#nav [data-view=pieces]'); await pg.wait_for_timeout(150)
        ok(await pg.evaluate("S.view === 'accueil' && /données arrivent/.test(document.querySelector('#toast')?.textContent || '')"), 'nouveau poste : menu bloqué pendant le chargement, avec un message')
        await pg.wait_for_timeout(4000)
        ok(await pg.evaluate("!CLOUD.loading && !document.querySelector('.loadcard') && db.pieces.length > 0"), 'nouveau poste : données affichées une fois chargées')
        await pg.evaluate("localStorage.removeItem('__slow')")
        for w in (1024, 1366):
            await pg.set_viewport_size({'width': w, 'height': 768}); await pg.evaluate("go('accueil')"); await pg.wait_for_timeout(300); await capture(f'ordi-{w}-accueil')
            ok(await pg.evaluate("(() => { const n = document.querySelector('#nav').getBoundingClientRect(), h = document.querySelector('.help-btn').getBoundingClientRect(), t = document.querySelector('.hero-copy').getBoundingClientRect(); return n.right <= h.left && n.left >= t.right - 1 && document.documentElement.scrollWidth <= innerWidth; })()"), f'menu bien placé à {w} px de large')
        await b.close()
    srv.shutdown()
    if CAPTURES: comparer(echecs)
    for e in erreurs: print('  ✗ Erreur JavaScript : ' + e)
    if erreurs or echecs:
        print(f'\nÉCHEC : {len(echecs)} vérification(s) et {len(erreurs)} erreur(s) JavaScript.'); sys.exit(1)
    print('\nTout est bon.' + (' Captures : outils/tests/captures/' if CAPTURES else ''))

def comparer(echecs):
    """Compare chaque capture à la référence (outils/tests/reference/) et signale ce qui a changé visuellement."""
    import shutil
    from PIL import Image, ImageChops
    cap = os.path.join(ICI, 'captures'); os.makedirs(REF_DIR, exist_ok=True)
    noms = sorted(f for f in os.listdir(cap) if f.endswith('.png') and not f.startswith('diff-'))
    if REFERENCE:
        for f in noms: shutil.copy(os.path.join(cap, f), os.path.join(REF_DIR, f))
        print(f'Référence mise à jour : {len(noms)} captures.'); return
    changees, nouvelles = [], []
    for f in noms:
        r = os.path.join(REF_DIR, f)
        if not os.path.exists(r): nouvelles.append(f); continue
        a, b = Image.open(r).convert('RGB'), Image.open(os.path.join(cap, f)).convert('RGB')
        if a.size != b.size: changees.append((f, 100.0)); continue
        d = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > 24 else 0)
        n = sum(d.histogram()[255:]) ; part = 100 * n / (a.size[0] * a.size[1])
        if part > 0.3:
            changees.append((f, part))
            rouge = Image.new('RGB', b.size, (230, 30, 40)); Image.composite(rouge, b, d).save(os.path.join(cap, 'diff-' + f))
    print('Comparaison visuelle : ' + (f'{len(noms) - len(changees) - len(nouvelles)} identiques' if noms else 'aucune capture'))
    for f, part in changees: print(f'  ≠ {f} a changé ({part:.1f} % de la surface) : voir captures/diff-{f}')
    if nouvelles: print('  + nouvelles captures sans référence : ' + ', '.join(nouvelles))
    if STRICT and changees: echecs.append('captures différentes de la référence')

asyncio.run(main())
