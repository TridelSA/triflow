'use strict';
/* TriFlow — Pages : travaux (tâches et rapports), installation (KKS). (Fichiers chargés dans l'ordre par index.html.) */
/* ---------- Travaux : une seule page en trois étapes ----------
   À faire = les tâches (une seule fois ou qui reviennent) ; En cours = rapports pas terminés ;
   Fait = rapports terminés + travaux cochés sans rapport (t.faits : [{date, who:[ids]}]).
   t.rapport : '' = demander à chaque fois, 'oui' = toujours un rapport, 'non' = jamais. */
const wTab = () => S.view === 'taches' ? 'afaire' : S.statut === 'actives' ? 'encours' : 'fait';
function wtabs(){
  if (S.arch[S.view]) return '';
  const nT = db.taches.filter(t => live(t) && t.actif !== false && forWho(t, S.pour)).length, nE = db.interventions.filter(i => live(i) && i.statut !== 'terminee' && intFor(i, S.pour)).length, w = wTab();
  const b = (k, ic, t, n) => `<button role="tab" data-act="wtab" data-w="${k}" aria-selected="${w === k}">${icon(ic)}${t}${n != null ? ` <small>${n}</small>` : ''}</button>`;
  return `<div class="ttabs wtabs" role="tablist" aria-label="Étape">${b('afaire', 'list', 'À faire', nT)}${b('encours', 'wrench', 'En cours', nE)}${b('fait', 'check', 'Fait')}</div>`;
}
function travauxShell(){
  const t = S.view === 'taches';
  return `<header class="page-head"><h1>Travaux</h1><div class="tools">${searchBox(t ? 'taches' : 'interventions', t ? 'Rechercher un travail…' : 'Rechercher un rapport…')}
    ${t ? `<button class="btn primary" data-act="new-tache">${icon('plus')}Nouveau travail</button>` : `<button class="btn primary" data-act="new-int">${icon('plus')}Nouveau rapport</button>`}
    ${menu(t ? [['new-int', 'Nouveau rapport (travail imprévu)', 'report', {}], ['print-taches', 'Imprimer la liste de travail', 'printer', {}], ['xl-taches', 'Exporter la liste (Excel)', 'excel', {}], '-', archItem('taches')] : [['xl-ints', 'Exporter la liste (Excel)', 'excel', {}], archItem('interventions'), '-', ['import-travaux', 'Importer depuis CareOffice (fichier)', 'save', {}]])}</div></header>
    <div class="split"><section class="pane" id="list"></section><section class="pane detail" id="detail"></section></div>`;
}
const doneOn = (t, d) => db.interventions.some(i => i.tacheId === t.id && i.date === d) || (t.faits || []).some(f => f.date === d);
const nextAfter = (t, d) => { if (isPetit(t)) return ''; let n = t.prochaine; do { n = addFreq(n, t.freq.n, t.freq.unite); } while (n <= d); return n; };
/* « C'est fait » : rapport toujours, jamais, ou on demande */
function doTache(t, opts = {}){
  if (!t) return;
  const run = openRun(t); if (run) return interventionDialog(run);
  if (t.rapport === 'oui') return interventionDialog(null, null, t, opts);
  if (t.rapport === 'non') return finishTask(t, opts);
  const nx = nextAfter(t, opts.date || todayISO());
  dialog({title:'C’est fait', saveLabel:'Fermer', info:true, body:`<p class="task-note">${icon('check')}<span><b>${esc(t.titre)}</b>${nx ? ` · reviendra le ${fmtD(nx)}` : ''}</span></p>
    <p class="hint" style="margin:0 0 8px">Faut-il un rapport ?</p><div class="kind-pick">
      <button type="button" class="kind" data-r="non">${icon('check')}<b>Non, juste cocher</b><span>Pour les petites choses : une ampoule, un nettoyage…</span></button>
      <button type="button" class="kind" data-r="oui">${icon('report')}<b>Oui, faire un rapport</b><span>Noter ce qui a été fait, les pièces utilisées, qui était là.</span></button></div>
    <label class="toggle" style="margin-top:12px"><input type="checkbox" name="keep"> Retenir mon choix pour ce travail</label>`,
    onOpen(f, d){ $$('[data-r]', d).forEach(b => b.onclick = () => { const r = b.dataset.r, keep = f.elements.keep.checked; d.close();
      if (r === 'non') return finishTask(t, opts, keep ? 'non' : null);
      if (keep) tx(() => { t.rapport = 'oui'; });
      interventionDialog(null, null, t, opts); }); }, onSave(){}});
}
function finishTask(t, opts = {}, setRap = null){
  const date = opts.date || todayISO(), me = meId(), who = [...new Set([...(opts.who || []), ...(me ? [me] : [])])].filter(id => getPers(id));
  tx(() => { if (setRap) t.rapport = setRap; t.faits = [...(t.faits || []), {date, who}]; advanceTask(t, date); });
  render(); toast(isPetit(t) ? `Fait : ${t.titre}` : `Fait · prochaine fois le ${fmtD(t.prochaine)}`, '', true);
}
function doneHTML(t){
  const reps = db.interventions.filter(i => i.tacheId === t.id && live(i)), fs = t.faits || [];
  if (!reps.length && !fs.length) return '<p class="empty-line">Pas encore fait.</p>';
  const names = ids => (ids || []).map(id => getPers(id)).filter(Boolean).map(persName).join(', ');
  const rows = [...reps.map(i => ({d:i.date, h:`<tr data-act="goto" data-view="interventions" data-id="${i.id}" tabindex="0"><td class="ref">${esc(i.num)}</td><td>${esc(i.titre || '(sans titre)')}<span class="sub">${fmtD(i.date)}</span></td><td class="num">${i.statut !== 'terminee' ? statutChip(i.statut) : ''}</td></tr>`})),
    ...fs.map(f => ({d:f.date, h:`<tr><td class="ref">—</td><td>Fait, sans rapport<span class="sub">${fmtD(f.date)}${names(f.who) ? ' · ' + esc(names(f.who)) : ''}</span></td><td></td></tr>`}))].sort((a, b) => b.d.localeCompare(a.d));
  return `<div class="tbl-wrap"><table class="tbl compact itbl"><tbody>${rows.map(r => r.h).join('')}</tbody></table></div>`;
}
/* Quand ? : regroupement des travaux à faire */
const tKey = t => { if (t.actif === false) return 'fait'; if (!t.prochaine) return 'asap'; const n = daysTo(t.prochaine); return n < -365 ? 'vieux' : n < 0 ? 'retard' : n <= 7 ? 'semaine' : 'plus'; };
const T_GRP = [['retard', 'En retard', 'bad'], ['semaine', 'Cette semaine', 'warn'], ['asap', 'Dès que possible', ''], ['plus', 'Plus tard', ''], ['vieux', 'En retard depuis plus d’un an', '']];
function baseTaches(){
  let rows = db.taches.filter(t => S.arch.taches ? t.arch : !t.arch).filter(t => S.arch.taches || forWho(t, S.pour));
  const q = norm(S.q.taches || '');
  if (q) rows = rows.filter(t => norm([t.titre, t.description, getKks(t.kksId)?.code, getKks(t.kksId)?.designation, assignLabel(t.assign)].join(' ')).includes(q));
  return rows;
}
function filteredTaches(){
  const rows = baseTaches().filter(t => S.arch.taches || (S.tf ? tKey(t) === S.tf : t.actif !== false));
  return rows.sort((a, b) => (a.actif === false) - (b.actif === false) || (a.prochaine && b.prochaine ? a.prochaine.localeCompare(b.prochaine) : 0) || petitSort(a, b));
}
function pourSelect(){
  const groups = db.listes.groupes.filter(g => db.personnes.some(p => p.groupe === g && p.actif !== false));
  const people = db.personnes.filter(p => p.actif !== false && live(p)).sort(persSort);
  return `<select class="mini pour ${S.pour ? 'on' : ''}" data-change="pour" aria-label="Pour qui" title="${S.pour ? 'Filtre actif : choisissez « Tout le monde » pour tout voir' : ''}"><option value="">Tout le monde</option><optgroup label="Corps de métier">${groups.map(g => opt('g:' + g, g, S.pour)).join('')}</optgroup><optgroup label="Personne">${people.map(p => opt('p:' + p.id, persName(p), S.pour)).join('')}</optgroup></select>`;
}
function tacheRow(t, withSel = true){
  const k = getKks(t.kksId), run = openRun(t), off = t.actif === false;
  return `<tr data-act="${withSel ? 'select' : 'goto'}" ${withSel ? '' : 'data-view="taches"'} data-id="${t.id}" class="${withSel && S.sel.taches === t.id ? 'sel' : ''}" tabindex="0">
    <td><span class="des">${esc(t.titre)}</span><span class="sub">${k ? esc(k.code) + ' · ' : ''}${esc(assignLabel(t.assign))}${isPetit(t) ? '' : ` · <span class="rep">${icon('repeat')}${esc(freqLabel(t.freq))}</span>`}</span>${!off && !run ? `<span class="mdue">${dueInfo(t).chip}</span>` : ''}</td>
    <td class="num"><span class="trow-r">${off ? '<span class="chip ok">Fait</span>' : run ? '<span class="chip info">En cours</span>' : dueInfo(t).chip}${!off && !run && !t.arch ? `<button class="tick" data-act="do-tache" data-id="${t.id}" title="C’est fait" aria-label="C’est fait : ${esc(t.titre)}">${icon('check')}</button>` : ''}</span></td></tr>`;
}
VIEWS.taches = {
  shell: travauxShell,
  list(){
    const head = wtabs();
    if (!db.taches.length) return head + empty('Rien à faire', '<p>Ajoutez un travail avec « Nouveau travail » : une réparation, un contrôle, un entretien qui revient…</p>');
    const rows = filteredTaches(), base = S.arch.taches ? [] : baseTaches().filter(t => t.actif !== false);
    const cnt = {}; for (const t of base){ const k = tKey(t); cnt[k] = (cnt[k] || 0) + 1; }
    const chip = (f, t, n, tone = '') => f && !n && S.tf !== f ? '' : `<button role="tab" class="ychip ${tone}" data-act="tf" data-f="${f}" aria-selected="${(S.tf || '') === f}">${t} <small>${n || 0}</small></button>`;
    const chips = S.arch.taches ? '' : `<div class="fchips" role="tablist" aria-label="Quand">${pourSelect()}<span class="ysep" aria-hidden="true"></span>${chip('', 'Tout', base.length)}${T_GRP.map(([k, l, tone]) => chip(k, k === 'vieux' ? 'Anciens retards' : l, cnt[k], tone)).join('')}</div>`;
    if (!rows.length) return head + chips + (S.arch.taches ? empty('Aucun travail archivé', '') : empty('Rien à faire', '<p>Aucun travail pour cette sélection.</p>'));
    const grp = {}; rows.forEach(t => (grp[tKey(t)] ||= []).push(t));
    const sec = (key, title) => grp[key]?.length ? `<tbody><tr class="grp ${key === 'vieux' ? 'old' : ''}"><th colspan="2"><span>${title}</span> <span class="muted" style="font-family:var(--f-body);font-size:.8rem">${grp[key].length}</span></th></tr>${grp[key].map(t => tacheRow(t)).join('')}</tbody>` : '';
    return `${head}${chips}<div class="tbl-wrap"><table class="tbl">${T_GRP.map(([k, l]) => sec(k, l)).join('')}${sec('fait', 'Faits')}</table></div>`;
  },
  detail(){
    const t = get('taches', S.sel.taches);
    if (!t) return placeholder('check', 'Choisissez un travail pour le faire, voir quand il a été fait ou le modifier.');
    const k = getKks(t.kksId), run = openRun(t), last = [...db.interventions.filter(i => i.tacheId === t.id && live(i)).map(i => i.date), ...(t.faits || []).map(f => f.date)].sort().pop();
    const off = t.actif === false, di = dueInfo(t), RAP = {oui:'avec rapport', non:'sans rapport'};
    return `${archBanner('taches', t)}<div class="pd-head"><span class="pd-id">${isPetit(t) ? 'Une seule fois' + (prioOf(t) !== 'normale' ? ' · priorité ' + PRIO[prioOf(t)][0].toLowerCase() : '') : esc(freqLabel(t.freq))}</span><div class="pd-tools"><button class="btn small" data-act="edit-tache" data-id="${t.id}">${icon('edit')}Modifier</button>${menu([t.arch ? ['unarch', 'Restaurer', 'archive', {col:'taches', id:t.id}] : ['arch', 'Archiver', 'archive', {col:'taches', id:t.id}], hardItem('taches', t.id)].filter(Boolean), 'Plus', 'more', 'small')}</div></div>
      <h2 class="pd-title">${esc(t.titre)}</h2>
      ${k ? `<div class="equip-hero">${kksTag(k)}<span>${esc(k.designation || '')}</span></div>` : ''}
      <p class="pd-sub">${t.assign?.v ? `Pour <strong style="font-weight:600">${esc(assignLabel(t.assign))}</strong>` : '<span class="muted">Pour personne en particulier</span>'}${last ? ` · fait la dernière fois le ${fmtD(last)}` : ''}${RAP[t.rapport] ? ` · ${RAP[t.rapport]}` : ''}</p>
      <div class="pd-stock ${!off && (di.k === 'retard' || tKey(t) === 'retard') ? 'late' : ''}">
        <div class="pd-qty">${off ? '<span class="l" style="font-size:1rem">Fait</span>' : isPetit(t) ? `<span class="l">${t.prochaine ? 'Pour le' : 'Quand ?'}</span>${t.prochaine ? `<span class="n" style="font-size:1.5rem">${fmtD(t.prochaine)}</span>` : '<span class="n" style="font-size:1.2rem">Dès que possible</span>'}${prioOf(t) !== 'normale' ? di.chip : ''}` : `<span class="l">Prochaine fois</span><span class="n" style="font-size:1.5rem">${fmtD(t.prochaine)}</span>${di.k === 'plus' ? '' : di.chip}`}</div>
        ${off || t.arch ? '' : run ? `<button class="btn primary" data-act="edit-int" data-id="${run.id}">${icon('report')}Compléter le rapport ${esc(run.num)}</button>` : `<button class="btn primary" data-act="do-tache" data-id="${t.id}">${icon('check')}C’est fait</button>`}
      </div>
      ${!off && !t.arch && !isPetit(t) && daysTo(t.prochaine) < 0 ? `<p class="recal">${icon('repeat')}<span>Plus d’actualité ?</span><button class="btn small" data-act="recaler" data-id="${t.id}">Recaler sur la prochaine échéance</button></p>` : ''}
      ${t.description ? `<section class="pd-sec"><h3>${icon('list')}Ce qu’il faut faire</h3><p class="pre">${esc(t.description)}</p></section>` : ''}
      <section class="pd-sec"><h3>${icon('check')}Déjà fait</h3>${doneHTML(t)}</section>${byLine(t)}`;
  }
};
function newTacheDialog(kksId){ tacheDialog(null, kksId); }
function tacheDialog(t, kksId){
  const isNew = !t, petit0 = t ? isPetit(t) : true;
  const v = t || {titre:'', description:'', kksId:kksId || '', assign:{type:'groupe', v:''}, freq:{n:1, unite:'once'}, prochaine:'', actif:true, prio:'normale', rapport:'oui'};
  const k = getKks(v.kksId);
  const assignItems = () => [
    ...db.listes.groupes.filter(g => db.personnes.some(p => p.groupe === g && p.actif !== false)).map(g => ({id:'g:' + g, label:g, search:'groupe métier ' + g, html:`<strong>${esc(g)}</strong>`, right:'<span class="muted">Corps de métier</span>'})),
    ...db.personnes.filter(p => p.actif !== false && live(p)).sort(persSort).map(p => ({id:'p:' + p.id, label:persName(p), search:persName(p) + ' ' + (p.groupe || ''), html:esc(persName(p)), right:`<span class="muted">${esc(p.groupe || '')}</span>`}))];
  const aId = v.assign?.v ? (v.assign.type === 'personne' ? 'p:' : 'g:') + v.assign.v : '';
  const pill = (name, k2, lbl, tone, cur) => `<label class="prio-o ${tone}"><input type="radio" name="${name}" value="${k2}" ${cur === k2 ? 'checked' : ''}><span>${lbl}</span></label>`;
  dialog({title: isNew ? 'Nouveau travail' : 'Modifier le travail',
    body:`<label>Quoi ?<input name="titre" value="${esc(v.titre)}" required placeholder="ex. Changer le néon de l’atelier, graisser les paliers…"></label>
      <fieldset><legend>Ça revient ?</legend>
        <div class="freq"><select name="unite" aria-label="Ça revient ?">${[['once', 'Non, une seule fois'], ['jour', 'Oui, tous les … jours'], ['semaine', 'Oui, toutes les … semaines'], ['mois', 'Oui, tous les … mois'], ['an', 'Oui, tous les … ans']].map(([a, b]) => opt(a, b, petit0 ? 'once' : v.freq.unite)).join('')}</select>
        <input name="n" type="number" min="1" step="1" value="${esc(v.freq.n || 1)}" aria-label="Intervalle" data-n></div>
        <div data-once><p class="hint" style="margin:10px 0 6px">Urgence</p><div class="prio-pick" role="radiogroup" aria-label="Priorité">${Object.entries(PRIO).map(([k2, [lbl, tone]]) => pill('prio', k2, lbl, tone, prioOf(v))).join('')}</div>
          <label>Pour quand ? (facultatif)<input name="pdate" type="date" value="${petit0 ? esc(v.prochaine || '') : ''}"></label></div>
        <div data-rec><label>${isNew || petit0 ? 'Première fois le' : 'Prochaine fois le'}<input name="prochaine" type="date" value="${esc(petit0 ? (v.prochaine || todayISO()) : v.prochaine)}"></label><p class="hint" data-fprev></p></div></fieldset>
      <label>Pour qui ?<input name="assign" data-id="${esc(aId)}" data-label="${esc(aId ? assignLabel(v.assign) : '')}" value="${esc(aId ? assignLabel(v.assign) : '')}" placeholder="Un corps de métier ou une personne"></label>
      <label>Équipement (repère KKS)<input name="kks" data-id="${k ? k.id : ''}" data-label="${k ? esc(kksLabel(k)) : ''}" value="${k ? esc(kksLabel(k)) : ''}" placeholder="Facultatif : code ou désignation"></label>
      <fieldset><legend>Faut-il un rapport ?</legend><div class="prio-pick rap-pick" role="radiogroup" aria-label="Rapport">${pill('rapport', 'oui', 'Oui', 'info', v.rapport || 'oui')}${pill('rapport', 'non', 'Non', 'info', v.rapport || 'oui')}</div>
        </fieldset>
      <label>Ce qu’il faut faire<textarea name="description" rows="3" placeholder="Consignes, points de contrôle… (facultatif)">${esc(v.description)}</textarea></label>`,
    onOpen(f, d){
      combo(f.elements.kks, {items: () => db.kks.filter(live).map(x => ({id:x.id, key:x.code, label:kksLabel(x), search:x.code + ' ' + x.designation, html:`<span class="kks">${esc(x.code)}</span> ${esc(x.designation)}`}))});
      combo(f.elements.assign, {items:assignItems});
      const u = () => { const un = val(f, 'unite'), once = un === 'once', n = Math.max(1, +val(f, 'n') || 1), p = val(f, 'prochaine');
        $('[data-n]', d).hidden = once; $('[data-once]', d).hidden = !once; $('[data-rec]', d).hidden = once;
        $('[data-fprev]', d).textContent = once || !p ? '' : `${freqLabel({n, unite:un})} : ${fmtD(p)}, puis ${fmtD(addFreq(p, n, un))}, ${fmtD(addFreq(addFreq(p, n, un), n, un))}…`; };
      f.addEventListener('input', u); f.addEventListener('change', u); u();
    },
    del: isNew ? null : archDel('taches', t, () => HARD.taches(t)),
    onSave(f){
      const titre = val(f, 'titre'), unite = val(f, 'unite'), petit = unite === 'once', n = petit ? 1 : Math.max(1, Math.round(+val(f, 'n') || 1)), prochaine = petit ? val(f, 'pdate') : val(f, 'prochaine');
      if (!titre) throw new Error('Indiquez le travail.');
      if (!petit && !/^\d{4}-\d{2}-\d{2}$/.test(prochaine)) throw new Error('Indiquez la date de la première fois.');
      let kk = null; const ki = f.elements.kks; if (ki.value.trim()){ kk = getKks(ki.dataset.id) || findKks(ki.value); if (!kk) throw new Error('Repère KKS inconnu : choisissez-le dans la liste.'); }
      const ai = f.elements.assign; let assign = {type:'groupe', v:''};
      if (ai.value.trim()){ const id = ai.dataset.id || ''; if (!id) throw new Error('Choisissez un corps de métier ou une personne dans la liste.'); assign = id.startsWith('g:') ? {type:'groupe', v:id.slice(2)} : {type:'personne', v:id.slice(2)}; }
      const rapport = (f.querySelector('input[name=rapport]:checked') || {}).value || '';
      const data = {titre, description:val(f, 'description'), kksId:kk ? kk.id : '', assign, freq:{n, unite}, prochaine, rapport, ...(petit ? {kind:'petit', prio:(f.querySelector('input[name=prio]:checked') || {}).value || 'normale'} : {kind:'rec'})};
      tx(() => { if (isNew){ const x = {id:uid(), actif:true, ...data}; db.taches.push(x); S.sel.taches = x.id; } else Object.assign(t, data, petit && t.actif === false && isPetit(t) ? {} : {actif:true}); });
      S.view = 'taches'; S.tf = ''; render(); toast(isNew ? 'Travail ajouté' : 'Enregistré');
    }});
}
function tachesSheetHTML(){
  const rows = [...baseTaches().filter(t => t.actif !== false && isPetit(t) && (prioOf(t) === 'haute' || daysTo(t.prochaine) <= 7)).sort(petitSort), ...baseTaches().filter(t => t.actif !== false && !isPetit(t) && daysTo(t.prochaine) <= 7).sort(urgSort)];
  const who = S.pour ? (S.pour.startsWith('g:') ? S.pour.slice(2) : persName(getPers(S.pour.slice(2)) || {nom:''})) : 'Tout le monde';
  return `<article class="rpt"><header class="rpt-head"><div><div class="rpt-org">Tridel · Maintenance</div><h1>Liste de travail</h1></div><div class="rpt-num"><div>${esc(who)}</div><div>${fmtD(todayISO())}</div></div></header>
    ${rows.length ? `<table class="rpt-tbl"><thead><tr><th style="width:8mm"></th><th>Tâche</th><th>Équipement</th><th>Pour</th><th>Prévue</th></tr></thead><tbody>${rows.map(t => { const k = getKks(t.kksId); return `<tr><td><span class="box"></span></td><td><strong>${esc(t.titre)}</strong>${t.description ? `<br><span style="font-size:8.5pt">${esc(t.description)}</span>` : ''}</td><td class="mono">${k ? esc(k.code) : ''}</td><td>${esc(assignLabel(t.assign))}</td><td>${fmtD(t.prochaine)}${daysTo(t.prochaine) < 0 ? ' (retard)' : ''}</td></tr>`; }).join('')}</tbody></table>` : '<p>Aucune tâche en retard ou prévue dans les 7 jours.</p>'}
    <footer class="rpt-foot">Tâches en retard et des 7 prochains jours · imprimé le ${fmtDT(new Date().toISOString())} · TriFlow</footer></article>`;
}

