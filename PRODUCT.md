# Product

TriFlow est la GMAO (gestion de la maintenance) de Tridel, l'usine d'incinération de Lausanne. Elle remplace CareOffice : pièces et stock, emplacements, équipements (repères KKS), travaux à faire, rapports d'intervention, planning de la semaine et historique de « qui a fait quoi ».

## Platform
web

## Stack
Site statique sans compilation (HTML, un fichier CSS, scripts JS classiques qui partagent des variables globales), publié par GitHub Pages. Données dans Supabase (une table `docs`), cache IndexedDB, temps réel. Personnes et présences lues dans le Planning Tridel (fichier JSON exporté d'Excel).

## Users
- **Techniciens d'atelier** (électriciens, automaticiens, mécaniciens, intendance) : surtout sur téléphone, souvent avec des gants, parfois sans réseau. Ils scannent une pièce, la sortent du stock, cochent un travail, écrivent un court rapport.
- **Cadres et responsables d'équipe** : sur ordinateur. Ils créent et répartissent les travaux, préparent le planning de la semaine suivante et l'impriment en A3 chaque semaine, suivent le stock à commander.
- **Le responsable informatique** (Thomas Bonnant) administre l'outil (accès, sauvegardes, imports).

## Product Purpose
Que chacun sache, en un coup d'œil, ce qu'il y a à faire, où est la pièce, et ce qui a été fait, sans paperasse.

## Positioning
Outil interne, en français, pensé pour l'atelier plutôt que pour le bureau. Doit être plus simple et plus rapide que CareOffice.

## Operating Context
Usine en exploitation continue : équipes, piquet, rotations (codes R, PIQ, EN, PI, CA…). Locaux techniques, magasins (codes de salle comme E1.11), étiquettes QR sur les pièces et les emplacements. Le planning papier A3 affiché à l'atelier reste la référence de la semaine.

## Capabilities and Constraints
- Toute modification est annulable (« Annuler ») et journalisée ; on archive au lieu de supprimer ; seule la direction (« Cadres ») peut supprimer définitivement.
- Le dépôt du code est public : jamais de données réelles dedans.
- CareOffice n'est lu qu'en lecture.
- Le fichier Excel du Planning Tridel fait foi pour les présences.

## Brand Commitments
Même famille visuelle que le Planning Tridel (vert Tridel, dessin de l'usine dans le bandeau, polices Space Grotesk et Inter). Mot d'ordre : « facile ».

## Evidence on Hand
Captures de test dans `outils/tests/captures/` (ordinateur et téléphone), modèle Excel de la feuille de planning A3, retours de l'équipe (« unanimité » lors de la présentation).

## Product Principles
1. **Facile** : peu de texte, des mots simples, une action évidente par écran.
2. **Simplifier plutôt qu'ajouter** ; pas deux chemins pour la même chose.
3. **Téléphone et ordinateur** à égalité ; au téléphone, tout se fait au doigt (zones de 44 px).
4. **Rien ne se perd** : annuler, archiver, historique.
5. **Un seul style de filtre** : les pastilles.

## Accessibility & Inclusion
Contrastes WCAG AA dans les deux thèmes (clair et sombre automatiques), repère clavier visible, respect de « réduire les animations », textes lisibles en atelier (pas en dessous de 11 px).
