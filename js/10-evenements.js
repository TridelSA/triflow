'use strict';
/* TriFlow — Actions (ACT), événements du navigateur et démarrage. (Fichiers chargés dans l'ordre par index.html.) */
/* =====================================================================
   ÉVÉNEMENTS
   ===================================================================== */
const ACT = {
  scan: () => scanDialog(),
  pweek(d) {
    const n = +d.n;
    S.pweek = n ? isoAdd(S.pweek || planWeek(), n) : planWeek();
    S.pday = null;
    render();
  },
  pday(d) {
    S.pday = +d.i;
    render();
  },
  'plan-pick'(d) {
    S.ppick = S.ppick === d.id ? null : d.id;
    render();
  },
  'plan-met'(d) {
    S.pmet = d.m || '';
    render();
  },
  'plan-add'(d, t) {
    if (S.ppick) {
      placeTask(S.ppick, d.who, d.date);
      return;
    }
    /* Un seul texte par case : si la case a déjà du texte, on le modifie au lieu d'ajouter un nouveau bloc */
    const ex = planTextItem(d.who, d.date);
    if (ex) {
      if (PLAN_TYPE()) {
        const c = $(`.wkgrid .pc[data-who="${CSS.escape(d.who)}"][data-date="${d.date}"]`) || t;
        planInline(c, d.who, d.date, ex, c.querySelector(`.pit[data-id="${ex.id}"]`));
      } else planDialog(d.who, d.date, ex);
      return;
    }
    if (PLAN_TYPE()) planInline(t, d.who, d.date, null);
    else planDialog(d.who, d.date, null);
  },
  'plan-del'(d) {
    const x = db.plan.find(y => y.id === d.id);
    if (!x) return;
    const t = x.tacheId ? get('taches', x.tacheId) : null;
    tx(() => {
      db.plan = db.plan.filter(y => y.id !== d.id);
    });
    render();
    toast(`${t ? t.titre : 'Texte'} retiré du planning`, '', true);
  },
  'plan-edit'(d, t) {
    const x = db.plan.find(y => y.id === d.id);
    if (!x) return;
    if (S.ppick) {
      placeTask(S.ppick, x.who, x.date);
      return;
    }
    if (PLAN_TYPE() && !x.tacheId) planInline(t.closest('.pc'), x.who, x.date, x, t);
    else planDialog(x.who, x.date, x);
  },
  'plan-side'() {
    S.pside = !S.pside;
    try {
      localStorage.setItem('tf-pside', S.pside ? '1' : '0');
    } catch (e) {}
    render();
  },
  'plan-hide': () => planHideDialog(),
  navplus(d, t) {
    const s2 = $('#navsheet');
    s2.hidden = !s2.hidden;
    t.setAttribute('aria-expanded', String(!s2.hidden));
  },
  'to-order': () => orderDialog(),
  /* Accueil : une équipe → ses travaux (filtre sur le groupe) */
  hmet(d) {
    const g = db.listes.groupes.find(x => metOf(x) === d.k);
    S.pour = g ? 'g:' + g : '';
    S.back = [];
    if (d.f === 'encours') {
      ACT.wtab({w: 'encours'});
      return;
    }
    S.tf = d.f || '';
    S.sel.taches = null;
    go('taches');
  },
  /* Bandeau sous l'en-tête */
  'photo-open'(d) {
    if (!d.col) return;
    const x = get(d.col, d.id);
    photoViewer(d.path, x ? () => {
      tx(() => {
        x.photos = (x.photos || []).filter(p => p.path !== d.path);
      });
      render();
      toast('Photo retirée', '', true);
    } : null);
  },
  'quick-out'(d) {
    const p = getPiece(d.id);
    if (p) quickMove(p);
  },
  'pour-set-go'(d) {
    S.pour = d.v || '';
    S.tf = '';
    S.back = [];
    go('taches');
  },
  'pour-set'(d) {
    S.pour = d.v || '';
    if (S.view === 'interventions') S.ryear = null;
    render();
  },
  hband(d) {
    S.back = [];
    if (d.f === 'low') {
      ACT['show-low']();
      return;
    }
    S.tf = d.f;
    S.sel.taches = null;
    go('taches');
  },
  'plan-print'(d) {
    if (d.f === 'a3' && !d.ok) return planCheckDialog();
    const a3 = d.f === 'a3';
    document.body.classList.add('land');
    document.body.classList.toggle('a3', a3);
    doPrint(fitSheet(planSheetHTML(), a3 ? 396 : 277, a3 ? 271 : 188));
  },
  me: () => meDialog(),
  help: () => helpDialog(),
  'relink-kks'() {
    const r = tx(() => linkPartialKks(db));
    render();
    toast(
      r.nl
        ? `${r.nl} lien(s) pièce ↔ KKS ajouté(s)${r.nc ? ` · ${r.nc} repère(s) KKS créé(s)` : ''}`
        : 'Aucun nouveau repère KKS trouvé dans les pièces',
      '',
      !!r.nl
    );
  },
  'p-all'(d) {
    S.pAll = S.pAll === d.id ? null : d.id;
    fillDetail();
  },
  'pour-all'() {
    S.pour = '';
    S.ryear = null;
    render();
  },
  'pour-me'() {
    const me = meId();
    S.pour = me ? 'p:' + me : '';
    render();
  },
  'name-ints'(d) {
    S.q.interventions = d.name;
    S.statut = 'toutes';
    S.arch.interventions = false;
    S.ryear = null;
    go('interventions');
  },
  recaler(d) {
    const t = get('taches', d.id);
    if (!t) return;
    const today = todayISO();
    tx(() => {
      if (t.freq.unite === 'once') t.prochaine = today;
      else {
        let n = t.prochaine;
        while (n < today) n = addFreq(n, t.freq.n, t.freq.unite);
        t.prochaine = n;
      }
    });
    render();
    toast(`Prochaine fois : ${fmtD(t.prochaine)}`, '', true);
  },
  wtab(d) {
    const q = S.q[S.view === 'taches' ? 'taches' : 'interventions'] || '';
    if (['taches', 'interventions'].includes(S.view)) S.q.taches = S.q.interventions = q;
    if (d.w === 'afaire') {
      S.tf = '';
      go('taches');
      return;
    }
    S.statut = d.w === 'encours' ? 'actives' : 'terminee';
    S.ryear = null;
    S.sel.interventions = null;
    go('interventions');
  },
  tf(d) {
    if (S.view !== 'taches') {
      S.tf = d.f || '';
      S.back = [];
      go('taches');
      return;
    }
    S.tf = d.f || '';
    S.sel.taches = null;
    fillList();
    fillDetail();
  },
  pf(d) {
    S.lowOnly = d.f === 'low';
    S.zeroOnly = d.f === 'zero';
    S.plimit = 200;
    S.sel.pieces = null;
    fillList();
    fillDetail();
  },
  pmore() {
    S.plimit += 300;
    fillList();
  },
  ploc() {
    locDialog(S.ploc || '');
  },
  'ploc-clear'() {
    S.ploc = '';
    S.plimit = 200;
    S.sel.pieces = null;
    fillList();
    fillDetail();
  },
  fab(d, t) {
    const m = $('#fab .fab-menu');
    m.hidden = !m.hidden;
    t.setAttribute('aria-expanded', String(!m.hidden));
  },
  rstat() {
    S.statut = S.statut === 'actives' ? 'toutes' : 'actives';
    S.ryear = null;
    S.sel.interventions = null;
    fillList();
    fillDetail();
  },
  ryear(d) {
    S.statut = 'toutes';
    S.ryear = d.y;
    S.sel.interventions = null;
    fillList();
    fillDetail();
  },
  rmore(d) {
    S.rmore = d.k;
    fillList();
  },
  'four-ints'(d) {
    S.q.interventions = d.name;
    S.statut = 'toutes';
    S.arch.interventions = false;
    S.ryear = 'all';
    go('interventions');
  },
  dups: () => dupDialog(),
  'xl-pieces': () => xlPieces(),
  'xl-ints': () => xlInts(),
  'xl-taches': () => xlTaches(),
  'xl-kks': () => xlKks(),
  arch(d) {
    const x = get(d.col, d.id);
    if (!x) return;
    try {
      archiveItem(d.col, x);
    } catch (e) {
      toast(e.message, 'bad');
    }
  },
  unarch(d) {
    const x = get(d.col, d.id);
    if (x) unarchiveItem(d.col, x);
  },
  'arch-view'(d) {
    S.arch[d.v] = !S.arch[d.v];
    S.sel[d.v] = null;
    render();
    window.scrollTo(0, 0);
  },
  'four-arch'(d) {
    tx(() => {
      db.listes.fournisseurs = db.listes.fournisseurs.filter(x => x !== d.name);
      if (!db.listes.fournArch.includes(d.name)) db.listes.fournArch.push(d.name);
    });
    S.fourOpen = null;
    render();
    toast(`« ${d.name} » archivé (les pièces gardent leur valeur)`, '', true);
  },
  'four-unarch'(d) {
    tx(() => {
      db.listes.fournArch = db.listes.fournArch.filter(x => x !== d.name);
      if (!db.listes.fournisseurs.includes(d.name)) db.listes.fournisseurs.push(d.name);
      db.listes.fournisseurs.sort(coll.compare);
    });
    render();
    toast(`« ${d.name} » restauré`);
  },
  'hard-del'(d) {
    if (!canDel()) {
      toast('Seuls les cadres peuvent supprimer définitivement.', 'bad');
      return;
    }
    const x = get(d.col, d.id);
    if (!x || !HARD[d.col]) return;
    const [lbl, more] = HARD_LBL[d.col];
    const name = d.col === 'interventions' ? `${x.num} · ${x.titre || ''}` : d.col === 'pieces' ? `${x.ref} · ${x.designation}` : x.titre;
    confirmDialog(
      `Supprimer ${lbl} définitivement ?`,
      `« ${esc(name)} » sera effacé et ne pourra pas être restauré depuis les archives. ${more}`,
      'Supprimer',
      () => HARD[d.col](x)
    );
  },
  jtype(d) {
    S.jf = {...(S.jf || {}), col: d.k};
    S.jlim = 100;
    render();
  },
  jmore() {
    S.jlim = (S.jlim || 100) + 100;
    jrnRefresh();
  },
  'new-access'() {
    if (!canDel()) {
      toast('Réservé aux cadres.', 'bad');
      return;
    }
    accessDialog();
  },
  'four-del'(d) {
    if (!canDel()) {
      toast('Seuls les cadres peuvent supprimer définitivement.', 'bad');
      return;
    }
    confirmDialog(
      'Supprimer le fournisseur',
      `« ${esc(d.name)} » sera retiré définitivement de la liste. Les pièces gardent le nom écrit dans leur fiche.`,
      'Supprimer',
      () => {
        tx(() => {
          db.listes.fournArch = db.listes.fournArch.filter(x => x !== d.name);
        });
        render();
      }
    );
  },
  menu(d, t) {
    const l = t.nextElementSibling,
      open = l.hidden;
    closeMenus(l);
    l.hidden = !open;
    t.setAttribute('aria-expanded', String(open));
    if (!open) return;
    const r = t.getBoundingClientRect(),
      h = l.offsetHeight;
    l.style.right = Math.max(8, innerWidth - r.right) + 'px';
    l.style.top = (r.bottom + 6 + h > innerHeight - 8 && r.top - 6 - h > 8 ? r.top - 6 - h : r.bottom + 6) + 'px';
    l.querySelector('button')?.focus();
  },
  nav: d => {
    S.back = [];
    go(d.view);
  },
  desel() {
    S.sel[S.view] = null;
    fillList();
    fillDetail();
    window.scrollTo(0, 0);
  },
  'nav-back'() {
    const b = S.back.pop();
    if (!b) return;
    Object.assign(S, {view: b.view, sel: b.sel, q: b.q, sys: b.sys, sysExp: b.sysExp, psort: b.psort, plimit: b.plimit});
    closeSearch();
    render();
    requestAnimationFrame(() => {
      const l = $('#list');
      if (l) l.scrollTop = b.ls;
      window.scrollTo(0, b.y);
      const si = document.querySelector('.page-head input[type=search]');
      if (si && b.q[si.dataset.search]) {
        /* recherche conservée */
      }
    });
  },
  select(d) {
    S.sel[S.view] = d.id;
    fillList();
    fillDetail();
    scrollDetail();
  },
  goto(d) {
    if (d.view !== S.view || S.sel[d.view] !== d.id) {
      S.back.push({
        view: S.view,
        sel: {...S.sel},
        q: {...S.q},
        sys: S.sys,
        sysExp: new Set(S.sysExp),
        psort: S.psort,
        plimit: S.plimit,
        y: window.scrollY,
        ls: $('#list')?.scrollTop || 0
      });
      if (S.back.length > 20) S.back.shift();
    }
    $('#gq').value = '';
    go(d.view, d.id);
  },
  tab(d) {
    S.tab[S.view] = d.tab;
    fillDetail();
  },
  sys(d) {
    const c = d.sys || '';
    S.q.kks = '';
    S.sel.kks = null;
    S.sysAuto = null;
    if (c.length === 3 || c === '?') {
      S.sys = c;
      if (c !== '?') {
        S.sysExp.add(c[0]);
        S.sysExp.add(c.slice(0, 2));
      }
    } else {
      S.sys = '';
      S.sysExp.add(c);
    }
    if (S.view !== 'kks') go('kks');
    else {
      fillList();
      fillDetail();
      scrollDetail();
    }
  },
  'sys-sel'(d) {
    const c = d.sys || '';
    S.q.kks = '';
    S.sel.kks = null;
    if (c && c !== '?' && c.length < 3) {
      if (S.sysExp.has(c) && S.sys === c) {
        S.sysExp.delete(c);
        for (const x of [...S.sysExp]) if (x.startsWith(c)) S.sysExp.delete(x);
      } else {
        S.sysExp.add(c[0]);
        S.sysExp.add(c);
      }
    }
    if (c.length === 3) {
      S.sysExp.add(c[0]);
      S.sysExp.add(c.slice(0, 2));
    }
    S.sys = c;
    S.sysAuto = null;
    if (S.view !== 'kks') go('kks');
    else {
      fillList();
      fillDetail();
      scrollDetail();
    }
  },
  kgrp(d) {
    S.grpOpen.has(d.g) ? S.grpOpen.delete(d.g) : S.grpOpen.add(d.g);
    fillDetail();
  },
  'k-all'(d) {
    S.kAll = S.kAll === d.id ? null : d.id;
    fillDetail();
  },
  'kks-back'() {
    S.sel.kks = null;
    fillList();
    fillDetail();
  },
  opt(d) {
    S.opt = d.sec;
    go('options');
  },
  'show-low'() {
    S.lowOnly = true;
    S.zeroOnly = false;
    S.sel.pieces = null;
    S.back = [];
    go('pieces');
  },
  'show-zero'() {
    S.zeroOnly = true;
    S.lowOnly = false;
    S.sel.pieces = null;
    S.back = [];
    go('pieces');
  },
  'toggle-low'() {
    S.lowOnly = !S.lowOnly;
    render();
  },
  'quick-move': d => moveDialog(null, d.type),
  'new-piece': () => pieceDialog(),
  'edit-piece': d => pieceDialog(getPiece(d.id)),
  move: d => moveDialog(getPiece(d.id), d.type),
  'add-place': d => addPlaceDialog(getPiece(d.id)),
  'hist-all'(d) {
    S.histAll = S.histAll === d.id ? null : d.id;
    fillDetail();
  },
  'unlink-lieu'(d) {
    const p = getPiece(d.piece);
    tx(() => (p.stock = p.stock.filter(s => !(s.lieuId === d.id && !s.qte))));
    fillList();
    fillDetail();
    toast('Emplacement retiré de la pièce');
  },
  'unlink-kks'(d) {
    const p = getPiece(d.piece),
      k = getKks(d.id);
    tx(() => (p.kks = p.kks.filter(id => id !== d.id)));
    fillList();
    fillDetail();
    toast(`Lien ${p.ref} ↔ ${k?.code || ''} retiré`);
  },
  'new-salle': () => salleDialog(),
  'edit-salle': d => salleDialog(getSalle(d.id)),
  'del-salle'(d) {
    const s = getSalle(d.id);
    if (!s) return;
    const ids = new Set(db.lieux.filter(l => l.salleId === s.id).map(l => l.id));
    const n = db.pieces.filter(p => p.stock.some(x => ids.has(x.lieuId) && x.qte > 0)).length;
    if (n) {
      toast(`Impossible : ${n} pièce(s) sont encore rangées dans ${salleCode(s)}. Déplacez-les d’abord.`);
      return;
    }
    confirmDialog(
      `Supprimer ${esc(salleCode(s))}`,
      `Le local ${esc(salleCode(s))}${ids.size ? ` et ses ${ids.size} emplacement(s) vides seront supprimés` : ' sera supprimé'}.`,
      'Supprimer',
      () => {
        tx(() => {
          db.pieces.forEach(p => {
            if (p.stock.some(x => ids.has(x.lieuId))) p.stock = p.stock.filter(x => !ids.has(x.lieuId));
          });
          db.lieux = db.lieux.filter(l => !ids.has(l.id));
          db.salles = db.salles.filter(x => x.id !== s.id);
        });
        render();
        toast(`Local ${salleCode(s)} supprimé`);
      }
    );
  },
  'new-lieu': d => lieuDialog(null, d.salle),
  'edit-lieu': d => lieuDialog(getLieu(d.id)),
  'gen-series': d => seriesDialog(d.salle),
  'import-lieux': () => importLieuxDialog(),
  'labels-list': () => pieceLabelsDialog(filteredPieces().map(p => p.id)),
  'labels-one': d => pieceLabelsDialog([d.id]),
  'labels-here': d =>
    pieceLabelsDialog(
      contentsOf(d.id)
        .filter(x => x.qte > 0)
        .map(x => x.p.id)
    ),
  'labels-loc': d =>
    locLabelsDialog(
      String(d.ids || '')
        .split(',')
        .filter(Boolean)
    ),
  'new-int': d => interventionDialog(null, d.kks),
  'new-tache': d => newTacheDialog(d.kks),
  'edit-tache': d => tacheDialog(get('taches', d.id)),
  'do-tache': d => doTache(get('taches', d.id)),
  'plan-done'(d) {
    const x = db.plan.find(y => y.id === d.id);
    if (!x) return;
    const t = x.tacheId ? get('taches', x.tacheId) : null;
    const who = db.plan.filter(y => y.date === x.date && (t ? y.tacheId === t.id : y.text === x.text) && getPers(y.who)).map(y => y.who);
    if (t) doTache(t, {who, date: x.date, text: x.text});
    else {
      interventionDialog(null, null, null, {who, date: x.date});
      setTimeout(() => {
        const f = document.querySelector('dialog[open] form');
        if (f && f.elements.titre && !f.elements.titre.value) f.elements.titre.value = x.text.split('\n')[0].slice(0, 120);
      }, 50);
    }
  },
  'print-taches': () => doPrint(tachesSheetHTML()),
  'edit-int': d => interventionDialog(getInt(d.id)),
  'print-int': d => doPrint(reportHTML(getInt(d.id))),
  'print-piece': d => doPrint(pieceSheetHTML(getPiece(d.id))),
  'pers-ints'(d) {
    const p = getPers(d.id);
    S.q.interventions = p.nom;
    S.statut = 'toutes';
    S.ryear = null;
    S.arch.interventions = false;
    go('interventions');
  },
  'new-kks': () => kksDialog(),
  'edit-kks': d => kksDialog(getKks(d.id)),
  'import-kks': () => importKksDialog(),
  'import-pieces': () => importPiecesDialog(),
  'import-four': () => importFourDialog(),
  'four-open'(d) {
    S.fourOpen = S.fourOpen === d.name ? null : d.name;
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  },
  'four-pieces'(d) {
    S.back.push({
      view: S.view,
      sel: {...S.sel},
      q: {...S.q},
      sys: S.sys,
      sysExp: new Set(S.sysExp),
      psort: S.psort,
      plimit: S.plimit,
      y: window.scrollY,
      ls: 0
    });
    S.q.pieces = d.name;
    S.lowOnly = false;
    S.zeroOnly = false;
    go('pieces');
  },
  'link-four'() {
    let np = 0;
    tx(() => {
      np = linkFournisseurs();
    });
    render();
    toast(`${np} pièce(s) reliée(s) à au moins un fournisseur`);
  },
  'import-travaux': () => importTravauxDialog(),
  'int-all'() {
    S.statut = 'toutes';
    render();
  },
  'new-pers': () => persDialog(),
  async logout() {
    await IDB.del(CLOUD.cacheKey());
    await CLOUD.sb.auth.signOut();
    location.reload();
  },
  'cloud-off'() {
    confirmDialog(
      'Revenir aux données du navigateur',
      'Ce poste n’utilisera plus la base partagée. Les données de la base ne sont pas supprimées.',
      'Revenir',
      () => {
        try {
          localStorage.removeItem('gmao-cloud');
        } catch (e) {}
        location.reload();
      }
    );
  },
  'push-local'() {
    let d = null;
    try {
      d = JSON.parse(localStorage.getItem(KEY));
    } catch (e) {}
    if (!d) return toast('Aucune donnée locale trouvée.', 'bad');
    confirmDialog(
      'Envoyer dans la base',
      `Le contenu de la base sera remplacé par les données de ce navigateur (${(d.pieces || []).length} pièces, ${(d.interventions || []).length} rapports, ${(d.taches || []).length} tâches).`,
      'Envoyer',
      () => {
        db = migrate(d);
        db.meta.demo = false;
        save();
        S.sel = {};
        go('accueil');
        toast('Données envoyées dans la base');
      }
    );
  },
  'new-four': () => fourDialog(),
  'edit-four': d => fourDialog(d.name),
  'edit-pers': d => persDialog(getPers(d.id)),
  'list-del'(d) {
    const v = db.listes[d.list][+d.i];
    tx(() => db.listes[d.list].splice(+d.i, 1));
    render();
    toast(`« ${v} » retiré de la liste`);
  },
  'export-json'() {
    download(`triflow-sauvegarde-${todayISO()}.json`, JSON.stringify(db, null, 1), 'application/json');
    toast('Sauvegarde téléchargée');
  },
  'import-json'() {
    if (!canDel()) {
      toast('Réservé aux cadres.', 'bad');
      return;
    }
    $('#file-json').value = '';
    $('#file-json').click();
  },
  'export-csv-stock': exportStock,
  'export-csv-int': exportInts,
  'export-csv-kks': exportKksLinks,
  'clear-demo'() {
    confirmDialog(
      'Effacer les exemples',
      'Les pièces, emplacements, repères et rapports d’exemple seront supprimés. Le personnel du planning, les réglages et les listes sont conservés.',
      'Effacer',
      () => {
        const r = db.reglages,
          li = db.listes,
          staff = db.personnes.filter(p => p.src === 'planning');
        db = blank();
        db.reglages = r;
        db.listes = li;
        db.personnes = staff;
        db.meta.staffV = 1;
        save();
        S.sel = {};
        go('accueil');
        toast('Exemples effacés, personnel conservé');
      }
    );
  },
  'clear-all'() {
    if (!canDel()) {
      toast('Réservé aux cadres.', 'bad');
      return;
    }
    confirmDialog(
      'Tout effacer',
      'Toutes les données de ce navigateur seront supprimées. Exportez d’abord une sauvegarde si vous voulez pouvoir les récupérer.',
      'Tout effacer',
      () => {
        const r = db.reglages,
          li = db.listes;
        db = blank();
        db.reglages = r;
        db.listes = li;
        save();
        S.sel = {};
        go('accueil');
        toast('Données effacées');
      }
    );
  },
  'load-demo'() {
    confirmDialog('Recharger les exemples', 'Les données actuelles seront remplacées par les données d’exemple.', 'Remplacer', () => {
      const r = db.reglages;
      db = seed();
      db.reglages = r;
      save();
      S.sel = {};
      go('accueil');
      toast('Exemples rechargés');
    });
  }
};
const FORMS = {
  'link-kks'(f) {
    const p = getPiece(f.dataset.piece),
      raw = val(f, 'kks');
    if (!raw) return;
    const k = findKks(raw);
    if (!k) return toast('Repère inconnu : choisissez-le dans la liste proposée.', 'bad');
    if (p.kks.includes(k.id)) return toast(`${k.code} est déjà lié.`, 'bad');
    tx(() => p.kks.push(k.id));
    fillList();
    fillDetail();
    $('#detail input[name=kks]')?.focus();
    toast(`${p.ref} liée à ${k.code}`);
  },
  'link-piece'(f) {
    const k = getKks(f.dataset.kks),
      raw = val(f, 'piece');
    if (!raw) return;
    const p = findPiece(raw);
    if (!p) return toast('Pièce inconnue : choisissez-la dans la liste proposée.', 'bad');
    if (p.kks.includes(k.id)) return toast(`${p.ref} est déjà liée.`, 'bad');
    tx(() => p.kks.push(k.id));
    fillList();
    fillDetail();
    $('#detail input[name=piece]')?.focus();
    toast(`${p.ref} liée à ${k.code}`);
  },
  'list-add'(f) {
    const key = f.dataset.list,
      v = val(f, 'v');
    if (!v) return;
    if (db.listes[key].some(x => norm(x) === norm(v))) return toast('Déjà dans la liste.', 'bad');
    tx(() => db.listes[key].push(v));
    render();
    $(`form[data-list="${key}"] input`)?.focus();
    toast(`« ${v} » ajouté`);
  },
  cloud(f) {
    const url = val(f, 'url').replace(/\/+$/, ''),
      key = val(f, 'key');
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url))
      return toast('L’adresse doit ressembler à https://xxxx.supabase.co', 'bad');
    if (key.length < 30) return toast('La clé publique semble incomplète.', 'bad');
    try {
      localStorage.setItem('gmao-cloud', JSON.stringify({url, key}));
    } catch (e) {
      return toast('Enregistrement impossible dans ce navigateur.', 'bad');
    }
    location.reload();
  },
  settings(f) {
    const u = val(f, 'qrBase');
    if (u && !/^https?:\/\//i.test(u)) return toast('L’adresse doit commencer par http:// ou https://', 'bad');
    tx(() => {
      db.reglages.qrBase = u;
      db.reglages.labelFmt = val(f, 'labelFmt');
    });
    toast('Réglages enregistrés');
  }
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || t.closest('dialog') || e.target.closest('.pinl')) return;
  const fn = ACT[t.dataset.act];
  if (!fn) return;
  e.preventDefault();
  if (t.dataset.act !== 'menu') closeMenus();
  try {
    fn(t.dataset, t);
  } catch (x) {
    toast(x.message, 'bad');
  }
});
document.addEventListener('input', e => {
  if (!e.target.matches('[data-jq]')) return;
  clearTimeout(jrnRefresh.t);
  jrnRefresh.t = setTimeout(() => {
    S.jf = {...(S.jf || {}), q: e.target.value};
    jrnRefresh();
  }, 300);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-act]')) {
    e.preventDefault();
    e.target.click();
  }
  if (e.key === '/' && !e.target.closest('input,textarea,select,dialog')) {
    e.preventDefault();
    const q = document.querySelector('.page-head input[type=search]');
    if (q) q.focus();
  }
});
document.addEventListener('submit', e => {
  const f = e.target;
  if (!f.dataset.form) return;
  e.preventDefault();
  try {
    FORMS[f.dataset.form](f);
  } catch (x) {
    toast(x.message, 'bad');
  }
});
document.addEventListener('input', e => {
  const k = e.target.dataset?.search;
  if (!k) return;
  S.q[k] = e.target.value;
  if (e.target.dataset.pside) {
    const mon = S.pweek,
      nd = S.pwe ? 7 : 5,
      days = Array.from({length: nd}, (_, i) => isoAdd(mon, i));
    const el = $('.pside');
    if (el) {
      const pos = e.target.selectionStart;
      el.outerHTML = planSideHTML(days, planPeople());
      const ni = $('.pside input');
      ni.focus();
      ni.setSelectionRange(pos, pos);
    }
    return;
  }
  if (k === 'interventions') S.ryear = null;
  if (e.target.dataset.opt4) {
    render();
    const i = document.querySelector('[data-opt4]');
    if (i) {
      i.focus();
      i.setSelectionRange(i.value.length, i.value.length);
    }
    return;
  }
  if (e.target.dataset.opt) {
    const q = norm(S.q.optkks);
    $('#opt-list').innerHTML = optKksTable(
      db.kks.filter(x => live(x) && (!q || norm(`${x.code} ${x.designation} ${x.aic || ''}`).includes(q))).sort(kksSort)
    );
  } else fillList();
});
document.addEventListener('change', e => {
  const c = e.target.dataset?.change;
  if (!c) return;
  if (c === 'lowOnly') S.lowOnly = !!e.target.value;
  if (c === 'statut') S.statut = e.target.value;
  if (c === 'resp') {
    if (!canDel()) {
      toast('Réservé aux cadres.', 'bad');
      render();
      return;
    }
    const g = e.target.dataset.g,
      v = e.target.value;
    tx(() => {
      db.reglages.resp = {...(db.reglages.resp || {}), [g]: v || undefined};
    });
    toast(v ? `${persName(getPers(v))} : responsable ${g}` : `Plus de responsable ${g}`, '', true);
    return;
  }
  if (c === 'psort') {
    S.psort = e.target.value;
    fillList();
    return;
  }
  if (c === 'plimit') {
    S.plimit = +e.target.value;
    fillList();
    return;
  }
  if (c === 'rlimit') {
    S.rlimit = +e.target.value;
    fillList();
    return;
  }
  if (c === 'zone') S.zone = e.target.value;
  if (c === 'pour') {
    S.pour = e.target.value;
    e.target.classList.toggle('on', !!S.pour);
    if (S.view === 'interventions') S.ryear = null;
  }
  if (c === 'optGrp') {
    S.optGrp = e.target.value;
    render();
    return;
  }
  fillList();
});
$('#file-json').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    let d;
    try {
      d = JSON.parse(r.result);
    } catch (x) {
      return toast('Ce fichier n’est pas une sauvegarde valide.', 'bad');
    }
    if (!d || !Array.isArray(d.pieces) || !Array.isArray(d.lieux)) return toast('Ce fichier n’est pas une sauvegarde TriFlow.', 'bad');
    confirmDialog(
      'Restaurer la sauvegarde',
      `Les données actuelles seront remplacées par celles du fichier « ${esc(file.name)} » (${d.pieces.length} pièces, ${d.lieux.length} emplacements, ${(d.interventions || []).length} rapports).`,
      'Restaurer',
      () => {
        db = migrate(d);
        save();
        S.sel = {};
        go('accueil');
        toast('Sauvegarde restaurée');
      }
    );
  };
  r.readAsText(file);
});

