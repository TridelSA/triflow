'use strict';
/* TriFlow — Cœur : historique, connexion, tx (modifications), identité et droits, aide, archives, stock, numéros, état S, rendu des pages. (Fichiers chargés dans l'ordre par index.html.) */
/* =====================================================================
   HISTORIQUE (journal « qui a fait quoi »)
   Chaque enregistrement vers la base est comparé à la version d'avant ;
   une phrase claire est écrite dans la collection « journal » (non chargée au démarrage,
   lue à la demande : Options › Historique et en bas de chaque fiche).
   ===================================================================== */
const J_FIELDS = {
  pieces: {
    designation: 'désignation',
    fabricant: 'marque',
    refFab: 'réf. fabricant',
    fournisseur: 'fournisseur',
    categorie: 'catégorie',
    unite: 'unité',
    stockMin: 'stock minimum',
    notes: 'notes',
    kks: 'équipements (KKS)'
  },
  interventions: {
    titre: 'titre',
    date: 'date',
    type: 'type',
    kksId: 'équipement',
    constat: 'constat',
    travaux: 'ce qui a été fait',
    duree: 'durée',
    intervenants: 'intervenants',
    pieces: 'pièces consommées'
  },
  taches: {
    titre: 'titre',
    description: 'description',
    kksId: 'équipement',
    assign: 'attribution',
    freq: 'fréquence',
    prochaine: 'prochaine échéance',
    derniere: 'dernière fois'
  },
  kks: {code: 'code', designation: 'désignation', aic: 'AIC'},
  personnes: {nom: 'nom', prenom: 'prénom', groupe: 'groupe', fonction: 'fonction', actif: 'actif'},
  lieux: {note: 'note'},
  salles: {nom: 'nom'}
};
const J_NOUN = {
  pieces: ['la pièce', 'Pièce'],
  interventions: ['le rapport', 'Rapport'],
  taches: ['la tâche', 'Tâche'],
  kks: ['l’équipement', 'Équipement'],
  lieux: ['l’emplacement', 'Emplacement'],
  salles: ['le local', 'Local'],
  personnes: ['la personne', 'Personne'],
  plan: ['le planning', 'Planning'],
  mouvements: ['le stock', 'Stock'],
  config: ['les réglages', 'Réglages']
};
const J_TYPES = [
  ['', 'Tout'],
  ['mouvements', 'Stock'],
  ['interventions', 'Rapports'],
  ['taches', 'Tâches'],
  ['pieces', 'Pièces'],
  ['plan', 'Planning'],
  ['autre', 'Autres']
];
const jWho = email => {
  const p = personFromEmail(email) || (meId() && getPers(meId()));
  return p ? persName(p) : email || '?';
};
const jDay = iso => (iso ? dayLbl(iso) : '');
function jLabel(col, x) {
  if (!x) return '';
  switch (col) {
    case 'pieces':
      return `${x.ref} · ${x.designation || ''}`;
    case 'interventions':
      return `${x.num} · ${x.titre || '(sans titre)'}`;
    case 'taches':
      return x.titre || '';
    case 'kks':
      return `${x.code}${x.designation ? ' · ' + x.designation : ''}`;
    case 'lieux':
      return lieuCode(x);
    case 'salles':
      return salleCode(x);
    case 'personnes':
      return persName(x);
    case 'plan': {
      const p = getPers(x.who),
        t = x.tacheId ? get('taches', x.tacheId) : null;
      return `${p ? persName(p) : PLAN_ROWS.find(r => r[0] === x.who)?.[1] || ''} · ${jDay(x.date)}${t ? ' · ' + t.titre : ''}`;
    }
    default:
      return '';
  }
}
const jShort = v => {
  const t = String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > 60 ? t.slice(0, 57) + '…' : t;
};
function jDiff(col, o, n) {
  const F = J_FIELDS[col] || {},
    out = [];
  for (const [k, lbl] of Object.entries(F)) {
    const a = JSON.stringify(o[k] ?? ''),
      b = JSON.stringify(n[k] ?? '');
    if (a === b) continue;
    if (k === 'kks') {
      const A = new Set(o.kks || []),
        B = new Set(n.kks || []);
      const add = [...B].filter(x => !A.has(x)).map(id => getKks(id)?.code || '?'),
        rm = [...A].filter(x => !B.has(x)).map(id => getKks(id)?.code || '?');
      out.push(
        [add.length ? 'KKS lié : ' + add.join(', ') : '', rm.length ? 'KKS retiré : ' + rm.join(', ') : ''].filter(Boolean).join(' · ')
      );
      continue;
    }
    if (k === 'kksId') {
      out.push(`${lbl} : ${getKks(n.kksId)?.code || '—'}`);
      continue;
    }
    if (k === 'prochaine' || k === 'derniere' || k === 'date') {
      out.push(`${lbl} : ${fmtD(o[k]) || '—'} → ${fmtD(n[k]) || '—'}`);
      continue;
    }
    if (k === 'assign') {
      out.push(`${lbl} : ${assignLabel(n.assign)}`);
      continue;
    }
    if (k === 'freq') {
      out.push(`${lbl} : ${n.freq ? freqLabel(n.freq) : '—'}`);
      continue;
    }
    if (k === 'intervenants') {
      out.push(lbl);
      continue;
    }
    if (k === 'pieces') {
      out.push(lbl);
      continue;
    }
    if ((typeof n[k] === 'string' && String(n[k]).length > 40) || (typeof o[k] === 'string' && String(o[k]).length > 40)) out.push(lbl);
    else out.push(`${lbl} : ${jShort(o[k]) || '—'} → ${jShort(n[k]) || '—'}`);
  }
  if (col === 'pieces') {
    const A = new Map((o.stock || []).map(x => [x.lieuId, x.qte])),
      B = new Map((n.stock || []).map(x => [x.lieuId, x.qte]));
    const add = [...B.keys()].filter(x => !A.has(x)).map(id => lieuCode(getLieu(id))),
      rm = [...A.keys()].filter(x => !B.has(x)).map(id => lieuCode(getLieu(id)));
    if (add.length) out.push('rangée aussi en ' + add.join(', '));
    if (rm.length) out.push('retirée de ' + rm.join(', '));
  }
  return out.filter(Boolean);
}
/* Une phrase par changement. o = version d'avant (ou null), n = nouvelle version (ou null si supprimée) */
function jDescribe(col, id, o, n) {
  if (col === 'histo' || col === 'journal') return null;
  if (col === 'config') {
    const parts = [];
    for (const k of ['listes', 'reglages']) {
      const A = o?.[k] || {},
        B = n?.[k] || {};
      for (const kk of new Set([...Object.keys(A), ...Object.keys(B)]))
        if (JSON.stringify(A[kk]) !== JSON.stringify(B[kk]) && kk !== 'moi')
          parts.push(
            {
              fournisseurs: 'fournisseurs',
              fournArch: 'fournisseurs archivés',
              categories: 'catégories',
              unites: 'unités',
              types: 'types de rapport',
              groupes: 'groupes',
              planHide: 'personnes affichées au planning',
              resp: 'responsables de groupe',
              systemes: 'noms des systèmes KKS',
              qrBase: 'adresse des QR codes',
              labelFmt: 'format des étiquettes'
            }[kk] || kk
          );
    }
    return parts.length
      ? {col, ref: 'main', lbl: 'Réglages', act: 'update', txt: `a modifié les réglages : ${[...new Set(parts)].join(', ')}`}
      : null;
  }
  const x = n || o,
    N = J_NOUN[col] || ['la fiche', 'Fiche'];
  if (col === 'mouvements') {
    if (!n) return null;
    const p = getPiece(n.pieceId),
      l = getLieu(n.lieuId),
      q = Math.abs(n.qte);
    return {
      col: 'pieces',
      ref: n.pieceId,
      lbl: p ? jLabel('pieces', p) : '',
      act: 'stock',
      txt: `${n.qte < 0 ? 'a sorti' : 'a entré'} ${num(q)} ${esc(p?.unite || '')} de ${p ? p.ref + ' · ' + (p.designation || '') : 'une pièce'}${l ? ` (${lieuCode(l)})` : ''}${n.motif ? ' · ' + n.motif : ''}${n.ref ? ' · ' + n.ref : ''}`
    };
  }
  if (col === 'plan') {
    const t = x.tacheId ? get('taches', x.tacheId) : null,
      p = getPers(x.who),
      who = p ? persName(p) : PLAN_ROWS.find(r => r[0] === x.who)?.[1] || '',
      what = t ? t.titre : jShort(x.text);
    if (!o) return {col, ref: x.id, lbl: jLabel(col, x), act: 'plan', txt: `a planifié « ${what} » pour ${who}, ${jDay(x.date)}`};
    if (!n) return {col, ref: x.id, lbl: jLabel(col, x), act: 'plan', txt: `a retiré « ${what} » du planning de ${who}, ${jDay(x.date)}`};
    if ((o.text || '') !== (n.text || ''))
      return {
        col,
        ref: x.id,
        lbl: jLabel(col, x),
        act: 'plan',
        txt: `a écrit « ${jShort(n.text)} » au planning de ${who}, ${jDay(x.date)}`,
        merge: true
      };
    return null;
  }
  const lbl = jLabel(col, x);
  if (!o) return {col, ref: id, lbl, act: 'create', txt: `a créé ${N[0]} ${lbl}`};
  if (!n) return {col, ref: id, lbl, act: 'delete', txt: `a supprimé définitivement ${N[0]} ${lbl}`};
  if (!o.arch && n.arch) return {col, ref: id, lbl, act: 'archive', txt: `a archivé ${N[0]} ${lbl}`};
  if (o.arch && !n.arch) return {col, ref: id, lbl, act: 'restore', txt: `a restauré ${N[0]} ${lbl}`};
  if (col === 'interventions' && o.statut !== n.statut) {
    const st = {terminee: 'a terminé', encours: 'a passé en cours', ouverte: 'a rouvert'}[n.statut] || 'a changé le statut de';
    return {col, ref: id, lbl, act: 'update', txt: `${st} le rapport ${lbl}`};
  }
  if (col === 'taches' && o.derniere !== n.derniere && n.derniere)
    return {col, ref: id, lbl, act: 'update', txt: `a fait la tâche ${lbl} (prochaine fois : ${fmtD(n.prochaine)})`};
  if (col === 'taches' && o.actif !== false && n.actif === false)
    return {col, ref: id, lbl, act: 'update', txt: `a fait la tâche ${lbl} (terminée)`};
  if (col === 'pieces' && o.mergedInto !== n.mergedInto && n.mergedInto)
    return {col, ref: id, lbl, act: 'archive', txt: `a fusionné le doublon ${lbl}`};
  const d = jDiff(col, o, n);
  if (!d.length) return null;
  return {col, ref: id, lbl, act: 'update', txt: `a modifié ${N[0]} ${lbl} : ${d.join(' · ')}`, merge: true};
}
const JRN = {
  last: new Map(),
  entries(changes, synced, auto = false) {
    const email = auto ? '' : CLOUD.user?.email || '',
      nom = auto ? 'TriFlow (mise à jour automatique)' : jWho(email),
      at = new Date().toISOString(),
      out = [];
    const real = changes.filter(c => !c.k.startsWith('journal|'));
    const byCol = new Map();
    for (const c of real) {
      const col = c.k.slice(0, c.k.indexOf('|'));
      byCol.set(col, (byCol.get(col) || 0) + 1);
    }
    for (const c of real) {
      const p = c.k.indexOf('|'),
        col = c.k.slice(0, p),
        id = c.k.slice(p + 1);
      if (byCol.get(col) > 40) continue;
      let o = null;
      try {
        o = synced.has(c.k) ? JSON.parse(synced.get(c.k)) : null;
      } catch (e) {}
      let e = null;
      try {
        e = jDescribe(col, id, o, c.del ? null : c.v);
      } catch (err) {}
      if (e) out.push(e);
    }
    for (const [col, n] of byCol)
      if (n > 40 && col !== 'histo')
        out.push({
          col,
          ref: '',
          lbl: '',
          act: 'bulk',
          txt: `a enregistré ${num(n)} fiches d’un coup (${(J_NOUN[col] || ['', col])[1].toLowerCase()} : import ou mise à jour)`
        });
    /* Mouvement + modification de stock de la même pièce : on ne garde que le mouvement */
    const stockRefs = new Set(out.filter(e => e.act === 'stock').map(e => e.ref));
    return out
      .filter(
        e =>
          !(
            e.col === 'pieces' &&
            e.act === 'update' &&
            stockRefs.has(e.ref) &&
            !/:.*[a-z]/.test(
              e.txt
                .split(' : ')
                .slice(1)
                .join('')
                .replace(/rangée aussi en.*|retirée de.*/g, '')
            )
          )
      )
      .map(e => {
        const key = `${email}|${e.col}|${e.ref}|${e.act}`,
          prev = this.last.get(key),
          now = Date.now();
        if (e.merge && prev && now - prev.t < 10 * 60e3) {
          prev.t = now;
          return {id: prev.id, rev: prev.rev, data: {...prev.data, at, txt: e.txt, lbl: e.lbl}, key};
        }
        const id = 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        return {
          id,
          rev: 0,
          data: {id, at, by: email, nom, col: e.col, ref: e.ref, lbl: e.lbl, act: e.act, txt: e.txt},
          key,
          merge: e.merge
        };
      });
  },
  async write(list) {
    if (!list.length || !CLOUD.sb) return;
    const {error} = await CLOUD.sb.rpc('save_docs', {
      changes: list.map(x => ({c: 'journal', id: x.id, rev: x.rev, del: false, data: x.data}))
    });
    if (error) return;
    const now = Date.now();
    for (const x of list) {
      if (x.merge || this.last.has(x.key)) this.last.set(x.key, {id: x.id, rev: x.rev + 1, data: x.data, t: now});
    }
    if ($('[data-jrn]')) jrnRefresh();
  },
  async query({ref = '', col = '', who = '', q = '', limit = 100, offset = 0} = {}) {
    if (!CLOUD.sb) return [];
    let r = CLOUD.sb.from('docs').select('id,data').eq('collection', 'journal');
    if (ref) r = r.eq('data->>ref', ref);
    if (col === 'mouvements') r = r.eq('data->>act', 'stock');
    else if (col && col !== 'autre') r = r.eq('data->>col', col);
    if (who) r = r.eq('data->>by', who);
    const {data, error} = await r.order('id', {ascending: false}).range(offset, offset + limit - 1);
    if (error) throw error;
    let rows = (data || []).map(x => x.data).sort((a, b) => (b.at || '').localeCompare(a.at || '') || (a.txt || '').localeCompare(b.txt || ''));
    if (col === 'autre') rows = rows.filter(x => !['interventions', 'taches', 'pieces', 'plan'].includes(x.col));
    if (col === 'pieces') rows = rows.filter(x => x.act !== 'stock');
    if (q) {
      const n = norm(q);
      rows = rows.filter(x => norm(`${x.nom} ${x.txt} ${x.lbl}`).includes(n));
    }
    return rows;
  }
};
const jIcon = a =>
  ({stock: 'move', create: 'plus', delete: 'out', archive: 'archive', restore: 'archive', plan: 'calendar', bulk: 'save'})[a] || 'edit';
