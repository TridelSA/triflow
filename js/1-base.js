'use strict';
/* TriFlow — Base : outils, icônes, menus, migrations des données, chargement local. (Fichiers chargés dans l'ordre par index.html.) */
/* =====================================================================
   TriFlow — prototype local (v2)
   Modèle de données (prévu pour être repris dans une vraie base) :
     salles(id, etage, numero, nom)                     → code E{etage}.{numero}
     lieux(id, salleId, chemin[], note)                 → code « E1.14 / A / 11 / 1 » (arborescence libre)
     personnes(id, prenom, nom, fonction, actif)
     kks(id, code, designation)                         → zone déduite de la lettre de groupe KKS
     pieces(id, ref, designation, categorie, fabricant, refFab, fournisseur, unite, stockMin, notes,
            kks[kksId], stock[{lieuId, qte}])           → lien pièce ↔ KKS (n-n)
     interventions(id, num, date, type, statut, kksId, titre, constat, travaux, duree,
            intervenants[personneId], pieces[{pieceId, lieuId, qte}])
     mouvements(id, date, pieceId, lieuId, qte(+/-), motif, ref)
     listes{categories[], unites[], types[]}, reglages{qrBase, labelFmt}
   ===================================================================== */
const KEY = 'gmao-tridel-v1';
const coll = new Intl.Collator('fr', {numeric: true, sensitivity: 'base'});
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* Mise à jour ciblée : compare l'ancien et le nouveau HTML et ne change que ce qui diffère.
   La page ne « saute » plus : défilement, focus et saisie en cours sont conservés.
   skip : sélecteur des blocs dont on garde le contenu (remplis ensuite par fillList / fillDetail). */
const MORPH = {anim: false};
function morph(el, html, skip) {
  const t = document.createElement('template');
  t.innerHTML = html;
  morphKids(el, t.content, skip);
}
function morphKids(a, b, skip) {
  const an = [...a.childNodes],
    bn = [...b.childNodes];
  const key = n => (n.nodeType === 1 ? n.getAttribute('data-id') || n.id || '' : '');
  let i = 0;
  for (; i < bn.length; i++) {
    const nb = bn[i];
    let na = an[i];
    /* liste avec identifiants : retrouver l'élément correspondant plus loin */
    const k = key(nb);
    if (k && na && key(na) !== k) {
      const found = an.find((x, j) => j > i && key(x) === k && x.nodeName === nb.nodeName);
      if (found) {
        a.insertBefore(found, na);
        an.splice(an.indexOf(found), 1);
        an.splice(i, 0, found);
        na = found;
      }
    }
    if (!na) {
      a.appendChild(nb.cloneNode(true));
      if (MORPH.anim && nb.nodeType === 1) a.lastChild.classList.add('m-in');
      continue;
    }
    if (na.nodeType !== nb.nodeType || na.nodeName !== nb.nodeName || (k && key(na) !== k)) {
      const c = nb.cloneNode(true);
      a.replaceChild(c, na);
      an[i] = c;
      if (MORPH.anim && c.nodeType === 1 && k) c.classList.add('m-in');
      continue;
    }
    if (na.nodeType === 3 || na.nodeType === 8) {
      if (na.nodeValue !== nb.nodeValue) {
        na.nodeValue = nb.nodeValue;
        const p = na.parentElement;
        if (MORPH.anim && p && p.matches('b, .badge, small, strong')) {
          p.classList.remove('m-bump');
          void p.offsetWidth;
          p.classList.add('m-bump');
        }
      }
      continue;
    }
    morphEl(na, nb, skip);
  }
  for (let j = an.length - 1; j >= i; j--) an[j].remove();
}
function morphEl(a, b, skip) {
  for (const {name, value} of [...b.attributes]) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
  for (const {name} of [...a.attributes]) if (!b.hasAttribute(name)) a.removeAttribute(name);
  const tag = a.nodeName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    if (document.activeElement !== a) {
      if (a.type === 'checkbox' || a.type === 'radio') a.checked = b.hasAttribute('checked');
      else a.value = tag === 'TEXTAREA' ? b.textContent : b.getAttribute('value') || '';
    }
    if (tag === 'TEXTAREA') return;
  }
  if (skip && a.matches(skip)) return;
  morphKids(a, b, skip);
  if (tag === 'SELECT' && document.activeElement !== a) {
    const o = [...b.options].findIndex(x => x.hasAttribute('selected'));
    a.selectedIndex = o >= 0 ? o : 0;
  }
  if (tag === 'DETAILS') a.open = b.hasAttribute('open');
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
const norm = s =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const round = n => Math.round(n * 1000) / 1000;
const num = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('fr-CH');
function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
const fmtD = s => {
  if (!s) return '';
  const d = new Date(s.length === 10 ? s + 'T12:00' : s);
  return isNaN(d) ? s : d.toLocaleDateString('fr-CH', {day: '2-digit', month: '2-digit', year: 'numeric'});
};
const fmtDT = s =>
  new Date(s).toLocaleString('fr-CH', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'});

/* ---------------- Icônes ---------------- */
const ICONS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  repeat: 'M4 11V9a3 3 0 013-3h12M16 3l3 3-3 3M20 13v2a3 3 0 01-3 3H5M8 21l-3-3 3-3',
  home: 'M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-6h4v6',
  box: 'M3 7.5l9-4.5 9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9',
  wrench: 'M14.5 5.5a4 4 0 005 5L11 19a2.1 2.1 0 01-3-3l8.5-8.5a4 4 0 01-2-2zM14.5 5.5l2-2',
  plant: 'M3 21V11l5 3v-3l5 3V6h3v15M3 21h18M18 21V4h2.5v17M7 17h1M11 17h1',
  shelf: 'M4 3v18M20 3v18M4 8h16M4 14h16M4 20h16',
  cog: 'M12 9a3 3 0 100 6 3 3 0 000-6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1',
  search: 'M10.5 4a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM20 20l-4.8-4.8',
  printer: 'M7 9V3.5h10V9M7 17H4.5v-7h15v7H17M7 14h10v6.5H7z',
  out: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14',
  in: 'M12 15V4M7.5 8.5L12 4l4.5 4.5M5 20h14',
  plus: 'M12 5v14M5 12h14',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18h2v2M18 18h2v2h-2',
  report: 'M7 3h7l5 5v13H7zM14 3v5h5M10 12h6M10 16h6',
  move: 'M4 8h13l-3.5-3.5M20 16H7l3.5 3.5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
  mic: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3M8.5 21h7',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h2M12 14h2M16 14h.01M8 17h2',
  scan: 'M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M7 12h10',
  merge: 'M6 3v6a6 6 0 006 6h6M15 12l3 3-3 3M6 21v-6',
  excel: 'M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8zM14 3v5h5M9 12l5 6M14 12l-5 6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  chev: 'M9 6l6 6-6 6',
  arrow: 'M4 12h15M14 7l5 5-5 5',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  truck: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19.5a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zM17 19.5a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z',
  flame: 'M12 3c.8 3.5 5 5.2 5 10a5 5 0 01-10 0c0-2.6 1.6-3.9 2-6.2.9.9 1.6 2 1.6 3.4C12.6 8 12.4 5.5 12 3z',
  drop: 'M12 3s6 6.8 6 11a6 6 0 01-12 0c0-4.2 6-11 6-11z',
  turbine: 'M12 10a2 2 0 100 4 2 2 0 000-4zM12 10V3.5l3.5 2.5M14 12h6.5L18 15.5M12 14v6.5L8.5 18M10 12H3.5L6 8.5',
  heat: 'M4 20h16M7.5 16.5c0-2 2-2 2-4.2S7.5 10 7.5 8M12 16.5c0-2 2-2 2-4.2S12 10 12 8M16.5 16.5c0-2 2-2 2-4.2s-2-2.3-2-4.3',
  bolt: 'M13 2.5L4.5 14H11l-1 7.5L18.5 10H12z',
  gauge: 'M12 14.5l4-4.5M4 18a8.5 8.5 0 1116 0',
  water:
    'M3 9c2 0 2-1.5 4.5-1.5S9.5 9 12 9s2.5-1.5 4.5-1.5S19 9 21 9M3 14c2 0 2-1.5 4.5-1.5S9.5 14 12 14s2.5-1.5 4.5-1.5S19 14 21 14M3 19c2 0 2-1.5 4.5-1.5S9.5 19 12 19s2.5-1.5 4.5-1.5S19 19 21 19',
  person: 'M12 4a4 4 0 100 8 4 4 0 000-8zM4 21c.8-4 4-6 8-6s7.2 2 8 6',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.5M4 12h.5M4 18h.5',
  save: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 14h8v7H8z',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.5'
};
let menuSeq = 0;
function menu(items, label = 'Plus', ic = 'more', cls = '') {
  const id = 'menu-' + ++menuSeq;
  return `<div class="menu"><button type="button" class="btn ${cls}" data-act="menu" aria-haspopup="menu" aria-expanded="false" aria-controls="${id}">${icon(ic)}${label}<svg class="ico chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button><div class="menu-list" id="${id}" role="menu" hidden>${items
    .map(it =>
      it === '-'
        ? '<hr>'
        : `<button type="button" role="menuitem" data-act="${it[0]}" ${Object.entries(it[3] || {})
            .map(([k, v]) => `data-${k}="${esc(v)}"`)
            .join(' ')}>${icon(it[2])}${it[1]}</button>`
    )
    .join('')}</div></div>`;
}
function closeMenus(except) {
  document.querySelectorAll('.menu-list').forEach(m => {
    if (m !== except && !m.hidden) {
      m.hidden = true;
      m.previousElementSibling?.setAttribute('aria-expanded', 'false');
    }
  });
}
const icon = n => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n] || ''}"/></svg>`;