/* Lien direct (QR code) : #piece=P-00001, #lieu=E1.11%20C45%20A, #int=INT-2026-0001 */
function applyHash() {
  let h = '';
  try {
    h = decodeURIComponent(location.hash.slice(1));
  } catch (e) {
    return false;
  }
  const m = h.match(/^(lieu|piece|int)=(.+)$/);
  if (!m) return false;
  if (m[1] === 'piece') {
    const p = findPiece(m[2]);
    if (p) {
      S.view = 'pieces';
      S.sel.pieces = p.id;
      return true;
    }
    toast(`Pièce ${m[2]} introuvable.`, 'bad');
  }
  if (m[1] === 'lieu') {
    const l = findLieu(m[2]);
    if (l) {
      S.view = 'lieux';
      S.sel.lieux = l.id;
      return true;
    }
  }
  if (m[1] === 'int') {
    const i = db.interventions.find(x => x.num === m[2]);
    if (i) {
      S.view = 'interventions';
      S.sel.interventions = i.id;
      return true;
    }
  }
  return false;
}
window.addEventListener('hashchange', () => {
  if (applyHash()) {
    render();
    scrollDetail();
  }
});
hydrateIcons();
if (CLOUD.cfg().url) {
  bootCloud();
  /* Téléphone : le menu du bas vit hors du bandeau, pour qu'aucun contenu ne passe jamais par-dessus */
  {
    const mq = matchMedia('(max-width: 760px)'),
      place = () => {
        const n = $('#nav'),
          side = $('.hero-side');
        if (!n || !side) return;
        if (mq.matches) {
          if (n.parentElement !== document.body) document.body.append(n);
        } else if (n.parentElement !== side) side.append(n);
      };
    mq.addEventListener ? mq.addEventListener('change', place) : mq.addListener(place);
    place();
  }
  /* Le site reste utilisable sans réseau (pas en test local) */
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
} else {
  applyHash();
  render();
  syncPlanning();
  setTimeout(maybeWelcome, 400);
}

