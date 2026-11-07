---
name: gmao-tridel
description: Métier de la maintenance pour TriFlow (GMAO de Tridel). À lire avant d'ajouter ou de modifier une fonction liée aux équipements, aux travaux, aux rapports, au préventif, au stock ou aux indicateurs ; donne le vocabulaire, les correspondances avec une GMAO classique (SAP PM, Maximo), les règles de Tridel et les indicateurs.
---

# GMAO Tridel — le métier

TriFlow est une GMAO volontairement **simple** (mot d'ordre « facile », voir `PRODUCT.md`). Les grandes GMAO (SAP PM, Maximo, Fiix) servent ici de **référence de vocabulaire et de bonnes idées**, jamais de modèle à recopier : on prend l'idée, on garde l'écran simple.

## 1. Correspondances avec une GMAO classique

| Notion GMAO (SAP PM) | Dans TriFlow | Où dans le code |
|---|---|---|
| Poste technique / équipement (functional location, equipment) | **Repère KKS** (code + désignation, système déduit du code) | collection `kks`, `zoneOf`, `sysLabel`, page Installation |
| Avis (notification : constat, demande) | Pas d'objet séparé : le **constat** est dans le rapport ; un petit travail sert de demande | `interventions.constat`, `taches kind:'petit'` |
| Ordre de travail (work order) | **Rapport** (numéro `R26-017`), statut Ouverte / En cours / Terminée | `interventions`, `nextNum`, `STATUTS` |
| Plan préventif + gamme (maintenance plan, task list) | **Travail récurrent** (`freq`, `prochaine`) avec « Ce qu'il faut faire » | `taches`, `addFreq`, `advanceTask` |
| Ordonnancement (scheduling) | **Planning de la semaine** (personne × jour), imprimé en A3 | collection `plan`, `planWeek`, `planCheckDialog` |
| Confirmation / clôture technique (TECO) | « **C'est fait** » : coché sans rapport (`faits`) ou rapport terminé | `doTache`, `finishTask` |
| Sortie de magasin sur ordre (goods issue) | Sortie liée à un rapport → « Pièces consommées » | `quickMove`, `linkPieceToReport`, `addStock` |
| Article / emplacement de stockage | **Pièce** + **emplacement** (local / plaque jaune) | `pieces`, `salles`, `lieux` |
| Historique équipement | Fiche KKS : rapports, travaux, pièces liés | page Installation |
| Journal des modifications | Historique « qui a fait quoi » | `journal`, `JRN`, Options › Historique |

## 2. Règles propres à Tridel (ne pas casser)
- **Rien n'est supprimé** : on archive (`arch`). Suppression définitive = cadres uniquement (`canDel()`), et la base le vérifie (`outils/droits.sql`).
- **Toute modification passe par `tx()`** (annulable, journalisée).
- **Le Planning Tridel (Excel) fait foi** pour les présences ; TriFlow ne les modifie jamais.
- Un rapport saisi après coup démarre **Terminé** ; un rapport ouvert depuis l'onglet « En cours » peut rester ouvert.
- Pas de **durée** dans les rapports (retirée à la demande de l'équipe).
- Travaux : `kind:'petit'` (une fois, priorité haute / normale / basse) ou récurrent (`freq`). `rapport` : vide = demander, `'oui'`, `'non'`.
- Métiers : électricien, automaticien, mécanicien, intendance (`METIERS`, `metOf`, `tMet`).
- CareOffice : lecture seule (imports réservés aux cadres).

## 3. Indicateurs utiles (si on en ajoute)
Toujours calculés à partir des données existantes, affichés simplement (un chiffre + une phrase), jamais de classement entre personnes.
- **Préventif fait à l'heure** = travaux récurrents faits avant ou à leur date ÷ travaux récurrents arrivés à échéance, sur 4 semaines.
- **Retards** = travaux dont `prochaine` < aujourd'hui (`tKey(t) === 'retard'`), avec leur âge (`lateLbl`).
- **Part du correctif** = rapports de type « Corrective » ÷ tous les rapports du mois (types dans `db.listes.types`).
- **Pannes répétées** = nombre de rapports correctifs par repère KKS sur 3 / 12 mois (les 5 premiers = équipements à surveiller).
- **MTBF** (temps moyen entre pannes) = période ÷ nombre de pannes, par KKS. **MTTR** demande une durée de réparation : TriFlow ne la note plus, donc ne pas le proposer sans en parler à Thomas.
- **Stock** : pièces sous le minimum (`isLow`), à zéro (`isOut`), sorties du mois par pièce.

## 4. Idées tirées des GMAO pro (à proposer, pas à imposer)
- **Codes de panne** (cause / dégât / action, comme les « catalogues » SAP) : une petite liste dans Options, un choix facultatif dans le rapport → permet les « pannes répétées ».
- **Demande d'intervention** par n'importe qui (photo + KKS + phrase), qui devient un petit travail à valider par le responsable du métier.
- **Gammes** : liste de points à cocher dans un travail récurrent (« Ce qu'il faut faire » en cases).
- **Compteurs** (heures de marche) pour un préventif déclenché à l'usage plutôt qu'au calendrier.
- **Pièces de rechange par équipement** (nomenclature) : déjà amorcé par le lien pièce ↔ KKS.

## 5. Avant de livrer une fonction métier
1. Le mot affiché est-il celui de l'atelier (« travail », « rapport », « pièce », « emplacement », « repère KKS ») et pas un mot de SAP ?
2. Ça marche au téléphone, avec des gants, et hors ligne (les données passent par `tx()` ; pas d'appel réseau obligatoire) ?
3. Un technicien le fait en **3 touches ou moins** ?
4. L'historique dit clairement qui a fait quoi (`jDescribe` à compléter si nouveau champ) ?
5. Ajouter une vérification dans `outils/tests/test.py`.

Inspiré des notions générales de SAP Plant Maintenance (équipements, avis, ordres, plans préventifs, MTBF/MTTR) ; aucun texte repris.
