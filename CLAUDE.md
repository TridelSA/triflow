# TriFlow — consignes pour Claude

TriFlow est la GMAO de Tridel (usine d'incinération, Lausanne) : pièces et stock, emplacements, équipements (repères KKS), tâches, rapports d'intervention, planning de la semaine, historique. Elle remplace CareOffice. Le README explique l'exploitation (Supabase, sauvegardes, accès) : le lire aussi.

Le demandeur est **Thomas Bonnant**, responsable informatique. Il décrit ses besoins en français, souvent depuis son téléphone, et attend des changements **faits, testés et publiés**. Répondre en français, simplement, sans jargon. Ne pas lui dire d'attendre la mise à jour du site après une publication : il le sait.

## Le mot d'ordre : « facile »
- Interface en **français**, pour des techniciens d'atelier : peu de texte, des mots simples, des actions évidentes.
- Préférer **simplifier** plutôt qu'ajouter. Pas de doublon d'accès à une même fonction. Un seul style de filtre : les **pastilles** (`.ychip` / `.fchips`).
- Toujours penser **ordinateur et téléphone**. Téléphone (≤ 760 px) = style appli : pas de bandeau, barre du bas « Ma journée · Travaux · [Scanner] · Pièces · Plus » (Plus = Planning, Options, Aide), accueil `.mhome` (dans `VIEWS.accueil`), pas d'impression.
- Rien n'est supprimé par défaut : on **archive** (champ `arch`). La suppression définitive est réservée aux **cadres** (`canDel()`).

## Où est le code
Pas d'outil de compilation : `index.html` (squelette) charge `css/triflow.css` puis les scripts `js/` **dans l'ordre**. Ce sont des scripts classiques qui partagent les mêmes variables globales. GitHub Pages publie le site à chaque commit sur `main`.

| Fichier | Contenu |
|---|---|
| `css/triflow.css` | Tous les styles. Couleurs dans `:root` et `prefers-color-scheme: dark`. Règles téléphone : `@media (max-width:760px)` (plusieurs blocs). |
| `sw.js` | Fonctionnement sans réseau (garde le site sur l'appareil). Ne jamais y mettre en cache la base Supabase. |
| `js/qrcode.js` | Bibliothèque QR (ne pas modifier). |
| `js/1-base.js` | Outils, **`morph()`** (mise à jour ciblée du HTML, utilisée par `render`), `ICONS`, `menu()`, migrations des données (`migrate`, drapeaux `d.meta.xxxV`). |
| `js/2-cloud.js` | `COLS`, `CLOUD` : Supabase (chargement + cache IndexedDB, `push`, temps réel). Hors ligne : les modifications non envoyées sont gardées (`pendKey`) et partent au retour du réseau (`goOffline`, événement `online`). |
| `js/3-coeur.js` | Journal « qui a fait quoi » (`jDescribe`, `JRN`, `jCtx`), connexion, **`tx()`**, identité et droits (`personFromEmail`, `canDel`, `meId`), aide, archives, stock (`addStock`), numéros (`nextNum`), `dueInfo`, état **`S`**, `render`/`fillList`/`fillDetail`. |
| `js/4-accueil-pieces.js` | `VIEWS`, pages Accueil et Pièces, doublons, emplacements. |
| `js/5-travaux-installation.js` | Page Travaux : vues `taches` (onglet À faire) et `interventions` (En cours / Fait), en-tête commun `travauxShell` + `wtabs` ; « C’est fait » = `doTache` (demande s’il faut un rapport) et `finishTask` (coché sans rapport) ; `newTacheDialog`, `tacheDialog`. Installation (KKS). |
| `js/6-planning-options.js` | Planning (`PCODE`, `DISPO`, grille, panneau « À planifier », `planInline`, `planSheetHTML` = feuille A3), emplacements (`locDialog`), accès (`accessDialog`), pages Options (`OPT.xxx`, rangées par groupes dans `OPT_GROUPS` ; Administration = cadres). |
| `js/7-recherche-scan.js` | Recherche globale, scan QR. |
| `js/8-fenetres.js` | `quickMove()` (sortie / entrée rapide, liée à un rapport), photos (`photoUpload`, `photoStrip`, seau Supabase « photos »), `dialog()` (fenêtres : `onSave` peut être `async`, une `Error` s'affiche dans la fenêtre, `info:true` = sans Annuler), fenêtres pièce/mouvement/emplacements, imports, étiquettes, impression, `combo()`. |
| `js/9-rapports-exports.js` | Fenêtre rapport (`interventionDialog`), KKS, personnes, synchronisation du personnel, exports Excel. |
| `js/10-evenements.js` | **`ACT`** (toutes les actions : `data-act="nom"` appelle `ACT.nom(dataset, element)`), événements, démarrage. |

**Après toute modification d'un fichier `css/` ou `js/`**, changer le numéro `?v=` (date-heure, ex. `?v=202611052215`) sur **toutes** les balises de `index.html`, pour que les navigateurs prennent la nouvelle version.

## Économiser (important : l'abonnement a des limites)
- **Ne jamais lire un fichier en entier sans raison.** Chercher d'abord (Grep sur un nom de fonction ou un texte affiché), puis lire seulement les lignes utiles.
- Ne pas relire un fichier qu'on vient de modifier.
- Tests : `python3 outils/tests/test.py` sans captures pour un petit changement ; `--captures` et regarder **une ou deux** captures seulement quand l'affichage change.
- Réponses courtes : ce qui a changé et où le voir.

### Règles d'écriture
- **Toute modification de données passe par `tx(() => { … })`** (enregistre, met à jour l'historique, permet « Annuler »). Puis `render()` ou `fillList()` / `fillDetail()`.
- Échapper tout texte affiché avec `esc()`. Dates : `todayISO()`, `isoAdd()`, `fmtD()`, `fmtDT()`, `daysTo()`. Recherche sans accents : `norm()`.
- Fiches vivantes : `live(x)` (non archivées). Personnes : `getPers`, `persName`, `meId()` (moi), `personFromEmail()`.
- Messages : `toast(texte, 'bad'?, true /* bouton Annuler */)`.
- Icônes : `icon('nom')` (liste dans `const ICONS`).

## Skills de design (dans `.claude/skills/`)
- **impeccable** (Paul Bakaus, Apache 2.0) : concevoir, auditer, peaufiner l'interface. Lancer d'abord `.claude/skills/impeccable/scripts/impeccable context --target index.html`. TriFlow est en mode **Operate** (outil de travail : lisibilité et précision avant l'effet). Contexte produit dans `PRODUCT.md`, choix visuels dans `DESIGN.md`. Après une modification d'affichage : `impeccable detect --json css/triflow.css js/<fichier>.js`.
- **emil-design-eng** (Emil Kowalski, MIT) : finitions (retour au clic, animations courtes, états de survol et de focus).
- **gmao-tridel** (écrite pour TriFlow) : le métier de la maintenance — correspondances avec une GMAO classique (SAP PM), règles de Tridel, indicateurs, idées. **À lire avant toute fonction liée aux équipements, travaux, rapports, préventif, stock ou indicateurs.**
- Ne pas les modifier : pour les mettre à jour, recopier depuis github.com/pbakaus/impeccable et github.com/emilkowalski/skills.

## Données (Supabase, une seule table `docs`)
Chaque fiche = `(collection, id, data jsonb, rev)`. Collections : `pieces`, `salles`, `lieux`, `kks`, `taches`, `interventions`, `mouvements`, `histo` (stock repris de CareOffice), `personnes`, `plan`, `journal` (non chargé au démarrage), `config` (id `main` : `listes`, `reglages`).
- **Tâches** (appelées « travaux » dans l’interface) : `kind:'petit'` (une seule fois, `prio` haute/normale/basse, date facultative) ou récurrente (`freq`, `prochaine`). `isPetit(t)` inclut aussi les anciennes tâches « une seule fois ». `rapport` : vide = demander, `'oui'` = toujours, `'non'` = jamais. `faits` : `[{date, who}]` = fait sans rapport (affiché dans l’onglet « Fait »). `assign` : `{type:'groupe'|'personne'|'four', v}` (`four` = entreprise, nom pris dans `listes.fournisseurs` ; un rapport créé depuis ce travail met l'entreprise dans ses intervenants, onglet Entreprises).
- **Historique du stock CareOffice** : collection `histo` `{id: pieceId, l:[{d, q, t, lieu, n (sans signe), w, no (n° d'écriture)}]}`, importée par *Pièces › Plus › Importer l’historique du stock* (`importHistoDialog`, Excel/CSV du « Journal des écritures » ou JSON brut ; CareOffice note les entrées en négatif).
- **Rapports** : numéro `R26-017` (`nextNum`, `renumberInts`) ; `co` = ancien numéro CareOffice, caché, sert à éviter les doublons à l'import.
- **Personnes et présences** : viennent du Planning Tridel (`PLANNING_URL`, fichier `planning-AAAA.json`, champs `nom`, `categorie`, `planning{date: code}`). Codes dans `PCODE`. Disponible au planning = `DISPO` (R, PIQ, EN, PI, CA) ; congés = `CONGE`.
- **Rôles** : cadres = groupe « Cadres » reconnu par l'e-mail ; responsable par groupe dans `reglages.resp` (droits à définir plus tard, Options › Rôles).
- **Planning** : s'ouvre sur la semaine suivante (`planWeek()`), une case = une personne × un jour ; un seul texte par case ; tâches glissées ou « cliquer puis cliquer la case ».

Scripts SQL (à lancer à la main dans Supabase, jamais depuis le site) : `outils/supabase.sql` (table et droits de base), `outils/droits.sql` (suppression réservée aux cadres, journal protégé), `outils/photos.sql`, `outils/acces.sql` (accès réservé aux adresses @tridelsa.ch confirmées ou à la table `tf_exceptions` ; cadres = table `tf_cadres`, lue par `is_cadre()` → `CLOUD.cadre` → `canDel()`). Fonction Supabase : `outils/supabase-fonction/creer-utilisateur.ts`.

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

Comparaison visuelle : avec `--captures`, chaque capture est comparée à `outils/tests/reference/` (date figée au 4.11.2026 09:30) ; les différences sont listées et dessinées en rouge dans `captures/diff-*.png`. Après un changement d'affichage **voulu**, mettre la référence à jour : `python3 outils/tests/test.py --reference` (et la publier). `--strict` fait échouer le test si une capture a changé.

Mise en forme du code : `node /opt/node22/lib/node_modules/prettier/bin/prettier.cjs --write js/<fichier>.js` (réglages dans `.prettierrc.json`).

Vérification rapide de syntaxe : `node --check js/<fichier>.js`.

## Publier
Commit sur `main` avec un message en français qui dit ce qui change pour l'utilisateur, puis `git push`. Ensuite, résumer à Thomas en quelques lignes ce qui a changé et où le voir.

## Reste à faire côté Thomas (ne pas refaire, rappeler si utile)
- Accès réservé à @tridelsa.ch (README §2) : inscription fermée et scripts SQL lancés (novembre 2026). Reste : installer `creer-utilisateur`, SMTP, URL du site, modèles d'e-mails, puis rouvrir l'inscription.
- Vérifier la région du projet Supabase (idéalement Zurich).
- Idées en attente : lien Microsoft To Do / Teams (rappels), droits par rôle.