/* ---------- Gestes au doigt (téléphone) ----------
   - glisser une ligne de travail vers la droite : « C'est fait »
   - tirer une fenêtre vers le bas : la fermer
   - glisser le planning à gauche / à droite : jour suivant / précédent */
(() => {
  let g = null;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.addEventListener(
    'pointerdown',
    e => {
      if (e.pointerType !== 'touch' || e.button > 0) return;
      const tick = e.target.closest('input, textarea, select, a, .tick') ? null : e.target.closest('tr, li');
      const row = tick && tick.querySelector('[data-act="do-tache"]') ? tick : null;
      const dlg = e.target.closest('dialog.dlg > form > header');
      const plan = !row && !dlg && e.target.closest('.pmlist') && !e.target.closest('textarea, input, .pinl');
      if (!row && !dlg && !plan) return;
      g = {x: e.clientX, y: e.clientY, row, dlg: dlg && dlg.closest('dialog'), plan, dir: null, dx: 0, dy: 0};
    },
    {passive: true}
  );
  document.addEventListener(
    'pointermove',
    e => {
      if (!g) return;
      g.dx = e.clientX - g.x;
      g.dy = e.clientY - g.y;
      if (!g.dir) {
        if (Math.abs(g.dx) < 10 && Math.abs(g.dy) < 10) return;
        g.dir = Math.abs(g.dx) > Math.abs(g.dy) ? 'h' : 'v';
      }
      if (g.row && g.dir === 'h' && g.dx > 0) {
        g.row.classList.add('sw-on');
        g.row.style.transform = `translateX(${Math.min(g.dx, 160)}px)`;
        g.row.classList.toggle('sw-go', g.dx > 90);
      } else if (g.dlg && g.dir === 'v' && g.dy > 0) {
        g.dlg.style.transition = 'none';
        g.dlg.style.transform = `translateY(${g.dy}px)`;
      }
    },
    {passive: true}
  );
  const end = () => {
    if (!g) return;
    const {row, dlg, plan, dir, dx, dy} = g;
    g = null;
    if (row) {
      row.style.transition = reduce() ? 'none' : 'transform .2s cubic-bezier(.23,1,.32,1)';
      if (dir === 'h' && dx > 90) {
        const id = row.querySelector('[data-act="do-tache"]').dataset.id;
        try {
          navigator.vibrate?.(15);
        } catch (x) {}
        row.style.transform = '';
        setTimeout(() => {
          row.classList.remove('sw-on', 'sw-go');
          row.style.transition = '';
          doTache(get('taches', id));
        }, 120);
      } else {
        row.style.transform = '';
        setTimeout(() => {
          row.classList.remove('sw-on', 'sw-go');
          row.style.transition = '';
        }, 220);
      }
    }
    if (dlg) {
      dlg.style.transition = reduce() ? 'none' : 'transform .22s cubic-bezier(.32,.72,0,1)';
      if (dir === 'v' && dy > 110) {
        dlg.style.transform = 'translateY(100%)';
        setTimeout(() => dlg.close(), reduce() ? 0 : 200);
      } else dlg.style.transform = '';
    }
    if (plan && dir === 'h' && Math.abs(dx) > 70) {
      const nd = S.pwe ? 7 : 5,
        cur = $('.pday.on') ? [...$$('.pday')].indexOf($('.pday.on')) : 0,
        n = Math.max(0, Math.min(nd - 1, cur + (dx < 0 ? 1 : -1)));
      if (n !== cur) {
        S.pday = n;
        render();
      }
    }
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', () => {
    if (g?.row) {
      g.row.style.transform = '';
      g.row.classList.remove('sw-on', 'sw-go');
    }
    if (g?.dlg) g.dlg.style.transform = '';
    g = null;
  });
})();