const jLine = (e, withObj = true) =>
  `<li class="jl j-${e.act}"><span class="ji">${icon(jIcon(e.act))}</span><span class="jt"><b>${esc(e.nom || e.by || '?')}</b> ${esc(e.txt)}</span><time>${fmtDT(e.at)}</time>${withObj && e.ref && e.col !== 'config' && e.col !== 'plan' && get(e.col, e.ref) ? `<button class="link" data-act="goto" data-view="${e.col === 'mouvements' ? 'pieces' : e.col === 'salles' || e.col === 'lieux' ? 'lieux' : e.col}" data-id="${e.ref}">Ouvrir</button>` : ''}</li>`;
/* Vue « sur la fiche » : on ne répète pas le nom de la fiche, on dit ce qui a changé */
function jCtx(e) {
  const t = e.txt || '',
    L = e.lbl || '',
    after = L && t.includes(L) ? t.slice(t.indexOf(L) + L.length).replace(/^\s*:\s*/, '') : '';
  if (e.act === 'stock') {
    const out = /^a sorti/.test(t);
    return [out ? 'Sortie de stock' : 'Entrée en stock', t.replace(/^a (sorti|entré) /, '').replace(' de ' + L, '')];
  }
  if (e.act === 'create') return ['Création', ''];
  if (e.act === 'delete') return ['Suppression définitive', ''];
  if (e.act === 'archive') return [/fusionné/.test(t) ? 'Fusion de doublon' : 'Archivage', ''];
  if (e.act === 'restore') return ['Restauration', ''];
  if (/^a terminé/.test(t)) return ['Rapport terminé', ''];
  if (/^a passé en cours/.test(t)) return ['Passé en cours', ''];
  if (/^a rouvert/.test(t)) return ['Rapport rouvert', ''];
  if (/^a fait la tâche/.test(t)) return ['Faite', (t.match(/\((.*)\)$/) || [])[1] || ''];
  return ['Modification', after];
}
const jCtxLine = e => {
  const [tt, dd] = jCtx(e);
  return `<li class="jc j-${e.act}"><time>${fmtDT(e.at)}</time><div class="jc-b"><div class="jc-t"><b>${esc(tt)}</b><span class="jc-w">${icon('person')}${esc(e.nom || e.by || '?')}</span></div>${dd ? `<div class="jc-x">${esc(dd).replace(/ · /g, '<span class="jsep"> · </span>').replace(/ → /g, ' <span class="jar">→</span> ')}</div>` : ''}</div></li>`;
};
/* Bloc « Historique » en bas d'une fiche : chargé à la demande */
const jrnBlock = ref =>
  CLOUD.on
    ? `<section class="pd-sec"><h3>${icon('list')}Modifications</h3><div data-jrn="${esc(ref)}"><p class="empty-line">Chargement…</p></div></section>`
    : '';
async function jrnRefresh() {
  for (const el of $$('[data-jrn]')) {
    const ref = el.dataset.jrn,
      full = el.dataset.full === '1';
    try {
      const f = full ? S.jf || {} : {ref};
      let rows = await JRN.query({...f, limit: full ? S.jlim || 100 : 30});
      if (!full && S.view === 'pieces') rows = rows.filter(e => e.act !== 'stock');
      if (!el.isConnected) continue;
      el.innerHTML = rows.length
        ? `<ul class="${full ? 'jlist' : 'jctx'}">${rows.map(e => (full ? jLine(e, true) : jCtxLine(e))).join('')}</ul>${full && rows.length >= (S.jlim || 100) ? `<p class="list-note"><button class="link" data-act="jmore">Voir plus</button></p>` : ''}`
        : `<p class="empty-line">${full ? 'Aucune action enregistrée pour ce filtre.' : 'Aucune modification enregistrée depuis la mise en place de l’historique.'}</p>`;
    } catch (e) {
      if (el.isConnected) el.innerHTML = `<p class="empty-line">Historique indisponible : ${esc(e.message || e)}</p>`;
    }
  }
}
function loadLib() {
  if (window.supabase?.createClient) return Promise.resolve();
  return new Promise((ok, ko) => {
    const sc = document.createElement('script');
    sc.src = SUPABASE_LIB;
    sc.onload = ok;
    sc.onerror = () => ko(new Error('Bibliothèque Supabase introuvable'));
    document.head.append(sc);
  });
}
function showGate(html) {
  let g = $('#gate');
  if (!g) {
    g = document.createElement('div');
    g.id = 'gate';
    document.body.append(g);
  }
  g.innerHTML = `<div class="gate-card"><h1>TriFlow</h1>${html}</div>`;
  g.hidden = false;
}
/* Chargement : la page prend déjà sa forme (blocs gris) au lieu d'un écran vide */
function showSkeleton() {
  hideGate();
  const b = (w, h = 14) => `<i class="sk" style="width:${w};height:${h}px"></i>`;
  const card = n => `<div class="btile sk-card">${b('40%', 18)}${b('22%', 40)}${Array.from({length: n}, () => b('100%', 34)).join('')}</div>`;
  $('#main').innerHTML = `<div class="bento" aria-busy="true" aria-label="Chargement">${card(4)}${card(1)}${card(1)}${card(2)}${card(1)}</div>`;
  $('#main').dataset.view = '';
}
function hideGate() {
  const g = $('#gate');
  if (g) g.hidden = true;
}
function loginForm(msg = '') {
  showGate(`<p class="muted">Connectez-vous avec votre compte.</p>
    <form id="login" class="gate-form" novalidate>
      <label>Adresse e-mail<input type="email" name="email" autocomplete="username" required></label>
      <label>Mot de passe<input type="password" name="pw" autocomplete="current-password" required></label>
      <p class="dlg-err" ${msg ? '' : 'hidden'}>${esc(msg)}</p>
      <button class="btn primary">Se connecter</button>
    </form>
    <p class="hint">Pas de compte ? Demandez-le au responsable de la GMAO.</p>`);
  const f = $('#login');
  f.elements.email.focus();
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const b = $('button', f);
    b.disabled = true;
    b.textContent = 'Connexion…';
    const {error} = await CLOUD.sb.auth.signInWithPassword({email: f.elements.email.value.trim(), password: f.elements.pw.value});
    if (error) {
      loginForm(/invalid/i.test(error.message) ? 'Adresse e-mail ou mot de passe incorrect.' : 'Connexion impossible : ' + error.message);
      return;
    }
    startCloud();
  });
}
async function bootCloud() {
  const c = CLOUD.cfg();
  showGate('<p class="muted">Connexion à la base…</p>');
  try {
    await loadLib();
  } catch (e) {
    showGate(
      `<p>Impossible de joindre Internet : la GMAO a besoin d’une connexion pour lire la base partagée.</p><button class="btn primary" onclick="location.reload()">Réessayer</button>`
    );
    return;
  }
  CLOUD.sb = window.supabase.createClient(c.url, c.key, {auth: {persistSession: true, autoRefreshToken: true, storageKey: 'gmao-auth'}});
  const {data} = await CLOUD.sb.auth.getSession();
  if (!data.session) return loginForm();
  startCloud();
}
async function startCloud() {
  showSkeleton();
  try {
    const {data: ss} = await CLOUD.sb.auth.getSession();
    CLOUD.user = ss?.session?.user || null;
    const cached = CLOUD.user ? await CLOUD.fromCache() : null;
    if (cached) {
      db = migrate(cached);
      CLOUD.warming = true;
      hideGate();
      applyHash();
      render();
      CLOUD.status('sync');
    }
    const pend = CLOUD.user ? await IDB.get(CLOUD.pendKey()) : null;
    let u;
    try {
      ({data: u} = await CLOUD.sb.auth.getUser());
    } catch (e) {
      u = null;
    }
    /* Pas de réseau : on travaille sur la copie de l'appareil, tout partira au retour du réseau */
    if (!u?.user && cached && (navigator.onLine === false || !(await netOk()))) return goOffline(pend);
    CLOUD.user = u?.user || null;
    if (!CLOUD.user) {
      CLOUD.warming = false;
      return loginForm();
    }
    /* Des modifications faites hors ligne attendent : on les envoie d'abord */
    if (pend?.db) {
      await CLOUD.fromCacheKeep();
      db = migrate(pend.db);
      CLOUD.on = true;
      CLOUD.warming = false;
      await CLOUD.push();
      if (CLOUD.state !== 'ok') return goOffline(pend);
      toast('Modifications faites hors ligne envoyées.');
    }
    const {d, empty} = await CLOUD.loadAll();
    CLOUD.on = true;
    CLOUD.warming = false;
    db = migrate(d);
    if (empty) db.meta.demo = false;
    CLOUD.auto = true;
    hideGate();
    if (!cached) applyHash();
    if (!document.querySelector('dialog[open]')) render();
    CLOUD.status('ok');
    const ft = $('#foot-txt');
    if (ft) ft.textContent = `Base partagée · ${CLOUD.user.email || ''} ·`;
    CLOUD.schedule();
    CLOUD.sb
      .channel('docs')
      .on('postgres_changes', {event: '*', schema: 'public', table: 'docs'}, ev => CLOUD.applyRemote(ev))
      .subscribe();
    syncPlanning();
    setTimeout(maybeWelcome, 400);
    if (empty && localStorage.getItem(KEY))
      toast('La base est vide : vous pouvez y envoyer les données de ce navigateur depuis Options › Connexion.');
  } catch (e) {
    showGate(
      `<p>Chargement impossible : ${esc(e.message || e)}</p><button class="btn primary" onclick="location.reload()">Réessayer</button>`
    );
  }
}
/* Mode hors ligne */
async function netOk() {
  try {
    await fetch(CLOUD.cfg().url + '/auth/v1/health', {method: 'GET', cache: 'no-store', headers: {apikey: CLOUD.cfg().key}});
    return true;
  } catch (e) {
    return false;
  }
}
async function goOffline(pend) {
  const base = await CLOUD.fromCacheKeep();
  db = migrate(pend?.db || base);
  CLOUD.on = true;
  CLOUD.warming = false;
  CLOUD.offline = true;
  hideGate();
  applyHash();
  render();
  CLOUD.status('offline');
  toast('Pas de réseau : vous travaillez sur la copie de cet appareil. Tout sera envoyé au retour du réseau.');
}
addEventListener('online', () => {
  if (CLOUD.offline) {
    CLOUD.offline = false;
    startCloud();
  } else if (CLOUD.on && CLOUD.state !== 'ok') CLOUD.push();
});
/* Toute modification passe par tx() : si une étape échoue, rien n'est enregistré. */
let REV = 0,
  LASTTX = null;
