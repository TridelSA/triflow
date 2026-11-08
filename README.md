# TriFlow · GMAO de Tridel

TriFlow est l'outil de maintenance de Tridel. Il gère le stock de pièces et leurs emplacements, l'installation (repères KKS), les tâches récurrentes, les rapports d'intervention et le planning de la semaine. Il remplace CareOffice.

- **Adresse du site** : https://tridelsa.github.io/triflow/
- **Code** : ce dépôt GitHub (`TridelSA/triflow`), publié automatiquement par GitHub Pages à chaque modification de `index.html`.
- **Données** : une base Supabase (projet `gzwmoevwapliqremrqpp`).
- **Personnel et présences** : lus depuis le Planning Tridel (https://tridelsa.github.io/planning/, dépôt `TridelSA/planning`).

Ce document sert à **reprendre TriFlow** : comprendre où sont les choses, l'administrer, le sauvegarder et le restaurer.

---

## 1. Comment c'est construit

| Élément | Où | Rôle |
|---|---|---|
| `index.html`, `css/`, `js/` | ce dépôt | L'application : une page HTML, une feuille de styles et des scripts chargés dans l'ordre, sans outil de compilation (détail dans `CLAUDE.md`). |
| `manifest.json`, icônes | ce dépôt | Icône et nom de l'application sur les téléphones. |
| Base Supabase | supabase.com | Une seule table `docs` : chaque fiche (pièce, rapport, tâche…) est un document JSON. |
| `outils/supabase.sql` | ce dépôt | Script de création de la table, des droits et de la fonction d'enregistrement `save_docs`. |
| `outils/sauvegarde.py` et `.github/workflows/sauvegarde.yml` | ce dépôt | Sauvegarde automatique chaque semaine (voir §4). |
| `outils/careoffice/` | ce dépôt | Scripts utilisés en 2026 pour reprendre les données de CareOffice (pour mémoire). |

### Les données (table `docs`)

Chaque ligne a une `collection`, un `id`, le contenu `data` (JSON) et un numéro de version `rev`. Ce numéro évite qu'un poste écrase la modification d'un autre.

| Collection | Contenu |
|---|---|
| `pieces` | Pièces : ID CareOffice, désignation, fournisseur, stock par emplacement, repères KKS liés, notes |
| `salles`, `lieux` | Locaux et emplacements de rangement |
| `kks` | Repères de l'installation (code KKS, désignation, AIC) |
| `taches` | Tâches récurrentes ou ponctuelles (fréquence, prochaine échéance, attribution) |
| `interventions` | Rapports d'intervention (figés quand ils sont terminés) |
| `mouvements` | Entrées et sorties de stock faites dans TriFlow |
| `histo` | Historique de stock repris de CareOffice |
| `personnes` | Personnel, synchronisé avec le Planning Tridel |
| `plan` | Planning de la semaine (une case = une personne, un jour, une tâche et/ou un texte) |
| `journal` | Historique « qui a fait quoi » (une phrase par action ; non chargé au démarrage, lu dans Options › Historique et en bas des fiches) |
| `config` (id `main`) | Réglages, listes (fournisseurs, types…), « qui est qui » (`reglages.moi`) |

Rien n'est supprimé par défaut : les éléments **archivés** gardent un champ `arch` (date) et peuvent être restaurés depuis l'application.

Chaque fiche enregistrée garde aussi `_by` (adresse de la personne) et `_at` (date et heure de la modification).

### Sécurité

- La clé Supabase présente dans `index.html` est la clé **publique** (« publishable ») : c'est normal. Sans compte connecté, la base ne se lit pas et ne se modifie pas ; avec `outils/acces.sql`, il faut en plus une adresse @tridelsa.ch confirmée (ou une exception).
- **Ne jamais** mettre la clé `service_role` dans le site ou dans ce dépôt (il est public).

---

## 2. Administrer

### Accès réservé à Tridel : mise en place (une seule fois, dans cet ordre)
Résultat : chacun peut **créer son compte** depuis la page de connexion avec son adresse **@tridelsa.ch**. Il reçoit un e-mail et clique le lien pour l'activer. Une autre adresse peut recevoir un e-mail, mais **ne voit rien** (la base refuse). « Mot de passe oublié ? » et *Options › Connexion › Changer mon mot de passe* fonctionnent aussi.

1. **Fermer la porte tout de suite** : Supabase › *Authentication › Sign In / Providers* › décocher **Allow new users to sign up** › *Save*. (Tant que l'étape 6 n'est pas faite.)
2. **Lancer les scripts** dans *SQL Editor › New query › Run*, dans l'ordre (chacun peut être relancé sans risque) : `outils/supabase.sql` (déjà fait), `outils/droits.sql`, `outils/photos.sql`, puis **`outils/acces.sql`**.
   À la fin, `acces.sql` affiche les **comptes qui n'auront plus accès** (hors @tridelsa.ch ou non confirmés). Pour en garder un (ex. le compte de sauvegarde) : `insert into public.tf_exceptions (email) values ('adresse@exemple.ch');`.
   Les cadres reconnus aujourd'hui sont repris dans la table **`tf_cadres`** (et ceux qui ont une adresse hors @tridelsa.ch, dans les exceptions).
3. **Fonction « Créer un accès »** (pour un externe, ou créer un compte à la place de quelqu'un) : Supabase › *Edge Functions* › *Deploy a new function* › *Via Editor* ; nom **`creer-utilisateur`** ; coller `outils/supabase-fonction/creer-utilisateur.ts` ; *Deploy*. Une adresse hors @tridelsa.ch créée ainsi est ajoutée aux exceptions.
4. **Envoi des e-mails** : l'envoi fourni de base par Supabase ne part qu'aux membres de l'équipe Supabase, 2 à 3 par heure. Il faut un vrai serveur : *Authentication › Emails › SMTP Settings* › *Enable custom SMTP*.
   - Microsoft 365 de Tridel : hôte `smtp.office365.com`, port `587`, une boîte d'envoi (ex. `triflow@tridelsa.ch`) avec « SMTP authentifié » autorisé par l'administrateur M365.
   - Ou un service d'envoi (ex. Brevo, gratuit jusqu'à 300 e-mails par jour) : suivre sa page « SMTP », et ajouter dans le DNS de tridelsa.ch les enregistrements qu'il demande (SPF / DKIM), sinon les e-mails finissent en indésirables.
   - Nom de l'expéditeur : `TriFlow`.
5. **Adresse du site et textes des e-mails** :
   - *Authentication › URL Configuration* : **Site URL** = `https://tridelsa.github.io/triflow/`, et la même adresse dans **Redirect URLs**.
   - *Authentication › Emails › Templates* (textes en français à coller) :
     - **Confirm signup** — Sujet : `Activez votre compte TriFlow` — Message : `<p>Bonjour,</p><p>Pour activer votre compte TriFlow, cliquez ici : <a href="{{ .ConfirmationURL }}">activer mon compte</a>.</p><p>Si vous n'avez rien demandé, ignorez cet e-mail.</p>`
     - **Reset password** — Sujet : `Nouveau mot de passe TriFlow` — Message : `<p>Bonjour,</p><p>Pour choisir un nouveau mot de passe, cliquez ici : <a href="{{ .ConfirmationURL }}">choisir mon mot de passe</a>.</p><p>Si vous n'avez rien demandé, ignorez cet e-mail.</p>`
   - *Authentication › Sign In / Providers › Email* : **Confirm email** doit être coché (réglage par défaut).
6. **Ouvrir l'inscription** : recocher **Allow new users to sign up**.
7. *Facultatif* (évite même la création de comptes inutiles) : *Authentication › Hooks* › **Before User Created** › *Postgres* › schéma `public`, fonction **`tf_avant_inscription`** › *Create*.

**Tester** : créer un compte avec une adresse @tridelsa.ch (e-mail reçu, lien, connexion), puis avec une adresse Gmail (refusée).

### Donner accès à un collègue
- Collègue avec une adresse @tridelsa.ch : il clique **Créer mon compte** sur la page de connexion.
- Sinon (externe, ou pour le faire à sa place) : **cadres**, *Options › Personnes › Créer un accès*, puis copier le message à transmettre.
- **À la main** (si besoin) : Supabase › Authentication › Users › Add user › Create new user, cocher « Auto confirm » ; pour une adresse hors @tridelsa.ch, l'ajouter aussi à `tf_exceptions`.

### Qui est qui, et qui peut supprimer
- TriFlow reconnaît la personne d'après son adresse e-mail : le nom de famille du Planning Tridel doit s'y trouver (`thomas.bonnant@…` → BONNANT). Sinon, elle choisit son nom à la première connexion.
- Seuls les **cadres** peuvent supprimer définitivement ; les autres archivent. La liste des cadres est la table **`tf_cadres`** de Supabase (*Table Editor › tf_cadres › Insert row*, adresse en minuscules) : elle ne se modifie pas depuis le site. La base tient aussi un journal des modifications (`outils/droits.sql`).

### Retirer un accès
Supabase › Authentication › Users › supprimer l'utilisateur. Ses rapports restent (les noms y sont figés).

### Personnel
La liste du personnel et les groupes viennent du **Planning Tridel** (fichier Excel → `planning-AAAA.json`). TriFlow la relit une fois par jour.

---

## 3. Modifier le site

1. Modifier `index.html`, `css/triflow.css` ou un fichier de `js/` (directement sur GitHub ou en local), puis changer le numéro `?v=` des balises dans `index.html`.
2. Enregistrer (commit) sur la branche `main` : GitHub Pages met le site à jour tout seul.
3. Les postes reçoivent la nouvelle version au prochain chargement (Ctrl+F5 pour forcer).

Le site garde une copie locale des données (IndexedDB, base `triflow-cache`) pour s'ouvrir instantanément. Il ne télécharge ensuite que les fiches modifiées.

---

### Avec Claude Code
Le fichier `CLAUDE.md` décrit le projet pour Claude (structure du code, règles, interdits) et les tests automatiques sont dans `outils/tests/` (`python3 outils/tests/test.py --captures`, avec une fausse base et des données inventées). Ouvrir Claude Code sur ce dépôt et demander les changements en français.

---

## 4. Sauvegardes

### Automatique (chaque lundi)
Le workflow **Sauvegarde TriFlow** (onglet *Actions* du dépôt) exporte toute la base chaque lundi vers 5h. Il la compresse et la **chiffre**, puis la garde 90 jours dans les « artifacts » de l'exécution. On peut aussi le lancer à la main : *Actions › Sauvegarde TriFlow › Run workflow*.

**Réglage à faire une seule fois** (*Settings › Secrets and variables › Actions › New repository secret*) :

| Secret | Valeur |
|---|---|
| `TRIFLOW_EMAIL` | adresse d'un compte TriFlow dédié (ex. `sauvegarde@tridelsa.ch`), créé comme au §2 (hors @tridelsa.ch : l'ajouter à `tf_exceptions`) |
| `TRIFLOW_PASSWORD` | son mot de passe |
| `BACKUP_PASSWORD` | un mot de passe de chiffrement long, **à conserver en lieu sûr** (sans lui, les sauvegardes sont illisibles) |