/* ---------------- Zones de l'usine (lettre de groupe principale du code KKS) ---------------- */
const ZONES = [
  {k: 'E', n: 'Déchets & résidus', d: 'Réception, fosse, alimentation, mâchefers', ic: 'truck'},
  {k: 'H', n: 'Four-chaudière & fumées', d: 'Foyer, chaudière, air de combustion, traitement des fumées', ic: 'flame', core: true},
  {k: 'L', n: 'Cycle eau-vapeur', d: 'Eau alimentaire, vapeur, condensats', ic: 'drop'},
  {k: 'M', n: 'Turbine & alternateur', d: 'Groupe turbo-alternateur', ic: 'turbine'},
  {k: 'AB', n: 'Électricité', d: 'Réseau, transformateurs, tableaux', ic: 'bolt'},
  {k: 'N', n: 'Chauffage à distance', d: 'Échangeurs, réseau CAD', ic: 'heat'},
  {k: 'C', n: 'Contrôle-commande', d: 'Mesures, automatismes, conduite', ic: 'gauge'},
  {k: '*', n: 'Eaux & auxiliaires', d: 'Eaux, refroidissement, air comprimé, bâtiments', ic: 'water'}
];
function zoneOf(code) {
  const m = String(code || '')
    .toUpperCase()
    .match(/^\d*\s*([A-Z])/);
  const L = m ? m[1] : '';
  return ZONES.find(z => z.k !== '*' && z.k.includes(L)) || ZONES[ZONES.length - 1];
}
/* ---------------- Systèmes de l'installation : lettres du code KKS (H › HA › HAC) ---------------- */
const sysOf = code =>
  (String(code || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .match(/^\d*([A-Z]{3})/) || [])[1] || '';
/* Noms des systèmes repris de l'arborescence CareOffice (modifiables en important une liste « CODE;Nom ») */
const SYS_DEFAULT = {
  'A': 'Installations du réseau électrique et de distribution',
  'AG': 'Réseau 50 kV (distribution et commutation)',
  'AGA': 'Installations de distribution',
  'AGT': 'Transfo 25 MVA',
  'AGU': 'Mise à terre, protection contre la foudre 50 kV',
  'AGY': 'Installations de contrôle, de réglage et de protection',
  'AK': 'Réseau 11.5 kV (distribution et commutation)',
  'AKA': 'Installations de distribution',
  'AKU': 'Mise à terre, protection contre la foudre',
  'AKY': 'Installations de contrôle, de réglage et de protection',
  'AQ': "Mesure et comptage d'énergie",
  'AQA': 'Mesure, comptage réseau 50 kV',
  'AR': 'Installations de protection',
  'ARA': 'A définir',
  'AU': 'Installations pour commande, signalisation et systèmes auxiliaires',
  'AUA': 'A définir',
  'AV': 'Distributeur de triage',
  'AVA': 'A définir',
  'B': "Evacuation d'énergie et approvisionnement des besoins internes",
  'BA': 'Energie',
  'BAC': "Evacuation d'énergie",
  'BB': 'Distribution moyenne tension et transformateurs, réseau normal',
  'BBA': "Installations de distribution MT (y compris disjoncteur de l'alternateur)",
  'BBB': 'Disjoncteurs MT',
  'BBT': 'Transformateur 11.5 / 50 kV',
  'BBY': 'Installations de contrôle, de réglage et de protection',
  'BF': 'Distribution basse tension et transformateur, réseau normal',
  'BFA': 'Distributions principales basse tension, réseau normal',
  'BFB': 'Disjoncteurs BT',
  'BFC': 'Disjoncteurs distribution',
  'BFT': 'Transformateurs basse tension (11.5/0,4 kV)',
  'BFY': 'Installations de contrôle, de réglage et de protection',
  'BM': 'Distribution basse tension secourue (par groupe électrogène)',
  'BMA': 'Distribution de courant secourue 400 VAC',
  'BMY': 'Installations de contrôle, de réglage et de protection',
  'BP': 'Installations MT pour entraînements à variateurs de fréquence',
  'BPA': 'Alimentation moyenne tension pour variateurs',
  'BPY': 'Installations de contrôle, de réglage et de protection',
  'BR': 'Alimentation sans interruption en courant -UPS',
  'BRA': 'Distribution de courant sans interruption',
  'BRU': 'Onduleur',
  'BRY': 'Installations de contrôle, de réglage et de protection',
  'BT': 'Batteries',
  'BTA': 'Batterie',
  'BTL': 'Redresseur, Chargeur',
  'BTW': 'Installations communes',
  'BU': 'Distributions de courant continu, réseau normal',
  'BUA': 'Disjoncteurs',
  'BUC': 'Distribution DC 110 V',
  'BUE': 'Distribution DC 24 V',
  'BY': 'Installations communes de contrôle, de réglage et de protection',
  'BYA': 'Mise à la terre',
  'BYF': 'Groupe FI',
  'C': 'Installations de la technique SCC',
  'CA': 'Armoires pour verrouillages de protection',
  'CAA': 'Armoires',
  'CB': 'Contrôle des groupes de fonctions',
  'CBA': 'Postes de processus de la technique de contrôle et de réglage',
  'CBG': "Protection de l'alternateur",
  'CBP': 'Armoires pour la synchronisation',
  'CBW': 'Armoires WAGO',
  'CC': 'Armoires pour cartes entrée-/sortie (cartes I/O)',
  'CCA': 'Remote-I/O',
  'CCG': 'Armoires',
  'CD': 'Armoires pour le contrôle des entraînements',
  'CDA': 'Armoires',
  'CF': 'Armoires pour mesure et enregistrement',
  'CFA': 'Armoires',
  'CFB': 'Analyses des fumées',
  'CG': 'Armoires GTC',
  'CH': 'Protection de chaudière',
  'CHE': 'Armoires protection de chaudière',
  'CJ': 'Niveau de contrôle (commande) du bloc',
  'CJF': 'Système de contrôle/réglage de la chaudière, armoires comprises',
  'CJJ': 'Equipement de surveillance de la turbine',
  'CK': 'Equipements SCC',
  'CKA': "Postes d'opérateurs",
  'CKB': "Ordinateur d'exploitation",
  'CKC': "Postes d'ingénierie",
  'CKD': 'X-terminaux',
  'CKE': 'Imprimante',
  'CKF': 'Switchs et routeur',
  'CKH': 'Ordinateurs de surveillance et de diagnostic des processus',
  'CKQ': "Mesures d'émissions",
  'CU': 'Réglage (partie puissance)',
  'CUA': 'Distributeur central des signalisations',
  'CW': 'Salle de commande',
  'CWA': 'Pupitre de contrôle',
  'CWF': 'Tableau de contrôle',
  'CX': 'Postes de contrôle',
  'CXA': 'Postes de contrôle locaux',
  'CY': 'Technique de communication',
  'CYF': "Equipements d'horloges (horloge à radiotransmission)",
  'CYP': 'Caméras TV avec écrans (moniteurs)',
  'CYT': 'Téléphonie',
  'CYY': "Mesures d'ultrasons",
  'E': 'Approvisionnement en carburant et élimination des résidus',
  'EA': 'Déchargement et stockage des ordures ménagères',
  'EAF': 'Ponts-roulants à déchets',
  'EAG': 'Cabine grutier SdC',
  'EAY': 'Armoires de commande pont , trémies, dévouteur',
  'EG': 'Approvisionnement en mazout',
  'EGA': 'Installations de réception pour le mazout',
  'EGB': 'Réservoirs (mazout)',
  'EGC': 'Station de pompage',
  'EGD': 'Système de tuyauteries',
  'EGY': 'Installations de contrôle, de réglage et de protection',
  'EK': 'Approvisionnement en carburants gazeux',
  'EN': 'Approvisionnement en ordures',
  'ENB': 'Portails halle de déchargement',
  'ENC': 'Portes de fosse Nencki',
  'END': 'Broyeur pour encombrants',
  'ENF': 'Installations de transport (p. ex. convoyeurs à bandes)',
  'ENT': 'Pesage (à ordures)',
  'ENX': 'Installations hydrauliques',
  'ENY': 'Installations de contrôle, de réglage et de protection',
  'EP': 'Réception et chargement des boues de STEP',
  'EPA': 'Portails halle du silo pour boues de STEP',
  'EPB': 'Installation silo',
  'EPC': 'Installation de pompage',
  'EPD': 'Système de conduits',
  'EPE': 'Dispositif de chargement',
  'EPF': 'Dosage des lubrifiants (agents antifriction)',
  'EPX': 'Installation hydraulique',
  'EPY': 'Installations de contrôle, de réglage et de protection',
  'ET': "Installation d'évacuation des cendres",
  'ETG': 'Installation de transport pour cendres sèches',
  'ETH': 'Silo pour cendres',
  'ETN': 'Eaux résiduaires (incinération)',
  'ETY': 'Installations de contrôle, de réglage et de protection',
  'EU': 'Résidus, traitement et installations de transport',
  'EUB': 'Traitement des mâchefers',
  'EUC': 'Lavage des cendres',
  'EUF': 'pont mâchefers',
  'EUT': 'trémies mâchefers',
  'G': 'Approvisionnement en eau et traitement des eaux',
  'GA': 'Approvisionnement en eau brute',
  'GAD': "Installation de stockage (réservoir de l'eau brute)",
  'GAF': 'Installation de pompage',
  'GC': 'Traitement et installation de déminéralisation',
  'GCF': 'Adoucisseurs-Osmose-CFD',
  'GCK': 'Système principal de tuyauteries',
  'GCL': "Récipients de l'eau déminéralisée",
  'GCN': 'Dosage NaOH',
  'GCP': 'Installations de régénération, installation de rétrolavage',
  'GCR': 'Installations de neutralisation',
  'GCY': "Fonctions MCR du système d'eau déminéralisée",
  'GD': "Système de traitement d'eau",
  'GDF': 'Echangeur ionique',
  'GDN': 'Approvisionnement en produits chimiques',
  'GDY': 'Installations de contrôle, de réglage et de protection',
  'GH': "Systèmes de distribution de l'eau d'exploitation (non potable)",
  'GHA': "Conduites de l'eau industrielle (eau d'exploitation)",
  'GHC': 'Transport eau démin. dans bâches',
  'GHD': "Système d'eau adoucie",
  'GHY': 'Dispositif de contrôle, de réglage et de protection (armoires in situ)',
  'GK': 'Approvisionnement en eau potable',
  'GKA': 'Système principal de distribution, transport, stockage',
  'GKB': 'by-pass Grangette - Sauvabelin',
  'GKC': 'Distribution Grangette et Sauvabelin',
  'GKY': 'Dispositif de contrôle, de réglage et de protection (armoires en situ)',
  'GM': "Systèmes collecteurs et d'évacuation de l'eau d'exploitation",
  'GMA': 'Alimentation biotope',
  'GN': "Traitement de l'eau d'exploitation",
  'GNB': 'Nettoyage mécanique, filtre à bougie',
  'GNE': 'Stockage après neutralisation',
  'GNF': 'Séparation Hg, absorption',
  'GNK': 'Filtration finale',
  'GNN': 'Approvisionnement HCL - NAOH',
  'GNR': 'Chargement gâteau filtrepresse',
  'GNS': 'Homogénisation, filtration',
  'GNY': 'Commandes filtre-presse',
  'GQ': "Systèmes collecteurs et d'évacuation des eaux usées domestiques",
  'GQA': 'Raccordement eaux usées Flon',
  'GU': 'Systèmes collecteurs et évacuation de drainage de toits et surfaces',
  'GUA': 'Eaux de pluie pour lavage des fumées',
  'GUG': 'Eaux grises',
  'H': 'Production de chaleur conventionnelle (incinération, circuit gaz)',
  'HA': 'Système des chaudières',
  'HAC': 'Economiseurs',
  'HAD': 'Groupes chaudières',
  'HAH': 'Système de surchauffe',
  'HAN': 'Vidange, évents, purges chaudière',
  'HAY': 'Dispositif de contrôle, de réglage et de protection',
  'HB': 'Charpente , gaine, intérieur de la chaudière',
  'HBA': 'Charpente de chaudière y compris fondations',
  'HBB': 'Isolation et revêtement',
  'HBC': "Revêtement ceramique, murage d'isolation et cladding inclus",
  'HBD': 'Escaliers et passerelles (plates-formes)',
  'HBK': 'Chaudière, postcombustion',
  'HBY': 'Dispositif de contrôle, de réglage et de protection',
  'HC': 'Nettoyage des surfaces de chauffe côté gaz',
  'HCB': 'Installation de souffleur de cendres à air',
  'HCE': 'Frappages chaudières',
  'HCF': 'Installation de pluie de billes ou de brossage',
  'HD': 'Evacuation des mâchefers et cendres four et chaudière',
  'HDA': 'Extracteurs machefers',
  'HDB': 'Evacuation des résidus sous grille',
  'HDC': 'Transport des mâchefers',
  'HDE': 'Electrofiltre',
  'HDU': 'Approvisionnement en air de transport',
  'HDX': 'Installations hydrauliques mâchefers',
  'HDY': 'Electrofiltre: contrôle, réglage et protection',
  'HF': "Système d'alimentation, trémies, poussoirs",
  'HFA': "Trémie d'alimentation et confidentiels",
  'HFB': 'Poussoirs',
  'HFF': 'Aspiration de bués avec ventilateur',
  'HFK': 'Refroidissement de la trémie',
  'HFY': 'Armoires commande poussoir',
  'HH': 'Incinération',
  'HHC': 'Installation de la grille',
  'HHF': "Ventilateur d'aspiration des buées",
  'HHL': "Amenée de l'air de combustion",
  'HHM': 'Système de soutirage vapeur',
  'HHQ': 'Approvisionnement en refroidissant',
  'HHT': 'Système de conversation de chaleur',
  'HHU': 'Refroidissement Aquaroll',
  'HHV': 'Approvisionnement en lubrifiants',
  'HHX': 'Installations hydrauliques',
  'HHY': 'Armoires de commande',
  'HL': 'Approvisionnement en air comburant',
  'HLA': "Système d'air primaire",
  'HLB': 'Ventilateurs air primaire et secondaire',
  'HLC': "Réchauffeur d'air",
  'HLG': "Système d'air secondaire",
  'HLW': 'Clapets air comburant',
  'HLY': 'Dispositif de contrôle, de réglage et de protection',
  'HN': "Evacuation des gaz (sans installations d'épuration)",
  'HNA': 'Système de gaines',
  'HNC': 'Ventilateur de tirage',
  'HNE': 'Installations de la cheminée',
  'HNF': 'Recirculation des fumées',
  'HNW': 'Approvisionnement en air de barrage',
  'HNX': 'Etancheité ventilateurs',
  'HNY': 'Dispositif de contrôle, de réglage et de protection',
  'HS': 'Installation DeNox',
  'HSA': 'Système de gaines des gaz dans HS',
  'HSB': 'Echangeur récupérateur de chaleur (gaz/gaz)',
  'HSD': 'Catalyseurs',
  'HSJ': 'Approvisionnement en agents de réduction, stockage compris',
  'HSK': 'Distribution et injection NH4OH',
  'HSL': "Système d'arrosage d'eau (p. ex. pour. réservoirs)",
  'HSP': "Système collecteur et d'évacuation des cendres volantes",
  'HSQ': "Puisard d'aspiration + conduits corresp. stockage NH4OH",
  'HSW': 'Approvisionnement en fluide de rideau',
  'HSY': 'Dispositif de contrôle, de réglage et de protection',
  'HT': 'Epuration des gaz humide (laveur) / traitement des rejets liquides (TRL))',
  'HTA': 'Système de gaines des gaz dans le système HT',
  'HTB': 'Echangeur de chaleur fumées/fumées',
  'HTD': 'Laveurs des fumées',
  'HTE': 'Séparateur électrofiltrant par voie humide',
  'HTF': "Circuits de pompage de l'eau des laveurs",
  'HTH': "Stockage: matières provenant des circuits de lavage d'adsorption (rejets du laveur, eaux usées)",
  'HTJ': "Approvisionnement en agents d'adsorption, stockage compris",
  'HTK': "Traitement et distribution des agents d'adsorption",
  'HTL': 'Purge du laveur, neutralisation, floculation et précipitation',
  'HTM': 'Epaississement de boues / stockage avec installation de déshydratation',
  'HTQ': "Système d'eau de secours laveur",
  'HTR': 'Approvisionnement en eau de sécurité',
  'HTS': 'Approvisionnement NaOH laveurs',
  'HTT': 'Bac rétention et bac avarie laveur',
  'HTW': "Système d'agents de blocage",
  'HTY': 'Dispositif de contrôle, de réglage et de protection',
  'HU': 'Réchauffage des gaz',
  'HUB': 'Système de gaz dans HU',
  'HUD': 'Réchauffeur des gaz (préchauffeur gaz/gaz)',
  'HUF': 'Réchauffeur des gaz (échangeur vapeur)',
  'L': "Circuits de vapeur et d'eau",
  'LA': "Système de l'eau d'alimentation",
  'LAA': 'Bâche alimentaire avec dégazeur',
  'LAB': "Conduites de l'eau d'alimentation",
  'LAC': "Installation de pompage de l'eau d'alimentation",
  'LAD': "Préchauffage de l'eau d'alimentation",
  'LAE': 'Injection eau de refroidissement',
  'LAH': 'Conduites de démarrage',
  'LB': 'Système de vapeur',
  'LBA': 'Système de conduites de vapeur haute pression (50 bar)',
  'LBB': 'Système de conduites de vapeur moyenne pression (10bar)',
  'LBD': 'Système de conduites de vapeur basse pression (5.5 bar)',
  'LBE': "Système de la vapeur d'échappement (sortie turbine à condenseur)",
  'LBG': 'Conduites de vapeur auxiliaire',
  'LBH': 'Système de vapeur de démarrage',
  'LBJ': "Précipitation d'eau",
  'LBK': 'soupape sécurité',
  'LBQ': 'Préchauffage eau alimentaire',
  'LBR': 'Système vapeur turbopompe',
  'LBS': 'Système conduites de soutirage pour préchauffage du condensat princi-pal',
  'LBU': 'Tuyaux de lâchement de la vapeur',
  'LBW': 'Système de blocage de la vapeur',
  'LC': 'Système de condensat',
  'LCA': 'Système de conduites du condensat principal',
  'LCB': 'Installation de pompage du condensat principal',
  'LCC': 'Préchauffage du condensat principal',
  'LCE': "Système d'injection du condensat",
  'LCJ': 'Système de condensat du préchauffage du condensat principal',
  'LCM': "Système de purge d'eau",
  'LCN': 'Système de recyclage du condensat secondaire',
  'LCP': 'Système collecteur du condensat secondaire',
  'LCQ': "Purge de l'eau de la chaudière, du ballon d'évaporation",
  'LD': 'Système de phosphate trisodique',
  'LDN': 'Pompage phosphate',
  'LF': 'Installation de dosage NH4OH ->eau alim.',
  'LFN': 'Dosage injection NH4OH',
  'M': 'Groupe turbogénérateur',
  'MA': 'Installation de turbine à vapeur',
  'MAA': 'Système de purges turbine',
  'MAD': 'Paliers',
  'MAG': "Système de la vapeur d'échappement et condenseur d'air",
  'MAJ': 'Evacuation',
  'MAK': 'Réducteur et dispositif vireur du rotor',
  'MAL': "Système d'évacuation d'eau et système de purge d'air",
  'MAM': "Système d'aspiration de la vapeur",
  'MAN': 'By-pass de la turbine',
  'MAV': 'Système de lubrification',
  'MAW': 'Système de vapeur de barrage',
  'MAX': 'Turbine à vapuer',
  'MK': 'Installation du générateur',
  'MKA': 'Générateur',
  'MKC': 'Excitation du générateur',
  'MKD': 'Paliers du générateur',
  'MKG': 'Refroidissement à air du générateur',
  'MP': 'Installations communes pour le groupe turbogénérateur',
  'MPA': 'Fondations',
  'MPB': 'Gaine (revêtement)',
  'MPG': 'Supports',
  'MPS': 'Système de séchage et de conservation',
  'N': "Mise à disposition de l'énergie pour usagers externes (CAD)",
  'NA': 'Système de processus vapeur, recyclage du condensat inclus',
  'NAA': 'Vapeur',
  'NAB': 'Condensat CAD',
  'NAE': 'Vapeur technique',
  'NAY': 'Dispositif de contrôle, de réglage et de protection',
  'ND': "Système d'eau chaude (chauffage à distance)",
  'NDA': 'Système de conduites (aller)',
  'NDB': 'Système de conduites (retour)',
  'NDC': "Installation de pompage de l'eau chaude",
  'NDD': "Transmission de chaleur (échangeur de chaleur chez l'utilisateur)",
  'NDE': "Accumulation de l'eau chaude",
  'NDF': 'Chauffage bâtiment',
  'NDG': "Récupération d'énergie",
  'NDK': 'Système de maintien de la pression',
  'NDY': 'Dispositif de contrôle, de réglage et de protection',
  'P': 'Approvisionnement en eau de refroidissement',
  'PA': "Système principal de l'eau de refroidissement",
  'PB': "Traitement principal de l'eau de refroidissement",
  'PC': "Système secondaire de l'eau de refroidissement, partie convent.",
  'PD': "Traitement secondaire de l'eau de refroidissement, partie conventionnelle",
  'PG': 'Systeme de refroidissement (eau glycolée)',
  'PGA': 'Système de pompage',
  'PGB': 'Système de refroidissement de retour',
  'PGF': "Dispositif d'expansion",
  'PGH': "Branche de refroidissement pour l'hydraulique de la grille",
  'PGL': "Branche de refroidissement pour les pompes de l'eau d'alimentation",
  'PGM': "Branche de refroidissement de l'alternateur",
  'PGN': 'Réservoir eau glycolée',
  'PGQ': 'Branche pour les refroidisseurs des échantillons',
  'Q': 'Services auxiliaires',
  'QB': 'Groupe électrogène de secours',
  'QBA': 'Installation des batteries de démarrage',
  'QBB': 'Réception et approvisionnement en carburant',
  'QBC': 'Approvisionnement en air de combustion',
  'QBD': 'Moteur',
  'QBF': 'Refroidissement du moteur',
  'QBG': "Système des gaz d'échappement",
  'QBJ': 'Génératrice',
  'QBY': 'Dispositif de contrôle, de réglage et de protection',
  'QC': 'Approvisionnement en réactifs',
  'QCA': 'NH4OH',
  'QCB': 'NaOH',
  'QCC': 'Préparation de lait de chaux',
  'QCD': 'HCL',
  'QCE': 'Saumure',
  'QCQ': 'Dosage produits chimiques PO4',
  'QE': "Approvisionnement en air comprimé (= air de commande / d'exploit.)",
  'QEA': "Production de l'air comprimé",
  'QEB': "Distribution principale de l'air comprimé",
  'QEC': "Distribution secondaire de l'air dans la zone four / chaudière",
  'QED': 'Distribution air maintenance',
  'QEE': "Distribution secondaire de l'air dans le bâtiment de l'énergie",
  'QEF': "Distribution secondaire de l'air dans le bâtiment du four",
  'QEG': "Distribution secondaire de l'air dans le bâtiment de commande",
  'QEH': "Distribution secondaire de l'air dans le bâtiment administratif",
  'QF': 'Approvisionnement en air de barrage',
  'QFA': "Production d'air de barrage",
  'QFB': "Distribution d'air de barrage, système de conduites",
  'QH': 'Production de vapeur auxiliaire',
  'QHA': 'Système à pression',
  'QHB': 'Système de support, gaine, intérieur de la production de vapeur',
  'QHF': 'Entrepôt des réservoirs de mazout et approvisionnement en mazout',
  'QHG': "Système de conduites de l'eau d'alimentation",
  'QHH': 'Installation des brûleurs',
  'QHL': "Système de l'air de combustion",
  'QHN': 'Evacuation des fumées',
  'QHY': 'Dispositif de contrôle, de réglage et de protection',
  'QU': 'Système de prélèvement pour tests',
  'QUC': 'Ballon des purges chaudières',
  'QUY': 'Armoire prise échantillon',
  'QUA': "Prise d'échantillons coté eau",
  'QUH': "Prise d'échantillons coté vapeur",
  'S': 'Installations secondaires du bâtiment',
  'SA': 'Installations de ventilation des équipements EM',
  'SAB': 'Ventilation des réservoirs de stockage',
  'SAY': 'Dispositif de réglage, de contrôle et de protection (armoires in situ)',
  'SB': 'Production de chaleur',
  'SBA': 'Production de chaleur',
  'SBY': 'Dispositif de réglage, de contrôle et de protection (armoires in situ)',
  'SC': 'Chauffage',
  'SCA': 'Chauffage primaire',
  'SCB': 'Chauffage usine',
  'SCC': 'Chauffage batiment admin.',
  'SD': 'Aspiration centralisée',
  'SE': 'installation photovoltaïque',
  'SF': 'Froid',
  'SFA': 'Refroidissement usine',
  'SFB': 'Refroidissement bâtiment admin.',
  'SG': 'Systèmes de protection contre le feu',
  'SGA': 'Installation sprinklers',
  'SGB': 'Détection incendie',
  'SGE': 'Exutoire de fumées',
  'SGP': 'Extincteurs et postes incendies',
  'SH': 'Luminaires',
  'SI': 'Sanitaires',
  'SM': 'Installation de grues, engins de levage stationnaires',
  'SMA': 'Pont roulant bâtiment des turbines',
  'SMC': 'Grue débourrage du broyeur des déchets encombrants',
  'SME': 'Pont roulant pour big-bags',
  'SMH': 'Engins de levage (grues) de maintenance',
  'SV': 'Installations de ventilation',
  'SVA': 'Ventilation salle de commande',
  'SVB': 'Ventilation réfectoire et cuisine',
  'SVC': 'Ventilation ateliers',
  'SVD': 'Ventilation local peinture',
  'SVE': 'Ventilation bureaux',
  'SVF': 'Ventilation vestiaires et buanderie',
  'SVG': 'Ventilation locaux borgnes',
  'SVH': 'Ventilation halle de déchargement',
  'SVI': 'Ventilation halle des fours',
  'SVJ': 'Ventilation locaux LCV-TRL',
  'SVK': 'Ventilation locaux acides',
  'SVL': "Transfert d'air locaux usine",
  'SVM': 'Ventilation Gare',
  'SVN': 'Ventilation transformateurs',
  'SVO': 'Ventilation zone mâchefers',
  'SVP': 'Ventilation local air comprimé',
  'SVQ': 'Ventilation local turbine',
  'SVR': 'Ventilation local NH4OH',
  'U': 'Ouvrages',
  'UA': 'Bâtiments',
  'UE': 'Aménagements extérieurs',
  'UF': 'Fosses',
  'UG': 'Galerie PdP',
  'UR': 'Rampe à camions',
  'UT': 'Tunnel',
  'Z': "Equipements d'exploitation et de commerce",
  'ZA': 'Structures et passerelles',
  'ZB': 'Engins de manutention',
  'ZBA': 'Camion',
  'ZBB': "Engins d'entretien",
  'ZBC': 'Chargeuse',
  'ZBE': 'Engins de levage',
  'ZBN': 'Nacelles',
  'ZBV': 'Voiture de service',
  'ZC': 'Appareils mobiles',
  'ZCE': 'Electricité',
  'ZCG': 'Exploitation gare',
  'ZCI': 'Usine',
  'ZCM': 'Mécanique',
  'ZCN': 'Entretien',
  'ZCS': 'Serrurerie',
  'ZCU': 'Exploitation usine',
  'ZD': 'Machines',
  'ZDE': 'Electricité',
  'ZDM': 'Mécanique',
  'ZE': 'EPI',
  'ZI': 'Isolation',
  'ZM': 'Equipements de manutention',
  'ZMA': 'Echelles',
  'ZME': 'Elingues',
  'ZMS': 'Etagères de stockage',
  'XXX': 'Vannes à réviser',
  'YYY': 'Pompes à réviser',
  'ZZZ': 'Machines à réviser'
};
const sysName = c => (db.listes.systemes || {})[c] || SYS_DEFAULT[c] || '';
const ZSHORT = {
  A: ['Réseau électrique', 'bolt'],
  B: ['Distribution élec.', 'bolt'],
  C: ['Contrôle-commande', 'gauge'],
  E: ['Déchets & résidus', 'truck'],
  G: ['Eaux', 'water'],
  H: ['Four-chaudière', 'flame'],
  L: ['Eau-vapeur', 'drop'],
  M: ['Turbine', 'turbine'],
  N: ['Chauffage à distance', 'heat'],
  P: ['Refroidissement', 'water'],
  Q: ['Services auxiliaires', 'cog'],
  S: ['Bâtiment', 'shelf'],
  U: ['Ouvrages', 'plant'],
  Z: ['Exploitation', 'wrench']
};
const sysEff = code => {
  const s = sysOf(code);
  return s && sysName(s[0]) ? s : '';
};
const sysLabel = code => {
  const s = sysOf(code);
  return s ? `${s} ${sysName(s)}`.trim() : '';
};
const zoneTag = code => {
  const z = zoneOf(code);
  return `<span class="zone-tag">${icon(z.ic)}${esc(z.n)}</span>`;
};

/* Personnel et groupes repris du Planning Tridel (tridelsa.github.io/planning).
   Sert de secours si le planning en ligne n'est pas joignable. */
const PLANNING_URL = 'https://tridelsa.github.io/planning/';
const PLANNING_CAT = {
  'Equipe 1': 'Équipe',
  'Equipe 2': 'Équipe',
  'Equipe 3': 'Équipe',
  'Equipe 4': 'Équipe',
  'Equipe 5': 'Équipe',
  'Elect': 'Électricien',
  'Autom.': 'Automaticien',
  'Mécanique': 'Mécanicien',
  'Intendance': 'Intendance',
  'Chauffeurs-grutiers': 'Chauffeurs-grutiers',
  'Admin.': 'Administration',
  'Cadres': 'Cadres'
};
const PLANNING_STAFF = [
  ['AQUILLON', 'Équipe'],
  ['HODZIC', 'Équipe'],
  ['MIGUEL', 'Équipe'],
  ['DUC', 'Équipe'],
  ['IONITA', 'Équipe'],
  ['YILDIRIM', 'Équipe'],
  ['GARCIA', 'Équipe'],
  ['FELISBERTO', 'Équipe'],
  ['BRAHIMI', 'Équipe'],
  ['SIMONIN', 'Équipe'],
  ['LAUNAZ', 'Équipe'],
  ['NAHOUNOU', 'Équipe'],
  ['MERMOUD', 'Équipe'],
  ['SERRANO', 'Équipe'],
  ['DA ROCHA', 'Équipe'],
  ['LUCAS COUTO', 'Électricien'],
  ['RAUSIS', 'Automaticien'],
  ['PACHE', 'Automaticien'],
  ['DURGNIAT', 'Mécanicien'],
  ['PINTO', 'Mécanicien'],
  ['CHAMBAZ', 'Mécanicien'],
  ['LIMA', 'Mécanicien'],
  ['MEYER', 'Mécanicien'],
  ['BURGENER', 'Intendance'],
  ['AFONSO', 'Intendance'],
  ['DUFAUX', 'Intendance'],
  ['MONTHE VERRILLI', 'Intendance'],
  ['COLOMA', 'Intendance'],
  ['DE JESUS MARQUES LUIS', 'Intendance'],
  ['PAIVA', 'Chauffeurs-grutiers'],
  ['MAGES', 'Chauffeurs-grutiers'],
  ['DUARTE MACHADO', 'Chauffeurs-grutiers'],
  ['PEREIRA', 'Chauffeurs-grutiers'],
  ['ROBERT', 'Chauffeurs-grutiers'],
  ['BRUESCH', 'Chauffeurs-grutiers'],
  ['ANTIC', 'Chauffeurs-grutiers'],
  ['GRAVELHO', 'Chauffeurs-grutiers'],
  ['PEDROSA', 'Chauffeurs-grutiers'],
  ['MARQUES', 'Administration'],
  ['ROPRAZ', 'Administration'],
  ['SAFAR', 'Administration'],
  ['PITTET', 'Administration'],
  ['CARRASCO', 'Administration'],
  ['GALLIKER', 'Administration'],
  ['MORIER', 'Administration'],
  ['VAUCHER', 'Cadres'],
  ['GUEX', 'Cadres'],
  ['FONTANNAZ', 'Cadres'],
  ['ANUSCA', 'Cadres'],
  ['GAUSSEN', 'Cadres'],
  ['GONTHIER', 'Cadres'],
  ['BONNANT', 'Cadres'],
  ['MUHAXHERI', 'Cadres'],
  ['WUTHRICH', 'Cadres'],
  ['SCHNEIDER', 'Cadres'],
  ['UMUHIRE', 'Cadres'],
  ['ZERMATTEN', 'Cadres']
];
const PANNES_DEF = ['Usure', 'Encrassement / bouchage', 'Fuite', 'Défaut électrique', 'Capteur / mesure', 'Casse mécanique', 'Surchauffe', 'Réglage / paramètre', 'Erreur d’utilisation', 'Autre'];
const STATUTS = {ouverte: ['Ouverte', 'bad'], encours: ['En cours', 'info'], terminee: ['Terminée', 'ok']};
const LEGACY_TYPES = {corrective: 'Corrective', preventive: 'Préventive', amelioration: 'Amélioration', controle: 'Contrôle'};

/* ---------------- Stockage ---------------- */
/* Ajoute le personnel du planning (sans doublon) et met à jour les groupes. */
function mergeStaff(d, list, full = false) {
  let add = 0,
    upd = 0;
  if (full) {
    const names = new Set(list.map(x => norm(x[0])));
    for (const p of d.personnes) if (p.src === 'planning') p.actif = names.has(norm(p.nom));
  }
  for (const [nom, groupe] of list) {
    if (groupe && !d.listes.groupes.includes(groupe)) d.listes.groupes.push(groupe);
    const ex = d.personnes.find(p => norm(p.nom) === norm(nom) && (p.src === 'planning' || !p.prenom));
    if (ex) {
      ex.src = 'planning';
      if (groupe && ex.groupe !== groupe) {
        ex.groupe = groupe;
        upd++;
      }
    } else {
      d.personnes.push({id: uid(), prenom: '', nom, fonction: '', groupe, actif: true, src: 'planning'});
      add++;
    }
  }
  return {add, upd};
}
function blank() {
  return {
    version: 2,
    meta: {demo: false},
    reglages: {qrBase: '', labelFmt: 'sheet'},
    listes: {
      fournisseurs: [],
      fournArch: [],
      categories: ['Mécanique', 'Électrique', 'Instrumentation', 'Hydraulique', 'Pneumatique', 'Consommable'],
      unites: ['pce', 'jeu', 'm', 'l', 'kg', 'rouleau', 'boîte'],
      types: ['Corrective', 'Préventive', 'Contrôle', 'Amélioration'],
      pannes: PANNES_DEF.slice(),
      groupes: ['Électricien', 'Automaticien', 'Mécanicien', 'Intendance', 'Chauffeurs-grutiers', 'Cadres', 'Équipe', 'Administration'],
      systemes: {}
    },
    salles: [],
    lieux: [],
    personnes: [],
    kks: [],
    pieces: [],
    interventions: [],
    mouvements: [],
    taches: [],
    histo: [],
    plan: []
  };
}
/* Retire des notes d'une pièce les codes KKS déjà liés à la pièce (écrits d'un bloc, avec espaces ou « 1 / 2 HTQ30AA310 ») */
const KKS_RX =
  /(^|[^A-Z0-9])((?:[0-2]\s*(?:\/|\+|ET|,|-)\s*)*[0-2])?\s?([A-Z]{3})\s?(\d{2})\s?([A-Z]{2})\s?(\d{3})(-[A-Z0-9.]+)?(?![0-9])/g;
function cleanNotes(notes, codes) {
  if (!notes || !codes.size) return notes;
  const out = [];
  for (const line of String(notes).split('\n')) {
    const m = line.match(/^([^:]{2,30}?\s:\s)(.*)$/),
      head = m ? m[1] : '',
      body = m ? m[2] : line;
    const up = body.toUpperCase();
    let res = '',
      last = 0,
      hit = false;
    for (const x of up.matchAll(KKS_RX)) {
      const units = (x[2] || '').match(/[0-2]/g) || ['0', '1', '2'],
        base = x[3] + x[4] + x[5] + x[6];
      if (!units.some(u => codes.has(u + base))) continue;
      const st = x.index + x[1].length;
      res += body.slice(last, st);
      last = x.index + x[0].length;
      hit = true;
    }
    if (!hit) {
      out.push(line);
      continue;
    }
    res = (res + body.slice(last))
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s\/,;+|.\-]+|[\s\/,;+|.\-]+$/g, '')
      .trim();
    if (res && !/^(ET)?$/i.test(res)) out.push(head + res);
  }
  return out.join('\n');
}
/* Retire des notes les attributs réduits à un seul chiffre et tout ce qui concerne un prix */
function cleanMisc(notes) {
  if (!notes) return notes;
  const out = String(notes)
    .split('\n')
    .filter(l => !/^Attribut\s*\d+\s*:\s*\d\s*$/i.test(l.trim()) && !/\bprix\b|\bCHF\b|\bEUR\b|€/i.test(l));
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
/* Repères KKS écrits en abrégé dans les pièces : « 1ETG30 » (groupe), « 0ETG30/40/70AF001/02 », « 1 / 2 HTQ30AA310 »…
   Chaque code trouvé est relié à la pièce comme objet KKS ; s'il n'existe pas encore, il est créé quand son système est connu. */
const KKS_BASE = 'ABCEGHLMNPQSUZ';
const KKS_RX2 =
  /(?<![A-Z0-9])((?:[0-2]\s*(?:\/|\+|ET|,|-)\s*)*[0-2])\s?([A-Z]{3})\s?(\d{2}(?:\s*\/\s*\d{2}(?![0-9]))*)(?:\s?([A-Z]{2})\s?(\d{3}(?:\s*\/\s*\d{2,3}(?![0-9]))*))?(-[A-Z]\d{2})?(?![0-9])/g;
function kksScan(txt, has) {
  const out = [];
  for (const m of String(txt || '')
    .toUpperCase()
    .matchAll(KKS_RX2)) {
    if (!KKS_BASE.includes(m[2][0])) continue;
    const us = m[1].match(/[0-2]/g),
      nns = m[3].match(/\d{2}/g),
      codes = [];
    let nums = [];
    if (m[4]) {
      const raw = m[5].match(/\d+/g),
        f = raw[0];
      nums = [f, ...raw.slice(1).map(x => f.slice(0, 3 - x.length) + x)];
    }
    for (const u of us)
      for (const nn of nns) {
        if (m[4])
          for (const n of nums) {
            let c = u + m[2] + nn + m[4] + n;
            if (m[6] && has(c + m[6])) c += m[6];
            codes.push(c);
          }
        else codes.push(u + m[2] + nn);
      }
    out.push({tok: m[0], codes});
  }
  return out;
}
function linkPartialKks(d) {
  const key = c => String(c).replace(/\s+/g, '').toUpperCase();
  const byCode = new Map(d.kks.map(k => [key(k.code), k]));
  const codes = [...byCode.keys()];
  const SYS = {...SYS_DEFAULT, ...(d.listes.systemes || {})};
  const grpName = c => {
    const kids = codes
      .filter(x => x.startsWith(c) && x !== c)
      .map(x => byCode.get(x))
      .filter(k => !/^\(repris/.test(k.designation || ''));
    const cand = kids.filter(k => /\d$/.test(k.code) && !/BR\d{3}$/.test(key(k.code)));
    const pool = cand.length ? cand : kids;
    return pool.map(k => k.designation || '').sort((a, b) => b.length - a.length)[0] || '';
  };
  let nl = 0,
    nc = 0;
  for (const p of d.pieces) {
    const txt = [p.designation, p.notes, p.refFab].join(' ');
    if (!/\d\s?[A-Z]{3}\s?\d{2}/i.test(txt)) continue;
    let notes = p.notes || '';
    for (const {tok, codes: cs} of kksScan(txt, c => byCode.has(c))) {
      let all = true;
      for (const c of cs) {
        let k = byCode.get(c);
        if (!k) {
          const sys = c.slice(1, 4),
            known = SYS[sys] || codes.some(x => x.slice(1, 4) === sys);
          if (!known) {
            all = false;
            continue;
          }
          const app = (String(p.notes || '').match(/Application\s*:\s*([^\n]+)/) || [])[1];
          const des = (c.length === 6 ? grpName(c) : '') || (app ? app.trim() : '') || SYS[sys] || c;
          k = {id: uid(), code: c, designation: des, aic: ''};
          d.kks.push(k);
          byCode.set(c, k);
          codes.push(c);
          nc++;
        }
        if (!p.kks.includes(k.id)) {
          p.kks.push(k.id);
          nl++;
        }
      }
      if (all && notes.toUpperCase().includes(tok)) {
        const i = notes.toUpperCase().indexOf(tok);
        notes = notes.slice(0, i) + notes.slice(i + tok.length);
      }
    }
    if (notes !== (p.notes || ''))
      p.notes = notes
        .split('\n')
        .map(l => l.replace(/[ \t]{2,}/g, ' ').trimEnd())
        .filter(l => !/^\s*(N°\s*\/\s*repère|Repère|N° repère|KKS)\s*:?\s*$/i.test(l))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
  }
  return {nl, nc};
}
function cleanPieceNotes(d, p) {
  const codes = new Set(
    (p.kks || [])
      .map(id =>
        d.kks
          .find(k => k.id === id)
          ?.code.replace(/\s+/g, '')
          .toUpperCase()
      )
      .filter(Boolean)
  );
  const n = cleanNotes(p.notes, codes);
  if (n !== p.notes) p.notes = n;
}
function migrate(d) {
  const b = blank();
  for (const k in b) if (d[k] == null) d[k] = b[k];
  d.reglages = {...b.reglages, ...d.reglages};
  d.meta = {...b.meta, ...d.meta};
  d.listes = {...b.listes, ...d.listes};
  for (const p of d.pieces) {
    if (p.categorie && !d.listes.categories.includes(p.categorie)) d.listes.categories.push(p.categorie);
    if (p.unite && !d.listes.unites.includes(p.unite)) d.listes.unites.push(p.unite);
  }
  for (const p of d.personnes) {
    if (p.groupe == null) p.groupe = '';
    if (p.groupe && !d.listes.groupes.includes(p.groupe)) d.listes.groupes.push(p.groupe);
  }
  for (const i of d.interventions) {
    if (LEGACY_TYPES[i.type]) i.type = LEGACY_TYPES[i.type];
    if (i.type && !d.listes.types.includes(i.type)) d.listes.types.push(i.type);
  }
  // Groupes : « Équipe 1 » … « Équipe 5 » deviennent « Équipe »
  for (const p of d.personnes) if (/^[ÉE]quipe \d+$/.test(p.groupe || '')) p.groupe = 'Équipe';
  d.listes.groupes = d.listes.groupes.filter(g => !/^[ÉE]quipe \d+$/.test(g));
  // Personnes fictives des premières versions : retirées (remplacées dans les rapports par le personnel réel)
  if (!d.meta.fictV) {
    const FICT = [
      ['Marc', 'Favre', 'DURGNIAT'],
      ['Julie', 'Rochat', 'LUCAS COUTO'],
      ['Samuel', 'Pittet', 'RAUSIS'],
      ['Samuel', 'Pidoux', 'RAUSIS'],
      ['Nadia', 'Berset', '']
    ];
    for (const [pr, nm, repl] of FICT) {
      const f = d.personnes.find(p => p.prenom === pr && p.nom === nm && p.src !== 'planning');
      if (!f) continue;
      if (!d.meta.staffV) {
        mergeStaff(d, PLANNING_STAFF);
        d.meta.staffV = 1;
      }
      const r = repl && d.personnes.find(p => p.nom === repl && p.src === 'planning');
      for (const i of d.interventions) {
        if (!i.intervenants.includes(f.id)) continue;
        i.intervenants = i.intervenants.filter(x => x !== f.id);
        if (r && !i.intervenants.includes(r.id)) i.intervenants.push(r.id);
      }
      d.personnes = d.personnes.filter(p => p !== f);
    }
    d.meta.fictV = 1;
  }
  if (!d.meta.staffV) {
    mergeStaff(d, PLANNING_STAFF);
    d.meta.staffV = 1;
  }
  const G0 = blank().listes.groupes;
  d.listes.groupes = [...G0, ...d.listes.groupes.filter(g => !G0.includes(g))];
  for (const p of d.pieces)
    for (const n of [p.fabricant, p.fournisseur])
      if (n && !d.listes.fournisseurs.some(x => norm(x) === norm(n)) && !d.listes.fournArch.some(x => norm(x) === norm(n)))
        d.listes.fournisseurs.push(n);
  d.listes.fournisseurs.sort(coll.compare);
  for (const l of d.lieux)
    if (!Array.isArray(l.chemin)) {
      l.chemin = [(l.rayonnage || '') + (l.niveau || ''), l.bac || ''].filter(Boolean);
      delete l.rayonnage;
      delete l.niveau;
      delete l.bac;
    }
  {
    const byId = new Map(d.kks.map(k => [k.id, k]));
    for (const p of d.pieces)
      if (p.notes && p.kks?.length) {
        const codes = new Set(p.kks.map(id => byId.get(id)?.code.replace(/\s+/g, '').toUpperCase()).filter(Boolean));
        const n = cleanNotes(p.notes, codes);
        if (n !== p.notes) p.notes = n;
      }
    for (const p of d.pieces)
      if (p.notes) {
        const n = cleanMisc(p.notes);
        if (n !== p.notes) p.notes = n;
      }
  }
  for (const k of d.kks)
    if (!k.aic) {
      const m = String(k.designation || '').match(/^(.*\S)\s+(\d{2}\s?[A-Z]{2,3}\s?[A-Z]?\d)$/);
      if (m) {
        k.designation = m[1];
        k.aic = m[2];
      }
    }
  if (!d.meta.statutV) {
    for (const x of d.salles) if (x.code && STATUT_RE.test(x.code.trim())) x.statut = true;
    d.meta.statutV = 1;
  }
  ensureSnaps(d);
  {
    const P = new Map(d.pieces.map(p => [p.id, p])),
      Lm = new Map(d.lieux.map(l => [l.id, l]));
    const K = new Map(d.kks.map(k => [k.id, k])),
      Tm = new Map((d.taches || []).map(t => [t.id, t]));
    for (const i of d.interventions)
      if (i.statut === 'terminee') {
        if (!i.ks && K.get(i.kksId)) {
          const k = K.get(i.kksId);
          i.ks = {code: k.code, designation: k.designation, aic: k.aic || ''};
        }
        if (!i.ts && Tm.get(i.tacheId)) {
          const t = Tm.get(i.tacheId);
          i.ts = {
            titre: t.titre,
            description: t.description || '',
            freq: freqLabel(t.freq),
            assign: t.assign?.type === 'personne' ? d.personnes.find(p => p.id === t.assign.v)?.nom || '' : t.assign?.v || ''
          };
        }
      }
    for (const i of d.interventions)
      for (const x of i.pieces || [])
        if (!x.s) {
          const p = P.get(x.pieceId),
            l = Lm.get(x.lieuId);
          if (p) {
            const sa = l && d.salles.find(z => z.id === l.salleId);
            x.s = {
              ref: p.ref,
              designation: p.designation,
              unite: p.unite,
              lieu: l && sa ? [sa.code || `${sa.batiment || 'E'}${sa.etage}.${sa.numero}`, ...(l.chemin || [])].join(' / ') : ''
            };
          }
        }
  }
  if (!d.meta.fourIntV) {
    for (const i of d.interventions) {
      if (!i.intervenants.some(id => String(id).startsWith('ext:'))) continue;
      i.intervenants = i.intervenants.map(id => {
        if (!String(id).startsWith('ext:')) return id;
        const f = fourMatch(i.snap?.[id]?.nom || '', d.listes.fournisseurs);
        if (!f) return id;
        const nid = 'four:' + f;
        i.snap = i.snap || {};
        i.snap[nid] = fourSnap(f);
        delete i.snap[id];
        return nid;
      });
      i.intervenants = [...new Set(i.intervenants)];
    }
    d.meta.fourIntV = 1;
  }
  if (!d.meta.kksPartV && d.pieces.length) {
    linkPartialKks(d);
    d.meta.kksPartV = 1;
  }
  if (!d.meta.numV && d.interventions.length) {
    renumberInts(d);
    d.meta.numV = 1;
  }
  /* « Modifié par » posé en masse par un import ou une mise à jour automatique : ce n'est pas une vraie modification, on l'efface */
  if (!d.meta.byFixV) {
    for (const c of COLS) {
      const g = new Map();
      for (const x of d[c] || [])
        if (x._by && x._at) {
          const k = x._by + '|' + String(x._at).slice(0, 16);
          g.set(k, (g.get(k) || 0) + 1);
        }
      for (const x of d[c] || [])
        if (x._by && x._at && g.get(x._by + '|' + String(x._at).slice(0, 16)) > 40) {
          delete x._by;
          delete x._at;
        }
    }
    d.meta.byFixV = 1;
  }
  if (d.meta.demo && !d.meta.tachesV) {
    seedTaches(d);
  }
  d.meta.tachesV = 1;
  /* Codes de panne (liste modifiable dans Options › Listes) */
  if (!Array.isArray(d.listes.pannes)) d.listes.pannes = PANNES_DEF.slice();
  d.version = 2;
  return d;
}
function load() {
  try {
    const t = localStorage.getItem(KEY);
    return t ? migrate(JSON.parse(t)) : null;
  } catch (e) {
    return null;
  }
}
function save() {
  if (CLOUD.on) {
    CLOUD.schedule();
    return;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (e) {
    toast('Enregistrement impossible dans ce navigateur. Exportez une sauvegarde depuis Options.', 'bad');
  }
}
