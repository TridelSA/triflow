---
name: TriFlow
description: GMAO de Tridel — outil d'atelier clair, vert Tridel, pensé pour le doigt et le téléphone.
colors:
  bg: "#F1F4F1"
  surface: "#FFFFFF"
  sunk: "#EAF0EB"
  ink: "#17211C"
  muted: "#5E6E64"
  line: "#E1E8E2"
  accent: "#1F7A4D"
  accent-soft: "#E7F4EC"
  accent-line: "#9CCDB2"
  signal: "#E8770F"
  steel: "#1D516B"
  plate: "#F6EFDC"
  plate-ink: "#5B4718"
  ok: "#1C6E3E"
  warn: "#8A5A00"
  bad: "#C62838"
  out: "#B42318"
  in: "#16703F"
  hero-a: "#0E2818"
  hero-b: "#1F5C2C"
  hero-c: "#3C8A48"
  band-top: "#FCEFE3"
  today: "#B85A12"
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
  h1:
    fontSize: "1.7rem"
  h2:
    fontSize: "1.4rem"
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
