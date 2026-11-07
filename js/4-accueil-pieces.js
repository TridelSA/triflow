'use strict';
/* TriFlow — Pages : VIEWS, accueil, pièces, doublons, emplacements. (Fichiers chargés dans l'ordre par index.html.) */
/* =====================================================================
   VUES
   ===================================================================== */
const VIEWS = {};

/* ---------- Accueil ---------- */
/* Accueil « une carte par page » : chaque carte résume une page (Travaux, Pièces, Planning, Rapports, Options) et y emmène. */
const MOIS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
VIEWS.accueil = {
  shell() {
    const today = todayISO(),
      Y = today.slice(0, 4),
      P = PLANS[Y];
    if (!P) loadPresence(Y);
    const go = (v, t = 'Ouvrir') => `<button class="bt-go" data-act="nav" data-view="${v}">${t} ›</button>`;
    const head = (v, ic, t, cls) => `<div class="bt-h"><span class="bt-i ${cls}">${icon(ic)}</span><h2>${t}</h2>${go(v)}</div>`;
    const plural = (n, a, b) => (n > 1 ? b : a);
    /* Travaux */
    const T = db.taches.filter(t => live(t) && t.actif !== false && !openRun(t));
    const ret = T.filter(t => tKey(t) === 'retard').sort(urgSort),
      sem = T.filter(t => tKey(t) === 'semaine').sort(urgSort);
    const hau = T.filter(t => isPetit(t) && prioOf(t) === 'haute' && !['retard', 'semaine'].includes(tKey(t))).sort(petitSort);
    const O = db.interventions.filter(i => live(i) && i.statut !== 'terminee').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const tot = Math.max(1, ret.length + sem.length + O.length),
      pc = n => ((n / tot) * 100).toFixed(1) + '%';
    const trow = (t, tone) => {
      const k = getKks(t.kksId);
      return `<li class="${tone}"><button class="br-l" data-act="goto" data-view="taches" data-id="${t.id}"><i class="d"></i><span class="t">${esc(t.titre)}</span>${k ? `<span class="kk">${esc(k.code)}</span>` : ''}</button><span class="br-r">${dueInfo(t).chip}</span><button class="tick" data-act="do-tache" data-id="${t.id}" title="C’est fait" aria-label="C’est fait : ${esc(t.titre)}">${icon('check')}</button></li>`;
    };
    const irow = i =>
      `<li class="info"><button class="br-l" data-act="goto" data-view="interventions" data-id="${i.id}"><i class="d"></i><span class="t">${esc(i.titre || 'Rapport sans titre')}</span><span class="kk">${esc(i.num)}</span></button><span class="br-r"><span class="chip info">En cours</span></span></li>`;
    const rows = [...ret.map(t => trow(t, 'bad')), ...sem.map(t => trow(t, 'warn')), ...hau.map(t => trow(t, 'hi'))].slice(0, 5);
    const travaux = `<section class="btile bt-w">${head('taches', 'check', 'Travaux', 'w')}
      <div class="bt-n"><b class="${ret.length ? 'bad' : ''}">${ret.length}</b><span>en retard · <strong class="${sem.length ? 'warn' : ''}">${sem.length}</strong> cette semaine · <strong>${O.length}</strong> ${plural(O.length, 'rapport en cours', 'rapports en cours')}</span></div>
      <div class="bt-seg" aria-hidden="true"><i class="bad" style="width:${pc(ret.length)}"></i><i class="warn" style="width:${pc(sem.length)}"></i><i class="ok" style="width:${pc(O.length)}"></i></div>
      ${
        rows.length || O.length
          ? `<ul class="bt-rows">${rows.join('')}${O.slice(0, Math.max(1, 6 - rows.length))
              .map(irow)
              .join('')}</ul>`
          : '<p class="bt-empty">Rien d’urgent. Bravo !</p>'
      }
      <div class="bt-foot"><button class="btn small" data-act="new-tache">${icon('plus')}Nouveau travail</button><button class="btn small" data-act="new-int">${icon('report')}Nouveau rapport</button></div></section>`;
    /* Pièces */
    const live_p = db.pieces.filter(live),
      low = live_p.filter(isLow),
      zero = live_p.filter(isOut).length;
    const lm = db.mouvements.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0],
      lp = lm && getPiece(lm.pieceId);
    const pieces = `<section class="btile bt-p">${head('pieces', 'box', 'Pièces', 'p')}
      <div class="bt-n"><b class="${low.length ? 'warn' : ''}">${low.length}</b><span>${plural(low.length, 'pièce à commander', 'pièces à commander')}${zero ? ` · ${zero} à zéro` : ''}</span></div>
      ${
        low.length
          ? `<div class="bt-chips">${low
              .slice(0, 3)
              .map(p => `<button data-act="goto" data-view="pieces" data-id="${p.id}">${esc(p.designation)}</button>`)
              .join('')}${low.length > 3 ? `<button data-act="to-order">+${low.length - 3}</button>` : ''}</div>`
          : `<p class="bt-txt">${num(live_p.length)} ${plural(live_p.length, 'pièce', 'pièces')} en stock, rien à commander.</p>`
      }
      ${lp ? `<p class="bt-txt">Dernier mouvement : <strong>${esc(lp.designation)}</strong> (${lm.qte > 0 ? '+' : ''}${num(lm.qte)}), ${fmtDT(lm.date)}</p>` : ''}
      <div class="bt-foot">${low.length ? `<button class="btn small" data-act="to-order">${icon('list')}Liste à commander</button>` : ''}<button class="btn small" data-act="quick-move" data-type="sortie">${icon('move')}Mouvement</button></div></section>`;
    /* Planning */
    const presOk = P && !P.loading && P.byNom.size,
      ppl = db.personnes.filter(p => live(p) && p.actif !== false);
    const here = presOk ? ppl.filter(p => isDispo(presOf(p, today)?.code)).length : null;
    const nw = planWeek(),
      days = [0, 1, 2, 3, 4].map(n => isoAdd(nw, n)),
      cnt = days.map(d => db.plan.filter(x => x.date === d).length),
      placed = cnt.reduce((a, b) => a + b, 0);
    const planning = `<section class="btile bt-l">${head('planning', 'calendar', 'Planning', 'l')}
      <div class="bt-n"><b>${here == null ? '–' : here}</b><span>${here == null ? 'présences en chargement' : plural(here, 'présent aujourd’hui', 'présents aujourd’hui')} · semaine ${isoWeek(nw)} : <strong>${placed}</strong> ${plural(placed, 'case remplie', 'cases remplies')}</span></div>
      <div class="bt-week">${days.map((d, i) => `<div><span>${DAYS[i].slice(0, 3)}</span><b class="${cnt[i] ? 'on' : ''}">${cnt[i] || ''}</b></div>`).join('')}</div>
      <div class="bt-foot"><button class="btn small" data-act="nav" data-view="planning">${icon('printer')}Préparer et imprimer</button></div></section>`;
    /* Rapports */
    const mon = isoAdd(today, -((new Date(today + 'T12:00:00').getDay() + 6) % 7));
    const done = db.interventions
      .filter(i => live(i) && i.statut === 'terminee')
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.num || '').localeCompare(a.num || ''));
    const wk = done.filter(i => i.date >= mon).length;
    const rapports = `<section class="btile bt-r"><div class="bt-h"><span class="bt-i r">${icon('report')}</span><h2>Rapports</h2><button class="bt-go" data-act="wtab" data-w="fait">Ouvrir ›</button></div>
      <div class="bt-n"><b>${wk}</b><span>${plural(wk, 'rapport fait cette semaine', 'rapports faits cette semaine')}</span></div>
      ${
        done.length
          ? `<ul class="bt-rows">${done
              .slice(0, 3)
              .map(
                i =>
                  `<li><button class="br-l" data-act="goto" data-view="interventions" data-id="${i.id}"><span class="kk">${esc(i.num)}</span><span class="t">${esc(i.titre || 'Sans titre')}</span></button><span class="br-r muted">${fmtD(i.date)}</span></li>`
              )
              .join('')}</ul>`
          : '<p class="bt-empty">Aucun rapport pour l’instant.</p>'
      }</section>`;
    /* Options */
    const nP = ppl.length,
      nL = db.lieux.filter(live).length,
      nK = db.kks.filter(live).length;
    const options = `<section class="btile bt-o">${head('options', 'cog', 'Options', 'o')}
      <div class="bt-links"><button data-act="opt" data-sec="personnes">${icon('person')}<span>Personnes</span><small>${nP}</small></button><button data-act="opt" data-sec="lieux">${icon('shelf')}<span>Emplacements</span><small>${nL}</small></button><button data-act="opt" data-sec="kks">${icon('plant')}<span>Installation (KKS)</span><small>${nK}</small></button><button data-act="opt" data-sec="historique">${icon('list')}<span>Historique</span></button></div></section>`;
    /* « Ma journée » : la case du planning d'aujourd'hui, mes travaux, et le scan */
    const me = meId(),
      mp = me && getPers(me);
    let myday = '';
    if (mp) {
      const mine = T.filter(t => forWho(t, 'p:' + me));
      const mr = mine.filter(t => tKey(t) === 'retard').sort(urgSort),
        ms = mine.filter(t => tKey(t) === 'semaine').sort(urgSort),
        mh = mine.filter(t => isPetit(t) && prioOf(t) === 'haute' && !['retard', 'semaine'].includes(tKey(t))).sort(petitSort);
      const mrows = [...mr.map(t => trow(t, 'bad')), ...ms.map(t => trow(t, 'warn')), ...mh.map(t => trow(t, 'hi'))];
      const items = db.plan.filter(x => x.who === me && x.date === today),
        pr = presOk ? presOf(mp, today) : null,
        absent = pr && pr.code && !isDispo(pr.code);
      const it = x => {
        const t = x.tacheId && get('taches', x.tacheId);
        return t
          ? `<button class="md-it task" data-act="goto" data-view="taches" data-id="${t.id}">${mdot(tMet(t))}${esc(t.titre)}</button>`
          : `<span class="md-it">${esc(x.text)}</span>`;
      };
      myday = `<section class="myday"><div class="md-h"><div><p class="md-k">Ma journée</p><h2>Bonjour ${esc(mp.prenom || persName(mp))}</h2></div><button class="md-scan" data-act="scan">${icon('scan')}<span>Scanner une pièce</span></button></div>
        <div class="md-plan"><span class="md-l">${icon('calendar')}Au planning</span>${absent ? '<span class="md-it abs">Pas au planning aujourd’hui</span>' : items.length ? items.map(it).join('') : '<span class="muted">Rien de noté pour aujourd’hui.</span>'}</div>
        ${mrows.length ? `<ul class="bt-rows">${mrows.slice(0, 5).join('')}</ul>${mrows.length > 5 ? `<button class="link" data-act="pour-set-go" data-v="p:${me}">Voir mes ${mrows.length} travaux</button>` : ''}` : '<p class="bt-empty">Aucun travail urgent pour vous. </p>'}</section>
        <h2 class="ov-h">Vue d’ensemble</h2>`;
    }
    return `${db.meta.demo ? `<div class="notice"><p><strong>Données d'exemple.</strong> Elles sont fictives et servent à essayer l'outil.</p><button class="btn" data-act="clear-demo">Effacer les exemples</button></div>` : ''}
    ${myday}<div class="bento ${canDel() ? 'cadre' : ''}">${travaux}${pieces}${planning}${rapports}${options}</div>`;
  },
  list: () => '',
  detail: () => ''
};
/* ---------- Pièces ---------- */
function filteredPieces() {
  const q = norm(S.q.pieces);
  let rows = db.pieces
    .filter(p => (S.arch.pieces ? p.arch : !p.arch))
    .filter(
      p =>
        !q ||
        norm(
          [
            p.ref,
            p.designation,
            p.fabricant,
            p.fournisseur,
            ...(p.fours || []),
            p.refFab,
            p.categorie,
            ...p.kks.map(id => getKks(id)?.code),
            ...p.stock.map(s => lieuCode(getLieu(s.lieuId)))
          ].join(' ')
        ).includes(q)
    );
  if (S.lowOnly) rows = rows.filter(isLow);
  if (S.zeroOnly) rows = rows.filter(p => isOut(p));
  if (S.ploc) {
    const P = S.ploc;
    rows = rows.filter(p =>
      p.stock.some(x => {
        const c = lieuCode(getLieu(x.lieuId));
        return c === P || c.startsWith(P + ' / ');
      })
    );
  }
  const idn = p => (/^\d+$/.test(p.ref) ? +p.ref : Infinity);
  if (S.psort === 'alpha') return rows.sort((a, b) => coll.compare(a.designation, b.designation));
  if (S.psort === 'recent' || S.psort === 'old') {
    const last = new Map();
    for (const m of db.mouvements) if (!last.has(m.pieceId) || m.date > last.get(m.pieceId)) last.set(m.pieceId, m.date);
    for (const h of db.histo) {
      const d = h.l && h.l[0] && h.l[0].d;
      if (d && (!last.has(h.id) || d > last.get(h.id))) last.set(h.id, d);
    }
    const k = p => last.get(p.id) || '';
    return S.psort === 'recent'
      ? rows.sort((a, b) => k(b).localeCompare(k(a)) || idn(b) - idn(a))
      : rows.sort((a, b) => (k(a) || '9').localeCompare(k(b) || '9') || idn(a) - idn(b));
  }
  if (S.psort === 'iddesc') return rows.sort((a, b) => idn(b) - idn(a) || coll.compare(b.ref, a.ref));
  return rows.sort((a, b) => idn(a) - idn(b) || coll.compare(a.ref, b.ref));
}
VIEWS.pieces = {
  shell:
    () => `<header class="page-head"><h1>Pièces</h1><div class="tools">${searchBox('pieces', 'Rechercher une pièce…')}<button class="btn icon-only" data-act="scan" title="Scanner un QR code" aria-label="Scanner un QR code">${icon('scan')}</button><button class="btn primary" data-act="new-piece">${icon('plus')}Nouvelle pièce</button>
    ${menu([['labels-list', 'Étiquettes QR de la liste', 'qr', {}], ['toggle-low', S.lowOnly ? 'Afficher toutes les pièces' : 'Pièces sous le stock minimum', 'list', {}], ['xl-pieces', 'Exporter la liste (Excel)', 'excel', {}], '-', ['to-order', 'Liste à commander', 'truck', {}], ['dups', 'Rechercher les doublons', 'merge', {}], ['relink-kks', 'Relier les repères KKS cités dans les notes', 'plant', {}], archItem('pieces'), '-', ['import-pieces', 'Importer depuis CareOffice (fichier)', 'save', {}]])}</div></header>
    <div class="split"><section class="pane" id="list"></section><section class="pane detail" id="detail"></section></div>`,
  list() {
    const rows = filteredPieces();
    if (!db.pieces.length) return empty('Aucune pièce', '<p>Créez la première avec « Nouvelle pièce ».</p>');
    const lv = S.arch.pieces ? [] : db.pieces.filter(live),
      nLow = lv.filter(isLow).length,
      nZero = lv.filter(isOut).length,
      pf = S.zeroOnly ? 'zero' : S.lowOnly ? 'low' : '';
    const chips = S.arch.pieces
      ? ''
      : `<div class="fchips" role="tablist" aria-label="Quelles pièces">${[
          ['', 'Toutes', lv.length, ''],
          ['low', 'Stock bas', nLow, 'warn'],
          ['zero', 'Épuisées', nZero, '']
        ]
          .map(
            ([f, t, n, tone]) =>
              `<button role="tab" class="ychip ${tone}" data-act="pf" data-f="${f}" aria-selected="${pf === f}">${t} <small>${num(n)}</small></button>`
          )
          .join(
            ''
          )}<span class="ysep" aria-hidden="true"></span>${S.ploc ? `<span class="ychip loc-on">${icon('shelf')}<button class="loc-l" data-act="ploc">${esc(S.ploc)}</button><button class="loc-x" data-act="ploc-clear" aria-label="Retirer le filtre d’emplacement">×</button></span>` : `<button class="ychip" data-act="ploc">${icon('shelf')}Par emplacement</button>`}</div>`;
    if (!rows.length)
      return (
        chips +
        (S.arch.pieces
          ? empty('Aucune pièce archivée', '')
          : empty(
              'Aucune pièce ne correspond',
              `<p>Essayez un autre mot, ou scannez l’étiquette.</p><button class="btn" data-act="scan">${icon('scan')}Scanner</button>`
            ))
      );
    const more = `${chips}<div class="list-bar"><span class="muted">${num(rows.length)} pièce(s)</span><span class="lb-r lb-sort"><label>Trier<select class="mini" data-change="psort" aria-label="Trier les pièces">${[
      ['iddesc', 'Par ID (décroissant)'],
      ['id', 'Par ID (croissant)'],
      ['alpha', 'Alphabétique'],
      ['recent', 'Mouvement le plus récent'],
      ['old', 'Mouvement le plus ancien']
    ]
      .map(([v, t]) => `<option value="${v}" ${S.psort === v ? 'selected' : ''}>${t}</option>`)
      .join('')}</select></label></span></div>`;
    return `${more}<div class="plist">${rows
      .slice(0, S.plimit)
      .map(p => {
        const mp = mainPlace(p),
          n = sortedStock(p).length,
          hm = horsMag(p);
        return `<button class="prow ${S.sel.pieces === p.id ? 'sel' : ''}" data-act="select" data-id="${p.id}">
        ${p.photos?.length ? photoImg(p.photos[0].path, 'ph-row') : ''}<span class="pm"><span class="pdes" title="${esc(p.designation)}">${esc(p.designation)}</span>
          <span class="ploc"><span class="pid">${esc(p.ref)}</span>${mp ? plate(mp, false) + (n > 1 ? ` <span class="muted">+${n - 1}</span>` : '') : '<span class="muted">Sans emplacement</span>'}${hm.length ? ` <span class="muted" style="color:var(--stat)">+${num(hm.reduce((a, s) => a + s.qte, 0))} hors magasin</span>` : ''}</span></span>
        <span class="pq ${isOut(p) ? 'zero' : isLow(p) ? 'low' : ''}"><b>${num(dispo(p))}</b><small>${isOut(p) ? 'épuisé' : isLow(p) ? 'stock bas' : esc(p.unite)}</small></span></button>`;
      })
      .join(
        ''
      )}${rows.length > S.plimit ? `<p class="list-note"><button class="link" data-act="pmore" data-autoload>Afficher les suivantes (${num(rows.length - S.plimit)} de plus)</button></p>` : ''}</div>`;
  },
  detail() {
    const p = getPiece(S.sel.pieces);
    if (!p) return placeholder('box', 'Choisissez une pièce ou scannez son QR code.');
    const lines = sortedStock(p),
      phys = lines.filter(x => !isStatut(getLieu(x.lieuId))),
      out = horsMag(p);
    const ks = p.kks.map(getKks).filter(Boolean);
    const hist = pieceHistory(p),
      showAll = S.histAll === p.id;
    const salleOf = l => {
      const sa = l && getSalle(l.salleId);
      return sa && sa.nom ? sa.nom : '';
    };
    const noteRows = String(p.notes || '')
      .split('\n')
      .reduce((acc, ln) => {
        const m = ln.match(/^([^:]{2,30}?)\s:\s(.*)$/);
        if (m) acc.push([m[1], m[2]]);
        else if (ln.trim()) {
          if (acc.length && acc[acc.length - 1][0] !== '') acc[acc.length - 1][1] += '\n' + ln;
          else acc.push(['', ln]);
        }
        return acc;
      }, []);
    const low = p.stockMin > 0 && dispo(p) < p.stockMin;
    return `<button class="btn small m-only back-list" data-act="desel">${icon('chev')}Liste des pièces</button>${archBanner('pieces', p)}<div class="pd-head"><span class="pd-id">ID ${esc(p.ref)}</span><div class="pd-tools"><button class="btn small" data-act="edit-piece" data-id="${p.id}">${icon('edit')}Modifier</button>${menu([['labels-one', 'Étiquette QR', 'qr', {id: p.id}], ['print-piece', 'Fiche A4', 'printer', {id: p.id}], ['add-place', 'Ranger à un autre emplacement', 'shelf', {id: p.id}], '-', p.arch ? ['unarch', 'Restaurer la pièce', 'archive', {col: 'pieces', id: p.id}] : ['arch', 'Archiver la pièce', 'archive', {col: 'pieces', id: p.id}], hardItem('pieces', p.id)].filter(Boolean), 'Plus', 'more', 'small')}</div></div>
      <h2 class="pd-title">${esc(p.designation)}</h2>
      ${p.fabricant || p.refFab ? `<p class="pd-sub">${esc(p.fabricant || '')}${p.refFab ? ` <span class="muted">· réf.</span> <span class="mono">${esc(p.refFab)}</span>` : ''}</p>` : ''}
      <div class="pd-stock ${low ? 'low' : ''}">
        <div class="pd-qty"><span class="n">${num(dispo(p))}</span><span class="u">${esc(p.unite)}</span><span class="l">en magasin${p.stockMin ? ` · min ${num(p.stockMin)}` : ''}</span></div>
        <button class="btn primary" data-act="move" data-id="${p.id}" data-type="sortie">${icon('move')}Mouvement de stock</button>
      </div>
      <div class="pd-mbar"><button class="btn big-out" data-act="quick-out" data-id="${p.id}">− Sortir</button><button class="btn big-in" data-act="quick-out" data-id="${p.id}">+ Entrer</button></div>
      <section class="pd-sec"><h3>${icon('camera')}Photos <span class="muted">${(p.photos || []).length || ''}</span></h3>${photoStrip(p.photos, {col: 'pieces', id: p.id})}</section>
      <section class="pd-sec"><h3>${icon('shelf')}Où la trouver</h3>
        ${
          phys.length
            ? `<div class="pd-where">${phys
                .map(x => {
                  const l = getLieu(x.lieuId);
                  return `<div class="pd-loc">${plate(l)}<span class="t">${esc(salleOf(l))}</span><span class="q">${num(x.qte)} <small>${esc(p.unite)}</small></span>${!x.qte ? `<button class="link danger" data-act="unlink-lieu" data-piece="${p.id}" data-id="${x.lieuId}" title="Retirer cet emplacement">×</button>` : ''}</div>`;
                })
                .join('')}</div>`
            : '<p class="empty-line">Rangée nulle part pour l’instant.</p>'
        }
        ${out.length ? `<div class="pd-where out">${out.map(x => `<div class="pd-loc">${plate(getLieu(x.lieuId))}<span class="t">hors magasin</span><span class="q">${num(x.qte)} <small>${esc(p.unite)}</small></span></div>`).join('')}</div>` : ''}</section>
      <section class="pd-sec"><h3>${icon('plant')}Équipements (KKS)</h3>
        ${ks.length ? `<div class="pd-kks">${ks.map(k => `<span class="pd-k">${kksTag(k)}<span class="t">${esc(k.designation)}</span><button class="icon-btn" data-act="unlink-kks" data-piece="${p.id}" data-id="${k.id}" aria-label="Retirer ${esc(k.code)}" title="Retirer">×</button></span>`).join('')}</div>` : '<p class="empty-line">Aucun équipement lié.</p>'}
        <form class="inline-form" data-form="link-kks" data-piece="${p.id}"><input name="kks" list="dl-kks" placeholder="Lier un équipement (code KKS)" aria-label="Repère KKS à lier" autocomplete="off"><button class="btn">Lier</button></form></section>
      ${
        (p.fournisseur && p.fournisseur !== p.fabricant) || noteRows.length || (p.fours || []).length
          ? `<section class="pd-sec"><h3>${icon('list')}Informations</h3><dl class="pd-info">
        ${p.fournisseur && p.fournisseur !== p.fabricant ? `<dt>Fournisseur</dt><dd>${esc(p.fournisseur)}</dd>` : ''}
        ${(p.fours || []).filter(n => n !== p.fournisseur && n !== p.fabricant).length ? `<dt>Aussi cités</dt><dd>${esc(p.fours.filter(n => n !== p.fournisseur && n !== p.fabricant).join(', '))}</dd>` : ''}
        ${noteRows.map(([k, v]) => (k ? `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>` : `<dd class="full">${esc(v)}</dd>`)).join('')}</dl></section>`
          : ''
      }
      ${(() => {
        const ids = matIndex().usedIn.get(p.id);
        if (!ids || !ids.size) return '';
        const ints = [...ids]
            .map(getInt)
            .filter(Boolean)
            .sort((a, b) => b.date.localeCompare(a.date)),
          all = S.pAll === p.id;
        return `<section class="pd-sec"><h3>${icon('report')}Utilisée dans les rapports <span class="muted">${ints.length}</span></h3>${intTable(all ? ints : ints.slice(0, 5))}${ints.length > 5 ? `<button class="link" data-act="p-all" data-id="${p.id}">${all ? 'Réduire' : `Voir les ${ints.length} rapports`}</button>` : ''}</section>`;
      })()}
      <section class="pd-sec"><h3>${icon('repeat')}Mouvements de stock <span class="muted">${hist.length || ''}</span></h3>
        ${
          hist.length
            ? `<div class="pd-hist">${(showAll ? hist : hist.slice(0, 8)).map(h => `<div class="ph"><span class="d">${fmtD(h.date)}</span><span class="q ${h.neutral ? '' : h.qte < 0 ? 'neg' : 'pos'}">${h.neutral ? '' : h.qte > 0 ? '+' : h.qte < 0 ? '−' : ''}${num(Math.abs(h.qte))}</span><span class="m">${esc(h.motif)}${h.who ? ` <span class="muted">· ${esc(h.who)}</span>` : ''}${h.lieu ? `<span class="lw">${esc(h.lieu)}</span>` : ''}</span></div>`).join('')}</div>
          ${hist.length > 8 ? `<button class="link" data-act="hist-all" data-id="${p.id}">${showAll ? 'Réduire' : `Voir les ${hist.length} mouvements`}</button>` : ''}`
            : '<p class="empty-line">Aucun mouvement enregistré.</p>'
        }</section>${byLine(p)}`;
  }
};

