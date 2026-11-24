'use strict';
/* TriFlow — Pages : travaux (tâches et rapports), installation (KKS). (Fichiers chargés dans l'ordre par index.html.) */
/* ---------- Travaux : une seule page en trois étapes ----------
   À faire = les tâches (une seule fois ou qui reviennent) ; En cours = rapports pas terminés ;
   Fait = rapports terminés + travaux cochés sans rapport (t.faits : [{date, who:[ids]}]).
   t.rapport : '' = demander à chaque fois, 'oui' = toujours un rapport, 'non' = jamais. */
const wTab = () => (S.view === 'revision' ? 'revision' : S.view === 'taches' ? 'afaire' : S.statut === 'actives' ? 'encours' : 'fait');
function wtabs() {
  if (S.arch[S.view] && S.view !== 'revision') return '';
  const nT = db.taches.filter(t => live(t) && t.actif !== false && forWho(t, S.pour)).length,
    nE = db.interventions.filter(i => live(i) && i.statut !== 'terminee' && intFor(i, S.pour)).length,
    w = wTab();
  const b = (k, ic, t, n) =>
    `<button role="tab" data-act="wtab" data-w="${k}" aria-selected="${w === k}">${icon(ic)}${t}${n != null ? ` <small>${n}</small>` : ''}</button>`;
  return `<div class="ttabs wtabs" role="tablist" aria-label="Étape">${b('afaire', 'list', 'À faire', nT)}${b('encours', 'wrench', 'En cours', nE)}${b('fait', 'check', 'Fait')}</div>`;
}
function travauxShell() {
  const t = S.view === 'taches';
  return `<header class="page-head"><h1>Travaux</h1><div class="tools">${searchBox(t ? 'taches' : 'interventions', t ? 'Rechercher un travail…' : 'Rechercher un rapport…')}
    ${t ? `<button class="btn primary" data-act="new-tache">${icon('plus')}Nouveau travail</button>` : `<button class="btn primary" data-act="new-int">${icon('plus')}Nouveau rapport</button>`}
    <span class="head-tools">${(t ? [['signal', 'Signaler un problème', 'bell', {}], ['new-int', 'Nouveau rapport sans travail prévu', 'report', {}], ['print-taches', 'Imprimer la liste', 'printer', {}], ['xl-taches', 'Exporter en Excel', 'excel', {}], archItem('taches')] : [['xl-ints', 'Exporter en Excel', 'excel', {}], archItem('interventions')]).map(x => toolBtn(x)).join('')}</span></div></header>
    <div class="split"><section class="pane" id="list"></section><section class="pane detail" id="detail"></section></div>`;
}
const doneOn = (t, d) => db.interventions.some(i => i.tacheId === t.id && i.date === d) || (t.faits || []).some(f => f.date === d);
const nextAfter = (t, d) => {
  if (isPetit(t)) return '';
  let n = t.prochaine;
  do {
    n = addFreq(n, t.freq.n, t.freq.unite);
  } while (n <= d);
  return n;
};
/* « C'est fait » : rapport toujours, jamais, ou on demande */
function doTache(t, opts = {}) {
  if (!t) return;
  const run = openRun(t);
  if (run) return interventionDialog(run);
  if (t.rapport === 'oui') return interventionDialog(null, null, t, opts);
  if (t.rapport === 'non') return finishTask(t, opts);
  const nx = nextAfter(t, opts.date || todayISO());
  const dd = dialog({
    title: 'C’est fait',
    saveLabel: 'Annuler',
    info: true,
    body: `<p class="task-note">${icon('check')}<span><b>${esc(t.titre)}</b>${nx ? ` · reviendra le ${fmtD(nx)}` : ''}</span></p>
    <p class="hint" style="margin:0 0 8px">Faut-il un rapport ?</p><div class="kind-pick">
      <button type="button" class="kind" data-r="non">${icon('check')}<b>Non, juste cocher</b></button>
      <button type="button" class="kind" data-r="oui">${icon('report')}<b>Oui, faire un rapport</b></button></div>
    <label class="toggle" style="margin-top:12px"><input type="checkbox" name="keep"> Retenir mon choix pour ce travail</label>`,
    onOpen(f, d) {
      $$('[data-r]', d).forEach(
        b =>
          (b.onclick = () => {
            const r = b.dataset.r,
              keep = f.elements.keep.checked;
            d.close();
            if (r === 'non') return finishTask(t, opts, keep ? 'non' : null);
            if (keep)
              tx(() => {
                t.rapport = 'oui';
              });
            interventionDialog(null, null, t, opts);
          })
      );
    },
    onSave() {}
  });
  $('footer .primary', dd)?.classList.remove('primary');
}
function finishTask(t, opts = {}, setRap = null) {
  const date = opts.date || todayISO(),
    me = meId(),
    who = [...new Set([...(opts.who || []), ...(me ? [me] : [])])].filter(id => getPers(id));
  tx(() => {
    if (setRap) t.rapport = setRap;
    t.faits = [...(t.faits || []), {date, who}];
    advanceTask(t, date);
  });
  const rows = $$(`[data-act="do-tache"][data-id="${t.id}"]`).map(b => b.closest('li, tr') || b.parentElement);
  rows.forEach(r => r.classList.add('done-out'));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (rows.length && !reduce) setTimeout(render, 320);
  else render();
  toast(isPetit(t) ? `Fait : ${t.titre}` : `Fait · prochaine fois le ${fmtD(t.prochaine)}`, '', true);
}
function doneHTML(t) {
  const reps = db.interventions.filter(i => i.tacheId === t.id && live(i)),
    fs = t.faits || [];
  if (!reps.length && !fs.length) return '<p class="empty-line">Pas encore fait.</p>';
  const names = ids =>
    (ids || [])
      .map(id => getPers(id))
      .filter(Boolean)
      .map(persName)
      .join(', ');
  const rows = [
    ...reps.map(i => ({
      d: i.date,
      h: `<tr data-act="goto" data-view="interventions" data-id="${i.id}" tabindex="0"><td class="ref">${fmtD(i.date)}</td><td>${esc(i.titre || '(sans titre)')}<span class="sub">${esc(i.num)}</span></td><td class="num">${i.statut !== 'terminee' ? statutChip(i.statut) : ''}</td></tr>`
    })),
    ...fs.map(f => ({
      d: f.date,
      h: `<tr><td class="ref">${fmtD(f.date)}</td><td>Fait, sans rapport${names(f.who) ? `<span class="sub">${esc(names(f.who))}</span>` : ''}</td><td></td></tr>`
    }))
  ].sort((a, b) => b.d.localeCompare(a.d));
  return `<div class="tbl-wrap"><table class="tbl compact itbl"><tbody>${rows.map(r => r.h).join('')}</tbody></table></div>`;
}
/* Arrêt de l'usine (révision) : travaux marqués « arret », dates dans reglages.arret {du, au} */
/* Une période par année : reglages.arrets {AAAA: {du, au}} (l'ancien reglages.arret compte pour son année) */
function arretsAll() {
  const A = {...(db.reglages.arrets || {})},
    a = db.reglages.arret;
  if (a?.du && !A[a.du.slice(0, 4)]) A[a.du.slice(0, 4)] = a;
  return A;
}
/* La révision en cours ou la prochaine (sinon la dernière) */
const arretDates = () => {
  const t = todayISO(),
    L = Object.values(arretsAll())
      .filter(x => x?.du && x?.au)
      .sort((x, y) => x.du.localeCompare(y.du));
  return L.find(x => x.au >= t) || L[L.length - 1] || {};
};
const arretOn = (from = todayISO(), to = from) => {
  const a = arretDates();
  return !!(a.du && a.au && a.du <= to && a.au >= from);
};
/* Fait pour cet arrêt : fait depuis 3 mois avant le début (préparation comprise) ; sans dates : petit travail coché */
const arretFait = t => {
  const a = arretDates();
  if (!a.du) return t.actif === false;
  if (!t.derniere) return t.actif === false;
  return t.derniere >= isoAdd(a.du, -90) && (!a.au || t.derniere <= a.au);
};
/* Quand ? : regroupement des travaux à faire (pendant l'arrêt, ses travaux passent dans « Cette semaine ») */
const tKey = t => {
  if (t.actif === false) return 'fait';
  if (t.arret && !arretFait(t)) return arretOn() ? 'semaine' : 'arret';
  if (!t.prochaine) return 'asap';
  const n = daysTo(t.prochaine);
  return n < -365 ? 'vieux' : n < 0 ? 'retard' : n <= 7 ? 'semaine' : 'plus';
};
const T_GRP = [
  ['retard', 'En retard', 'bad'],
  ['semaine', 'Cette semaine', 'warn'],
  ['asap', 'Dès que possible', ''],
  ['plus', 'Plus tard', ''],
  ['arret', 'Pour l’arrêt', ''],
  ['vieux', 'En retard depuis plus d’un an', '']
];
function baseTaches() {
  let rows = db.taches.filter(t => (S.arch.taches ? t.arch : !t.arch)).filter(t => S.arch.taches || forWho(t, S.pour));
  const q = norm(S.q.taches || '');
  if (q)
    rows = rows.filter(t =>
      norm([t.titre, t.description, getKks(t.kksId)?.code, getKks(t.kksId)?.designation, assignLabel(t.assign)].join(' ')).includes(q)
    );
  return rows;
}
function filteredTaches() {
  const rows = baseTaches().filter(
    t => S.arch.taches || (S.tf === 'arret' ? t.arret && (t.actif !== false || arretFait(t)) : S.tf ? tKey(t) === S.tf : t.actif !== false)
  );
  return rows.sort(
    (a, b) =>
      (a.actif === false) - (b.actif === false) ||
      (a.prochaine && b.prochaine ? a.prochaine.localeCompare(b.prochaine) : 0) ||
      petitSort(a, b)
  );
}
function pourSelect() {
  /* Pastilles « Moi / Mon équipe / Tous », le reste (autre équipe, autre personne) dans « Autre… » */
  const me = meId(),
    mg = me && getPers(me)?.groupe,
    quick = [['', 'Tout le monde']].concat(me ? [['p:' + me, 'Moi']] : [], mg ? [['g:' + mg, 'Mon équipe']] : []);
  const other = S.pour && !quick.some(q => q[0] === S.pour);
  return `<span class="pour-chips" role="group" aria-label="Pour qui">${quick.map(([v, l]) => `<button type="button" class="ychip" data-act="pour-set" data-v="${esc(v)}" aria-pressed="${S.pour === v}">${l}</button>`).join('')}${pourOther(other)}</span>`;
}
function pourOther(on) {
  const groups = db.listes.groupes.filter(g => db.personnes.some(p => p.groupe === g && p.actif !== false));
  const people = db.personnes.filter(p => p.actif !== false && live(p)).sort(persSort);
  return `<select class="mini pour ${on ? 'on' : ''}" data-change="pour" aria-label="Autre équipe ou personne"><option value="" ${on ? '' : 'selected'}>Autre…</option><optgroup label="Corps de métier">${groups.map(g => opt('g:' + g, g, S.pour)).join('')}</optgroup><optgroup label="Personne">${people.map(p => opt('p:' + p.id, persName(p), S.pour)).join('')}</optgroup></select>`;
}
function tacheRow(t, withSel = true) {
  const k = getKks(t.kksId),
    run = openRun(t),
    off = t.actif === false || (S.tf === 'arret' && arretFait(t));
  return `<tr data-act="${withSel ? 'select' : 'goto'}" ${withSel ? '' : 'data-view="taches"'} data-id="${t.id}" class="${withSel && S.sel.taches === t.id ? 'sel' : ''}" tabindex="0">
    <td><span class="des">${t.demande && !t.demande.ok ? '<span class="chip info dem">Demande</span> ' : ''}${esc(t.titre)}</span><span class="sub">${k ? esc(k.code) + ' · ' : ''}${esc(assignLabel(t.assign))}${isPetit(t) ? '' : ` · <span class="rep">${icon('repeat')}${esc(freqLabel(t.freq))}</span>`}${t.arret ? ' · Arrêt' : ''}</span>${!off && !run ? `<span class="mdue">${dueInfo(t).chip}</span>` : ''}</td>
    <td class="num"><span class="trow-r">${off ? `<span class="chip ok">Fait${t.arret && t.derniere && S.tf === 'arret' ? ' le ' + fmtD(t.derniere) : ''}</span>` : run ? '<span class="chip info">En cours</span>' : dueInfo(t).chip}${!off && !run && !t.arch ? `<button class="tick" data-act="do-tache" data-id="${t.id}" title="C’est fait" aria-label="C’est fait : ${esc(t.titre)}">${icon('check')}</button>` : ''}</span></td></tr>`;
}
VIEWS.taches = {
  shell: travauxShell,
  list() {
    const head = wtabs();
    if (!db.taches.length)
      return (
        head +
        empty(
          'Rien à faire',
          `<p>Une réparation, un contrôle, un entretien qui revient…</p><button class="btn primary" data-act="new-tache">${icon('plus')}Nouveau travail</button>`
        )
      );
    const rows = filteredTaches(),
      base = S.arch.taches ? [] : baseTaches().filter(t => t.actif !== false);
    const cnt = {};
    for (const t of base) {
      const k = tKey(t);
      cnt[k] = (cnt[k] || 0) + 1;
    }
    const chip = (f, t, n, tone = '') =>
      f && !n && S.tf !== f
        ? ''
        : `<button role="tab" class="ychip ${tone}" data-act="tf" data-f="${f}" aria-selected="${(S.tf || '') === f}">${t} <small>${n || 0}</small></button>`;
    const arr = base.filter(t => t.arret),
      arrTodo = arr.filter(t => !arretFait(t)).length,
      chipArr = arr.length || S.tf === 'arret' ? chip('arret', 'Arrêt', arrTodo || (S.tf === 'arret' ? 0 : '0')) : '';
    const chips = S.arch.taches
      ? ''
      : `<div class="fchips" role="tablist" aria-label="Quand">${pourSelect()}<span class="ysep" aria-hidden="true"></span>${chip('', 'Tout', base.length)}${T_GRP.filter(
          g => g[0] !== 'arret'
        )
          .map(([k, l, tone]) => chip(k, k === 'vieux' ? 'Anciens retards' : l, cnt[k], tone))
          .join('')}${chipArr}</div>${S.tf === 'arret' ? arretBar(rows) : ''}`;
    if (!rows.length)
      return (
        head +
        chips +
        (S.arch.taches
          ? empty('Aucun travail archivé', '')
          : empty(
              'Rien à faire',
              S.pour || S.tf
                ? `<p>Aucun travail pour cette sélection.</p><button class="btn" data-act="pour-set" data-v="">Tout voir</button>`
                : `<p>Tout est à jour.</p><button class="btn" data-act="new-tache">${icon('plus')}Nouveau travail</button>`
            ))
      );
    const grp = {},
      gk = t => (S.tf === 'arret' ? (arretFait(t) ? 'fait' : 'arret') : tKey(t));
    rows.forEach(t => (grp[gk(t)] ||= []).push(t));
    const sec = (key, title) =>
      grp[key]?.length
        ? `<tbody><tr class="grp ${key === 'vieux' ? 'old' : ''}"><th colspan="2"><span>${title}</span> <span class="muted" style="font-family:var(--f-body);font-size:.8rem">${grp[key].length}</span></th></tr>${grp[key].map(t => tacheRow(t)).join('')}</tbody>`
        : '';
    return `${head}${chips}<div class="tbl-wrap"><table class="tbl">${T_GRP.map(([k, l]) => sec(k, k === 'arret' && S.tf === 'arret' ? 'À faire pendant l’arrêt' : l)).join('')}${sec('fait', 'Faits')}</table></div>`;
  },
  detail() {
    const t = get('taches', S.sel.taches);
    if (!t) return placeholder('check', 'Choisissez un travail.');
    const k = getKks(t.kksId),
      run = openRun(t),
      last = [...db.interventions.filter(i => i.tacheId === t.id && live(i)).map(i => i.date), ...(t.faits || []).map(f => f.date)]
        .sort()
        .pop();
    const off = t.actif === false,
      di = dueInfo(t),
      RAP = {oui: 'avec rapport', non: 'sans rapport'};
    return `${archBanner('taches', t)}<div class="pd-head"><span class="pd-id txt">${isPetit(t) ? 'Une seule fois' + (prioOf(t) !== 'normale' ? ' · priorité ' + PRIO[prioOf(t)][0].toLowerCase() : '') : esc(freqLabel(t.freq))}${t.arret ? ' · pendant l’arrêt' : ''}</span><div class="pd-tools"><button class="btn small" data-act="edit-tache" data-id="${t.id}">${icon('edit')}Modifier</button>${toolBtn(t.arch ? ['unarch', 'Restaurer', 'archive', {col: 'taches', id: t.id}] : ['arch', 'Archiver', 'archive', {col: 'taches', id: t.id}])}${toolBtn(hardItem('taches', t.id), 'danger-ghost')}</div></div>
      <h2 class="pd-title">${esc(t.titre)}</h2>
      ${k ? `<div class="equip-hero">${kksTag(k)}<span>${esc(k.designation || '')}</span></div>` : ''}
      <p class="pd-sub">${t.assign?.v ? `Pour <strong style="font-weight:600">${esc(assignLabel(t.assign))}</strong>` : '<span class="muted">Pour personne en particulier</span>'}${last ? ` · fait la dernière fois le ${fmtD(last)}` : ''}${RAP[t.rapport] ? ` · ${RAP[t.rapport]}` : ''}</p>
      <div class="pd-stock ${!off && (di.k === 'retard' || tKey(t) === 'retard') ? 'late' : ''}">
        <div class="pd-qty">${off ? '<span class="l" style="font-size:1rem">Fait</span>' : isPetit(t) ? `<span class="l">${t.prochaine ? 'Pour le' : 'Quand ?'}</span>${t.prochaine ? `<span class="n" style="font-size:1.5rem">${fmtD(t.prochaine)}</span>` : '<span class="n" style="font-size:1.2rem">Dès que possible</span>'}${prioOf(t) !== 'normale' ? di.chip : ''}` : `<span class="l">Prochaine fois</span><span class="n" style="font-size:1.5rem">${fmtD(t.prochaine)}</span>${di.k === 'plus' ? '' : di.chip}`}</div>
        ${off || t.arch ? '' : run ? `<button class="btn primary" data-act="edit-int" data-id="${run.id}">${icon('report')}Compléter le rapport ${esc(run.num)}</button>` : `<button class="btn primary" data-act="do-tache" data-id="${t.id}">${icon('check')}C’est fait</button>`}
      </div>
      ${!off && !t.arch && !isPetit(t) && daysTo(t.prochaine) < 0 ? `<p class="recal">${icon('repeat')}<span>Plus d’actualité ?</span><button class="btn small" data-act="recaler" data-id="${t.id}">Recaler sur la prochaine échéance</button></p>` : ''}
      ${demandeHTML(t)}
      ${t.description ? `<section class="pd-sec"><h3>${icon('list')}Ce qu’il faut faire</h3><p class="pre">${esc(t.description)}</p></section>` : ''}
      ${(t.points || []).length ? `<section class="pd-sec"><h3>${icon('check')}Points à contrôler</h3><ul class="pts-list">${t.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></section>` : ''}
      ${(t.photos || []).length || t.demande ? `<section class="pd-sec"><h3>${icon('camera')}Photos</h3>${photoStrip(t.photos, {col: 'taches', id: t.id})}</section>` : ''}
      ${(() => {
        const h = doneHTML(t);
        return h.includes('empty-line') ? '' : `<section class="pd-sec"><h3>${icon('check')}Déjà fait</h3>${h}</section>`;
      })()}${byLine(t)}`;
  }
};
/* Bandeau de l'onglet Arrêt : dates et avancement */
function arretBar(rows) {
  const a = arretDates(),
    done = rows.filter(arretFait).length;
  return `<p class="arr-bar">${icon('calendar')}<span>${a.du ? `Arrêt du <b>${fmtD(a.du)}</b> au <b>${fmtD(a.au)}</b>` : 'Dates de l’arrêt pas encore fixées'} · ${rows.length - done} à faire · ${done} ${done > 1 ? 'faits' : 'fait'}</span><button class="btn small" data-act="arret-dates">${a.du ? 'Changer les dates' : 'Fixer les dates'}</button></p>`;
}
function newTacheDialog(kksId) {
  tacheDialog(null, kksId);
}
/* Pastille de choix (bouton radio stylé) et pastille interrupteur (case à cocher) : grandes zones à toucher */
const sp = (name, value, label, cur, cls = '') =>
  `<label class="sp ${cls}"><input type="radio" name="${name}" value="${esc(value)}" ${String(cur) === String(value) ? 'checked' : ''}><span>${label}</span></label>`;
const tchip = (name, label, on) =>
  `<label class="tchip"><input type="checkbox" name="${name}" ${on ? 'checked' : ''}><span>${label}</span></label>`;
function tacheDialog(t, kksId) {
  const isNew = !t,
    petit0 = t ? isPetit(t) : true;
  const v = t || {
    titre: '',
    description: '',
    kksId: kksId || '',
    assign: {type: 'groupe', v: ''},
    freq: {n: 1, unite: 'once'},
    prochaine: '',
    actif: true,
    prio: 'normale',
    rapport: 'oui',
    arret: S.view === 'taches' && S.tf === 'arret'
  };
  const k = getKks(v.kksId);
  const assignItems = () => [
    ...db.listes.groupes
      .filter(g => db.personnes.some(p => p.groupe === g && p.actif !== false))
      .map(g => ({
        id: 'g:' + g,
        label: g,
        search: 'groupe métier ' + g,
        html: `<strong>${esc(g)}</strong>`,
        right: '<span class="muted">Corps de métier</span>'
      })),
    ...db.personnes
      .filter(p => p.actif !== false && live(p))
      .sort(persSort)
      .map(p => ({
        id: 'p:' + p.id,
        label: persName(p),
        search: persName(p) + ' ' + (p.groupe || ''),
        html: esc(persName(p)),
        right: `<span class="muted">${esc(p.groupe || '')}</span>`
      })),
    ...db.listes.fournisseurs
      .filter(n => !(db.listes.fournArch || []).includes(n))
      .map(n => ({
        id: 'f:' + n,
        label: n,
        search: 'entreprise ' + n,
        html: esc(n),
        right: '<span class="muted">Entreprise</span>'
      }))
  ];
  const aId = v.assign?.v ? ({personne: 'p:', four: 'f:'}[v.assign.type] || 'g:') + v.assign.v : '';
  /* Pastilles « Pour qui ? » : les corps de métier, moi, puis « Autre… » (recherche : personne ou entreprise) */
  const me = meId() && getPers(meId());
  const whoPills = [
    ...db.listes.groupes
      .filter(g => metOf(g) && db.personnes.some(p => p.groupe === g && p.actif !== false && live(p)))
      .map(g => ['g:' + g, `${mdot(metOf(g))}${esc(g)}`]),
    ...(me ? [['p:' + me.id, 'Moi']] : [])
  ];
  const whoCur = !aId ? '' : whoPills.some(w => w[0] === aId) ? aId : 'other';
  const quand0 = petit0 ? (v.prochaine ? 'date' : 'asap') : 'rec';
  dialog({
    title: isNew ? 'Nouveau travail' : 'Modifier le travail',
    cls: 'tdlg',
    body: `<input class="t-title" name="titre" value="${esc(v.titre)}" required placeholder="Quel travail ? ex. Changer le néon de l’atelier" aria-label="Quel travail ?" autocomplete="off">
      <p class="t-sum" data-sum aria-live="polite"></p>
      <div class="fgrp"><span class="fl">${icon('calendar')}Quand ?</span>
        <div class="pills" role="radiogroup" aria-label="Quand ?">${sp('quand', 'asap', 'Dès que possible', quand0)}${sp('quand', 'date', 'À une date', quand0)}${sp('quand', 'rec', `${icon('repeat')}Ça revient`, quand0)}</div>
        <div class="dsub" data-q="date"><div class="qd">${[
          ['0', 'Aujourd’hui'],
          ['1', 'Demain'],
          ['mon', 'Lundi prochain']
        ]
          .map(([k2, l]) => `<button type="button" class="qd-b" data-pd="${k2}">${l}</button>`)
          .join('')}</div><input name="pdate" type="date" value="${petit0 ? esc(v.prochaine || '') : ''}" aria-label="Date"></div>
        <div class="dsub" data-q="rec" data-rec><div class="freq2"><span>Tous les</span><input name="n" type="number" min="1" step="1" value="${esc(v.freq.n || 1)}" aria-label="Intervalle" data-n><div class="pills" role="radiogroup" aria-label="Unité">${[
          ['jour', 'jours'],
          ['semaine', 'semaines'],
          ['mois', 'mois'],
          ['an', 'ans']
        ]
          .map(([k2, l]) => sp('unite', k2, l, petit0 ? 'mois' : v.freq.unite))
          .join('')}</div></div>
          <label>${isNew || petit0 ? 'Première fois le' : 'Prochaine fois le'}<input name="prochaine" type="date" value="${esc(petit0 ? v.prochaine || todayISO() : v.prochaine)}"></label><p class="hint" data-fprev></p></div>
      </div>
      <div class="fgrp" data-once><span class="fl">${icon('bell')}Urgence</span><div class="pills" role="radiogroup" aria-label="Urgence">${['basse', 'normale', 'haute'].map(k2 => sp('prio', k2, PRIO[k2][0], prioOf(v), 'p-' + k2)).join('')}</div></div>
      <div class="fgrp"><span class="fl">${icon('person')}Pour qui ?</span>
        <div class="pills" role="radiogroup" aria-label="Pour qui ?">${sp('who', '', 'N’importe qui', whoCur)}${whoPills.map(([k2, l]) => sp('who', k2, l, whoCur)).join('')}${sp('who', 'other', 'Autre…', whoCur)}</div>
        <div class="dsub" data-q="other"><input name="assign" data-id="${esc(whoCur === 'other' ? aId : '')}" data-label="${esc(whoCur === 'other' ? assignLabel(v.assign) : '')}" value="${esc(whoCur === 'other' ? assignLabel(v.assign) : '')}" placeholder="Tapez un nom : personne, équipe ou entreprise" aria-label="Personne, équipe ou entreprise"></div>
      </div>
      <div class="fgrp"><span class="fl">${icon('plant')}Équipement <span class="muted">· facultatif</span></span><input name="kks" data-id="${k ? k.id : ''}" data-label="${k ? esc(kksLabel(k)) : ''}" value="${k ? esc(kksLabel(k)) : ''}" placeholder="Code KKS ou nom de l’équipement" aria-label="Équipement"></div>
      <div class="tchips">${tchip('arret', `${icon('flame')}Pendant l’arrêt`, v.arret)}${tchip('norap', `${icon('report')}Sans rapport`, v.rapport === 'non')}</div>
      <details class="more" ${!isNew && (v.description || (v.points || []).length) ? 'open' : ''}><summary>${icon('chev')}Consignes et points à contrôler</summary>
      <label>Ce qu’il faut faire<textarea name="description" rows="3" placeholder="Consignes… (facultatif)">${esc(v.description)}</textarea></label>
      <label>Points à contrôler <span class="muted">(un par ligne : ils deviennent des cases à cocher dans le rapport)</span><textarea name="points" rows="3" placeholder="ex. Niveau d’huile&#10;Serrage des bornes&#10;Bruit anormal">${esc((v.points || []).join('\n'))}</textarea></label></details>`,
    onOpen(f, d) {
      combo(f.elements.kks, {
        items: () =>
          db.kks.filter(live).map(x => ({
            id: x.id,
            key: x.code,
            label: kksLabel(x),
            search: x.code + ' ' + x.designation,
            html: `<span class="kks">${esc(x.code)}</span> ${esc(x.designation)}`
          }))
      });
      combo(f.elements.assign, {items: assignItems});
      const rv = n => f.querySelector(`input[name="${n}"]:checked`)?.value || '';
      /* Dates rapides */
      d.addEventListener('click', e => {
        const b = e.target.closest('[data-pd]');
        if (!b) return;
        const k2 = b.dataset.pd,
          dow = (new Date(todayISO() + 'T12:00').getDay() + 6) % 7;
        f.elements.pdate.value = k2 === 'mon' ? isoAdd(todayISO(), 7 - dow) : isoAdd(todayISO(), +k2);
        u();
      });
      const u = () => {
        const q = rv('quand'),
          rec = q === 'rec',
          un = rv('unite') || 'mois',
          n = Math.max(1, +val(f, 'n') || 1),
          p = val(f, 'prochaine'),
          who = rv('who');
        for (const el of $$('[data-q]', d)) el.hidden = el.dataset.q !== q && el.dataset.q !== who;
        $('[data-once]', d).hidden = rec;
        for (const b of $$('[data-pd]', d)) {
          const dow = (new Date(todayISO() + 'T12:00').getDay() + 6) % 7;
          b.classList.toggle(
            'on',
            f.elements.pdate.value === (b.dataset.pd === 'mon' ? isoAdd(todayISO(), 7 - dow) : isoAdd(todayISO(), +b.dataset.pd))
          );
        }
        $('[data-fprev]', d).textContent =
          !rec || !p ? '' : `${fmtD(p)}, puis ${fmtD(addFreq(p, n, un))}, ${fmtD(addFreq(addFreq(p, n, un), n, un))}…`;
        /* Résumé en une phrase : ce qui va être créé */
        const whoL = who === 'other' ? f.elements.assign.value.trim() : who ? (who.startsWith('p:') ? 'moi' : who.slice(2)) : '';
        const pd = val(f, 'pdate');
        const when = rec ? freqLabel({n, unite: un}).toLowerCase() : q === 'date' && pd ? 'pour le ' + fmtD(pd) : 'dès que possible';
        const prio = rv('prio');
        const kk = f.elements.kks.value.trim().split(' ')[0];
        const bits = [
          whoL ? `Pour <b>${esc(whoL)}</b>` : 'Pour <b>n’importe qui</b>',
          `<b>${esc(when)}</b>`,
          !rec && prio === 'haute' ? '<b class="hot">urgent</b>' : '',
          kk ? `sur <b class="mono">${esc(kk)}</b>` : '',
          f.elements.arret.checked ? 'pendant l’arrêt' : '',
          f.elements.norap.checked ? 'sans rapport' : ''
        ].filter(Boolean);
        $('[data-sum]', d).innerHTML = bits.join(' · ');
      };
      f.addEventListener('input', u);
      f.addEventListener('change', u);
      u();
      if (isNew) setTimeout(() => f.elements.titre.focus(), 30);
    },
    del: isNew ? null : archDel('taches', t, () => HARD.taches(t)),
    onSave(f) {
      const rv = n2 => f.querySelector(`input[name="${n2}"]:checked`)?.value || '';
      const titre = val(f, 'titre'),
        quand = rv('quand'),
        petit = quand !== 'rec',
        unite = petit ? 'once' : rv('unite') || 'mois',
        n = petit ? 1 : Math.max(1, Math.round(+val(f, 'n') || 1)),
        prochaine = quand === 'date' ? val(f, 'pdate') : quand === 'rec' ? val(f, 'prochaine') : '';
      if (quand === 'date' && !prochaine) throw new Error('Choisissez la date, ou « Dès que possible ».');
      if (!titre) throw new Error('Indiquez le travail.');
      if (!petit && !/^\d{4}-\d{2}-\d{2}$/.test(prochaine)) throw new Error('Indiquez la date de la première fois.');
      let kk = null;
      const ki = f.elements.kks;
      if (ki.value.trim()) {
        kk = getKks(ki.dataset.id) || findKks(ki.value);
        if (!kk) throw new Error('Repère KKS inconnu : choisissez-le dans la liste.');
      }
      const ai = f.elements.assign,
        who = rv('who');
      let assign = {type: 'groupe', v: ''},
        id = who === 'other' ? '' : who;
      if (who === 'other' && ai.value.trim()) {
        id = ai.dataset.id || '';
        if (!id) throw new Error('Choisissez une personne, une équipe ou une entreprise dans la liste.');
      }
      if (id) assign = {type: {g: 'groupe', p: 'personne', f: 'four'}[id[0]] || 'groupe', v: id.slice(2)};
      const rapport = f.elements.norap.checked ? 'non' : v.rapport === 'non' ? 'oui' : (v.rapport ?? 'oui');
      const data = {
        titre,
        description: val(f, 'description'),
        points: val(f, 'points')
          .split('\n')
          .map(x => x.trim())
          .filter(Boolean),
        kksId: kk ? kk.id : '',
        assign,
        freq: {n, unite},
        prochaine,
        rapport,
        arret: f.elements.arret.checked,
        ...(petit ? {kind: 'petit', prio: rv('prio') || 'normale'} : {kind: 'rec'})
      };
      tx(() => {
        if (isNew) {
          const x = {id: uid(), actif: true, ...data};
          if (!x.arret) delete x.arret;
          db.taches.push(x);
          S.sel.taches = x.id;
        } else {
          Object.assign(t, data, petit && t.actif === false && isPetit(t) ? {} : {actif: true});
          if (!t.arret) delete t.arret;
        }
      });
      S.view = 'taches';
      if (S.tf !== 'arret' || !data.arret) S.tf = '';
      render();
      toast(isNew ? 'Travail ajouté' : 'Enregistré');
    }
  });
}
/* Liste de l'arrêt, par métier, avec une case à cocher */
function arretSheetHTML() {
  const a = arretDates(),
    rows = filteredTaches(),
    by = {};
  for (const t of rows) (by[tMet(t) || 'z'] ||= []).push(t);
  const ml = k => METIERS.find(m => m[0] === k)?.[1] || 'Autres';
  const order = [...METIERS.map(m => m[0]), 'z'].filter(k => by[k]);
  return `<article class="rpt"><header class="rpt-head"><div><div class="rpt-org">Tridel · Maintenance</div><h1>Travaux de l’arrêt</h1></div><div class="rpt-num"><div>${a.du ? `${fmtD(a.du)} – ${fmtD(a.au)}` : ''}</div><div>${rows.length} travaux</div></div></header>
    ${
      rows.length
        ? `<table class="rpt-tbl"><thead><tr><th style="width:8mm"></th><th>Travail</th><th>Équipement</th><th>Pour</th><th>Fait le</th></tr></thead>${order
            .map(
              k =>
                `<tbody><tr><th colspan="5" class="g">${esc(ml(k))} · ${by[k].length}</th></tr>${by[k]
                  .map(t => {
                    const kk = getKks(t.kksId),
                      ok = arretFait(t);
                    return `<tr><td><span class="box">${ok ? '✓' : ''}</span></td><td><strong>${esc(t.titre)}</strong>${t.description ? `<br><span style="font-size:8.5pt">${esc(t.description)}</span>` : ''}</td><td class="mono">${kk ? esc(kk.code) : ''}</td><td>${esc(assignLabel(t.assign))}</td><td>${ok && t.derniere ? fmtD(t.derniere) : ''}</td></tr>`;
                  })
                  .join('')}</tbody>`
            )
            .join('')}</table>`
        : '<p>Aucun travail marqué « pendant l’arrêt ».</p>'
    }
    <footer class="rpt-foot">Imprimé le ${fmtDT(new Date().toISOString())} · TriFlow</footer></article>`;
}
function tachesSheetHTML() {
  if (S.tf === 'arret') return arretSheetHTML();
  const rows = [
    ...baseTaches()
      .filter(t => t.actif !== false && isPetit(t) && (prioOf(t) === 'haute' || daysTo(t.prochaine) <= 7))
      .sort(petitSort),
    ...baseTaches()
      .filter(t => t.actif !== false && !isPetit(t) && daysTo(t.prochaine) <= 7)
      .sort(urgSort)
  ];
  const who = S.pour ? (S.pour.startsWith('g:') ? S.pour.slice(2) : persName(getPers(S.pour.slice(2)) || {nom: ''})) : 'Tout le monde';
  return `<article class="rpt"><header class="rpt-head"><div><div class="rpt-org">Tridel · Maintenance</div><h1>Liste de travail</h1></div><div class="rpt-num"><div>${esc(who)}</div><div>${fmtD(todayISO())}</div></div></header>
    ${
      rows.length
        ? `<table class="rpt-tbl"><thead><tr><th style="width:8mm"></th><th>Tâche</th><th>Équipement</th><th>Pour</th><th>Prévue</th></tr></thead><tbody>${rows
            .map(t => {
              const k = getKks(t.kksId);
              return `<tr><td><span class="box"></span></td><td><strong>${esc(t.titre)}</strong>${t.description ? `<br><span style="font-size:8.5pt">${esc(t.description)}</span>` : ''}</td><td class="mono">${k ? esc(k.code) : ''}</td><td>${esc(assignLabel(t.assign))}</td><td>${fmtD(t.prochaine)}${daysTo(t.prochaine) < 0 ? ' (retard)' : ''}</td></tr>`;
            })
            .join('')}</tbody></table>`
        : '<p>Aucune tâche en retard ou prévue dans les 7 jours.</p>'
    }
    <footer class="rpt-foot">Tâches en retard et des 7 prochains jours · imprimé le ${fmtDT(new Date().toISOString())} · TriFlow</footer></article>`;
}

function filteredInts() {
  const q = norm(S.q.interventions);
  let rows = db.interventions
    .filter(i => (S.arch.interventions ? i.arch : !i.arch))
    .filter(i => S.arch.interventions || intFor(i, S.pour))
    .filter(i => S.arch.interventions || (S.statut === 'actives' ? i.statut !== 'terminee' : i.statut === 'terminee'));
  if (q)
    rows = rows.filter(i =>
      norm(
        [i.num, i.titre, i.type, i.constat, i.travaux, kInfo(i)?.code, kInfo(i)?.designation, ...intPers(i).map(snapLabel)].join(' ')
      ).includes(q)
    );
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.num.localeCompare(a.num));
}
/* Travaux cochés sans rapport, pour l'onglet « Fait » */
function faitsSans() {
  const q = norm(S.q.interventions || ''),
    out = [];
  for (const t of db.taches) {
    if (!live(t) || !(t.faits || []).length || !forWho(t, S.pour)) continue;
    const k = getKks(t.kksId);
    for (const f of t.faits) {
      const who = (f.who || []).map(getPers).filter(Boolean);
      if (q && !norm([t.titre, k?.code, k?.designation, assignLabel(t.assign), ...who.map(persName)].join(' ')).includes(q)) continue;
      out.push({virt: true, id: 't:' + t.id, t, k, date: f.date, num: '', who});
    }
  }
  return out;
}
VIEWS.interventions = {
  shell: travauxShell,
  list() {
    const head = wtabs(),
      openOnly = S.statut === 'actives' && !S.arch.interventions;
    const all = [...filteredInts(), ...(S.arch.interventions || openOnly ? [] : faitsSans())].sort(
      (a, b) => b.date.localeCompare(a.date) || String(b.num).localeCompare(String(a.num))
    );
    const pour = S.arch.interventions ? '' : pourSelect();
    if (!all.length) {
      const bar = pour ? `<div class="ychips">${pour}</div>` : '';
      if (S.arch.interventions) return head + empty('Aucun rapport archivé', '');
      if (S.pour)
        return (
          head +
          bar +
          empty(`Rien pour ${esc(pourLabel(S.pour))}`, '<p><button class="btn small" data-act="pour-all">Voir tout le monde</button></p>')
        );
      if (norm(S.q.interventions)) return head + bar + empty('Rien ne correspond', '');
      return (
        head +
        bar +
        (openOnly
          ? empty(
              'Rien en cours',
              `<p>Tous les rapports sont terminés.</p><button class="btn" data-act="new-int">${icon('report')}Nouveau rapport</button>`
            )
          : empty(
              'Rien de fait pour l’instant',
              `<p>Les rapports terminés et les travaux cochés arrivent ici.</p><button class="btn" data-act="new-int">${icon('report')}Nouveau rapport</button>`
            ))
      );
    }
    const yc = new Map();
    for (const i of all) {
      const y = (i.date || '').slice(0, 4) || '—';
      yc.set(y, (yc.get(y) || 0) + 1);
    }
    const years = [...yc.keys()].sort().reverse();
    const searching = !!norm(S.q.interventions);
    let y = openOnly
      ? 'all'
      : S.ryear && (S.ryear === 'all' || yc.has(S.ryear))
        ? S.ryear
        : searching || all.length <= 150
          ? 'all'
          : years[0];
    const rows = y === 'all' ? all : all.filter(i => (i.date || '').startsWith(y));
    const MO = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
      MS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const lim = S.rmore === y + norm(S.q.interventions) ? 1e9 : 400,
      shown = rows.slice(0, lim);
    const groups = [];
    for (const i of shown) {
      const k = (i.date || '').slice(0, 7);
      if (!groups.length || groups[groups.length - 1].k !== k) groups.push({k, list: []});
      groups[groups.length - 1].list.push(i);
    }
    const mcount = new Map();
    for (const i of rows) {
      const k = (i.date || '').slice(0, 7);
      mcount.set(k, (mcount.get(k) || 0) + 1);
    }
    const yrs =
      !openOnly && years.length > 1
        ? `<button role="tab" class="ychip" data-act="ryear" data-y="all" aria-selected="${y === 'all'}">Toutes <small>${all.length}</small></button>${years.map(x => `<button role="tab" class="ychip" data-act="ryear" data-y="${x}" aria-selected="${y === x}">${x} <small>${yc.get(x)}</small></button>`).join('')}`
        : '';
    const chips =
      pour || yrs
        ? `<div class="ychips" role="tablist" aria-label="Filtrer">${pour}${pour && yrs ? '<span class="ysep" aria-hidden="true"></span>' : ''}${yrs}</div>`
        : '';
    const day = d => `<span class="rday"><b>${+d.slice(8, 10) || ''}</b><small>${MS[+d.slice(5, 7) - 1] || ''}</small></span>`;
    const row = i => {
      const d = i.date || '';
      if (i.virt)
        return `<button class="rrow ${S.sel.interventions === i.id ? 'sel' : ''}" data-act="select" data-id="${i.id}">${day(d)}
        <span class="pm"><span class="pdes">${esc(i.t.titre)}</span>${i.k ? `<span class="requip"><span class="kks">${esc(i.k.code)}</span><span class="rq">${esc(i.k.designation || '')}</span></span>` : ''}<span class="ploc"><span class="norep">sans rapport</span>${
          i.who.length
            ? `<span class="muted rwho">${esc(
                i.who
                  .slice(0, 3)
                  .map(x => x.nom)
                  .join(', ')
              )}</span>`
            : ''
        }</span></span></button>`;
      const k = kInfo(i),
        who =
          intPers(i)
            .slice(0, 3)
            .map(x => x.nom)
            .join(', ') + (i.intervenants.length > 3 ? ` +${i.intervenants.length - 3}` : '');
      return `<button class="rrow ${S.sel.interventions === i.id ? 'sel' : ''}" data-act="select" data-id="${i.id}">${day(d)}
        <span class="pm"><span class="pdes">${esc(i.titre || '(sans titre)')}</span>${k?.code || k?.designation ? `<span class="requip">${k.code ? `<span class="kks">${esc(k.code)}</span>` : ''}<span class="rq">${esc(k.designation || '')}</span></span>` : ''}<span class="ploc">${i.type ? `<span>${esc(i.type)}</span>` : ''}${who ? `<span class="muted rwho">${esc(who)}</span>` : ''}</span></span>
        ${i.statut !== 'terminee' ? statutChip(i.statut) : ''}</button>`;
    };
    return `${head}${chips}${yrs ? '' : `<div class="list-bar"><span class="muted">${openOnly ? nbs(rows.length, 'rapport en cours', 'rapports en cours') : nbs(rows.length, 'rapport', 'rapports')}</span></div>`}
      <div class="rlist">${groups.map(g => `<div class="rmonth"><span>${g.k ? MO[+g.k.slice(5, 7) - 1] + ' ' + g.k.slice(0, 4) : 'Sans date'}</span><small>${mcount.get(g.k) || g.list.length}</small></div>${g.list.map(row).join('')}`).join('')}
      ${rows.length > shown.length ? `<p class="list-note"><button class="link" data-act="rmore" data-k="${esc(y + norm(S.q.interventions))}">Afficher les ${rows.length - shown.length} autres</button></p>` : ''}</div>`;
  },
  detail() {
    const sid = String(S.sel.interventions || '');
    if (sid.startsWith('t:')) {
      const keep = S.sel.taches;
      S.sel.taches = sid.slice(2);
      const h = VIEWS.taches.detail();
      S.sel.taches = keep;
      return h;
    }
    const i = getInt(sid);
    if (!i) return placeholder('report', 'Choisissez un élément de la liste.');
    const k = kInfo(i),
      T = tInfo(i);
    const names = intPers(i)
      .map(
        x =>
          `${getPers(x.id) ? `<button class="link" data-act="pers-ints" data-id="${x.id}">${esc(persName(x))}</button>` : esc(persName(x))}${x.groupe ? ` <span class="muted">(${esc(x.groupe)})</span>` : ''}`
      )
      .join(', ');
    const pills = intPers(i)
      .map(
        x =>
          `<span class="pp ${isFourId(x.id) ? 'four' : ''}">${isFourId(x.id) ? icon('truck') : ''}${getPers(x.id) ? `<button class="link" data-act="pers-ints" data-id="${x.id}" title="Tous ses rapports">${esc(persName(x))}</button>` : isFourId(x.id) ? `<button class="link" data-act="four-ints" data-name="${esc(x.id.slice(5))}" title="Tous ses rapports">${esc(persName(x))}</button>` : `<button class="link" data-act="name-ints" data-name="${esc(x.nom)}" title="Tous ses rapports">${esc(persName(x))}</button>`}${x.groupe ? `<small>${esc(x.groupe)}</small>` : ''}</span>`
      )
      .join('');
    return `${archBanner('interventions', i)}<div class="pd-head"><span class="pd-id">${esc(i.num)}</span><div class="pd-tools">${i.statut !== 'terminee' ? statutChip(i.statut) : ''}<button class="btn small" data-act="edit-int" data-id="${i.id}">${icon('edit')}${i.statut === 'terminee' ? 'Modifier' : 'Compléter'}</button>${toolBtn(['print-int', 'Imprimer', 'printer', {id: i.id}])}${toolBtn(i.arch ? ['unarch', 'Restaurer le rapport', 'archive', {col: 'interventions', id: i.id}] : ['arch', 'Archiver le rapport', 'archive', {col: 'interventions', id: i.id}])}${toolBtn(hardItem('interventions', i.id), 'danger-ghost')}</div></div>
      <h2 class="pd-title">${esc(i.titre)}</h2>
      ${k ? `<div class="equip-hero">${kTagI(i)}<span>${esc(k.designation || '')}</span></div>` : ''}
      <p class="pd-sub">${fmtD(i.date)}${i.type ? ` · ${esc(i.type)}` : ''}${i.cause ? ` · cause : ${esc(i.cause)}` : ''}${i.statut === 'terminee' ? ' · <span style="color:var(--ok)">terminé</span>' : ''}</p>
      <dl class="pd-info rep">
        ${k ? '' : '<dt>Équipement</dt><dd>—</dd>'}
        ${T ? `<dt>Tâche</dt><dd>${get('taches', i.tacheId) ? `<button class="link" data-act="goto" data-view="taches" data-id="${i.tacheId}">${esc(T.titre)}</button>` : esc(T.titre)} <span class="muted">· ${esc(T.freq)}</span></dd>` : ''}
        ${pills ? `<dt>Intervenants</dt><dd><span class="pps">${pills}</span></dd>` : ''}</dl>
      ${i.constat ? `<section class="pd-sec"><h3>${icon('report')}Constat / demande</h3><p class="pre">${esc(i.constat)}</p></section>` : ''}
      ${i.travaux ? `<section class="pd-sec"><h3>${icon('wrench')}Travaux réalisés</h3>${travauxHTML(i.travaux)}</section>` : ''}
      ${(i.points || []).length ? `<section class="pd-sec"><h3>${icon('check')}Points contrôlés <span class="muted">${i.points.filter(p => p.ok).length} / ${i.points.length}</span></h3><ul class="pts-list done">${i.points.map(p => `<li class="${p.ok ? 'ok' : 'no'}">${p.ok ? '✓' : '—'} ${esc(p.t)}</li>`).join('')}</ul></section>` : ''}
      <section class="pd-sec"><h3>${icon('camera')}Photos <span class="muted">${(i.photos || []).length || ''}</span></h3>${photoStrip(i.photos, {col: 'interventions', id: i.id})}</section>
      ${
        i.pieces.length
          ? `<section class="pd-sec"><h3>${icon('box')}Pièces utilisées <span class="muted">${i.pieces.length}</span></h3><div class="tbl-wrap"><table class="tbl compact"><tbody>${i.pieces
              .map(x => {
                const p = getPiece(x.pieceId),
                  s = lineInfo(x, i);
                return `<tr ${p ? `data-act="goto" data-view="pieces" data-id="${p.id}" tabindex="0"` : ''}><td><span class="ref">${esc(s.ref)}</span> ${esc(s.designation)}${s.lieu ? `<span class="sub">${esc(s.lieu)}</span>` : ''}</td><td class="num qty">${num(x.qte)} ${esc(s.unite || '')}</td></tr>`;
              })
              .join('')}</tbody></table></div></section>`
          : ''
      }${byLine(i)}`;
  }
};

