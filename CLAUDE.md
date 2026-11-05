# TriFlow — consignes pour Claude

TriFlow est la GMAO de Tridel (usine d'incinération, Lausanne) : pièces et stock, emplacements, équipements (repères KKS), tâches, rapports d'intervention, planning de la semaine, historique. Elle remplace CareOffice. Le README explique l'exploitation (Supabase, sauvegardes, accès) : le lire aussi.

Le demandeur est **Thomas Bonnant**, responsable informatique. Il décrit ses besoins en français, souvent depuis son téléphone, et attend des changements **faits, testés et publiés**. Répondre en français, simplement, sans jargon. Ne pas lui dire d'attendre la mise à jour du site après une publication : il le sait.

## Le mot d'ordre : « facile »
- Interface en **français**, pour des techniciens d'atelier : peu de texte, des mots simples, des actions évidentes.
- Préférer **simplifier** plutôt qu'ajouter. Pas de doublon d'accès à une même fonction. Un seul style de filtre : les **pastilles** (`.ychip` / `.fchips`).
- Toujours penser **ordinateur et téléphone** (≤ 760 px : barre de navigation en bas, bouton rond « + »).
- Rien n'est supprimé par défaut : on **archive** (champ `arch`). La suppression définitive est réservée aux **cadres** (`canDel()`).

## Où est le code
**Tout est dans `index.html`** (HTML + CSS + JavaScript, ~5 600 lignes, sans outil de compilation). C'est la seule source : on la modifie directement. GitHub Pages publie le site à chaque commit sur `main`.

Repères dans le fichier (chercher ces commentaires) :
| Où | Quoi |
|---|---|
| `<style>` (début) | Styles. Variables de couleur dans `:root` (clair) et `prefers-color-scheme: dark`. Bloc « Ergonomie v5 » et suivants = ajouts récents. |
| `/* ---------- Écrans moyens & téléphone` | Règles téléphone. D'autres `@media (max-width:760px)` existent plus bas. |
| `const COLS`, `let db`, `migrate(d)` | Modèle de données et migrations (drapeaux `d.meta.xxxV` : une migration ne tourne qu'une fois). |
| `const CLOUD = {` | Synchronisation Supabase : `loadAll` (cache IndexedDB + delta), `push` (diff, lots de 400, `_by`/`_at`), temps réel. |
| `HISTORIQUE (journal` | Journal « qui a fait quoi » : `jDescribe`, `JRN`, `jrnBlock`, `jCtx`. |
| `const S = {` | État de l'interface (vue, sélection, filtres). |
| `const VIEWS = {}` puis `VIEWS.accueil/pieces/taches/interventions/kks/planning/options` | Chaque page : `shell()` (en-tête), `list()`, `detail()`. |
| `const OPT_SECS` / `OPT.xxx = () =>` | Sections des Options (Historique, Rôles, Personnes…). |
| `const ACT = {` | Toutes les actions. Un élément `data-act="nom"` appelle `ACT.nom(dataset, element)`. |
| `function dialog({` | Fenêtres. `onSave` peut être `async` ; lancer une `Error` affiche le message dans la fenêtre. `info:true` = sans bouton Annuler. |
| `tacheDialog`, `newTacheDialog`, `interventionDialog`, `pieceDialog`, `planDialog`, `planInline`, `locDialog` | Formulaires principaux. |
| `planSheetHTML` | Feuille A3 imprimée du planning (reprend le modèle Excel de Tridel). |

### Règles d'écriture
- **Toute modification de données passe par `tx(() => { … })`** (enregistre, met à jour l'historique, permet « Annuler »). Puis `render()` ou `fillList()` / `fillDetail()`.
- Échapper tout texte affiché avec `esc()`. Dates : `todayISO()`, `isoAdd()`, `fmtD()`, `fmtDT()`, `daysTo()`. Recherche sans accents : `norm()`.
- Fiches vivantes : `live(x)` (non archivées). Personnes : `getPers`, `persName`, `meId()` (moi), `personFromEmail()`.
- Messages : `toast(texte, 'bad'?, true /* bouton Annuler */)`.
- Icônes : `icon('nom')` (liste dans `const ICONS`).

## Données (Supabase, une seule table `docs`)
Chaque fiche = `(collection, id, data jsonb, rev)`. Collections : `pieces`, `salles`, `lieux`, `kks`, `taches`, `interventions`, `mouvements`, `histo` (stock repris de CareOffice), `personnes`, `plan`, `journal` (non chargé au démarrage), `config` (id `main` : `listes`, `reglages`).
- **Tâches** : `kind:'petit'` (petit travail, `prio` haute/normale/basse, date facultative) ou récurrente (`freq`, `prochaine`). `isPetit(t)` inclut aussi les anciennes tâches « une seule fois ».
- **Rapports** : numéro `R26-017` (`nextNum`, `renumberInts`) ; `co` = ancien numéro CareOffice, caché, sert à éviter les doublons à l'import.
- **Personnes et présences** : viennent du Planning Tridel (`PLANNING_URL`, fichier `planning-AAAA.json`, champs `nom`, `categorie`, `planning{date: code}`). Codes dans `PCODE`. Disponible au planning = `DISPO` (R, PIQ, EN, PI, CA) ; congés = `CONGE`.
- **Rôles** : cadres = groupe « Cadres » reconnu par l'e-mail ; responsable par groupe dans `reglages.resp` (droits à définir plus tard, Options › Rôles).
- **Planning** : s'ouvre sur la semaine suivante (`planWeek()`), une case = une personne × un jour ; un seul texte par case ; tâches glissées ou « cliquer puis cliquer la case ».

Scripts SQL (à lancer à la main dans Supabase, jamais depuis le site) : `outils/supabase.sql` (table et droits de base), `outils/droits.sql` (suppression réservée aux cadres, journal protégé). Fonction Supabase : `outils/supabase-fonction/creer-utilisateur.ts`.

## Interdits
- **Le dépôt est public** : jamais de données réelles (pièces, rapports, personnes, planning, exports CareOffice), jamais de clé `service_role` ni de mot de passe. La clé présente dans `index.html` est la clé publique : c'est normal.
- CareOffice : uniquement en **lecture**, jamais de modification.
- Ne pas modifier la base de production depuis un test.

## Tester avant de publier
```
pip install playwright && playwright install chromium   # une fois
python3 outils/tests/test.py --captures
```
Le test ouvre `index.html` dans un vrai navigateur avec une **fausse base** (`outils/tests/supabase-factice.js`, mot de passe `secret`) et un **faux planning** (personnes inventées), crée quelques fiches, fait le tour des pages (ordinateur et téléphone) et vérifie les parcours principaux. Il échoue à la moindre erreur JavaScript. Les captures vont dans `outils/tests/captures/` (non versionné) : **les regarder** quand on touche à l'affichage. Ajouter une vérification au test quand on ajoute une fonction.

Vérification rapide de syntaxe : extraire le plus grand `<script>` et lancer `node --check`.

## Publier
Commit sur `main` avec un message en français qui dit ce qui change pour l'utilisateur, puis `git push`. Ensuite, résumer à Thomas en quelques lignes ce qui a changé et où le voir.

## Reste à faire côté Thomas (ne pas refaire, rappeler si utile)
- Lancer `outils/droits.sql` et installer la fonction `creer-utilisateur` dans Supabase.
- Ajouter les secrets GitHub de la sauvegarde (`TRIFLOW_EMAIL`, `TRIFLOW_PASSWORD`, `BACKUP_PASSWORD`).
- Vérifier la région du projet Supabase (idéalement Zurich).
- Idées en attente : lien Microsoft To Do / Teams (rappels), photos dans les rapports, droits par rôle.