/* ---------- Doublons : seulement des pièces strictement identiques (désignation, marque, réf. et notes), jamais fusionnées sans accord ---------- */
const dupKey = p =>
  [p.designation, p.fabricant, p.refFab, p.notes]
    .map(x =>
      String(x || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
    )
    .join('|');
function dupGroups() {
  const ok = new Set(db.meta.notDup || []),
    m = new Map();
  for (const p of db.pieces) {
    if (!live(p)) continue;
    const k = dupKey(p);
    if (k.split('|')[0].length < 6) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(p);
  }
  const idn = p => (/^\d+$/.test(p.ref) ? +p.ref : Infinity);
  return [...m.values()]
    .filter(g => g.length > 1)
    .map(g => g.sort((a, b) => idn(a) - idn(b)))
    .filter(
      g =>
        !ok.has(
          g
            .map(p => p.id)
            .sort()
            .join('|')
        )
    );
}
function mergePieces(keep, others) {
  tx(() => {
    for (const o of others) {
      for (const st of o.stock.filter(x => x.qte)) {
        if (getLieu(st.lieuId)) {
          const q = st.qte;
          addStock(o, st.lieuId, -q, 'Fusion doublon', `vers ID ${keep.ref}`);
          addStock(keep, st.lieuId, q, 'Fusion doublon', `de l’ID ${o.ref}`);
        } else {
          const k = keep.stock.find(x => x.lieuId === st.lieuId);
          if (k) k.qte = round(k.qte + st.qte);
          else keep.stock.push({...st});
          st.qte = 0;
        }
      }
      o.stock = o.stock.filter(x => x.qte);
      for (const id of o.kks) if (!keep.kks.includes(id)) keep.kks.push(id);
      if (o.fours?.length) keep.fours = [...new Set([...(keep.fours || []), ...o.fours])];
      if (!keep.fournisseur && o.fournisseur) keep.fournisseur = o.fournisseur;
      keep.stockMin = Math.max(keep.stockMin || 0, o.stockMin || 0);
      for (const m of db.mouvements) if (m.pieceId === o.id && m.motif !== 'Fusion doublon') m.pieceId = keep.id;
      for (const i of db.interventions) for (const x of i.pieces) if (x.pieceId === o.id) x.pieceId = keep.id;
      const ho = db.histo.find(h => h.id === o.id);
      if (ho?.l?.length) {
        let hk = db.histo.find(h => h.id === keep.id);
        if (!hk) {
          hk = {id: keep.id, l: []};
          db.histo.push(hk);
        }
        hk.l = [...hk.l, ...ho.l.map(h => ({...h, t: `${h.t} (ID ${o.ref})`}))].sort((a, b) => String(b.d).localeCompare(String(a.d)));
      }
      o.arch = todayISO();
      o.mergedInto = keep.ref;
    }
  });
}
function dupDialog() {
  const body = () => {
    const gs = dupGroups();
    return gs.length
      ? `<p class="hint">Seules les pièces <strong>strictement identiques</strong> sont proposées : même désignation, même marque, même référence et mêmes notes. Rien n’est fusionné sans votre accord. La pièce fusionnée n’est pas supprimée : elle est archivée, et son stock, ses KKS et son historique passent sur la pièce gardée.</p>
    ${gs
      .map(g => {
        const gid = g.map(p => p.id).join(',');
        return `<div class="dupg" data-g="${gid}"><div class="dup-t">${esc(g[0].designation)}${g[0].fabricant ? ` <span class="muted">· ${esc(g[0].fabricant)}</span>` : ''}${g[0].refFab ? ` <span class="muted">· réf. <span class="mono">${esc(g[0].refFab)}</span></span>` : ''}</div>
      <p class="hint" style="margin:0 0 4px">Ouvrez chaque fiche pour comparer si besoin :${g.map(p => ` <button type="button" class="link" data-dopen="${p.id}">ID ${esc(p.ref)}</button>`).join(',')}</p>
      ${g
        .map((p, n) => {
          const ls = sortedStock(p);
          return `<label class="dup-p"><input type="radio" name="keep-${g[0].id}" value="${p.id}" ${n === 0 ? 'checked' : ''}><span class="pid">ID ${esc(p.ref)}</span><span class="t">${ls.length ? ls.map(x => `${plate(getLieu(x.lieuId), false)} ${num(x.qte)}`).join(' ') : '<span class="muted">sans emplacement</span>'}</span><span class="muted">${p.kks.length} KKS · ${pieceHistory(p).length} mvt</span></label>`;
        })
        .join('')}
      <div class="dup-a"><button type="button" class="btn small primary" data-dmerge="${gid}">${icon('merge')}Fusionner dans la pièce cochée</button><button type="button" class="btn small" data-dnot="${gid}">Ce ne sont pas des doublons</button></div></div>`;
      })
      .join('')}`
      : '<p>Aucun doublon : aucune pièce n’est strictement identique à une autre.</p>';
  };
  dialog({
    title: 'Doublons de pièces',
    wide: true,
    saveLabel: 'Fermer',
    body: `<div data-dups>${body()}</div>`,
    onSave() {},
    onOpen(f, d) {
      const box = $('[data-dups]', d);
      box.addEventListener('click', e => {
        const mb = e.target.closest('[data-dmerge]'),
          nb = e.target.closest('[data-dnot]');
        if (mb) {
          const ids = mb.dataset.dmerge.split(','),
            keepId = $(`input[name="keep-${ids[0]}"]:checked`, box)?.value,
            keep = getPiece(keepId),
            others = ids
              .filter(id => id !== keepId)
              .map(getPiece)
              .filter(Boolean);
          if (!keep || !others.length) return;
          if (!mb.dataset.armed) {
            mb.dataset.armed = 1;
            mb.innerHTML = `Confirmer : garder l’ID ${esc(keep.ref)}, archiver ${others.map(o => 'l’ID ' + esc(o.ref)).join(', ')}`;
            return;
          }
          try {
            mergePieces(keep, others);
            toast(`Fusionné dans l’ID ${keep.ref} · ${others.length} pièce(s) archivée(s)`, '', true);
          } catch (x) {
            toast(x.message, 'bad');
          }
          box.innerHTML = body();
          render();
        }
        const ob = e.target.closest('[data-dopen]');
        if (ob) {
          d.close();
          go('pieces', ob.dataset.dopen);
          return;
        }
        if (nb) {
          const key = nb.dataset.dnot.split(',').sort().join('|');
          tx(() => {
            db.meta.notDup = [...(db.meta.notDup || []), key];
          });
          box.innerHTML = body();
        }
      });
    }
  });
}

/* Matériel des rapports CareOffice (« · 2 × Désignation ») relié à une pièce du stock quand la désignation est identique et unique */
const normDes = x =>
  String(x || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const MAT_RX = /^·\s*(?:([\d.,]+)\s*×\s*)?(.+)$/;
let MATIDX = null;
function matIndex() {
  if (MATIDX && MATIDX.db === db && MATIDX.rev === REV) return MATIDX;
  const byDes = new Map();
  for (const p of db.pieces) {
    if (!live(p)) continue;
    const k = normDes(p.designation);
    if (k.length < 5) continue;
    byDes.set(k, byDes.has(k) ? null : p);
  }
  const usedIn = new Map(),
    add = (pid, iid) => {
      if (!usedIn.has(pid)) usedIn.set(pid, new Set());
      usedIn.get(pid).add(iid);
    };
  for (const i of db.interventions) {
    if (!live(i)) continue;
    for (const x of i.pieces || []) add(x.pieceId, i.id);
    const t = i.travaux || '',
      k = t.indexOf('Matériel utilisé');
    if (k < 0) continue;
    for (const ln of t.slice(k).split('\n')) {
      const m = ln.match(MAT_RX);
      if (m) {
        const p = byDes.get(normDes(m[2]));
        if (p) add(p.id, i.id);
      }
    }
  }
  return (MATIDX = {db, rev: REV, byDes, usedIn});
}
const matPiece = des => matIndex().byDes.get(normDes(des)) || null;
function travauxHTML(t) {
  const k = t.indexOf('Matériel utilisé :');
  const head = k >= 0 ? t.slice(0, k).trim() : t,
    mat =
      k >= 0
        ? t
            .slice(k)
            .split('\n')
            .slice(1)
            .filter(l => l.trim())
        : [];
  return `${head ? `<p class="pre">${esc(head)}</p>` : ''}${
    mat.length
      ? `<div class="matl"><div class="matl-h">${icon('box')}Matériel utilisé</div>${mat
          .map(l => {
            const m = l.match(MAT_RX);
            const des = m ? m[2] : l.replace(/^·\s*/, ''),
              q = m && m[1] ? m[1] : '',
              p = matPiece(des);
            return `<div class="matl-r"><span class="q">${q ? esc(q) + ' ×' : ''}</span>${p ? `<button class="link" data-act="goto" data-view="pieces" data-id="${p.id}" title="Ouvrir la pièce ID ${esc(p.ref)}">${esc(des)}</button><span class="pid">ID ${esc(p.ref)}</span>` : `<span>${esc(des)}</span>`}</div>`;
          })
          .join('')}</div>`
      : ''
  }`;
}

/* Historique d'une pièce : mouvements TriFlow + historique repris de CareOffice */
function pieceHistory(p) {
  const own = db.mouvements
    .filter(m => m.pieceId === p.id)
    .map(m => ({
      date: m.date,
      qte: m.qte,
      motif: m.motif + (m.ref ? ' ' + m.ref : ''),
      lieu: getLieu(m.lieuId) ? lieuCode(getLieu(m.lieuId)) : '',
      who: m.who || (m._by ? byWho(m._by) : '')
    }));
  const old = (get('histo', p.id)?.l || []).map(h => ({
    date: h.d,
    qte: h.q,
    neutral: !!h.n,
    motif: h.t,
    lieu: h.lieu || '',
    who: h.w || ''
  }));
  return [...own, ...old].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/* ---------- Emplacements (consultation) ---------- */
/* Arborescence d'une salle : chaque niveau du chemin devient un groupe, les emplacements sont des boutons. */
function lieuTree(ls, act, selId) {
  const root = {kids: new Map(), lieu: null};
  for (const l of ls) {
    let n = root;
    for (const seg of pathOf(l)) {
      if (!n.kids.has(seg)) n.kids.set(seg, {kids: new Map(), lieu: null});
      n = n.kids.get(seg);
    }
    n.lieu = l;
  }
  const slot = (label, l) => {
    const c = contentsOf(l.id).filter(x => x.qte > 0).length;
    return `<button class="slot ${c ? 'filled' : ''} ${selId === l.id ? 'sel' : ''}" data-act="${act}" data-id="${l.id}" title="${esc(lieuCode(l))}">${esc(label)}${c ? `<small>${c}</small>` : ''}</button>`;
  };
  const draw = (node, depth) => {
    const keys = [...node.kids.keys()].sort(coll.compare);
    const leaves = keys.filter(k => !node.kids.get(k).kids.size),
      groups = keys.filter(k => node.kids.get(k).kids.size);
    return (
      (leaves.length ? `<div class="slots">${leaves.map(k => slot(k, node.kids.get(k).lieu)).join('')}</div>` : '') +
      groups
        .map(k => {
          const g = node.kids.get(k);
          return `<div class="rack"><div class="rack-head">${g.lieu ? slot(k, g.lieu) : esc(k)}</div>${draw(g, depth + 1)}</div>`;
        })
        .join('')
    );
  };
  return (root.lieu ? `<div class="slots">${slot('Dans la salle', root.lieu)}</div>` : '') + draw(root, 0);
}
VIEWS.lieux = {
  shell:
    () => `<header class="page-head"><h1>Emplacements</h1><div class="tools">${searchBox('lieux', 'Filtrer : code, salle ou pièce rangée…')}${menu([['opt', 'Gérer les emplacements', 'shelf', {sec: 'lieux'}], '-', ['new-salle', 'Nouvelle salle', 'plus', {}], ['new-lieu', 'Nouvel emplacement', 'plus', {}], ['gen-series', 'Créer une série', 'plus', {}], '-', ['arch-view', S.arch.lieux ? 'Quitter les archives' : 'Archives', 'archive', {v: 'lieux'}]])}</div></header>
    <div class="split"><section class="pane" id="list"></section><section class="pane detail" id="detail"></section></div>`,
  list() {
    if (!db.salles.length)
      return empty('Aucun emplacement défini', '<p>Les salles et emplacements se créent dans Options › Emplacements.</p>');
    if (S.arch.lieux) {
      const ss = db.salles.filter(x => x.arch),
        ls = db.lieux.filter(l => l.arch && live(getSalle(l.salleId))).sort(lieuSort);
      if (!ss.length && !ls.length) return empty('Aucun emplacement archivé', '');
      return `<div class="plist">${ss.map(x => `<div class="prow arch-row"><span class="pm"><span class="pdes"><span class="plate">${esc(salleCode(x))}</span> ${esc(x.nom || '')}</span><span class="ploc"><span class="muted">Local archivé le ${fmtD(x.arch)} · ${db.lieux.filter(l => l.salleId === x.id).length} emplacement(s)</span></span></span><button class="btn small" data-act="unarch" data-col="salles" data-id="${x.id}">Restaurer</button></div>`).join('')}
        ${ls.map(l => `<div class="prow arch-row"><span class="pm"><span class="pdes"><span class="plate">${esc(lieuCode(l))}</span></span><span class="ploc"><span class="muted">Archivé le ${fmtD(l.arch)}</span></span></span><button class="btn small" data-act="unarch" data-col="lieux" data-id="${l.id}">Restaurer</button></div>`).join('')}</div>`;
    }
    const q = norm(S.q.lieux),
      out = [];
    const sorted = db.salles.filter(live).sort((a, b) => !!a.statut - !!b.statut || coll.compare(salleCode(a), salleCode(b)));
    let statHead = false;
    for (const s of sorted) {
      const salleMatch = !q || norm(salleCode(s) + ' ' + s.nom).includes(q);
      let ls = db.lieux.filter(l => l.salleId === s.id && live(l)).sort(lieuSort);
      if (q && !salleMatch)
        ls = ls.filter(l =>
          norm(
            lieuCode(l) +
              ' ' +
              l.note +
              ' ' +
              contentsOf(l.id)
                .map(x => x.p.designation + ' ' + x.p.ref)
                .join(' ')
          ).includes(q)
        );
      if (q && !salleMatch && !ls.length) continue;
      if (s.statut && !statHead) {
        statHead = true;
        out.push(
          `<div class="stat-head">${icon('out')}<div><strong>Hors magasin</strong><span>Pièces sorties du stock mais suivies : en prêt, en révision, en attente…</span></div></div>`
        );
      }
      const full = ls.filter(l => contentsOf(l.id).some(x => x.qte > 0)).length,
        pct = ls.length ? Math.round((full / ls.length) * 100) : 0;
      out.push(`<div class="room ${s.statut ? 'is-stat' : ''}"><div class="room-head">${s.statut ? `<span class="stat">${icon('out')}${esc(salleCode(s))}</span>` : `<span class="plate">${esc(salleCode(s))}</span>`}<strong>${esc(s.nom)}</strong><span class="fill" title="${full} case(s) occupée(s) sur ${ls.length}"><span class="fill-bar"><i style="width:${pct}%"></i></span><span class="muted">${full}/${ls.length} occupées</span></span></div>
        ${lieuTree(ls, 'select', S.sel.lieux)}
        ${!ls.length ? '<p class="empty-line">Aucun emplacement dans cette salle.</p>' : ''}</div>`);
    }
    return out.length ? out.join('') : empty('Aucun emplacement ne correspond', '');
  },
  detail() {
    const l = getLieu(S.sel.lieux);
    if (l && !liveLieu(l)) return archBanner(l.arch ? 'lieux' : 'salles', l.arch ? l : getSalle(l.salleId));
    if (!l) return placeholder('shelf', 'Choisissez un emplacement pour voir ce qui y est rangé et imprimer les étiquettes du matériel.');
    const s = getSalle(l.salleId),
      items = contentsOf(l.id);
    const parts = [
      ...(s?.code ? [esc(s.code)] : [`Bâtiment ${esc(s?.batiment || 'E')}`, `étage ${esc(s?.etage)}`, `local ${esc(s?.numero)}`]),
      ...pathOf(l).map(esc)
    ].join(' › ');
    const withStock = items.filter(x => x.qte > 0);
    if (s?.statut)
      return `<div class="d-head"><div class="d-title"><span>${plate(l, false).replace('class="stat"', 'class="stat big"')}</span><h2>Hors magasin</h2><p class="muted">Les pièces ici ne sont pas en stock : elles sont ${esc(salleCode(s).toLowerCase())}${pathOf(l).length ? ' (' + esc(pathOf(l).join(' › ')) + ')' : ''}. Pour les remettre en magasin, faites un « Déplacer » vers un emplacement physique.</p></div>
      <div class="d-actions">${menu([
        ['edit-lieu', 'Modifier', 'edit', {id: l.id}],
        ['edit-salle', 'Modifier le statut', 'edit', {id: l.salleId}]
      ])}</div></div>
      <section class="block"><h3>Pièces concernées</h3>${items.length ? `<div class="tbl-wrap"><table class="tbl compact"><tbody>${items.map(x => `<tr data-act="goto" data-view="pieces" data-id="${x.p.id}" tabindex="0"><td><span class="ref">${esc(x.p.ref)}</span> ${esc(x.p.designation)}</td><td class="num qty">${num(x.qte)} <span class="muted">${esc(x.p.unite)}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-line">Aucune pièce.</p>'}</section>`;
    return `<div class="d-head"><div class="d-title"><span><span class="plate big">${esc(lieuCode(l))}</span></span><h2>${esc(s?.nom || '')}</h2><p class="muted">${parts}</p></div>
      <div class="d-actions"><button class="btn primary" data-act="labels-here" data-id="${l.id}" ${withStock.length ? '' : 'disabled'}>${icon('qr')}Étiquettes du matériel (${withStock.length})</button>
        ${menu([['edit-lieu', 'Modifier l’emplacement', 'edit', {id: l.id}], ['edit-salle', 'Modifier la salle', 'edit', {id: l.salleId}], ['labels-loc', 'Étiquette d’emplacement', 'tag', {ids: l.id}], '-', ['opt', 'Gérer les emplacements', 'shelf', {sec: 'lieux'}], ['arch', 'Archiver l’emplacement', 'archive', {col: 'lieux', id: l.id}]])}</div></div>
      <section class="block"><h3>Rangé ici</h3>${items.length ? `<div class="tbl-wrap"><table class="tbl compact"><tbody>${items.map(x => `<tr data-act="goto" data-view="pieces" data-id="${x.p.id}" tabindex="0"><td><span class="ref">${esc(x.p.ref)}</span> ${esc(x.p.designation)}</td><td class="num qty">${num(x.qte)} <span class="muted">${esc(x.p.unite)}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-line">Emplacement vide.</p>'}</section>
      ${l.note ? `<section class="block"><h3>Note</h3><p class="pre">${esc(l.note)}</p></section>` : ''}`;
  }
};