const kksRows = rows =>
  `<div class="tbl-wrap"><table class="tbl"><tbody>${rows.map(k => `<tr data-act="select" data-id="${k.id}" class="${S.sel.kks === k.id ? 'sel' : ''}" tabindex="0"><td style="width:1%"><span class="kks">${esc(k.code)}</span></td><td>${esc(k.designation)}</td><td class="num">${k.aic ? `<span class="aic">${esc(k.aic)}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
/* Regroupement des équipements d'un système : 1HHX10… (n° de sous-ensemble), puis par type (AA vannes, AP pompes…) */
const KKS_TYPES = {
  AA: 'Vannes et robinetterie',
  AB: 'Clapets et registres',
  AC: 'Échangeurs de chaleur',
  AE: 'Levage et rotation',
  AF: 'Convoyeurs',
  AH: 'Chauffage et refroidissement',
  AJ: 'Broyage',
  AM: 'Agitateurs et mélangeurs',
  AN: 'Ventilateurs et compresseurs',
  AP: 'Pompes',
  AT: 'Filtres et nettoyage',
  AU: 'Transmissions et réducteurs',
  BB: 'Réservoirs et bâches',
  BN: 'Éjecteurs et injecteurs',
  BP: 'Diaphragmes',
  BR: 'Tuyauteries et gaines',
  BS: 'Silencieux',
  BZ: 'Supports et divers',
  CE: 'Mesures électriques',
  CF: 'Mesures de débit',
  CG: 'Mesures de position',
  CL: 'Mesures de niveau',
  CP: 'Mesures de pression',
  CQ: 'Analyses',
  CS: 'Mesures de vitesse',
  CT: 'Mesures de température',
  CY: 'Vibrations',
  CU: 'Mesures combinées'
};
const kksParts = code => {
  const m = String(code)
    .replace(/\s+/g, '')
    .match(/^(\d?)([A-Z]{3})(\d{2})([A-Z]{2})?/);
  return m ? {grp: m[1] + m[2] + m[3], unit: m[1], num: m[3], type: m[4] || ''} : {grp: '', unit: '', num: '', type: ''};
};
const typeName = t => KKS_TYPES[t] || (t[0] === 'C' ? 'Mesures' : t[0] === 'E' ? 'Signaux et automatisme' : t ? 'Autres' : 'Ensemble');
function kksGroups(rows) {
  const byCode = new Map(db.kks.map(k => [k.code.replace(/\s+/g, ''), k]));
  const groups = new Map();
  for (const k of rows) {
    const g = kksParts(k.code).grp || '—';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(k);
  }
  return `<div class="kgroups">${[...groups]
    .sort((a, b) => coll.compare(a[0].slice(1), b[0].slice(1)) || coll.compare(a[0], b[0]))
    .map(([g, ks]) => {
      const own = byCode.get(g),
        p = kksParts(g),
        open = S.grpOpen.has(g) || groups.size === 1;
      const name =
        g === '—'
          ? 'Général'
          : own
            ? own.designation
            : (() => {
                const c = ks.filter(k => /\d$/.test(k.code) && kksParts(k.code).type !== 'BR');
                return (c.length ? c : ks).map(k => k.designation).sort((x, y) => y.length - x.length)[0];
              })();
      const line = p.unit === '1' ? 'Ligne 1' : p.unit === '2' ? 'Ligne 2' : p.unit === '0' ? 'Commun' : '';
      if (ks.length === 1 && !own) return `<div class="kgrp single">${kksRows(ks)}</div>`;
      const types = new Map();
      for (const k of ks) {
        const t = kksParts(k.code).type;
        const n = typeName(t);
        if (!types.has(n)) types.set(n, []);
        types.get(n).push(k);
      }
      return `<div class="kgrp ${open ? 'open' : ''}"><button class="kgrp-h" data-act="kgrp" data-g="${esc(g)}" aria-expanded="${open}"><span class="chev ${open ? 'open' : ''}">${icon('chev')}</span><b class="code">${esc(g)}</b><span class="t">${esc(name)}</span>${line ? `<span class="chip">${line}</span>` : ''}<span class="cnt">${ks.length}</span></button>
      ${open ? [...types].map(([n, list]) => `${types.size > 1 ? `<div class="ktype">${esc(n)} <span class="muted">${list.length}</span></div>` : ''}${kksRows(list)}`).join('') : ''}</div>`;
    })
    .join('')}</div>`;
}
const kksSort = (a, b) => coll.compare(a.code.replace(/^\d+/, ''), b.code.replace(/^\d+/, '')) || coll.compare(a.code, b.code);
VIEWS.kks = {
  shell: () => `<header class="page-head"><h1>Installation</h1><div class="tools">${searchBox('kks', 'KKS, AIC ou équipement…')}
    ${menu(
      [
        ['new-kks', 'Un seul équipement', 'plus', {}],
        ['import-kks', 'Plusieurs (coller une liste)', 'list', {}]
      ],
      'Ajouter',
      'plus',
      'primary'
    )}<span class="head-tools">${toolBtn(['xl-kks', 'Exporter en Excel', 'excel', {}])}${toolBtn(archItem('kks'))}</span></div></header>
    <div class="split tsplit"><section class="pane" id="list"></section><section class="pane detail" id="detail"></section></div>`,
  list() {
    if (!db.kks.length) return empty('Aucun équipement', '<p>Ajoutez-les avec « Coller une liste ».</p>');
    if (S.arch.kks) {
      const ar = db.kks.filter(k => k.arch).sort(kksSort);
      return ar.length
        ? `<p class="list-note">${nbs(ar.length, 'équipement archivé', 'équipements archivés')}</p>${kksRows(ar)}`
        : empty('Aucun équipement archivé', '');
    }
    const q = norm(S.q.kks);
    if (q) {
      const rows = db.kks
        .filter(live)
        .filter(
          k =>
            norm(`${k.code} ${k.designation} ${k.aic || ''}`).includes(q) ||
            norm(k.code.replace(/\s+/g, '')).includes(q.replace(/\s+/g, ''))
        )
        .sort(kksSort);
      if (!rows.length) return empty('Rien ne correspond', '');
      return `<p class="list-note">${nbs(rows.length, 'équipement', 'équipements')}${rows.length > 300 ? ', les 300 premiers affichés' : ''}</p>${kksRows(rows.slice(0, 300))}`;
    }
    const k = getKks(S.sel.kks);
    if (k && S.sysAuto !== k.id) {
      S.sysAuto = k.id;
      S.sys = sysEff(k.code) || '?';
      if (S.sys !== '?') {
        S.sysExp.add(S.sys[0]);
        S.sysExp.add(S.sys.slice(0, 2));
      }
    }
    const cnt = new Map();
    for (const x of db.kks.filter(live)) {
      const c = sysEff(x.code) || '?';
      cnt.set(c, (cnt.get(c) || 0) + 1);
    }
    const s3 = [...cnt.keys()].filter(c => c !== '?').sort();
    const n = pre => s3.filter(c => c.startsWith(pre)).reduce((a, c) => a + cnt.get(c), 0);
    const node = (c, lvl, open, label) =>
      `<button class="tnode l${lvl} ${S.sys === c ? 'sel' : ''}" data-act="sys-sel" data-sys="${c}" ${lvl < 3 ? `aria-expanded="${open}"` : ''}>${lvl < 3 ? `<span class="chev ${open ? 'open' : ''}">${icon('chev')}</span>` : '<span class="tdot"></span>'}<span class="t"><b class="code">${c}</b>${label}</span><span class="cnt">${lvl < 3 ? n(c) : cnt.get(c)}</span></button>`;
    let h = '<div class="tree">';
    for (const L of [...new Set(s3.map(c => c[0]))]) {
      const o1 = S.sysExp.has(L);
      h += node(L, 1, o1, esc(sysName(L)));
      if (!o1) continue;
      for (const L2 of [...new Set(s3.filter(c => c[0] === L).map(c => c.slice(0, 2)))]) {
        const o2 = S.sysExp.has(L2);
        h += node(L2, 2, o2, esc(sysName(L2)));
        if (o2) for (const c of s3.filter(c => c.startsWith(L2))) h += node(c, 3, false, esc(sysName(c)));
      }
    }
    if (cnt.get('?'))
      h += `<button class="tnode l1 ${S.sys === '?' ? 'sel' : ''}" data-act="sys-sel" data-sys="?"><span class="tdot"></span><span class="t">Sans système</span><span class="cnt">${cnt.get('?')}</span></button>`;
    return h + '</div>';
  },
  detail() {
    const k = getKks(S.sel.kks);
    if (!k) {
      const cnt = new Map();
      for (const x of db.kks.filter(live)) {
        const c = sysEff(x.code) || '?';
        cnt.set(c, (cnt.get(c) || 0) + 1);
      }
      const n = pre => [...cnt].filter(([c]) => c !== '?' && c.startsWith(pre)).reduce((a, [, v]) => a + v, 0);
      const cur = S.sys === '?' ? '' : S.sys;
      const crumb = `<nav class="crumbs"><button class="link" data-act="sys-sel" data-sys="">Installation</button>${[...cur]
        .map((_, i) => cur.slice(0, i + 1))
        .map(
          c =>
            ` <span class="muted">›</span> ${c === cur ? `<strong>${c}</strong>` : `<button class="link" data-act="sys-sel" data-sys="${c}">${c}</button>`}`
        )
        .join('')}</nav>`;
      if (S.sys === '?' || cur.length === 3) {
        const rows = db.kks.filter(x => live(x) && (S.sys === '?' ? !sysEff(x.code) : sysEff(x.code) === S.sys)).sort(kksSort);
        return `${crumb}<div class="sys-head"><h3><b class="code">${S.sys === '?' ? '' : cur}</b>${S.sys === '?' ? 'Sans système' : esc(sysName(cur))}</h3><span class="cnt">${rows.length} équip.</span></div>
          ${rows.length ? (rows.length > 12 && S.sys !== '?' ? kksGroups(rows) : kksRows(rows)) : '<p class="empty-line" style="padding:16px 0">Aucun équipement.</p>'}`;
      }
      if (!cur) return placeholder('plant', 'Choisissez un système.');
      const kids = [...new Set([...cnt.keys()].filter(c => c !== '?' && c.startsWith(cur)).map(c => c.slice(0, cur.length + 1)))].sort();
      return `${crumb}${cur ? `<div class="sys-head"><h3><b class="code">${cur}</b>${esc(sysName(cur))}</h3><span class="cnt">${n(cur)} équip.</span></div>` : ''}
        <div class="sys-kids">${kids.map(c => `<button class="sys-kid" data-act="sys-sel" data-sys="${c}"><b class="code">${c}</b><span class="t">${esc(sysName(c)) || '<span class="muted">Sans nom</span>'}</span><span class="cnt">${n(c)}</span>${icon('chev')}</button>`).join('')}</div>`;
    }
    const ps = db.pieces.filter(p => live(p) && p.kks.includes(k.id)).sort((a, b) => coll.compare(a.designation, b.designation)),
      ints = db.interventions.filter(i => live(i) && i.kksId === k.id).sort((a, b) => b.date.localeCompare(a.date)),
      ts = db.taches.filter(t => live(t) && t.kksId === k.id);
    const nxt = ts.filter(t => t.actif !== false).sort((a, b) => a.prochaine.localeCompare(b.prochaine))[0],
      inStock = ps.filter(p => dispo(p) > 0).length,
      allI = S.kAll === k.id;
    const stat = (n, t, sub, tone = '') =>
      `<div class="kst ${tone}"><b>${n}</b><span>${t}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    return `${S.q.kks || S.arch.kks ? '' : `<button class="btn small back" data-act="kks-back">${icon('chev')}${sysEff(k.code) ? `${sysEff(k.code)} ${esc(sysName(sysEff(k.code)))}` : 'Retour'}</button>`}${archBanner('kks', k)}
      <div class="pd-head"><span class="kks big">${esc(k.code)}</span><div class="pd-tools"><button class="btn small" data-act="edit-kks" data-id="${k.id}">${icon('edit')}Modifier</button><button class="btn small" data-act="new-tache" data-kks="${k.id}">${icon('plus')}Travail</button>${toolBtn(k.arch ? ['unarch', 'Restaurer l’équipement', 'archive', {col: 'kks', id: k.id}] : ['arch', 'Archiver l’équipement', 'archive', {col: 'kks', id: k.id}])}</div></div>
      <h2 class="pd-title">${esc(k.designation)}</h2>
      <p class="pd-sub">${sysEff(k.code) ? `<button class="link" data-act="sys-sel" data-sys="${sysEff(k.code)}">${esc(sysLabel(k.code))}</button>` : '<span class="muted">Sans système</span>'}${k.aic ? ` · AIC <span class="aic">${esc(k.aic)}</span>` : ''}</p>
      <div class="kstats">${stat(ps.length, plural(ps.length, 'pièce de rechange', 'pièces de rechange'), ps.length ? `${inStock} en stock` : '', ps.length && !inStock ? 'bad' : '')}${stat(ints.length, plural(ints.length, 'rapport', 'rapports'), ints[0] ? `dernier le ${fmtD(ints[0].date)}` : '')}${stat(ts.length, plural(ts.length, 'travail', 'travaux'), nxt ? `prochaine le ${fmtD(nxt.prochaine)}` : '', nxt && daysTo(nxt.prochaine) < 0 ? 'bad' : '')}</div>
      <div class="kacts"><button class="btn primary" data-act="new-int" data-kks="${k.id}">${icon('report')}Nouveau rapport</button><button class="btn" data-act="new-tache" data-kks="${k.id}">${icon('check')}Nouveau travail</button></div>
      ${ts.length ? `<section class="pd-sec"><h3>${icon('repeat')}Tâches</h3><div class="tbl-wrap"><table class="tbl compact"><tbody>${ts.map(t => tacheRow(t, false)).join('')}</tbody></table></div></section>` : ''}
      ${(() => {
        const y = isoAdd(todayISO(), -365),
          pn = ints.filter(i => live(i) && i.date >= y && (i.cause || /correct/i.test(i.type || '')));
        if (!pn.length) return '';
        const c = new Map();
        pn.forEach(i => i.cause && c.set(i.cause, (c.get(i.cause) || 0) + 1));
        return `<p class="pannes ${pn.length >= 3 ? 'warn' : ''}">${icon('bolt')}<span><b>${pn.length} panne${pn.length > 1 ? 's' : ''}</b> en 12 mois${
          c.size
            ? ' · ' +
              [...c]
                .sort((a, b) => b[1] - a[1])
                .map(([k, n]) => `${esc(k)}${n > 1 ? ' ×' + n : ''}`)
                .join(', ')
            : ''
        }</span></p>`;
      })()}
      <section class="pd-sec"><h3>${icon('report')}Rapports <span class="muted">${ints.length || ''}</span></h3>${ints.length ? intTable(allI ? ints : ints.slice(0, 6), true) + (ints.length > 6 ? `<button class="link" data-act="k-all" data-id="${k.id}">${allI ? 'Réduire' : `Voir les ${ints.length} rapports`}</button>` : '') : '<p class="empty-line">Aucun rapport sur cet équipement.</p>'}</section>
      <section class="pd-sec"><h3>${icon('box')}Pièces de rechange <span class="muted">${ps.length || ''}</span></h3>
        ${
          ps.length
            ? `<div class="four-list">${ps
                .map(p => {
                  const mp = mainPlace(p);
                  return `<div class="kp"><button class="four-p" data-act="goto" data-view="pieces" data-id="${p.id}"><span class="pid">${esc(p.ref)}</span><span class="t">${esc(p.designation)}</span>${mp ? plate(mp, false) : ''}<span class="q ${isOut(p) ? 'zero' : ''}">${num(dispo(p))} <small>${esc(p.unite)}</small></span></button><button class="icon-btn" data-act="unlink-kks" data-piece="${p.id}" data-id="${k.id}" aria-label="Retirer ${esc(p.ref)}" title="Retirer le lien">×</button></div>`;
                })
                .join('')}</div>`
            : '<p class="empty-line">Aucune pièce liée.</p>'
        }
        <form class="inline-form" data-form="link-piece" data-kks="${k.id}"><input name="piece" list="dl-pieces" placeholder="Lier une pièce (ID ou désignation)" aria-label="Pièce à lier" autocomplete="off"><button class="btn">Lier</button></form></section>`;
  }
};

