---
name: TriFlow
description: GMAO de Tridel — outil d'atelier clair, aux couleurs du logo Tridel (vert foncé principal ; vert clair, jaune, orange, rouge en touches), pensé pour le doigt et le téléphone.
colors:
  # ruban Tridel (logo, sous le bandeau) : #0C6E3E, #A4C961, #FBDC17, #F18413, #E11817
  tridel-green-light: "#A4C961"
  tridel-yellow: "#FBDC17"
  tridel-orange: "#F18413"
  tridel-red: "#E11817"
  bg: "#F3F5F2"
  surface: "#FFFFFF"
  sunk: "#EDF1EC"
  ink: "#14201A"
  muted: "#58665E"
  line: "#DFE6E0"
  accent: "#0C6E3E"
  accent-soft: "#E4F1E8"
  accent-line: "#A9D1B6"
  signal: "#E8770F"
  steel: "#0C6E3E"
  plate: "#F6EFDC"
  plate-ink: "#5B4718"
  ok: "#1C6E3E"
  warn: "#8A5A00"
  bad: "#C62838"
  out: "#B42318"
  in: "#16703F"
  hero-a: "#0A5A33"
  hero-b: "#0B6238"
  hero-c: "#0C6E3E"
  band-top: "#FFFFFF"
  today: "#B85A0B"
  # thème sombre (automatique)
  bg-dark: "#0D1310"
  surface-dark: "#151D18"
  sunk-dark: "#111814"
  ink-dark: "#E6EEE8"
  muted-dark: "#94A69A"
  line-dark: "#243029"
  accent-dark: "#3FB16F"
  hero-a-dark: "#07361F"
  hero-b-dark: "#083F24"
  hero-c-dark: "#0A4A2B"
  # point d'état de la connexion, sur le bandeau vert
  dot-ok: "#6FD08A"
  dot-wait: "#F2C14E"
  dot-bad: "#FF6B5E"
  # métiers (planning, À planifier)
  m-elec: "#E3A008"
  m-auto: "#7C5CD6"
  m-meca: "#D2622E"
  m-intend: "#2E8FC2"
  # bouton « ? » posé sur le bandeau
  hero-glass: "rgba(8, 28, 16, 0.55)"
  # feuilles imprimées (rapport, étiquettes, planning A3)
  print-ink: "#000000"
  print-muted: "#555555"
  print-soft: "#444444"
  print-faint: "#999999"
  print-guide: "#C8C8C8"
  print-plate: "#F5D66E"
  print-blue: "#0000FF"
typography:
  display:
    fontFamily: "Space Grotesk, Segoe UI, system-ui, sans-serif"
    fontWeight: 700
    lineHeight: 1.15
  body:
    fontFamily: "Inter, -apple-system, Segoe UI, Arial, sans-serif"
    fontSize: "15px"
    lineHeight: 1.5
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, Consolas, monospace"
  print-planning:
    fontFamily: "Calibri, Arial, sans-serif"
  h1:
    fontSize: "1.7rem"
  h2:
    fontSize: "1.4rem"
  number:
    fontSize: "2rem"
  number-big:
    fontSize: "2.5rem"
  title-big:
    fontSize: "1.55rem"
  title:
    fontSize: "1.1rem"
  title-section:
    fontSize: "1.4rem"
  text:
    fontSize: "0.95rem"
  tabbar:
    fontSize: "0.64rem"
  label:
    fontSize: "0.8rem"
    fontWeight: 700
    letterSpacing: "0.08em"
rounded:
  xs: "4px"
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "20px"
  xl-phone: "16px"
  pill: "999px"
spacing:
  gutter-phone: "12px"
  gutter-desktop: "20px"
  touch: "44px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
  button-out:
    backgroundColor: "{colors.out}"
    textColor: "#FFFFFF"
  button-in:
    backgroundColor: "{colors.in}"
    textColor: "#FFFFFF"
  chip:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
  chip-selected:
    backgroundColor: "{colors.accent}"
    textColor: "#FFFFFF"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
  location-plate:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.plate-ink}"
    rounded: "{rounded.xs}"
---

# DESIGN — TriFlow

Les jetons ci-dessus sont la référence ; dans le code ils vivent dans `:root` de `css/triflow.css` (avec leurs équivalents sombres sous `prefers-color-scheme: dark`). Toujours utiliser `var(--…)`, jamais une couleur écrite en dur.

## Overview
Outil de travail (mode « Operate ») : la lisibilité et la rapidité passent avant l'effet. L'identité vient du **bandeau vert avec le dessin de l'usine** (grand sur l'accueil, barre fine ailleurs), de la **bande « Aujourd'hui »** couleur pêche collée dessous, des **plaques jaunes** d'emplacement et des **codes KKS** en police mono. Même famille que le Planning Tridel.

## Colors
- Vert Tridel `accent` pour l'action principale et la sélection ; `accent-soft` pour les fonds sélectionnés (jamais de barre de couleur sur le bord gauche).
- `bad` (rouge) = en retard / haute priorité ; `warn` (ambre) = cette semaine / stock bas ; `ok` = fait.
- `out` / `in` : boutons Sortir / Entrer du stock, mêmes couleurs dans les deux thèmes.
- Couleurs par métier : électricien ambre, automaticien violet, mécanicien orange, intendance bleu (`.mdot.m-*`).
- Hachures rouges = personne absente au planning (signal voulu, pas une décoration).

## Typography
- Titres en Space Grotesk, texte en Inter, codes (KKS, références, quantités) en IBM Plex Mono.
- Échelle de texte : `--t-xs` .72rem, `--t-sm` .8rem, `--t-md` .88rem, `--t-base` .95rem, `--t-lg` 1.1rem, `--t-xl` 1.4rem. Rien en dessous de 11 px.
- Étiquettes de section : `--t-sm`, majuscules, espacement .08em, couleur `muted`.

## Layout
- Ordinateur : liste à gauche + fiche à droite ; accueil en grille de cartes (« une carte par page ») sous « Ma journée ».
- Téléphone (≤ 760 px) : une colonne, barre de navigation en bas, bouton rond **Scanner**, fenêtres qui montent du bas. Marges 12 px.

## Elevation & Depth
Cartes blanches avec ombre très douce (`--sh-2`) ; pas de lueur colorée. Le bandeau est la seule surface sombre.

## Shapes
Arrondis : `--r-sm` boutons et champs, `--r-md`/`--r-lg` lignes et blocs, `--r-xl` cartes, `--r-pill` pastilles.

## Components
- **Pastilles** (`.ychip`) : le seul style de filtre. Sélectionnée = fond vert.
- **✓ « C'est fait »** (`.tick`) : rond, 44 px sur téléphone ; se remplit de vert au toucher.
- **Fenêtres** (`dialog()`) : en-tête, corps, pied avec Annuler + action. Sur téléphone, feuille qui monte du bas.
- **Pages vides** : petite usine dessinée + phrase + l'action utile.
- **Mouvements** : courts (≤ 300 ms, `--ease-out`), désactivés si « réduire les animations ».

## Do's and Don'ts
- ✅ Une action évidente par écran ; des mots simples ; zones de 44 px au doigt.
- ✅ Annuler plutôt que confirmer ; archiver plutôt que supprimer.
- ❌ Pas de listes déroulantes comme filtres (pastilles), pas de bordure colorée sur un côté, pas de texte gris sur fond teinté.
- ❌ Pas de nouvelle couleur sans jeton.