### Manuelle
Dans l'application : *Options › Sauvegarde › Exporter la sauvegarde* (fichier `.json`).

### Restaurer
1. Télécharger l'artifact voulu (*Actions › exécution › Artifacts*) et le dézipper : `triflow-sauvegarde-AAAA-MM-JJ.json.gz.enc`.
2. Le déchiffrer (Linux, Mac ou Git Bash sous Windows) :
   ```
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in triflow-sauvegarde-AAAA-MM-JJ.json.gz.enc -out sauvegarde.json.gz
   gunzip sauvegarde.json.gz
   ```
3. Dans l'application : *Options › Sauvegarde › Restaurer une sauvegarde…* et choisir `sauvegarde.json`. **Attention** : cela remplace toutes les données de la base.

---

## 5. Si Supabase devait disparaître

Les données sont de simples documents JSON (voir §1). Pour changer d'hébergeur :
1. Créer une nouvelle base PostgreSQL (Supabase ou autre) avec `outils/supabase.sql`.
2. Mettre son adresse et sa clé publique dans `index.html` (`SUPABASE_URL`, `SUPABASE_KEY`).
3. Se connecter, puis *Options › Sauvegarde › Restaurer* avec la dernière sauvegarde.

Sans base du tout, l'application fonctionne aussi seule dans un navigateur (données locales) : il suffit de vider `SUPABASE_URL` dans `index.html`.

---

## 6. Reprise de CareOffice (historique, 2026)

Les scripts de `outils/careoffice/` ont converti les exports de CareOffice (articles, emplacements, KKS, historique de stock, 6 048 travaux, fournisseurs) en fichiers d'import TriFlow. Ces imports se font depuis l'application (menus *⋯ Plus › Importer depuis CareOffice*). Les fichiers de données eux-mêmes ne sont **pas** dans ce dépôt (il est public).

*Contact : Thomas Bonnant, informatique Tridel.*