/* ---------- Signaler un problème (demande d'intervention) ----------
   N'importe qui : quoi, où (facultatif), quel métier, urgent ?, photo. Devient un petit travail marqué « Demande »,
   que le responsable du métier (Options › Rôles) ou un cadre accepte ou refuse. */
const canValidate = t =>
  canDel() || (db.reglages.resp || {})[t.assign?.type === 'groupe' ? t.assign.v : getPers(t.assign?.v)?.groupe] === meId();
function demandeHTML(t) {
  if (!t.demande) return '';
  const by = getPers(t.demande.by);
  if (t.demande.ok)
    return `<p class="dem-line">${icon('check')}<span>Demande de ${esc(by ? persName(by) : 'quelqu’un')} le ${fmtD(t.demande.at.slice(0, 10))}, acceptée${getPers(t.demande.okBy) ? ' par ' + esc(persName(getPers(t.demande.okBy))) : ''}.</span></p>`;
  return `<div class="dem-box"><p><b>Demande à valider</b> · signalée par ${esc(by ? persName(by) : 'quelqu’un')} le ${fmtD(t.demande.at.slice(0, 10))}.</p>${
    canValidate(t) && !t.arch
      ? `<div class="dem-act"><button class="btn primary" data-act="dem-ok" data-id="${t.id}">${icon('check')}Accepter</button><button class="btn" data-act="arch" data-col="taches" data-id="${t.id}">Refuser</button></div>`
      : '<p class="muted">En attente du responsable du métier.</p>'
  }</div>`;
}
function signalDialog() {
  const groups = METIERS.map(([k, lbl]) => [k, lbl, db.listes.groupes.find(g => metOf(g) === k)]).filter(x => x[2]);
  const mine = metOf(getPers(meId())?.groupe);
  dialog({
    title: 'Signaler un problème',
    saveLabel: 'Envoyer',
    body: `<label>Quel est le problème ?<input name="titre" required placeholder="ex. Fuite d’huile sous la pompe P2"></label>
      <label>Où ? <span class="muted">(repère KKS, facultatif)</span><input name="kks" data-id="" placeholder="Code ou nom de l’équipement"></label>
      <fieldset><legend>Pour quel métier ?</legend><div class="prio-pick">${groups.map(([k, lbl, g]) => `<label class="prio-o"><input type="radio" name="grp" value="${esc(g)}" ${k === mine ? 'checked' : ''}><span>${mdot(k)}${lbl}</span></label>`).join('')}</div></fieldset>
      <label class="toggle"><input type="checkbox" name="urgent"> C’est urgent</label>
      <fieldset><legend>Photo <span class="muted">(facultatif)</span></legend><div data-phwrap>${photoStrip([], {}, true)}</div></fieldset>`,
    onOpen(f, d) {
      d._photos = [];
      combo(f.elements.kks, {
        items: () =>
          db.kks.filter(live).map(x => ({
            id: x.id,
            key: x.code,
            label: kksLabel(x),
            search: x.code + ' ' + x.designation,
            html: `<span class="kks">${esc(x.code)}</span> ${esc(x.designation)}`
          }))
      });
      d.addEventListener('change', async e => {
        const inp = e.target.closest('[data-photo-pick]');
        if (!inp || !inp.files?.length) return;
        try {
          for (const fl of inp.files) d._photos.push(await photoUpload(fl, 'demandes'));
          $('[data-phwrap]', d).innerHTML = photoStrip(d._photos, {}, true);
        } catch (er) {
          toast(er.message, 'bad');
        }
      });
    },
    onSave(f, d) {
      const titre = val(f, 'titre');
      if (!titre) throw new Error('Décrivez le problème en quelques mots.');
      const kk = f.elements.kks.dataset.id ? getKks(f.elements.kks.dataset.id) : null;
      if (val(f, 'kks') && !kk) throw new Error('Repère inconnu : choisissez-le dans la liste, ou laissez vide.');
      const g = (f.querySelector('input[name=grp]:checked') || {}).value || '';
      if (!g) throw new Error('Choisissez le métier concerné (une touche).');
      const x = {
        id: uid(),
        titre,
        description: '',
        kksId: kk ? kk.id : '',
        assign: {type: 'groupe', v: g},
        freq: {n: 1, unite: 'once'},
        prochaine: '',
        actif: true,
        kind: 'petit',
        prio: f.elements.urgent.checked ? 'haute' : 'normale',
        rapport: '',
        photos: d._photos || [],
        demande: {by: meId() || '', at: new Date().toISOString(), ok: false}
      };
      tx(() => db.taches.push(x));
      render();
      toast('Merci, c’est signalé. Le responsable du métier va le prendre en charge.', '', true);
    }
  });
}

