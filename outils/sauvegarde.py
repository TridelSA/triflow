"""Sauvegarde de la base TriFlow (Supabase) au format « Restaurer une sauvegarde » de l'application.
Utilisé par .github/workflows/sauvegarde.yml ; peut aussi être lancé à la main :
  TRIFLOW_EMAIL=... TRIFLOW_PASSWORD=... python3 outils/sauvegarde.py > triflow-sauvegarde.json
"""
import json, os, sys, urllib.request, urllib.parse

URL = os.environ.get('SUPABASE_URL', 'https://gzwmoevwapliqremrqpp.supabase.co').rstrip('/')
KEY = os.environ.get('SUPABASE_KEY', 'sb_publishable_Mslbg2kd3UQp5lhVkhrXkA_XXN2H9vK')
COLS = ['salles', 'lieux', 'personnes', 'kks', 'pieces', 'interventions', 'mouvements', 'taches', 'histo', 'plan']

def call(path, data=None, token=None):
    req = urllib.request.Request(URL + path, data=json.dumps(data).encode() if data else None, method='POST' if data else 'GET')
    req.add_header('apikey', KEY); req.add_header('Content-Type', 'application/json')
    req.add_header('Authorization', 'Bearer ' + (token or KEY))
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())

miss = [k for k in ('TRIFLOW_EMAIL', 'TRIFLOW_PASSWORD') if not os.environ.get(k)]
if miss:
    sys.exit('Secrets GitHub manquants : ' + ', '.join(miss) + ' (Settings › Secrets and variables › Actions).')
try:
    tok = call('/auth/v1/token?grant_type=password', {'email': os.environ['TRIFLOW_EMAIL'], 'password': os.environ['TRIFLOW_PASSWORD']})['access_token']
except urllib.error.HTTPError as e:
    sys.exit(f'Connexion refusée par Supabase ({e.code}) : vérifier TRIFLOW_EMAIL et TRIFLOW_PASSWORD.')
rows, start = [], 0
while True:
    part = call(f'/rest/v1/docs?select=collection,id,data&order=collection,id&offset={start}&limit=1000', token=tok)
    rows += part
    if len(part) < 1000: break
    start += 1000
db = {c: [] for c in COLS}
cfg = {}
for r in rows:
    if r['collection'] == 'config': cfg = r['data']
    elif r['collection'] in db: db[r['collection']].append(r['data'])
db.update({'version': cfg.get('version', 2), 'meta': cfg.get('meta', {}), 'reglages': cfg.get('reglages', {}), 'listes': cfg.get('listes', {})})
if len(db['pieces']) < 1:
    sys.exit('Sauvegarde vide : vérifier le compte de sauvegarde.')
json.dump(db, sys.stdout, ensure_ascii=False)
print(f"{len(rows)} fiches sauvegardées ({len(db['pieces'])} pièces, {len(db['interventions'])} rapports)", file=sys.stderr)