function tx(fn) {
  if (CLOUD.warming) throw new Error('Un instant : mise à jour des données en cours…');
  const snap = JSON.stringify(db);
  try {
    const r = fn();
    REV++;
    LASTTX = {snap, rev: REV};
    save();
    return r;
  } catch (e) {
    db = JSON.parse(snap);
    throw e;
  }
}
/* Annule la dernière modification (si rien d'autre n'a été modifié depuis) */
function undoLast(rev) {
  if (!LASTTX || LASTTX.rev !== rev) {
    toast('Impossible d’annuler : d’autres changements ont eu lieu depuis.', 'bad');
    return;
  }
  db = JSON.parse(LASTTX.snap);
  LASTTX = null;
  REV++;
  save();
  render();
  toast('Modification annulée');
}

/* ---------------- Accès ---------------- */
const get = (col, id) => db[col].find(x => x.id === id);
const getSalle = id => get('salles', id),
  getLieu = id => get('lieux', id),
  getPiece = id => get('pieces', id),
  getKks = id => get('kks', id),
  getPers = id => get('personnes', id),
  getInt = id => get('interventions', id);
const salleCode = s => s.code || `${s.batiment || 'E'}${s.etage}.${s.numero}`;
const pathOf = l => l.chemin || [];
function lieuCode(l) {
  if (!l) return '(supprimé)';
  const s = getSalle(l.salleId),
    ch = pathOf(l);
  return (s ? salleCode(s) : '?') + (ch.length ? ' / ' + ch.join(' / ') : '');
}
const normCode = s =>
  String(s || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
const normLieu = s => normCode(s).replace(/\s*[\/›>]\s*/g, ' / ');
const flatLieu = s => normCode(s).replace(/[\s\/›>]+/g, '');
function findLieu(s) {
  const c = normLieu(s);
  if (!c) return null;
  const ex = db.lieux.find(l => normLieu(lieuCode(l)) === c);
  if (ex) return ex;
  const fl = flatLieu(s),
    m = db.lieux.filter(l => flatLieu(lieuCode(l)) === fl);
  return m.length === 1 ? m[0] : null;
}
const findSalle = s => {
  const c = normCode(s);
  return c ? db.salles.find(x => normCode(salleCode(x)) === c) : null;
};
/* « E1.14 / A / 11 / 1 » ou « E1.11 C45 A » → salle + chemin */
function parseCode(str) {
  const t = String(str || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!t) return null;
  const m = t.match(/^([A-Za-z]{1,3}) ?(-?\d+) ?[.,] ?(\d+)(.*)$/);
  if (m) {
    const rest = m[4].trim().replace(/^[\/›>]\s*/, '');
    if (!rest || /^[\/›>\s]/.test(m[4]) || !/^\S/.test(m[4]) || /[\/›>]/.test(rest)) {
      const chemin = !rest ? [] : /[\/›>]/.test(m[4]) ? rest.split(/\s*[\/›>]\s*/).filter(Boolean) : rest.split(' ');
      const batiment = m[1].toUpperCase();
      return {batiment, etage: m[2], numero: m[3], local: `${batiment}${m[2]}.${m[3]}`, chemin};
    }
  }
  /* Local au nom libre : « Atelier électrique / A / 10 », « S1 / Visserie », « Banc d'essai » */
  const parts = t.split(/\s*[\/›>]\s*/).filter(Boolean);
  if (!parts.length) return null;
  return {local: parts[0], chemin: parts.slice(1), libre: true};
}
const persName = p => (p ? `${p.prenom || ''} ${p.nom}`.trim() : '(supprimé)');
/* Intervenants d'un rapport : figés tels qu'ils étaient lors du rapport (nom + groupe). */
const persSnap = p => ({nom: p.nom, prenom: p.prenom || '', groupe: p.groupe || ''});
/* Entreprises externes (liste des fournisseurs) comme intervenants : id « four:Nom » */
/* « Moi » : la personne de la liste qui utilise ce poste (liée à l'adresse de connexion, sinon mémorisée dans ce navigateur) */
/* Personne reconnue d'après l'adresse e-mail : le nom de famille du planning se trouve dans la partie avant @ (thomas.bonnant@… → BONNANT).
   Correspondance exacte d'un morceau (thomas / bonnant) d'abord, sinon nom contenu dans l'adresse. Rien si plusieurs personnes correspondent. */
const letters = x => norm(String(x || '')).replace(/[^a-z]/g, '');
function personFromEmail(email) {
  const local = String(email || '')
    .toLowerCase()
    .split('@')[0];
  if (!local) return null;
  const L = letters(local),
    toks = new Set(
      local
        .split(/[^a-zà-ÿ]+/i)
        .map(letters)
        .filter(Boolean)
    );
  let best = 0,
    hits = [];
  for (const p of db.personnes) {
    if (!live(p) || p.actif === false) continue;
    const n = letters(p.nom);
    if (n.length < 3) continue;
    const sc = toks.has(n) || [...toks].join('') === n ? 2 : n.length >= 4 && L.includes(n) ? 1 : 0;
    if (sc > best) {
      best = sc;
      hits = [p];
    } else if (sc && sc === best) hits.push(p);
  }
  return hits.length === 1 ? hits[0] : null;
}
/* Seuls les cadres peuvent supprimer définitivement (la base applique la même règle, voir outils/droits.sql) */
function canDel() {
  if (!CLOUD.user) return true;
  return personFromEmail(CLOUD.user.email)?.groupe === 'Cadres';
}
function meId() {
  const e = (CLOUD.user?.email || '').toLowerCase();
  let id = e && db.reglages.moi ? db.reglages.moi[e] : null;
  if (!id && e) id = personFromEmail(e)?.id || null;
  if (!id) {
    try {
      id = localStorage.getItem('tf-moi');
    } catch (x) {}
  }
  return id && getPers(id) ? id : null;
}
function setMe(id) {
  const e = (CLOUD.user?.email || '').toLowerCase();
  if (e)
    tx(() => {
      db.reglages.moi = {...(db.reglages.moi || {}), [e]: id || undefined};
    });
  try {
    id ? localStorage.setItem('tf-moi', id) : localStorage.removeItem('tf-moi');
  } catch (x) {}
}
/* Filtre « mes affaires » : actif par défaut à chaque chargement, sauf pour les cadres et l'administration */
const NOFILTER_GRP = ['Cadres', 'Administration'];
function initPour() {
  if (S.pourInit) return;
  const me = meId();
  if (!me) return;
  S.pourInit = true;
  const g = getPers(me)?.groupe || '';
  S.pour = NOFILTER_GRP.includes(g) ? '' : 'p:' + me;
}
function pourLabel(pour) {
  if (!pour) return '';
  if (pour.startsWith('g:')) return pour.slice(2);
  const p = getPers(pour.slice(2));
  return p ? persName(p) + (p.groupe ? ' · ' + p.groupe : '') : '';
}
function intFor(i, pour) {
  if (!pour) return true;
  const ps = intPers(i);
  if (pour.startsWith('g:'))
    return (
      ps.some(x => x.groupe === pour.slice(2)) || (i.tacheId && get('taches', i.tacheId) ? forWho(get('taches', i.tacheId), pour) : false)
    );
  const id = pour.slice(2),
    g = getPers(id)?.groupe || '';
  return (
    i.intervenants.includes(id) ||
    (g && ps.some(x => x.groupe === g)) ||
    (i.tacheId && get('taches', i.tacheId) ? forWho(get('taches', i.tacheId), pour) : false)
  );
}
/* ---------- Aide ---------- */
const HELP = [
  [
    'report',
    'Faire un rapport',
    [
      'Appuyez sur <b>+</b> (téléphone) ou <b>Nouveau rapport</b>.',
      'Remplissez <b>Quoi ?</b>, <b>Où ?</b> (le KKS) et <b>Ce qui a été fait</b> : le bouton micro permet de dicter.',
      'Intervenants : vous êtes déjà dedans ; tapez le nom d’un collègue ou d’une entreprise pour l’ajouter.',
      'Pièces utilisées, durée, type : dans « Plus de détails ». <b>Enregistrer</b>.'
    ]
  ],
  [
    'check',
    'Faire un travail',
    [
      '<b>Travaux</b> a trois onglets : <b>À faire</b>, <b>En cours</b> (rapports pas finis) et <b>Fait</b>.',
      'Cliquez sur <b>✓</b> au bout de la ligne : « Non, juste cocher » ou « Oui, faire un rapport ».',
      'Pour ne plus être interrogé : cochez « Retenir mon choix », ou réglez « Un rapport quand c’est fait ? » dans le travail.',
      'Un travail qui revient passe tout seul à sa prochaine date.'
    ]
  ],
  [
    'move',
    'Sortir ou rentrer une pièce',
    [
      'Scannez l’étiquette QR de la pièce, ou cherchez-la dans <b>Pièces</b>.',
      'Sur sa fiche : <b>− Sortir</b> ou <b>+ Entrer</b>, la quantité, l’emplacement.',
      'Une erreur ? Le message en bas propose <b>Annuler</b> pendant quelques secondes.'
    ]
  ],
  [
    'scan',
    'Trouver une pièce',
    [
      '<b>Scanner un QR</b> (accueil ou bouton à côté de la recherche) ouvre directement la fiche.',
      'Sinon, tapez un mot, un ID, une référence ou un KKS dans la recherche des Pièces.',
      'La fiche indique où elle est rangée, sur quels équipements elle va et dans quels rapports elle a servi.'
    ]
  ],
  [
    'calendar',
    'Planifier la semaine',
    [
      'Onglet <b>Planning</b> : une ligne par personne, avec ses présences (R, RM, VA…).',
      'Glissez une tâche de la colonne « À planifier » dans une case, ou cliquez dans la case pour écrire le travail.',
      'Imprimer la semaine : ⋯ Plus › Imprimer.'
    ]
  ],
  [
    'person',
    'Ce que je vois',
    [
      'TriFlow vous reconnaît d’après votre adresse e-mail ; sinon, choisissez votre nom une fois (accueil ou Options › Connexion).',
      'Tâches, rapports et accueil sont alors filtrés sur vous et votre groupe. Pour tout voir : « Tout le monde ».',
      'Les archives ne sont jamais filtrées.'
    ]
  ],
  [
    'list',
    'Qui a fait quoi',
    [
      'Chaque action est notée : sorties de stock, rapports, tâches, planning, modifications.',
      'Tout l’historique : <b>Options › Historique</b>. Celui d’une fiche : en bas de la fiche, « Qui a fait quoi ».'
    ]
  ],
  [
    'archive',
    'Archiver et retrouver',
    [
      'Rien ne se supprime par erreur : « Archiver » retire un élément des listes.',
      'Pour le retrouver : ⋯ Plus › Archives, puis <b>Restaurer</b>.'
    ]
  ]
];
function helpDialog(open = 0) {
  dialog({
    title: 'Aide',
    saveLabel: 'Fermer',
    wide: true,
    info: true,
    body: `<div class="help">${HELP.map(([ic, t, steps], i) => `<details ${i === open ? 'open' : ''}><summary>${icon(ic)}${t}</summary><ol>${steps.map(x => `<li>${x}</li>`).join('')}</ol></details>`).join('')}</div><p class="hint">Une question, une idée ? Parlez-en à Thomas Bonnant (informatique).</p>`,
    onSave() {}
  });
}
function maybeWelcome() {
  let seen = null;
  try {
    seen = localStorage.getItem('tf-welcome');
  } catch (e) {
    return;
  }
  if (seen || document.querySelector('dialog[open]') || (CLOUD.cfg().url && !CLOUD.on)) return;
  try {
    localStorage.setItem('tf-welcome', '1');
  } catch (e) {}
  const me = meId() && getPers(meId()),
    all = me && NOFILTER_GRP.includes(me.groupe || '');
  const first = me
    ? `<li><b>Vous êtes reconnu : ${esc(persName(me))}${me.groupe ? ` · ${esc(me.groupe)}` : ''}.</b> ${all ? 'Vous voyez les tâches et rapports de tout le monde.' : `L’accueil, les tâches et les rapports sont filtrés sur vous${me.groupe ? ` et votre groupe (${esc(me.groupe)})` : ''} ; « Voir tout le monde » enlève le filtre.`} <button type="button" class="link" data-w-me>Ce n’est pas vous ?</button></li>`
    : `<li><b>Dites-nous qui vous êtes.</b> Vous verrez vos tâches et celles de votre groupe. <button type="button" class="btn small primary" data-w-me>${icon('person')}Choisir mon nom</button></li>`;
  const d = dialog({
    title: me ? `Bonjour ${esc(persName(me))}` : 'Bienvenue dans TriFlow',
    saveLabel: 'C’est parti',
    info: true,
    body: `<ol class="welcome">
    ${first}
    <li><b>Votre semaine</b> est sur l’accueil : ce que le planning vous a attribué, jour par jour.</li>
    <li><b>C’est fait ?</b> Dans <b>Travaux</b>, cochez ✓ : TriFlow demande s’il faut un rapport. Pour un rapport, une sortie de stock ou un scan : le bouton <b>+</b> en bas à droite sur téléphone, ou les raccourcis de l’accueil.</li>
    <li><b>Perdu ?</b> Le bouton <b>?</b> en haut ouvre l’aide, en quelques lignes.</li></ol>`,
    onSave() {},
    onOpen(f, dd) {
      const b = $('[data-w-me]', dd);
      if (b)
        b.onclick = () => {
          dd.close();
          meDialog();
        };
    }
  });
  return d;
}
function meDialog() {
  const ps = db.personnes.filter(p => live(p) && p.actif !== false).sort(persSort),
    cur = meId();
  dialog({
    title: 'Qui êtes-vous ?',
    saveLabel: 'Valider',
    body: `<p class="hint">L’accueil affichera d’abord vos tâches et celles de votre corps de métier.</p><label>Je suis<select name="me"><option value="">— personne en particulier —</option>${db.listes.groupes
      .filter(g => ps.some(p => p.groupe === g))
      .map(
        g =>
          `<optgroup label="${esc(g)}">${ps
            .filter(p => p.groupe === g)
            .map(p => opt(p.id, persName(p), cur))
            .join('')}</optgroup>`
      )
      .join('')}</select></label>`,
    onSave(f) {
      setMe(val(f, 'me'));
      S.pour = '';
      S.pourInit = false;
      render();
      toast(val(f, 'me') ? `Bonjour ${persName(getPers(val(f, 'me')))}` : 'Accueil pour tout le monde');
    }
  });
}
/* « Modifié par … » : chaque fiche enregistrée garde l'adresse de la personne et l'heure */
function byWho(email) {
  const id = db.reglages.moi?.[String(email || '').toLowerCase()];
  const p = (id && getPers(id)) || personFromEmail(email);
  return p ? persName(p) : String(email || '').split('@')[0];
}
const byLine = x => (x && x._by ? `<p class="byline">${icon('edit')}Modifié par ${esc(byWho(x._by))} · ${esc(fmtDT(x._at))}</p>` : '');
const FOUR_GRP = 'Entreprise externe';
const fourSnap = n => ({nom: n, prenom: '', groupe: FOUR_GRP});
const isFourId = id => String(id).startsWith('four:');
const fourCore = x =>
  String(x || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(ag|sa|gmbh|sarl|ltd|inc|co|kg|sas|bv|spa|ab|oy)\b\.?/g, '')
    .replace(/[^a-z0-9]/g, '');
function fourMatch(name, list) {
  const c = fourCore(name);
  if (c.length < 3) return null;
  let best = null;
  for (const f of list) {
    const fc = fourCore(f);
    if (fc === c) return f;
    if (!best && c.length >= 4 && fc.startsWith(c)) best = f;
  }
  if (best) return best;
  const W = x => [
    ...new Set(
      String(x)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(w => w.length >= 2)
    )
  ];
  const toks = W(name);
  if (!toks.length) return null;
  const hit = list.filter(f => {
    const ws = W(f);
    return toks.length === 1
      ? /^[A-Z0-9]{3,5}$/.test(String(name).trim()) && ws.includes(toks[0])
      : toks.every(t => ws.some(w => w === t || (w.length >= 4 && t.length >= 4 && (w.startsWith(t) || t.startsWith(w)))));
  });
  return hit.length === 1 ? hit[0] : null;
}
const intPers = i =>
  i.intervenants.map(id => ({
    id,
    ...((isFourId(id) ? i.snap?.[id] || fourSnap(id.slice(5)) : null) ||
      (i.statut !== 'terminee' && getPers(id) ? persSnap(getPers(id)) : null) ||
      i.snap?.[id] ||
      (getPers(id) ? persSnap(getPers(id)) : {nom: '(supprimé)', prenom: '', groupe: ''}))
  }));
const snapLabel = x => persName(x) + (x.groupe ? ` (${x.groupe})` : '');
function ensureSnaps(d) {
  for (const i of d.interventions) {
    if (i.snap) continue;
    i.snap = {};
    for (const id of i.intervenants) {
      const p = d.personnes.find(x => x.id === id);
      if (p) i.snap[id] = persSnap(p);
    }
  }
}
const grpIdx = g => {
  const i = db.listes.groupes.indexOf(g);
  return i < 0 ? 999 : i;
};
const persSort = (a, b) =>
  grpIdx(a.groupe) - grpIdx(b.groupe) || coll.compare(a.nom, b.nom) || coll.compare(a.prenom || '', b.prenom || '');
const grpChip = g => (g ? `<span class="chip off">${esc(g)}</span>` : '');
const pieceLabel = p => `${p.ref} — ${p.designation}`;
const kksLabel = k => `${k.code} — ${k.designation}`;
function findBy(col, field, labelFn, s) {
  const raw = String(s || '').trim();
  if (!raw) return null;
  const key = raw.split(' — ')[0].trim().toUpperCase();
  return db[col].find(x => String(x[field]).toUpperCase() === key) || db[col].find(x => norm(labelFn(x)) === norm(raw)) || null;
}
const findPiece = s => {
  const r = String(s || '').replace(/^.*#piece=/, '');
  let t = r;
  try {
    t = decodeURIComponent(r);
  } catch (e) {}
  return findBy('pieces', 'ref', pieceLabel, t);
};
const findKks = s => findBy('kks', 'code', kksLabel, s);
const total = p => round(p.stock.reduce((a, s) => a + (+s.qte || 0), 0));
/* Emplacements « statut » : pièces hors magasin (en prêt, en révision…), distinctes des locaux physiques. */
const STATUT_RE = /^(en pr[êe]t|en r[ée]vision.*|en attente|retour fournisseur|en fonction sur installation)$/i;
const isStatut = l => !!getSalle(l?.salleId)?.statut;
const dispo = p => round(p.stock.filter(s => !isStatut(getLieu(s.lieuId))).reduce((a, s) => a + (+s.qte || 0), 0));
const horsMag = p => p.stock.filter(s => s.qte > 0 && isStatut(getLieu(s.lieuId)));
const statutLabel = l => {
  const s = getSalle(l.salleId);
  return [s ? salleCode(s) : '?', ...pathOf(l)].join(' › ');
};
const isOut = p => p.stock.length > 0 && dispo(p) <= 0 && !horsMag(p).length;
const isLow = p => +p.stockMin > 0 && dispo(p) <= +p.stockMin;
const stockAt = (p, lieuId) => (p.stock.find(s => s.lieuId === lieuId) || {qte: 0}).qte;
const lieuSort = (a, b) =>
  coll.compare(salleCode(getSalle(a.salleId) || {etage: '', numero: ''}), salleCode(getSalle(b.salleId) || {etage: '', numero: ''})) ||
  coll.compare(pathOf(a).join('\u0001'), pathOf(b).join('\u0001'));
let contIdx = null;
const contentsOf = lieuId => {
  if (!contIdx) {
    contIdx = new Map();
    for (const p of db.pieces)
      for (const s of p.stock) {
        if (!contIdx.has(s.lieuId)) contIdx.set(s.lieuId, []);
        contIdx.get(s.lieuId).push({p, qte: s.qte});
      }
  }
  return contIdx.get(lieuId) || [];
};
/* Pièce figée dans un rapport : on garde l'ID, la désignation, l'unité et l'emplacement tels qu'ils étaient au moment du rapport */
const pSnap = (p, l) => ({ref: p.ref, designation: p.designation, unite: p.unite, lieu: l ? lieuCode(l) : ''});
const lineInfo = (x, i) =>
  (i && i.statut !== 'terminee' && getPiece(x.pieceId) ? pSnap(getPiece(x.pieceId), getLieu(x.lieuId)) : null) ||
  x.s ||
  (getPiece(x.pieceId)
    ? pSnap(getPiece(x.pieceId), getLieu(x.lieuId))
    : {ref: '', designation: '(pièce supprimée)', unite: '', lieu: getLieu(x.lieuId) ? lieuCode(getLieu(x.lieuId)) : ''});
/* Équipement et tâche figés dans un rapport validé */
const kSnap = k => ({code: k.code, designation: k.designation, aic: k.aic || ''});
const kInfo = i =>
  (i.statut !== 'terminee' && getKks(i.kksId) ? kSnap(getKks(i.kksId)) : null) || i.ks || (getKks(i.kksId) ? kSnap(getKks(i.kksId)) : null);
const tSnap = t => ({titre: t.titre, description: t.description || '', freq: freqLabel(t.freq), assign: assignLabel(t.assign)});
const tInfo = i =>
  (i.statut !== 'terminee' && get('taches', i.tacheId) ? tSnap(get('taches', i.tacheId)) : null) ||
  i.ts ||
  (get('taches', i.tacheId) ? tSnap(get('taches', i.tacheId)) : null);
const kTagI = i => {
  const k = kInfo(i),
    live = getKks(i.kksId);
  return k
    ? live
      ? `<button class="kks" data-act="goto" data-view="kks" data-id="${live.id}">${esc(k.code)}</button>`
      : `<span class="kks">${esc(k.code)}</span>`
    : '';
};
/* ---------- Archives : rien n'est supprimé par défaut, tout peut être restauré ---------- */
const live = x => !!x && !x.arch;
const liveLieu = l => live(l) && live(getSalle(l.salleId));
const ARCH_LBL = {
  pieces: ['Pièce archivée', 'la pièce'],
  kks: ['Équipement archivé', 'l’équipement'],
  taches: ['Tâche archivée', 'la tâche'],
  interventions: ['Rapport archivé', 'le rapport'],
  personnes: ['Personne archivée', 'la personne'],
  lieux: ['Emplacement archivé', 'l’emplacement'],
  salles: ['Local archivé', 'le local']
};
function archiveItem(col, x) {
  if (col === 'lieux' && db.pieces.some(p => p.stock.some(s => s.lieuId === x.id && s.qte > 0)))
    throw new Error('Cet emplacement contient du stock : déplacez-le avant d’archiver.');
  if (col === 'salles') {
    const ids = new Set(db.lieux.filter(l => l.salleId === x.id).map(l => l.id));
    if (db.pieces.some(p => p.stock.some(s => ids.has(s.lieuId) && s.qte > 0)))
      throw new Error('Des pièces sont encore rangées dans ce local : déplacez-les avant d’archiver.');
  }
  tx(() => {
    x.arch = todayISO();
  });
  const v = col === 'salles' ? 'lieux' : col;
  if (S.sel[v] === x.id) S.sel[v] = null;
  render();
  toast(
    `${ARCH_LBL[col][0]} · retrouvez-la dans « Plus › Archives »`.replace(
      'retrouvez-la',
      /archivé$/.test(ARCH_LBL[col][0]) ? 'retrouvez-le' : 'retrouvez-la'
    ),
    '',
    true
  );
}
function unarchiveItem(col, x) {
  tx(() => {
    delete x.arch;
    delete x.mergedInto;
  });
  render();
  toast(`${ARCH_LBL[col][0].replace(/archivée?$/, '')}restauré${/archivée$/.test(ARCH_LBL[col][0]) ? 'e' : ''}`);
}
/* Bouton du bas des fenêtres « Modifier » : Archiver (réversible), ou Supprimer définitivement si déjà archivé */
/* Suppressions définitives (cadres uniquement) */
const HARD = {
  taches(t) {
    tx(() => {
      db.taches = db.taches.filter(x => x.id !== t.id);
      db.plan = db.plan.filter(x => x.tacheId !== t.id);
      db.interventions.forEach(i => {
        if (i.tacheId === t.id) delete i.tacheId;
      });
    });
    S.sel.taches = null;
    render();
    toast('Tâche supprimée (les rapports sont conservés)', '', true);
  },
  pieces(p) {
    if (usedInInterventions(p.id).length) throw new Error('Cette pièce figure dans des rapports d’intervention : archivez-la plutôt.');
    tx(() => {
      db.pieces = db.pieces.filter(x => x.id !== p.id);
      db.mouvements = db.mouvements.filter(m => m.pieceId !== p.id);
      db.histo = db.histo.filter(h => h.id !== p.id);
    });
    S.sel.pieces = null;
    render();
    toast('Pièce supprimée', '', true);
  },
  interventions(it) {
    tx(() => {
      (it.pieces || []).forEach(x => {
        const p = getPiece(x.pieceId);
        if (p && getLieu(x.lieuId)) addStock(p, x.lieuId, x.qte, 'Annulation intervention', it.num);
      });
      db.interventions = db.interventions.filter(i => i.id !== it.id);
    });
    S.sel.interventions = null;
    render();
    toast('Rapport supprimé' + ((it.pieces || []).length ? ', pièces remises en stock' : ''), '', true);
  }
};
const HARD_LBL = {
  taches: ['la tâche', 'Les rapports déjà faits sont conservés.'],
  pieces: ['la pièce', 'Son historique de stock est aussi effacé.'],
  interventions: ['le rapport', 'Les pièces qu’il a consommées sont remises en stock.']
};
const hardItem = (col, id) => (canDel() ? ['hard-del', 'Supprimer définitivement', 'out', {col, id}] : null);
const archDel = (col, x, hard) =>
  x.arch
    ? canDel()
      ? {label: 'Supprimer définitivement', run: hard}
      : null
    : {
        label: 'Archiver',
        soft: true,
        run() {
          archiveItem(col, x);
        }
      };
const archBanner = (col, x) =>
  x && x.arch
    ? `<div class="arch-banner">${icon('archive')}<span><strong>${ARCH_LBL[col][0]}</strong> le ${fmtD(x.arch)}${x.mergedInto ? ` · fusionnée dans l’ID ${esc(x.mergedInto)}` : ''}. Elle n’apparaît plus dans les listes.</span><button class="btn small" data-act="unarch" data-col="${col}" data-id="${x.id}">Restaurer</button></div>`.replace(
        'Elle n’apparaît',
        /archivé$/.test(ARCH_LBL[col][0]) ? 'Il n’apparaît' : 'Elle n’apparaît'
      )
    : '';
const archCount = col => db[col].filter(x => x.arch).length;
const archItem = v => [
  'arch-view',
  S.arch[v] ? 'Quitter les archives' : `Archives${archCount(v) ? ` (${archCount(v)})` : ''}`,
  'archive',
  {v}
];
const usedInInterventions = pieceId => db.interventions.filter(i => i.pieces.some(l => l.pieceId === pieceId));
const sortedStock = p => [...p.stock].filter(s => getLieu(s.lieuId)).sort((a, b) => lieuSort(getLieu(a.lieuId), getLieu(b.lieuId)));
const mainPlace = p => {
  const l = [...p.stock]
    .filter(s => getLieu(s.lieuId))
    .sort((a, b) => isStatut(getLieu(a.lieuId)) - isStatut(getLieu(b.lieuId)) || b.qte - a.qte)[0];
  return l ? getLieu(l.lieuId) : null;
};

function addStock(p, lieuId, delta, motif, ref = '') {
  const l = getLieu(lieuId);
  if (!l) throw new Error('Emplacement introuvable.');
  let s = p.stock.find(x => x.lieuId === lieuId);
  if (!s) {
    s = {lieuId, qte: 0};
    p.stock.push(s);
  }
  const next = round(s.qte + delta);
  if (next < 0) throw new Error(`Stock insuffisant : ${p.ref} en ${lieuCode(l)}, ${num(s.qte)} ${p.unite} disponible(s).`);
  s.qte = next;
  if (delta) db.mouvements.unshift({id: uid(), date: new Date().toISOString(), pieceId: p.id, lieuId, qte: round(delta), motif, ref});
}
function nextRef() {
  let n = 0;
  for (const p of db.pieces) {
    const v = /^\d+$/.test(String(p.ref)) ? +p.ref : 0;
    if (v > n) n = v;
  }
  return String(n + 1);
}
/* Numéro de rapport unique et simple : R + année sur 2 chiffres + numéro d'ordre dans l'année (R26-017) */
function nextNum(date) {
  const y = String(date || todayISO()).slice(2, 4);
  const n = Math.max(
    0,
    ...db.interventions.map(i => {
      const m = String(i.num).match(/^R(\d{2})-(\d+)$/);
      return m && m[1] === y ? +m[2] : 0;
    })
  );
  return `R${y}-${String(n + 1).padStart(3, '0')}`;
}
/* Renumérote tous les rapports dans l'ordre chronologique, année par année. Le numéro CareOffice est gardé en interne (co) pour éviter les doublons à l'import. */
function renumberInts(d) {
  for (const i of d.interventions) if (/^CO-/.test(String(i.num))) i.co = i.num;
  const list = [...d.interventions].sort(
    (a, b) =>
      (a.date || '9').localeCompare(b.date || '9') ||
      String(a.co || '').localeCompare(String(b.co || ''), undefined, {numeric: true}) ||
      String(a.num).localeCompare(String(b.num), undefined, {numeric: true})
  );
  const by = new Map();
  for (const i of list) {
    const y = (i.date || todayISO()).slice(2, 4),
      n = (by.get(y) || 0) + 1;
    by.set(y, n);
    i.num = `R${y}-${String(n).padStart(3, '0')}`;
  }
}

/* ---------------- QR code (pour le matériel) ---------------- */
const qrBase = () => (db.reglages.qrBase || '').trim() || (/^https?:$/.test(location.protocol) ? location.href.split('#')[0] : '');
function qrText(p) {
  const base = qrBase();
  return base ? base.replace(/#.*$/, '') + '#piece=' + encodeURIComponent(p.ref) : p.ref;
}
function qrSvg(text) {
  try {
    const q = new QRLib.QRCode(-1, QRLib.L.M);
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return `<div class="qr"><svg viewBox="-1 -1 ${n + 2} ${n + 2}" shape-rendering="crispEdges" role="img" aria-label="QR code ${esc(text)}"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="#fff"/><path d="${d}" fill="#000"/></svg></div>`;
  } catch (e) {
    return '<div class="qr"></div>';
  }
}

/* ---------------- Données d'exemple ---------------- */
function seed() {
  const d = blank();
  d.meta.demo = true;
  const salle = (etage, numero, nom) => {
    const s = {id: uid(), etage, numero, nom};
    d.salles.push(s);
    return s;
  };
  const S1 = salle('1', '11', 'Magasin pièces mécaniques'),
    S2 = salle('0', '04', 'Atelier électrique'),
    S3 = salle('2', '07', 'Local instrumentation');
  const L = {};
  const lieu = (s, r, n, b) => {
    const l = {id: uid(), salleId: s.id, chemin: [r + n, b].filter(Boolean), note: ''};
    d.lieux.push(l);
    return l;
  };
  ['40', '41', '42', '30', '31', '32'].forEach(n => ['A', 'B'].forEach(b => (L['C' + n + b] = lieu(S1, 'C', n, b))));
  ['10', '11'].forEach(n => (L['D' + n + 'A'] = lieu(S1, 'D', n, 'A')));
  ['10', '11', '12'].forEach(n => ['A', 'B'].forEach(b => (L['A' + n + b] = lieu(S2, 'A', n, b))));
  L.inst = lieu(S3, '', '', '');
  ['20', '21'].forEach(n => (L['B' + n + 'A'] = lieu(S3, 'B', n, 'A')));
  mergeStaff(d, PLANNING_STAFF);
  d.meta.staffV = 1;
  d.meta.fictV = 1;
  const who = nom => d.personnes.find(p => p.nom === nom);
  const marc = who('DURGNIAT'),
    julie = who('LUCAS COUTO'),
    sam = who('RAUSIS');
  const kk = (code, designation) => {
    const k = {id: uid(), code, designation};
    d.kks.push(k);
    return k;
  };
  const kConv = kk('1ETG10 AF001', 'Convoyeur à mâchefers, ligne 1');
  kk('1EAC10 AE001', 'Pont roulant fosse à déchets');
  const kTirage = kk('1HNC10 AN001', 'Ventilateur de tirage, ligne 1'),
    kAir = kk('1HLB10 AN001', "Ventilateur d'air primaire, ligne 1");
  const kPompe = kk('1LAC10 AP001', 'Pompe alimentaire chaudière, ligne 1'),
    kVanne = kk('1LAB20 AA101', 'Vanne de régulation eau alimentaire, ligne 1');
  kk('1MAA10', 'Turbine à vapeur');
  const kTab = kk('1BFA10', 'Tableau basse tension, ligne 1');
  kk('1NDA10 AP001', 'Pompe de circulation réseau CAD');
  const kPT = kk('1LAC10 CP001', 'Mesure de pression refoulement pompe alimentaire');
  const piece = (ref, designation, categorie, fabricant, refFab, unite, stockMin, kks, stock) => {
    const p = {
      id: uid(),
      ref,
      designation,
      categorie,
      fabricant,
      refFab,
      fournisseur: '',
      unite,
      stockMin,
      notes: '',
      kks: kks.map(k => k.id),
      stock: stock.map(([l, q]) => ({lieuId: l.id, qte: q}))
    };
    d.pieces.push(p);
    return p;
  };
  const roul = piece(
    'P-00001',
    'Roulement à billes 6205-2RS',
    'Mécanique',
    'SKF',
    '6205-2RSH',
    'pce',
    4,
    [kTirage, kAir],
    [
      [L.C40A, 6],
      [L.C40B, 2]
    ]
  );
  piece('P-00002', 'Garniture mécanique Ø 35 mm', 'Mécanique', 'EagleBurgmann', 'MG1/35', 'pce', 2, [kPompe], [[L.C41A, 1]]);
  piece('P-00003', 'Courroie trapézoïdale SPA 1250', 'Mécanique', 'Optibelt', 'SPA 1250', 'pce', 6, [kAir], [[L.C30A, 8]]);
  piece('P-00004', 'Joint torique 50 × 3 mm FKM', 'Mécanique', '', '', 'pce', 20, [kVanne, kPompe], [[L.D10A, 45]]);
  piece(
    'P-00005',
    'Contacteur 3 pôles 25 A, bobine 24 V DC',
    'Électrique',
    'Siemens',
    '3RT2026-1BB40',
    'pce',
    2,
    [kConv, kTab],
    [[L.A10A, 3]]
  );
  piece('P-00006', 'Fusible NH00 63 A gG', 'Électrique', '', '', 'pce', 10, [kTab], [[L.A11B, 12]]);
  piece('P-00007', 'Transmetteur de pression 0–16 bar, 4–20 mA', 'Instrumentation', 'Endress+Hauser', '', 'pce', 1, [kPT], [[L.inst, 2]]);
  const graisse = piece('P-00008', 'Graisse roulements haute température', 'Consommable', '', '', 'kg', 2, [kTirage], [[L.B20A, 1.5]]);
  const int = (num, date, type, statut, k, titre, constat, travaux, duree, intervenants, pieces) =>
    d.interventions.push({
      id: uid(),
      num,
      date,
      type,
      statut,
      kksId: k.id,
      titre,
      constat,
      travaux,
      duree,
      intervenants: intervenants.map(p => p.id),
      pieces: pieces.map(([p, l, q]) => ({pieceId: p.id, lieuId: l.id, qte: q}))
    });
  int(
    'INT-2026-0001',
    '2026-10-14',
    'Corrective',
    'terminee',
    kTirage,
    'Bruit anormal palier côté accouplement',
    'Bruit et échauffement du palier côté accouplement relevés lors de la ronde.',
    'Remplacement des deux roulements, graissage, contrôle vibratoire après remise en service : valeurs normales.',
    3.5,
    [marc, sam],
    [
      [roul, L.C40A, 2],
      [graisse, L.B20A, 0.5]
    ]
  );
  int(
    'INT-2026-0002',
    '2026-10-27',
    'Contrôle',
    'encours',
    kPompe,
    'Contrôle étanchéité garniture',
    'Légère fuite à la garniture constatée lors de la ronde.',
    '',
    '',
    [marc],
    []
  );
  int(
    'INT-2026-0003',
    '2026-10-28',
    'Corrective',
    'ouverte',
    kConv,
    'Contacteur moteur convoyeur reste collé',
    'Le moteur ne s’arrête pas à l’arrêt d’urgence local, contacteur suspect.',
    '',
    '',
    [julie],
    []
  );
  for (const p of d.pieces)
    for (const s of p.stock) {
      const used = d.interventions
        .flatMap(i => i.pieces)
        .filter(x => x.pieceId === p.id && x.lieuId === s.lieuId)
        .reduce((a, x) => a + x.qte, 0);
      d.mouvements.push({
        id: uid(),
        date: '2026-10-01T08:00:00.000Z',
        pieceId: p.id,
        lieuId: s.lieuId,
        qte: s.qte + used,
        motif: 'Stock initial (exemple)',
        ref: ''
      });
    }
  for (const i of d.interventions)
    for (const x of i.pieces)
      d.mouvements.push({
        id: uid(),
        date: i.date + 'T15:00:00.000Z',
        pieceId: x.pieceId,
        lieuId: x.lieuId,
        qte: -x.qte,
        motif: 'Sortie intervention',
        ref: i.num
      });
  d.mouvements.sort((a, b) => b.date.localeCompare(a.date));
  d.listes.fournisseurs = [...new Set(d.pieces.map(p => p.fabricant).filter(Boolean))].sort(coll.compare);
  ensureSnaps(d);
  seedTaches(d);
  d.meta.tachesV = 1;
  return d;
}

/* ---------------- Tâches (récurrentes ou ponctuelles) ----------------
   taches(id, titre, description, kksId, assign{type:'groupe'|'personne', v}, freq{n, unite:'jour'|'semaine'|'mois'|'an'|'once'}, prochaine, actif)
   Un rapport créé depuis une tâche porte tacheId ; quand il est « Terminé », la tâche passe à l'échéance suivante. */
const UNITES_T = {jour: ['jour', 'jours'], semaine: ['semaine', 'semaines'], mois: ['mois', 'mois'], an: ['an', 'ans']};
function addFreq(iso, n, unite) {
  const d = new Date(iso + 'T12:00');
  if (unite === 'jour') d.setDate(d.getDate() + n);
  else if (unite === 'semaine') d.setDate(d.getDate() + 7 * n);
  else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + (unite === 'an' ? 12 * n : n));
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }
  const y = d.getFullYear(),
    m = String(d.getMonth() + 1).padStart(2, '0'),
    dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
const freqLabel = f =>
  f.unite === 'once'
    ? 'Une seule fois'
    : f.n === 1
      ? {jour: 'Chaque jour', semaine: 'Chaque semaine', mois: 'Chaque mois', an: 'Chaque année'}[f.unite]
      : `Tous les ${f.n} ${UNITES_T[f.unite][1]}`;
const assignLabel = a => (!a || !a.v ? 'Non attribuée' : a.type === 'personne' ? persName(getPers(a.v) || {nom: '(supprimé)'}) : a.v);
const daysTo = iso => Math.round((new Date(iso + 'T12:00') - new Date(todayISO() + 'T12:00')) / 864e5);
const lateLbl = n => (n < 14 ? `${n} j` : n < 60 ? `${Math.round(n / 7)} sem.` : `${Math.round(n / 30.4)} mois`);
/* Retard de plus d'un an : tâche « en souffrance » (souvent reprise de CareOffice) — affichée en gris pour que le rouge reste réservé à l'urgent */
/* Deux sortes de tâches : les petits travaux (ponctuels, avec une priorité) et les tâches récurrentes (entretien périodique) */
const isPetit = t => t.kind === 'petit' || t.freq?.unite === 'once';
const PRIO = {haute: ['Haute', 'bad'], normale: ['Normale', 'info'], basse: ['Basse', 'off']};
const prioOf = t => (PRIO[t.prio] ? t.prio : 'normale');
const PRIO_N = {haute: 0, normale: 1, basse: 2};
const petitSort = (a, b) =>
  PRIO_N[prioOf(a)] - PRIO_N[prioOf(b)] || (a.prochaine || '9').localeCompare(b.prochaine || '9') || coll.compare(a.titre, b.titre);
const isOld = t => !isPetit(t) && t.actif !== false && daysTo(t.prochaine) < -365;
const urgSort = (a, b) => isOld(a) - isOld(b) || a.prochaine.localeCompare(b.prochaine);
function dueInfo(t) {
  if (isPetit(t)) {
    const p = prioOf(t),
      n = t.prochaine ? daysTo(t.prochaine) : NaN;
    return {
      k: 'p-' + p,
      chip: `${p === 'normale' ? '' : `<span class="chip prio ${PRIO[p][1]}">${PRIO[p][0]}</span>`}${isNaN(n) ? '' : ` <span class="chip ${n < -365 ? 'old' : n < 0 ? 'bad' : n <= 7 ? 'warn' : 'off'}">${n < 0 ? 'depuis le' : 'pour le'} ${fmtD(t.prochaine)}</span>`}`
    };
  }
  const n = daysTo(t.prochaine);
  if (n < -365)
    return {
      k: 'vieux',
      chip: `<span class="chip old" title="Échéance : ${fmtD(t.prochaine)}">En retard depuis ${t.prochaine.slice(0, 4)}</span>`
    };
  if (n < 0) return {k: 'retard', chip: `<span class="chip bad" title="Échéance : ${fmtD(t.prochaine)}">En retard · ${lateLbl(-n)}</span>`};
  if (n === 0) return {k: 'semaine', chip: '<span class="chip warn">Aujourd’hui</span>'};
  if (n <= 7) return {k: 'semaine', chip: `<span class="chip warn">Dans ${n} j</span>`};
  return {k: 'plus', chip: `<span class="chip off">${fmtD(t.prochaine)}</span>`};
}
const openRun = t => db.interventions.find(i => i.tacheId === t.id && !i.tacheFait);
const forWho = (t, pour) => {
  if (!pour) return true;
  const type = pour.slice(0, 1),
    v = pour.slice(2);
  if (type === 'g') return t.assign?.type === 'groupe' && t.assign.v === v;
  const p = getPers(v);
  return (t.assign?.type === 'personne' && t.assign.v === v) || (t.assign?.type === 'groupe' && !!p && t.assign.v === p.groupe);
};
function advanceTask(t, doneISO) {
  t.derniere = doneISO;
  if (t.freq.unite === 'once') {
    t.actif = false;
    return;
  }
  let n = t.prochaine;
  do {
    n = addFreq(n, t.freq.n, t.freq.unite);
  } while (n <= doneISO);
  t.prochaine = n;
}
function seedTaches(d) {
  const k = code => d.kks.find(x => x.code === code)?.id || '';
  const pers = nom => d.personnes.find(p => p.nom === nom)?.id || '';
  const at = n => {
    const x = new Date();
    x.setDate(x.getDate() + n);
    x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
    return x.toISOString().slice(0, 10);
  };
  const T = (titre, description, kks, assign, freq, n) =>
    d.taches.push({id: uid(), titre, description, kksId: k(kks), assign, freq, prochaine: at(n), actif: true});
  T(
    'Graissage des paliers',
    'Graisser les deux paliers (graisse haute température), contrôler bruit et température.',
    '1HNC10 AN001',
    {type: 'groupe', v: 'Mécanicien'},
    {n: 1, unite: 'mois'},
    -3
  );
  T(
    'Contrôle étanchéité garniture',
    'Contrôle visuel de la garniture mécanique, noter toute fuite.',
    '1LAC10 AP001',
    {type: 'personne', v: pers('DURGNIAT')},
    {n: 2, unite: 'semaine'},
    2
  );
  T(
    'Tension et état des courroies',
    'Contrôler la tension et l’usure des courroies, remplacer si nécessaire.',
    '1HLB10 AN001',
    {type: 'groupe', v: 'Mécanicien'},
    {n: 3, unite: 'mois'},
    5
  );
  T(
    'Thermographie tableau BT',
    'Thermographie des départs et serrage des connexions.',
    '1BFA10',
    {type: 'groupe', v: 'Électricien'},
    {n: 1, unite: 'an'},
    40
  );
  T(
    'Étalonnage transmetteur de pression',
    'Vérifier l’étalonnage 4–20 mA sur 3 points.',
    '1LAC10 CP001',
    {type: 'groupe', v: 'Automaticien'},
    {n: 6, unite: 'mois'},
    21
  );
}

let db = CLOUD.cfg().url ? migrate(blank()) : load();
if (!db) {
  db = seed();
  save();
}

/* ---------------- État d'affichage ---------------- */
const S = {
  ttab: 'petits',
  pwe: false,
  psf: 'petits',
  ppick: null,
  pside: (() => {
    try {
      return localStorage.getItem('tf-pside') !== '0';
    } catch (e) {
      return true;
    }
  })(),
  pour: '',
  tf: '',
  view: 'accueil',
  sel: {},
  tab: {},
  q: {pieces: '', lieux: '', interventions: '', kks: '', optkks: '', optpers: '', optfour: ''},
  lowOnly: false,
  zeroOnly: false,
  psort: 'iddesc',
  plimit: 200,
  rlimit: 300,
  back: [],
  statut: 'toutes',
  zone: '',
  sys: '',
  sysExp: new Set(),
  sysAuto: null,
  grpOpen: new Set(),
  opt: 'lieux',
  arch: {}
};

function toast(msg, kind = '', undo = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show ' + kind + (undo ? ' undo' : '');
  if (undo && LASTTX) {
    const rev = LASTTX.rev,
      b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Annuler';
    b.onclick = () => {
      t.className = '';
      undoLast(rev);
    };
    t.append(b);
  }
  const ms = kind === 'bad' ? 5000 : undo ? 7000 : 2600,
    arm = () => {
      clearTimeout(toast.t);
      toast.t = setTimeout(() => (t.className = ''), ms);
    };
  t.onpointerenter = () => clearTimeout(toast.t);
  t.onpointerleave = arm;
  arm();
}
function refreshDatalists() {
  const uniq = arr =>
    [...new Set(arr.map(x => String(x || '').trim()).filter(Boolean))]
      .sort(coll.compare)
      .map(c => `<option value="${esc(c)}"></option>`)
      .join('');
  const set = (id, html) => {
    if (refreshDatalists[id] !== html) {
      refreshDatalists[id] = html;
      $(id).innerHTML = html;
    }
  };
  set('#dl-marques', uniq(db.listes.fournisseurs));
  set(
    '#dl-lieux',
    db.lieux
      .filter(liveLieu)
      .sort(lieuSort)
      .map(l => `<option value="${esc(lieuCode(l))}">${esc(getSalle(l.salleId)?.nom || '')}</option>`)
      .join('')
  );
  set(
    '#dl-pieces',
    db.pieces
      .filter(live)
      .map(p => `<option value="${esc(pieceLabel(p))}"></option>`)
      .join('')
  );
  set(
    '#dl-kks',
    db.kks
      .filter(live)
      .map(k => `<option value="${esc(kksLabel(k))}"></option>`)
      .join('')
  );
  $('#dl-fonctions').innerHTML = [...new Set(db.personnes.map(p => p.fonction).filter(Boolean))]
    .map(c => `<option value="${esc(c)}"></option>`)
    .join('');
}
function refreshCounts() {
  const c = {
    pieces: db.pieces.filter(live).length,
    lieux: db.lieux.filter(liveLieu).length,
    interventions: db.interventions.filter(i => live(i) && i.statut !== 'terminee').length,
    kks: db.kks.filter(live).length
  };
  $$('[data-count]').forEach(el => {
    el.textContent = c[el.dataset.count] || '';
  });
}
function hydrateIcons(root = document) {
  $$('[data-icon]', root).forEach(el => {
    el.outerHTML = icon(el.dataset.icon);
  });
}
function fabMenu() {
  const m = $('#fab .fab-menu');
  if (!m) return;
  const first = {pieces: ['new-piece', 'box', 'Nouvelle pièce'], taches: ['new-tache', 'check', 'Nouveau travail']}[S.view];
  const html =
    (first ? `<button data-act="${first[0]}">${icon(first[1])}${first[2]}</button>` : '') +
    `<button data-act="new-int">${icon('report')}Nouveau rapport</button><button data-act="quick-move" data-type="sortie">${icon('move')}Mouvement de stock</button><button data-act="scan">${icon('scan')}Scanner un QR</button>`;
  if (m.dataset.v !== S.view) {
    m.innerHTML = html;
    m.dataset.v = S.view;
  }
  m.hidden = true;
  $('#fab .fab-btn')?.setAttribute('aria-expanded', 'false');
}
/* En-tête façon Planning Tridel : nom de la page sous « TriFlow » et bandeau du jour (date, en retard, cette semaine, à commander) */
const PAGE_L = {
  accueil: 'Accueil',
  taches: 'Travaux',
  interventions: 'Travaux',
  pieces: 'Pièces',
  lieux: 'Emplacements',
  planning: 'Planning',
  options: 'Options',
  kks: 'Installation'
};
function headBand() {
  const sub = $('#hsub');
  if (sub) sub.textContent = PAGE_L[S.view] || 'Maintenance Tridel';
  const b = $('#hband');
  if (!b) return;
  const today = todayISO(),
    dt = new Date(today + 'T12:00:00');
  const T = db.taches.filter(t => live(t) && t.actif !== false && forWho(t, S.pour)),
    ret = T.filter(t => tKey(t) === 'retard').length,
    sem = T.filter(t => tKey(t) === 'semaine').length;
  const low = db.pieces.filter(p => live(p) && isLow(p)).length;
  const it = (f, tone, tag, v, l) =>
    `<span class="hb-sep" aria-hidden="true"></span><button class="hb-i ${v ? tone : ''}" data-act="hband" data-f="${f}"><span class="hb-t"><i></i>${tag}</span><b>${v}</b><span class="hb-w">${l}</span></button>`;
  b.innerHTML =
    `<span class="hb-i hb-day"><span class="hb-t"><i></i>Aujourd’hui</span>${DAYN[(dt.getDay() + 6) % 7]} ${dt.getDate()} ${MOIS_L[dt.getMonth()]} <span class="muted">· sem. ${isoWeek(today)}</span></span>` +
    (S.view === 'accueil'
      ? ''
      : it('retard', 'bad', 'En retard', ret, ret > 1 ? 'travaux' : 'travail') +
        it('semaine', 'warn', 'Cette semaine', sem, sem > 1 ? 'travaux' : 'travail') +
        it('low', 'warn', 'À commander', low, low > 1 ? 'pièces' : 'pièce'));
}
function render() {
  contIdx = null;
  initPour();
  fabMenu();
  headBand();
  document.body.dataset.view = S.view;
  refreshDatalists();
  refreshCounts();
  $$('#nav button').forEach(b =>
    b.setAttribute(
      'aria-current',
      b.dataset.view === S.view ||
        (b.dataset.view === 'taches' && S.view === 'interventions') ||
        (b.dataset.view === 'options' && S.view === 'kks') ||
        (b.classList.contains('nav-plus') && ['kks', 'options'].includes(S.view))
        ? 'page'
        : 'false'
    )
  );
  {
    const ns = $('#navsheet');
    if (ns) ns.hidden = true;
  }
  const bk = S.back[S.back.length - 1],
    VN = {
      planning: 'le planning',
      accueil: 'l’accueil',
      pieces: 'la pièce',
      kks: 'l’installation',
      lieux: 'les emplacements',
      interventions: 'le rapport',
      taches: 'le travail',
      options: 'les options'
    };
  const bl = bk
    ? bk.view === 'pieces' && getPiece(bk.sel.pieces)
      ? `la pièce ${getPiece(bk.sel.pieces).ref}`
      : bk.view === 'pieces' && bk.q.pieces
        ? `la recherche « ${bk.q.pieces} »`
        : bk.view === 'kks' && getKks(bk.sel.kks)
          ? getKks(bk.sel.kks).code
          : VN[bk.view] || 'la page précédente'
    : '';
  const am = S.arch[S.view]
    ? `<div class="arch-mode">${icon('archive')}<span><strong>Archives</strong> · éléments retirés des listes, restaurables à tout moment.</span><button class="btn small" data-act="arch-view" data-v="${S.view}">Revenir à la liste</button></div>`
    : '';
  const gw = $('.wkgrid-wrap'),
    gs = gw && S.view === 'planning' ? [gw.scrollTop, gw.scrollLeft] : null;
  const main = $('#main'),
    same = main.dataset.view === S.view;
  main.dataset.view = S.view;
  const html =
    (bk ? `<button class="btn small back-nav" data-act="nav-back">${icon('chev')}Retour à ${esc(bl)}</button>` : '') +
    VIEWS[S.view].shell().replace('</header>', '</header>' + am);
  /* même page : mise à jour ciblée (et petits mouvements) ; autre page : on repart de zéro */
  MORPH.anim = same && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (same) morph(main, html, '#list, #detail');
  else main.innerHTML = html;
  fillList();
  fillDetail();
  MORPH.anim = false;
  /* onglets : le trait vert glisse vers l'onglet choisi */
  $$('.ttabs').forEach(t => {
    const bs = [...t.querySelectorAll(':scope > button')],
      i = bs.findIndex(b => b.getAttribute('aria-selected') === 'true');
    t.style.setProperty('--n', bs.length);
    t.style.setProperty('--i', Math.max(0, i));
    t.classList.toggle('slide', i >= 0);
  });
  document.body.classList.toggle('placing', S.view === 'planning' && !!S.ppick);
  if (S.view === 'planning') planSuggest(S.ppick);
  if (!$('#detail') && $('[data-jrn]')) jrnRefresh();
  if (gs) {
    const g2 = $('.wkgrid-wrap');
    if (g2) {
      g2.scrollTop = gs[0];
      g2.scrollLeft = gs[1];
    }
  }
}
const AUTOIO =
  'IntersectionObserver' in window
    ? new IntersectionObserver(
        es =>
          es.forEach(e => {
            if (e.isIntersecting) {
              AUTOIO.unobserve(e.target);
              e.target.click();
            }
          }),
        {rootMargin: '600px'}
      )
    : null;
function fillList() {
  contIdx = null;
  const el = $('#list');
  if (el) {
    morph(el, VIEWS[S.view].list());
    if (AUTOIO) $$('[data-autoload]', el).forEach(b => AUTOIO.observe(b));
  }
}
/* Sur grand écran, ouvrir le premier élément de la liste plutôt qu'un panneau vide */
function autoSel() {
  if (!['pieces', 'taches', 'interventions'].includes(S.view) || !matchMedia('(min-width: 981px)').matches) return;
  const cur = S.sel[S.view];
  if (
    cur &&
    (S.view === 'pieces'
      ? getPiece(cur)
      : S.view === 'interventions' && String(cur).startsWith('t:')
        ? get('taches', cur.slice(2))
        : get(S.view, cur))
  )
    return;
  const f = $('#list [data-act=select][data-id]');
  if (!f) return;
  S.sel[S.view] = f.dataset.id;
  f.classList.add('sel');
}
function fillDetail() {
  contIdx = null;
  autoSel();
  const el = $('#detail');
  if (el) {
    const sid = S.sel[S.view];
    let h = VIEWS[S.view].detail();
    if (['pieces', 'taches', 'interventions', 'kks'].includes(S.view) && sid && !/class="placeholder/.test(h))
      h += jrnBlock(String(sid).replace(/^t:/, ''));
    morph(el, h, '[data-jrn]');
  }
  if ($('[data-jrn]')) jrnRefresh();
  $('#main .split')?.classList.toggle(
    'has-sel',
    (S.view === 'pieces' && !!getPiece(S.sel.pieces)) ||
      (S.view === 'interventions' &&
        !!(
          getInt(S.sel.interventions) ||
          (String(S.sel.interventions || '').startsWith('t:') && get('taches', S.sel.interventions.slice(2)))
        )) ||
      (S.view === 'taches' && !!get('taches', S.sel.taches))
  );
  if (el && (S.view === 'interventions' || S.view === 'taches') && S.sel[S.view] && !el.querySelector('.placeholder'))
    el.insertAdjacentHTML(
      'afterbegin',
      `<button class="btn small m-only back-list" data-act="desel">${icon('chev')}Retour à la liste</button>`
    );
}
function go(view, id) {
  S.view = view;
  if (id !== undefined) S.sel[view] = id;
  if (view === 'interventions' && id) {
    const i = getInt(id);
    if (i && !i.arch) S.statut = i.statut === 'terminee' ? 'terminee' : 'actives';
  }
  closeSearch();
  render();
  if (id) scrollDetail();
  else window.scrollTo(0, 0);
}
function scrollDetail() {
  if (matchMedia('(max-width: 980px)').matches)
    $('#detail')?.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
}

/* ---------------- Fragments ---------------- */
const plate = (l, act = true) =>
  l && isStatut(l)
    ? `<${act ? 'button data-act="goto" data-view="lieux" data-id="' + l.id + '"' : 'span'} class="stat">${icon('out')}${esc(statutLabel(l))}</${act ? 'button' : 'span'}>`
    : act && l
      ? `<button class="plate" data-act="goto" data-view="lieux" data-id="${l.id}">${esc(lieuCode(l))}</button>`
      : `<span class="plate">${esc(lieuCode(l))}</span>`;
const kksTag = k =>
  k ? `<button class="kks" data-act="goto" data-view="kks" data-id="${k.id}">${esc(k.code)}</button>` : '<span class="muted">—</span>';
const statutChip = s => {
  const [t, c] = STATUTS[s] || [s, 'off'];
  return `<span class="chip ${c}">${t}</span>`;
};
/* Petite usine dessinée (même esprit que le bandeau) pour les pages vides */
const EMPTY_ART = `<svg class="empty-art" viewBox="0 0 160 70" aria-hidden="true"><path class="ea-ground" d="M6 62h148"/><rect class="ea-b2" x="18" y="34" width="38" height="28" rx="3"/><rect class="ea-b1" x="52" y="24" width="56" height="38" rx="3"/><rect class="ea-chim" x="114" y="8" width="9" height="54" rx="2"/><path class="ea-band" d="M114 16h9M114 24h9"/><rect class="ea-b2" x="123" y="42" width="24" height="20" rx="3"/><path class="ea-win" d="M60 34h8M74 34h8M88 34h8M60 44h8M74 44h8M88 44h8M26 42h6M38 42h6"/><path class="ea-smoke" d="M118 6c-3-3 2-5 0-8M124 4c-2-3 3-4 1-7"/></svg>`;
const empty = (title, text) => `<div class="empty">${EMPTY_ART}<strong>${title}</strong>${text || ''}</div>`;
const placeholder = (ic, text) => `<div class="placeholder">${EMPTY_ART}<p>${text}</p></div>`;
const tabs = (list, cur) =>
  `<div class="tabs" role="tablist">${list.map(([k, label, n]) => `<button role="tab" aria-selected="${k === cur}" data-act="tab" data-tab="${k}">${label}${n != null ? `<span class="n">${n}</span>` : ''}</button>`).join('')}</div>`;
const searchBox = (key, ph) =>
  `<input type="search" class="search" id="q-${key}" data-search="${key}" placeholder="${ph}" value="${esc(S.q[key])}" aria-label="${ph}">`;
function mvTable(list, withPiece) {
  if (!list.length) return '<p class="empty-line">Aucun mouvement enregistré.</p>';
  return `<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Date</th>${withPiece ? '<th>Pièce</th>' : ''}<th>Emplacement</th><th class="num">Qté</th><th>Motif</th></tr></thead><tbody>${list
    .map(m => {
      const p = getPiece(m.pieceId);
      return `<tr><td class="qty">${fmtD(m.date)}</td>${withPiece ? `<td>${p ? esc(p.designation) : '—'}</td>` : ''}<td>${plate(getLieu(m.lieuId))}</td><td class="num qty" style="color:var(${m.qte < 0 ? '--bad' : '--ok'})">${m.qte > 0 ? '+' : '−'}${num(Math.abs(m.qte))}</td><td>${esc(m.motif)}${m.ref ? ` <span class="ref">${esc(m.ref)}</span>` : ''}</td></tr>`;
    })
    .join('')}</tbody></table></div>`;
}
function intTable(list, noK = false) {
  if (!list.length) return '<p class="empty-line">Aucun rapport.</p>';
  return `<div class="tbl-wrap"><table class="tbl compact itbl"><tbody>${[...list]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(
      i =>
        `<tr data-act="goto" data-view="interventions" data-id="${i.id}" tabindex="0"><td class="ref">${esc(i.num)}</td><td>${esc(i.titre || '(sans titre)')}<span class="sub">${fmtD(i.date)}${!noK && kInfo(i)?.code ? ` · <b class="kq">${esc(kInfo(i).code)}</b> ${esc(kInfo(i).designation || '')}` : ''}</span></td><td class="num">${i.statut !== 'terminee' ? statutChip(i.statut) : ''}</td></tr>`
    )
    .join('')}</tbody></table></div>`;
}