/* =====================================================================
   RÉVISION (arrêt de l'usine) : planning façon Excel « Planning révision L1 + L2 »
   — en haut « Qui est là » (présences du Planning Tridel, jour par jour),
   — en dessous les travaux de la révision (travaux marqués « pendant l'arrêt ») avec une barre par travail,
     colorée selon la ligne (L1 rouge, L2 cyan, L1 + L2 bleu, commun ambre).
   Un travail : t.arret = true, t.rev = {du, au, ligne, secteur, qui, mandat, notes{date: texte}}.
   ===================================================================== */
const REV_LIGNES = [
  ['L1', 'Ligne 1', 'l1'],
  ['L2', 'Ligne 2', 'l2'],
  ['L12', 'L1 + L2', 'l12'],
  ['commun', 'Commun', 'com']
];
const revLigneOf = v => {
  const n = norm(v || '').replace(/\s/g, '');
  return n === 'l1' ? 'L1' : n === 'l2' ? 'L2' : n.includes('l1') && n.includes('l2') ? 'L12' : n === 'l12' ? 'L12' : 'commun';
};
const revLcls = l => (REV_LIGNES.find(x => x[0] === l) || REV_LIGNES[3])[2];
/* Jours fériés vaudois (Pâques par la méthode de Meeus) */
const FERIES = {};
function feriesVD(y) {
  if (FERIES[y]) return FERIES[y];
  const a = y % 19,
    b = Math.floor(y / 100),
    c = y % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    mo = Math.floor((h + l - 7 * m + 114) / 31),
    da = ((h + l - 7 * m + 114) % 31) + 1;
  const p = `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
  const sept1 = new Date(y, 8, 1).getDay(),
    jeune = 1 + ((7 - sept1) % 7) + 14 + 1; /* lundi après le 3e dimanche de septembre */
  return (FERIES[y] = new Set([
    `${y}-01-01`,
    `${y}-01-02`,
    isoAdd(p, -2),
    isoAdd(p, 1),
    isoAdd(p, 39),
    isoAdd(p, 50),
    `${y}-08-01`,
    `${y}-09-${String(jeune).padStart(2, '0')}`,
    `${y}-12-25`
  ]));
}
const isFerie = d => feriesVD(+d.slice(0, 4)).has(d);
const isWE = d => [0, 6].includes(new Date(d + 'T12:00:00').getDay());
const revJobs = () => db.taches.filter(t => live(t) && t.arret);
/* Petit bouton « masquer / réafficher » au bout d'une ligne (personne ou travail), gardé avec le compte */
const revHideBtn = (k, id, hid, name) =>
  `<button class="rx" data-act="rev-hide" data-k="${k}" data-id="${id}" title="${hid ? 'Réafficher' : 'Masquer'} ${esc(name)}" aria-label="${hid ? 'Réafficher' : 'Masquer'} ${esc(name)}">${icon(hid ? 'plus' : 'eyeoff')}</button>`;
/* Période affichée : dates de la révision de l'année choisie, une semaine avant et après */
/* Année d'un travail de révision : sa date, sinon l'année notée à sa création, sinon l'année de l'import */
const revOldYear = () =>
  revJobs()
    .map(t => (t.rev?.du || '').slice(0, 4))
    .filter(Boolean)
    .sort()[0] || todayISO().slice(0, 4);
const revYearOf = t => (t.rev?.du || '').slice(0, 4) || t.rev?.annee || revOldYear();
const revDatesOf = y =>
  revJobs()
    .filter(t => revYearOf(t) === y)
    .flatMap(t => [t.rev?.du, t.rev?.au])
    .filter(Boolean)
    .sort();
/* Année affichée par défaut : la révision en cours ou à venir ; une fois celle de l'année passée, l'année suivante */
function revDefaultYear() {
  const t = todayISO(),
    A = arretsAll(),
    up = Object.entries(A)
      .filter(([, a]) => a?.au >= t)
      .sort((x, y) => x[1].du.localeCompare(y[1].du))[0];
  if (up) return up[0];
  const y = t.slice(0, 4),
    end = A[y]?.au || revDatesOf(y).pop();
  return end && end < t ? String(+y + 1) : y;
}
const revY = () => (/^\d{4}$/.test(S.revY || '') ? S.revY : revDefaultYear());
function revYears() {
  const ys = new Set([...Object.keys(arretsAll()), ...revJobs().map(revYearOf), revDefaultYear(), revY(), String(+todayISO().slice(0, 4) + 1)]);
  return [...ys].filter(y => /^\d{4}$/.test(y)).sort();
}
/* Période d'une année : dates fixées, sinon d'après ses travaux, sinon estimée d'après l'année d'avant (mêmes semaines) */
function revPeriod(y) {
  const A = arretsAll();
  if (A[y]?.du) return {du: A[y].du, au: A[y].au, src: 'fixe'};
  const ds = revDatesOf(y);
  if (ds.length) return {du: ds[0], au: ds[ds.length - 1], src: 'travaux'};
  const py = String(+y - 1),
    pd = revDatesOf(py),
    p = A[py]?.du ? A[py] : pd.length ? {du: pd[0], au: pd[pd.length - 1]} : null;
  return p ? {du: isoAdd(p.du, 364), au: isoAdd(p.au, 364), src: 'estime', from: py} : null;
}
/* Jours affichés : la période, avec une semaine avant et après (réglable), en commençant un lundi */
function revRange(y = revY()) {
  const p = revPeriod(y),
    ds = revDatesOf(y);
  let du = p ? p.du : `${y}-05-03`,
    au = p ? p.au : isoAdd(du, 55);
  if (ds[0] && ds[0] < du) du = ds[0];
  if (ds.length && ds[ds.length - 1] > au) au = ds[ds.length - 1];
  const pad = pref('revPad', true) ? 7 : 0;
  du = isoAdd(du, -pad);
  au = isoAdd(au, pad);
  du = isoAdd(du, -((new Date(du + 'T12:00:00').getDay() + 6) % 7));
  const n = Math.min(210, Math.max(7, daysBetween(du, au) + 1));
  return Array.from({length: n}, (_, i) => isoAdd(du, i));
}
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
/* Qui fait le travail : texte libre (équipe, entreprise) ; relié à un corps de métier ou une entreprise si on le reconnaît */
function revAssign(q) {
  const n = norm(q || '');
  const met = /electri/.test(n)
    ? 'elec'
    : /mecani/.test(n)
      ? 'meca'
      : /intendance|entretien/.test(n)
        ? 'intend'
        : /automat|informat/.test(n)
          ? 'auto'
          : '';
  if (met) {
    const g = db.listes.groupes.find(x => metOf(x) === met);
    if (g) return {type: 'groupe', v: g};
  }
  const f = q && !/^equipe/i.test(norm(q)) ? fourMatch(q, db.listes.fournisseurs) : null;
  return f ? {type: 'four', v: f} : {type: 'groupe', v: ''};
}
VIEWS.revision = {
  shell:
    () => `<header class="page-head"><h1>Révision</h1><div class="tools">${searchBox('revision', 'Rechercher : travail, secteur, qui…')}<button class="btn primary" data-act="rev-new">${icon('plus')}Travail de révision</button><span class="head-tools">${toolBtn(['arret-dates', 'Dates de la révision', 'calendar', {}])}${canDel() ? toolBtn(['rev-import', 'Importer le planning de révision (fichier préparé)', 'save', {}]) : ''}</span></div></header>
    <section class="pane rev" id="list"></section>`,
  list() {
    const y = revY(),
      days = revRange(y),
      today = todayISO(),
      L = S.revL || '',
      q = norm(S.q.revision || ''),
      showP = pref('revPpl', true),
      hideP = new Set(pref('revHideP', [])),
      hideT = new Set(pref('revHideT', [])),
      showHid = !!S.revShowHid,
      QUI = S.revQui || '';
    const yJobs = revJobs().filter(t => revYearOf(t) === y),
      quiOf = t => t.rev?.qui || (t.assign?.v ? assignLabel(t.assign) : '');
    for (const y of new Set(days.map(d => d.slice(0, 4)))) loadPresence(y);
    const jobs = yJobs
      .filter(t => showHid || !hideT.has(t.id))
      .filter(t => !QUI || quiOf(t) === QUI)
      .filter(t => !L || (t.rev?.ligne || 'commun') === L)
      .filter(t => !q || norm([t.titre, t.rev?.secteur, t.rev?.qui, assignLabel(t.assign), t.rev?.mandat].join(' ')).includes(q))
      .sort((a, b) => (a.rev?.du || '9').localeCompare(b.rev?.du || '9') || coll.compare(a.titre, b.titre));
    const dcls = d => [isWE(d) ? 'we' : '', isFerie(d) ? 'fer' : '', d === today ? 'auj' : ''].join(' ');
    /* en-tête : semaines puis jours */
    const weeks = [];
    for (const d of days) {
      const w = isoWeek(d);
      if (!weeks.length || weeks[weeks.length - 1][0] !== w) weeks.push([w, 0, d]);
      weeks[weeks.length - 1][1]++;
    }
    const MO = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const DJ = ['di', 'lu', 'ma', 'me', 'je', 've', 'sa'];
    const head = `<thead><tr class="rw"><th class="rl" rowspan="2"><span class="rcount">${nbs(jobs.length, 'travail', 'travaux')}</span></th>${weeks.map(([w, n, d]) => `<th colspan="${n}">sem. ${w} <small>${+d.slice(8)} ${MO[+d.slice(5, 7) - 1]}</small></th>`).join('')}</tr>
      <tr class="rd">${days.map(d => `<th class="${dcls(d)}" title="${esc(fmtD(d))}${isFerie(d) ? ' · férié' : ''}">${DJ[new Date(d + 'T12:00:00').getDay()]}<b>${+d.slice(8)}</b></th>`).join('')}</tr></thead>`;
    /* Qui est là */
    let ppl = '';
    if (showP) {
      const persons = db.personnes.filter(p => live(p) && p.actif !== false && (showHid || !hideP.has(p.id))),
        groups = db.listes.groupes.filter(g => persons.some(p => p.groupe === g));
      const cnt = days.map(d => persons.filter(p => !hideP.has(p.id) && isDispo(presOf(p, d)?.code)).length);
      ppl = `<tbody class="rp"><tr class="rsec"><th class="rl">${icon('person')}Qui est là <button class="link" data-act="rev-ppl">Masquer</button></th>${cnt.map((n, i) => `<td class="rn ${dcls(days[i])}">${n || ''}</td>`).join('')}</tr>${groups
        .map(
          g =>
            `<tr class="rg"><th class="rl">${mdot(metOf(g))}${esc(g)}</th>${days.map(d => `<td class="${dcls(d)}"></td>`).join('')}</tr>${persons
              .filter(p => p.groupe === g)
              .sort(persSort)
              .map(
                p =>
                  `<tr class="rpp ${hideP.has(p.id) ? 'hid' : ''}"><th class="rl"><span class="rln" title="${esc(persName(p))}">${esc(persName(p))}</span>${revHideBtn('p', p.id, hideP.has(p.id), persName(p))}</th>${days
                    .map(d => {
                      const c = presOf(p, d)?.code || '';
                      return !c || c === '0'
                        ? `<td class="${dcls(d)}"></td>`
                        : isDispo(c)
                          ? `<td class="ok ${dcls(d)}" title="${esc(persName(p))} : présent (${esc(c)})"><i></i></td>`
                          : `<td class="ab ${dcls(d)}" title="${esc(persName(p))} : ${esc((PCODE[c] || [c])[0])}">${esc(c)}</td>`;
                    })
                    .join('')}</tr>`
              )
              .join('')}`
        )
        .join('')}</tbody>`;
    }
    /* Travaux */
    const rows = jobs
      .map((t, n) => {
        const r = t.rev || {},
          lc = revLcls(r.ligne || 'commun'),
          who = r.qui || assignLabel(t.assign),
          off = t.actif === false,
          pick = S.revPick === t.id;
        return `<tr class="rj ${off ? 'done' : ''} ${pick ? 'pick' : ''} ${hideT.has(t.id) ? 'hid' : ''}"><th class="rl" title="${esc(t.titre)}${who && who !== 'Non attribuée' ? ' · ' + esc(who) : ''}"><button class="rt" data-act="rev-edit" data-id="${t.id}"><span class="rno">${n + 1}</span><span class="rti"><b>${esc(t.titre)}</b><small><span class="rlg ${lc}">${esc((REV_LIGNES.find(x => x[0] === (r.ligne || 'commun')) || REV_LIGNES[3])[1])}</span>${r.secteur ? esc(r.secteur) + ' · ' : ''}${esc(who === 'Non attribuée' ? '' : who)}</small></span>${off ? `<span class="rok">${icon('check')}</span>` : ''}</button>${revHideBtn('t', t.id, hideT.has(t.id), t.titre)}</th>${days
          .map(d => {
            const inb = r.du && d >= r.du && d <= r.au,
              note = r.notes?.[d] || '';
            return `<td class="rc ${dcls(d)} ${inb ? 'on ' + lc + (d === r.du ? ' s' : '') + (d === r.au ? ' e' : '') : ''}" data-act="rev-day" data-id="${t.id}" data-d="${d}">${note ? `<span>${esc(note)}</span>` : ''}</td>`;
          })
          .join('')}</tr>`;
      })
      .join('');
    const quis = [...new Set(yJobs.map(quiOf).filter(x => x && x !== 'Non attribuée'))].sort(coll.compare),
      nHid = yJobs.filter(t => hideT.has(t.id)).length + db.personnes.filter(p => hideP.has(p.id)).length,
      per = revPeriod(y),
      MOL = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
      dl = d => `${+d.slice(8)} ${MOL[+d.slice(5, 7) - 1]}`;
    const chips = `<div class="fchips rev-f" role="group" aria-label="Révision">${revYears()
      .map(v => `<button class="ychip" data-act="rev-y" data-v="${v}" aria-pressed="${v === y}">${v}</button>`)
      .join(
        ''
      )}<span class="rev-per">${per ? `${icon('calendar')}<b>${dl(per.du)} – ${dl(per.au)}</b>${per.src === 'estime' ? ` <span class="muted">estimée d’après ${per.from}</span>` : ''}` : '<span class="muted">Dates à fixer</span>'} <button class="link" data-act="arret-dates">${per?.src === 'fixe' ? 'Changer' : 'Fixer les dates'}</button></span></div>
      <div class="fchips rev-f2" role="group" aria-label="Filtres">${[['', 'Tout'], ...REV_LIGNES.map(x => [x[0], x[1]])].map(([v, l]) => `<button class="ychip" data-act="rev-l" data-v="${v}" aria-pressed="${L === v}">${v ? `<i class="rlg-d ${revLcls(v)}"></i>` : ''}${l}</button>`).join('')}${
        quis.length
          ? `<select class="mini pour ${QUI ? 'on' : ''}" data-change="revqui" aria-label="Entreprise ou équipe"><option value="">Toutes les entreprises</option>${quis.map(x => opt(x, x, QUI)).join('')}</select>`
          : ''
      }<span class="ysep" aria-hidden="true"></span><button class="ychip" data-act="rev-pad" aria-pressed="${pref('revPad', true)}" title="Afficher aussi la semaine avant et la semaine après">± 1 semaine</button>${showP ? '' : `<button class="ychip" data-act="rev-ppl">${icon('person')}Qui est là</button>`}${
        nHid
          ? `<button class="ychip" data-act="rev-showhid" aria-pressed="${showHid}">${showHid ? 'Cacher les masqués' : `Masqués <small>${nHid}</small>`}</button>`
          : ''
      }${S.revPick ? `<span class="rev-hint">${icon('calendar')}Cliquez le dernier jour de « ${esc(get('taches', S.revPick)?.titre || '')} » <button class="link" data-act="rev-cancel">Annuler</button></span>` : ''}</div>`;
    return `${chips}<div class="rev-scroll"><table class="revg">${head}${ppl}<tbody class="rjs"><tr class="rsec"><th class="rl">${icon('wrench')}Travaux de la révision</th>${days.map(d => `<td class="${dcls(d)}"></td>`).join('')}</tr>${rows || `<tr><th class="rl muted">Aucun travail : « Travail de révision » pour en ajouter.</th>${days.map(d => `<td class="${dcls(d)}"></td>`).join('')}</tr>`}</tbody></table></div>`;
  },
  detail: () => ''
};
/* Fenêtre d'un travail de révision : simple et concret */
function revDialog(t) {
  const isNew = !t,
    r = t?.rev || {},
    days = revRange();
  const secteurs = [
      ...new Set(
        revJobs()
          .map(x => x.rev?.secteur)
          .filter(Boolean)
      )
    ].sort(coll.compare),
    quis = [
      ...new Set([
        ...revJobs()
          .map(x => x.rev?.qui)
          .filter(Boolean),
        ...db.listes.groupes.map(g => 'Équipe ' + g.toLowerCase()),
        ...db.listes.fournisseurs
      ])
    ].sort(coll.compare);
  dialog({
    title: isNew ? 'Travail de révision' : 'Modifier le travail',
    cls: 'tdlg',
    body: `<input class="t-title" name="titre" value="${esc(t?.titre || '')}" required placeholder="Quel travail ? ex. Vidange chaudière" aria-label="Quel travail ?" autocomplete="off">
      <div class="fgrp"><span class="fl">${icon('plant')}Ligne</span><div class="pills" role="radiogroup" aria-label="Ligne">${REV_LIGNES.map(([v, l, c]) => sp('ligne', v, `<i class="rlg-d ${c}"></i>${l}`, r.ligne || 'commun')).join('')}</div></div>
      <div class="grid2"><label>Secteur<input name="secteur" list="dl-rsect" value="${esc(r.secteur || '')}" placeholder="ex. chaudière, laveur…" autocomplete="off"></label><label>Qui ?<input name="qui" list="dl-rqui" value="${esc(r.qui || (t ? assignLabel(t.assign).replace('Non attribuée', '') : ''))}" placeholder="Équipe ou entreprise" autocomplete="off"></label></div>
      <datalist id="dl-rsect">${secteurs.map(x => `<option value="${esc(x)}">`).join('')}</datalist><datalist id="dl-rqui">${quis.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
      <div class="grid2"><label>Du<input name="du" type="date" value="${esc(r.du || '')}"></label><label>Au<input name="au" type="date" value="${esc(r.au || '')}"></label></div>
      <details class="more" ${r.mandat || t?.description ? 'open' : ''}><summary>${icon('chev')}Mandat et consignes</summary>
      <label>Mandat / n° de tâche<input name="mandat" value="${esc(r.mandat || '')}" autocomplete="off"></label>
      <label>Consignes<textarea name="description" rows="3">${esc(t?.description || '')}</textarea></label></details>`,
    del: isNew ? null : archDel('taches', t, () => HARD.taches(t)),
    onOpen(f) {
      if (isNew) setTimeout(() => f.elements.titre.focus(), 30);
    },
    onSave(f) {
      const titre = val(f, 'titre');
      if (!titre) throw new Error('Indiquez le travail.');
      let du = val(f, 'du'),
        au = val(f, 'au') || du;
      if (du && au < du) [du, au] = [au, du];
      const qui = val(f, 'qui'),
        rev = {
          ...r,
          ligne: f.querySelector('input[name=ligne]:checked')?.value || 'commun',
          secteur: val(f, 'secteur'),
          qui,
          mandat: val(f, 'mandat'),
          du,
          au,
          annee: (du || '').slice(0, 4) || r.annee || revY()
        };
      tx(() => {
        if (isNew) {
          const x = {
            id: uid(),
            titre,
            kind: 'petit',
            freq: {n: 1, unite: 'once'},
            prio: 'normale',
            actif: true,
            arret: true,
            rapport: 'oui',
            assign: revAssign(qui),
            prochaine: du || '',
            description: val(f, 'description'),
            kksId: '',
            rev
          };
          db.taches.push(x);
        } else
          Object.assign(t, {
            titre,
            description: val(f, 'description'),
            assign: qui !== r.qui ? revAssign(qui) : t.assign,
            prochaine: du || t.prochaine,
            rev
          });
      });
      render();
      toast(isNew ? 'Travail ajouté à la révision' : 'Enregistré');
    }
  });
}
/* Import du planning de révision préparé depuis l'Excel (fichier JSON, jamais dans le dépôt) */
function revImportDialog() {
  dialog({
    title: 'Importer le planning de révision',
    saveLabel: 'Importer',
    body: `<p>Choisissez le fichier <span class="mono">revision-triflow.json</span> préparé à partir du planning Excel. Les travaux déjà présents (même titre, même ligne, même secteur) ne sont pas ajoutés deux fois.</p><label>Fichier<input type="file" name="file" accept=".json,application/json"></label><p class="hint" data-prev></p>`,
    onOpen(f, d) {
      f.elements.file.addEventListener('change', async () => {
        try {
          d._j = JSON.parse(await f.elements.file.files[0].text());
          $('[data-prev]', d).textContent =
            `${nbs((d._j.travaux || []).length, 'travail', 'travaux')} du ${fmtD(d._j.debut)} au ${fmtD(d._j.fin)}`;
        } catch (e) {
          d._j = null;
          $('[data-prev]', d).textContent = 'Fichier illisible.';
        }
      });
    },
    onSave(f, d) {
      const j = d._j;
      if (!j || !Array.isArray(j.travaux)) throw new Error('Choisissez le fichier revision-triflow.json.');
      const key = (titre, ligne, secteur) => norm([titre, ligne, secteur].join('|'));
      const have = new Set(revJobs().map(t => key(t.titre, t.rev?.ligne, t.rev?.secteur)));
      let n = 0;
      tx(() => {
        for (const w of j.travaux) {
          const ligne = revLigneOf(w.ligne),
            k = key(w.titre, ligne, w.secteur);
          if (!w.titre || have.has(k)) continue;
          have.add(k);
          db.taches.push({
            id: uid(),
            titre: w.titre,
            kind: 'petit',
            freq: {n: 1, unite: 'once'},
            prio: 'normale',
            actif: true,
            arret: true,
            rapport: 'oui',
            assign: revAssign(w.qui),
            prochaine: w.du || '',
            description: '',
            kksId: '',
            rev: {
              ligne,
              secteur: w.secteur || '',
              qui: w.qui || '',
              mandat: [w.mandat, w.tache].filter(Boolean).join(' · '),
              du: w.du || '',
              au: w.au || w.du || '',
              annee: (w.du || j.debut || todayISO()).slice(0, 4),
              notes: w.notes || {}
            }
          });
          n++;
        }
        if (j.debut && j.fin && !arretsAll()[j.debut.slice(0, 4)]) {
          db.reglages.arrets = {...arretsAll(), [j.debut.slice(0, 4)]: {du: j.debut, au: j.fin}};
          delete db.reglages.arret;
        }
      });
      render();
      toast(`${nbs(n, 'travail importé', 'travaux importés')} dans la révision`);
    }
  });
}