function filteredInts(){
  const q = norm(S.q.interventions);
  let rows = db.interventions.filter(i => S.arch.interventions ? i.arch : !i.arch).filter(i => S.arch.interventions || intFor(i, S.pour)).filter(i => S.arch.interventions || (S.statut === 'actives' ? i.statut !== 'terminee' : i.statut === 'terminee'));
  if (q) rows = rows.filter(i => norm([i.num, i.titre, i.type, i.constat, i.travaux, kInfo(i)?.code, kInfo(i)?.designation, ...intPers(i).map(snapLabel)].join(' ')).includes(q));
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.num.localeCompare(a.num));
}
/* Travaux cochés sans rapport, pour l'onglet « Fait » */
function faitsSans(){
  const q = norm(S.q.interventions || ''), out = [];
  for (const t of db.taches){
    if (!live(t) || !(t.faits || []).length || !forWho(t, S.pour)) continue;
    const k = getKks(t.kksId);
    for (const f of t.faits){
      const who = (f.who || []).map(getPers).filter(Boolean);
      if (q && !norm([t.titre, k?.code, k?.designation, assignLabel(t.assign), ...who.map(persName)].join(' ')).includes(q)) continue;
      out.push({virt:true, id:'t:' + t.id, t, k, date:f.date, num:'', who});
    }
  }
  return out;
}
VIEWS.interventions = {
  shell: travauxShell,
  list(){
    const head = wtabs(), openOnly = S.statut === 'actives' && !S.arch.interventions;
    const all = [...filteredInts(), ...(S.arch.interventions || openOnly ? [] : faitsSans())].sort((a, b) => b.date.localeCompare(a.date) || String(b.num).localeCompare(String(a.num)));
    const pour = S.arch.interventions ? '' : pourSelect();
    if (!all.length){
      const bar = pour ? `<div class="ychips">${pour}</div>` : '';
      if (S.arch.interventions) return head + empty('Aucun rapport archivé', '');
      if (S.pour) return head + bar + empty(`Rien pour ${esc(pourLabel(S.pour))}`, '<p><button class="btn small" data-act="pour-all">Voir tout le monde</button></p>');
      if (norm(S.q.interventions)) return head + bar + empty('Rien ne correspond', '');
      return head + bar + (openOnly ? empty('Rien en cours', '<p>Tous les rapports sont terminés.</p>') : empty('Rien de fait pour l’instant', '<p>Les rapports terminés et les travaux cochés arrivent ici.</p>'));
    }
    const yc = new Map(); for (const i of all){ const y = (i.date || '').slice(0, 4) || '—'; yc.set(y, (yc.get(y) || 0) + 1); }
    const years = [...yc.keys()].sort().reverse();
    const searching = !!norm(S.q.interventions);
    let y = openOnly ? 'all' : S.ryear && (S.ryear === 'all' || yc.has(S.ryear)) ? S.ryear : (searching || all.length <= 150 ? 'all' : years[0]);
    const rows = y === 'all' ? all : all.filter(i => (i.date || '').startsWith(y));
    const MO = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'], MS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const lim = S.rmore === y + norm(S.q.interventions) ? 1e9 : 400, shown = rows.slice(0, lim);
    const groups = []; for (const i of shown){ const k = (i.date || '').slice(0, 7); if (!groups.length || groups[groups.length - 1].k !== k) groups.push({k, list:[]}); groups[groups.length - 1].list.push(i); }
    const mcount = new Map(); for (const i of rows){ const k = (i.date || '').slice(0, 7); mcount.set(k, (mcount.get(k) || 0) + 1); }
    const yrs = !openOnly && years.length > 1 ? `<button role="tab" class="ychip" data-act="ryear" data-y="all" aria-selected="${y === 'all'}">Toutes <small>${all.length}</small></button>${years.map(x => `<button role="tab" class="ychip" data-act="ryear" data-y="${x}" aria-selected="${y === x}">${x} <small>${yc.get(x)}</small></button>`).join('')}` : '';
    const chips = pour || yrs ? `<div class="ychips" role="tablist" aria-label="Filtrer">${pour}${pour && yrs ? '<span class="ysep" aria-hidden="true"></span>' : ''}${yrs}</div>` : '';
    const day = d => `<span class="rday"><b>${+d.slice(8, 10) || ''}</b><small>${MS[+d.slice(5, 7) - 1] || ''}</small></span>`;
    const row = i => { const d = i.date || '';
      if (i.virt) return `<button class="rrow ${S.sel.interventions === i.id ? 'sel' : ''}" data-act="select" data-id="${i.id}">${day(d)}
        <span class="pm"><span class="pdes">${esc(i.t.titre)}</span>${i.k ? `<span class="requip"><span class="kks">${esc(i.k.code)}</span><span class="rq">${esc(i.k.designation || '')}</span></span>` : ''}<span class="ploc"><span class="norep">sans rapport</span>${i.who.length ? `<span class="muted rwho">${esc(i.who.slice(0, 3).map(x => x.nom).join(', '))}</span>` : ''}</span></span></button>`;
      const k = kInfo(i), who = intPers(i).slice(0, 3).map(x => x.nom).join(', ') + (i.intervenants.length > 3 ? ` +${i.intervenants.length - 3}` : '');
      return `<button class="rrow ${S.sel.interventions === i.id ? 'sel' : ''}" data-act="select" data-id="${i.id}">${day(d)}
        <span class="pm"><span class="pdes">${esc(i.titre || '(sans titre)')}</span>${k?.code || k?.designation ? `<span class="requip">${k.code ? `<span class="kks">${esc(k.code)}</span>` : ''}<span class="rq">${esc(k.designation || '')}</span></span>` : ''}<span class="ploc">${i.type ? `<span>${esc(i.type)}</span>` : ''}${who ? `<span class="muted rwho">${esc(who)}</span>` : ''}</span></span>
        ${i.statut !== 'terminee' ? statutChip(i.statut) : ''}</button>`; };
    return `${head}${chips}${yrs ? '' : `<div class="list-bar"><span class="muted">${rows.length} ${openOnly ? 'rapport(s) en cours' : 'élément(s)'}</span></div>`}
      <div class="rlist">${groups.map(g => `<div class="rmonth"><span>${g.k ? MO[+g.k.slice(5, 7) - 1] + ' ' + g.k.slice(0, 4) : 'Sans date'}</span><small>${mcount.get(g.k) || g.list.length}</small></div>${g.list.map(row).join('')}`).join('')}
      ${rows.length > shown.length ? `<p class="list-note"><button class="link" data-act="rmore" data-k="${esc(y + norm(S.q.interventions))}">Afficher les ${rows.length - shown.length} autres</button></p>` : ''}</div>`;
  },
  detail(){
    const sid = String(S.sel.interventions || '');
    if (sid.startsWith('t:')){ const keep = S.sel.taches; S.sel.taches = sid.slice(2); const h = VIEWS.taches.detail(); S.sel.taches = keep; return h; }
    const i = getInt(sid);
    if (!i) return placeholder('report', 'Choisissez un élément de la liste.');
    const k = kInfo(i), T = tInfo(i);
    const names = intPers(i).map(x => `${getPers(x.id) ? `<button class="link" data-act="pers-ints" data-id="${x.id}">${esc(persName(x))}</button>` : esc(persName(x))}${x.groupe ? ` <span class="muted">(${esc(x.groupe)})</span>` : ''}`).join(', ');
    const pills = intPers(i).map(x => `<span class="pp ${isFourId(x.id) ? 'four' : ''}">${isFourId(x.id) ? icon('truck') : ''}${getPers(x.id) ? `<button class="link" data-act="pers-ints" data-id="${x.id}" title="Tous ses rapports">${esc(persName(x))}</button>` : isFourId(x.id) ? `<button class="link" data-act="four-ints" data-name="${esc(x.id.slice(5))}" title="Tous ses rapports">${esc(persName(x))}</button>` : `<button class="link" data-act="name-ints" data-name="${esc(x.nom)}" title="Tous ses rapports">${esc(persName(x))}</button>`}${x.groupe ? `<small>${esc(x.groupe)}</small>` : ''}</span>`).join('');
    return `${archBanner('interventions', i)}<div class="pd-head"><span class="pd-id">${esc(i.num)}</span><div class="pd-tools">${i.statut !== 'terminee' ? statutChip(i.statut) : ''}<button class="btn small" data-act="edit-int" data-id="${i.id}">${icon('edit')}${i.statut === 'terminee' ? 'Modifier' : 'Compléter'}</button><button class="btn small" data-act="print-int" data-id="${i.id}">${icon('printer')}Imprimer</button>${menu([i.arch ? ['unarch', 'Restaurer le rapport', 'archive', {col:'interventions', id:i.id}] : ['arch', 'Archiver le rapport', 'archive', {col:'interventions', id:i.id}], hardItem('interventions', i.id)].filter(Boolean), 'Plus', 'more', 'small')}</div></div>
      <h2 class="pd-title">${esc(i.titre)}</h2>
      ${k ? `<div class="equip-hero">${kTagI(i)}<span>${esc(k.designation || '')}</span></div>` : ''}
      <p class="pd-sub">${fmtD(i.date)}${i.type ? ` · ${esc(i.type)}` : ''}${i.duree ? ` · ${num(i.duree)} h` : ''}${i.statut === 'terminee' ? ' · <span style="color:var(--ok)">terminé</span>' : ''}</p>
      <dl class="pd-info rep">
        ${k ? '' : '<dt>Équipement</dt><dd>—</dd>'}
        ${T ? `<dt>Tâche</dt><dd>${get('taches', i.tacheId) ? `<button class="link" data-act="goto" data-view="taches" data-id="${i.tacheId}">${esc(T.titre)}</button>` : esc(T.titre)} <span class="muted">· ${esc(T.freq)}</span></dd>` : ''}
        <dt>Intervenants</dt><dd>${pills ? `<span class="pps">${pills}</span>` : '—'}</dd></dl>
      ${i.constat ? `<section class="pd-sec"><h3>${icon('report')}Constat / demande</h3><p class="pre">${esc(i.constat)}</p></section>` : ''}
      ${i.travaux ? `<section class="pd-sec"><h3>${icon('wrench')}Travaux réalisés</h3>${travauxHTML(i.travaux)}</section>` : ''}
      ${byLine(i)}${i.pieces.length ? `<section class="block"><h3>Pièces utilisées</h3><div class="tbl-wrap"><table class="tbl compact"><tbody>${i.pieces.map(x => { const p = getPiece(x.pieceId), s = lineInfo(x, i); return `<tr ${p ? `data-act="goto" data-view="pieces" data-id="${p.id}" tabindex="0"` : ''}><td><span class="ref">${esc(s.ref)}</span> ${esc(s.designation)}${s.lieu ? `<span class="sub">${esc(s.lieu)}</span>` : ''}</td><td class="num qty">${num(x.qte)} ${esc(s.unite || '')}</td></tr>`; }).join('')}</tbody></table></div></section>` : ''}`;
  }
};

