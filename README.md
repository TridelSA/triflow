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

- La clé Supabase présente dans `index.html` est la clé **publique** (« publishable ») : c'est normal. Sans compte connecté, la base ne se lit pas et ne se modifie pas (règles RLS dans `outils/supabase.sql`).
- **Ne jamais** mettre la clé `service_role` dans le site ou dans ce dépôt (il est public).

---

## 2. Administrer

### Donner accès à un collègue
**Depuis TriFlow (cadres)** : *Options › Personnes › Créer un accès*. Choisir la personne (l'adresse est proposée), garder le mot de passe proposé, *Créer le compte*, puis copier le message à transmettre.

Installation unique de ce bouton :
1. Lancer `outils/droits.sql` (SQL Editor › Run), qui définit qui est cadre.
2. Supabase › **Edge Functions** › *Deploy a new function* › *Via Editor* ; nom **`creer-utilisateur`** ; coller `outils/supabase-fonction/creer-utilisateur.ts` ; *Deploy*.

La clé d'administration reste dans Supabase : elle n'est jamais dans le site.

**À la main** (si besoin) : Supabase › Authentication › Users › Add user › Create new user, cocher « Auto confirm ».

### Qui est qui, et qui peut supprimer
- TriFlow reconnaît la personne d'après son adresse e-mail : le nom de famille du Planning Tridel doit s'y trouver (`thomas.bonnant@…` → BONNANT). Sinon, elle choisit son nom à la première connexion.
- Seuls les **cadres** (groupe « Cadres » du planning) peuvent supprimer définitivement. Les autres archivent. La base applique la même règle et tient un journal des modifications : script `outils/droits.sql`, à lancer une fois dans *SQL Editor*.

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
| `TRIFLOW_EMAIL` | adresse d'un compte TriFlow dédié (ex. `sauvegarde@…`), créé comme au §2 |
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