const kksRows = rows => `<div class="tbl-wrap"><table class="tbl"><tbody>${rows.map(k => `<tr data-act="select" data-id="${k.id}" class="${S.sel.kks === k.id ? 'sel' : ''}" tabindex="0"><td style="width:1%"><span class="kks">${esc(k.code)}</span></td><td>${esc(k.designation)}</td><td class="num">${k.aic ? `<span class="aic">${esc(k.aic)}</span>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
/* Regroupement des équipements d'un système : 1HHX10… (n° de sous-ensemble), puis par type (AA vannes, AP pompes…) */
const KKS_TYPES = {AA:'Vannes et robinetterie', AB:'Clapets et registres', AC:'Échangeurs de chaleur', AE:'Levage et rotation', AF:'Convoyeurs', AH:'Chauffage et refroidissement', AJ:'Broyage', AM:'Agitateurs et mélangeurs', AN:'Ventilateurs et compresseurs', AP:'Pompes', AT:'Filtres et nettoyage', AU:'Transmissions et réducteurs', BB:'Réservoirs et bâches', BN:'Éjecteurs et injecteurs', BP:'Diaphragmes', BR:'Tuyauteries et gaines', BS:'Silencieux', BZ:'Supports et divers', CE:'Mesures électriques', CF:'Mesures de débit', CG:'Mesures de position', CL:'Mesures de niveau', CP:'Mesures de pression', CQ:'Analyses', CS:'Mesures de vitesse', CT:'Mesures de température', CY:'Vibrations', CU:'Mesures combinées'};
const kksParts = code => { const m = String(code).replace(/\s+/g, '').match(/^(\d?)([A-Z]{3})(\d{2})([A-Z]{2})?/); return m ? {grp:m[1] + m[2] + m[3], unit:m[1], num:m[3], type:m[4] || ''} : {grp:'', unit:'', num:'', type:''}; };
const typeName = t => KKS_TYPES[t] || (t[0] === 'C' ? 'Mesures' : t[0] === 'E' ? 'Signaux et automatisme' : t ? 'Autres' : 'Ensemble');
function kksGroups(rows){
  const byCode = new Map(db.kks.map(k => [k.code.replace(/\s+/g, ''), k]));
  const groups = new Map(); for (const k of rows){ const g = kksParts(k.code).grp || '—'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(k); }
  return `<div class="kgroups">${[...groups].sort((a, b) => coll.compare(a[0].slice(1), b[0].slice(1)) || coll.compare(a[0], b[0])).map(([g, ks]) => {
    const own = byCode.get(g), p = kksParts(g), open = S.grpOpen.has(g) || groups.size === 1;
    const name = g === '—' ? 'Général' : own ? own.designation : (() => { const c = ks.filter(k => /\d$/.test(k.code) && kksParts(k.code).type !== 'BR'); return (c.length ? c : ks).map(k => k.designation).sort((x, y) => y.length - x.length)[0]; })()
    const line = p.unit === '1' ? 'Ligne 1' : p.unit === '2' ? 'Ligne 2' : p.unit === '0' ? 'Commun' : '';
    if (ks.length === 1 && !own) return `<div class="kgrp single">${kksRows(ks)}</div>`;
    const types = new Map(); for (const k of ks){ const t = kksParts(k.code).type; const n = typeName(t); if (!types.has(n)) types.set(n, []); types.get(n).push(k); }
    return `<div class="kgrp ${open ? 'open' : ''}"><button class="kgrp-h" data-act="kgrp" data-g="${esc(g)}" aria-expanded="${open}"><span class="chev ${open ? 'open' : ''}">${icon('chev')}</span><b class="code">${esc(g)}</b><span class="t">${esc(name)}</span>${line ? `<span class="chip">${line}</span>` : ''}<span class="cnt">${ks.length}</span></button>
      ${open ? [...types].map(([n, list]) => `${types.size > 1 ? `<div class="ktype">${esc(n)} <span class="muted">${list.length}</span></div>` : ''}${kksRows(list)}`).join('') : ''}</div>`;
  }).join('')}</div>`;
}
const kksSort = (a, b) => coll.compare(a.code.replace(/^\d+/, ''), b.code.replace(/^\d+/, '')) || coll.compare(a.code, b.code);
VIEWS.kks = {
  shell: () => `<header class="page-head"><h1>Installation</h1><div class="tools">${searchBox('kks', 'KKS, AIC ou équipement…')}
    ${menu([['new-kks', 'Un équipement', 'plus', {}], ['import-kks', 'Coller une liste', 'list', {}]], 'Ajouter', 'plus', 'primary')}${menu([['xl-kks', 'Exporter (Excel)', 'excel', {}], archItem('kks')])}</div></header>
    <div class="split tsplit"><section class="pane" id="list"></section><section class="pane detail" id="detail"></section></div>`,
  list(){
    if (!db.kks.length) return empty('Aucun équipement', '<p>Ajoutez-les avec « Coller une liste ».</p>');
    if (S.arch.kks){ const ar = db.kks.filter(k => k.arch).sort(kksSort); return ar.length ? `<p class="list-note">${ar.length} équipement(s) archivé(s)</p>${kksRows(ar)}` : empty('Aucun équipement archivé', ''); }
    const q = norm(S.q.kks);
    if (q){
      const rows = db.kks.filter(live).filter(k => norm(`${k.code} ${k.designation} ${k.aic || ''}`).includes(q) || norm(k.code.replace(/\s+/g, '')).includes(q.replace(/\s+/g, ''))).sort(kksSort);
      if (!rows.length) return empty('Rien ne correspond', '');
      return `<p class="list-note">${rows.length} équipement(s)${rows.length > 300 ? ', les 300 premiers affichés' : ''}</p>${kksRows(rows.slice(0, 300))}`;
    }
    const k = getKks(S.sel.kks);
    if (k && S.sysAuto !== k.id){ S.sysAuto = k.id; S.sys = sysEff(k.code) || '?'; if (S.sys !== '?'){ S.sysExp.add(S.sys[0]); S.sysExp.add(S.sys.slice(0, 2)); } }
    const cnt = new Map(); for (const x of db.kks.filter(live)){ const c = sysEff(x.code) || '?'; cnt.set(c, (cnt.get(c) || 0) + 1); }
    const s3 = [...cnt.keys()].filter(c => c !== '?').sort();
    const n = pre => s3.filter(c => c.startsWith(pre)).reduce((a, c) => a + cnt.get(c), 0);
    const node = (c, lvl, open, label) => `<button class="tnode l${lvl} ${S.sys === c ? 'sel' : ''}" data-act="sys-sel" data-sys="${c}" ${lvl < 3 ? `aria-expanded="${open}"` : ''}>${lvl < 3 ? `<span class="chev ${open ? 'open' : ''}">${icon('chev')}</span>` : '<span class="tdot"></span>'}<span class="t"><b class="code">${c}</b>${label}</span><span class="cnt">${lvl < 3 ? n(c) : cnt.get(c)}</span></button>`;
    let h = '<div class="tree">';
    for (const L of [...new Set(s3.map(c => c[0]))]){
      const o1 = S.sysExp.has(L); h += node(L, 1, o1, esc(sysName(L)));
      if (!o1) continue;
      for (const L2 of [...new Set(s3.filter(c => c[0] === L).map(c => c.slice(0, 2)))]){
        const o2 = S.sysExp.has(L2); h += node(L2, 2, o2, esc(sysName(L2)));
        if (o2) for (const c of s3.filter(c => c.startsWith(L2))) h += node(c, 3, false, esc(sysName(c)));
      }
    }
    if (cnt.get('?')) h += `<button class="tnode l1 ${S.sys === '?' ? 'sel' : ''}" data-act="sys-sel" data-sys="?"><span class="tdot"></span><span class="t">Sans système</span><span class="cnt">${cnt.get('?')}</span></button>`;
    return h + '</div>';
  },
  detail(){
    const k = getKks(S.sel.kks);
    if (!k){
      const cnt = new Map(); for (const x of db.kks.filter(live)){ const c = sysEff(x.code) || '?'; cnt.set(c, (cnt.get(c) || 0) + 1); }
      const n = pre => [...cnt].filter(([c]) => c !== '?' && c.startsWith(pre)).reduce((a, [, v]) => a + v, 0);
      const cur = S.sys === '?' ? '' : S.sys;
      const crumb = `<nav class="crumbs"><button class="link" data-act="sys-sel" data-sys="">Installation</button>${[...cur].map((_, i) => cur.slice(0, i + 1)).map(c => ` <span class="muted">›</span> ${c === cur ? `<strong>${c}</strong>` : `<button class="link" data-act="sys-sel" data-sys="${c}">${c}</button>`}`).join('')}</nav>`;
      if (S.sys === '?' || cur.length === 3){
        const rows = db.kks.filter(x => live(x) && (S.sys === '?' ? !sysEff(x.code) : sysEff(x.code) === S.sys)).sort(kksSort);
        return `${crumb}<div class="sys-head"><h3><b class="code">${S.sys === '?' ? '' : cur}</b>${S.sys === '?' ? 'Sans système' : esc(sysName(cur))}</h3><span class="cnt">${rows.length} équip.</span></div>
          ${rows.length ? (rows.length > 12 && S.sys !== '?' ? kksGroups(rows) : kksRows(rows)) : '<p class="empty-line" style="padding:16px 0">Aucun équipement.</p>'}`;
      }
      if (!cur) return placeholder('plant', 'Choisissez un système à gauche, ou tapez un code KKS, un AIC ou un nom d’équipement dans la recherche.');
      const kids = [...new Set([...cnt.keys()].filter(c => c !== '?' && c.startsWith(cur)).map(c => c.slice(0, cur.length + 1)))].sort();
      return `${crumb}${cur ? `<div class="sys-head"><h3><b class="code">${cur}</b>${esc(sysName(cur))}</h3><span class="cnt">${n(cur)} équip.</span></div>` : '<p class="hint" style="margin:0 0 10px">Choisissez un système : il se déplie dans le menu de gauche.</p>'}
        <div class="sys-kids">${kids.map(c => `<button class="sys-kid" data-act="sys-sel" data-sys="${c}"><b class="code">${c}</b><span class="t">${esc(sysName(c)) || '<span class="muted">Sans nom</span>'}</span><span class="cnt">${n(c)}</span>${icon('chev')}</button>`).join('')}</div>`;
    }
    const ps = db.pieces.filter(p => live(p) && p.kks.includes(k.id)).sort((a, b) => coll.compare(a.designation, b.designation)), ints = db.interventions.filter(i => live(i) && i.kksId === k.id).sort((a, b) => b.date.localeCompare(a.date)), ts = db.taches.filter(t => live(t) && t.kksId === k.id);
    const nxt = ts.filter(t => t.actif !== false).sort((a, b) => a.prochaine.localeCompare(b.prochaine))[0], inStock = ps.filter(p => dispo(p) > 0).length, allI = S.kAll === k.id;
    const stat = (n, t, sub, tone = '') => `<div class="kst ${tone}"><b>${n}</b><span>${t}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    return `${S.q.kks || S.arch.kks ? '' : `<button class="btn small back" data-act="kks-back">${icon('chev')}${sysEff(k.code) ? `${sysEff(k.code)} ${esc(sysName(sysEff(k.code)))}` : 'Retour'}</button>`}${archBanner('kks', k)}
      <div class="pd-head"><span class="kks big">${esc(k.code)}</span><div class="pd-tools"><button class="btn small" data-act="edit-kks" data-id="${k.id}">${icon('edit')}Modifier</button>${menu([['new-tache', 'Nouveau travail sur cet équipement', 'check', {kks:k.id}], '-', k.arch ? ['unarch', 'Restaurer l’équipement', 'archive', {col:'kks', id:k.id}] : ['arch', 'Archiver l’équipement', 'archive', {col:'kks', id:k.id}]], 'Plus', 'more', 'small')}</div></div>
      <h2 class="pd-title">${esc(k.designation)}</h2>
      <p class="pd-sub">${sysEff(k.code) ? `<button class="link" data-act="sys-sel" data-sys="${sysEff(k.code)}">${esc(sysLabel(k.code))}</button>` : '<span class="muted">Sans système</span>'}${k.aic ? ` · AIC <span class="aic">${esc(k.aic)}</span>` : ''}</p>
      <div class="kstats">${stat(ps.length, 'pièce(s) de rechange', ps.length ? `${inStock} en stock` : '', ps.length && !inStock ? 'bad' : '')}${stat(ints.length, 'rapport(s)', ints[0] ? `dernier le ${fmtD(ints[0].date)}` : '')}${stat(ts.length, 'tâche(s)', nxt ? `prochaine le ${fmtD(nxt.prochaine)}` : '', nxt && daysTo(nxt.prochaine) < 0 ? 'bad' : '')}</div>
      <div class="kacts"><button class="btn primary" data-act="new-int" data-kks="${k.id}">${icon('report')}Nouveau rapport</button><button class="btn" data-act="new-tache" data-kks="${k.id}">${icon('check')}Nouveau travail</button></div>
      ${ts.length ? `<section class="pd-sec"><h3>${icon('repeat')}Tâches</h3><div class="tbl-wrap"><table class="tbl compact"><tbody>${ts.map(t => tacheRow(t, false)).join('')}</tbody></table></div></section>` : ''}
      <section class="pd-sec"><h3>${icon('report')}Rapports <span class="muted">${ints.length || ''}</span></h3>${ints.length ? intTable(allI ? ints : ints.slice(0, 6), true) + (ints.length > 6 ? `<button class="link" data-act="k-all" data-id="${k.id}">${allI ? 'Réduire' : `Voir les ${ints.length} rapports`}</button>` : '') : '<p class="empty-line">Aucun rapport sur cet équipement.</p>'}</section>
      <section class="pd-sec"><h3>${icon('box')}Pièces de rechange <span class="muted">${ps.length || ''}</span></h3>
        ${ps.length ? `<div class="four-list">${ps.map(p => { const mp = mainPlace(p); return `<div class="kp"><button class="four-p" data-act="goto" data-view="pieces" data-id="${p.id}"><span class="pid">${esc(p.ref)}</span><span class="t">${esc(p.designation)}</span>${mp ? plate(mp, false) : ''}<span class="q ${isOut(p) ? 'zero' : ''}">${num(dispo(p))} <small>${esc(p.unite)}</small></span></button><button class="icon-btn" data-act="unlink-kks" data-piece="${p.id}" data-id="${k.id}" aria-label="Retirer ${esc(p.ref)}" title="Retirer le lien">×</button></div>`; }).join('')}</div>` : '<p class="empty-line">Aucune pièce liée.</p>'}
        <form class="inline-form" data-form="link-piece" data-kks="${k.id}"><input name="piece" list="dl-pieces" placeholder="Lier une pièce (ID ou désignation)" aria-label="Pièce à lier" autocomplete="off"><button class="btn">Lier</button></form></section>`;
  }
};

