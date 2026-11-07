'use strict';
/* TriFlow — Fenêtres : rapport, KKS, personnes ; synchronisation du personnel ; exports Excel. (Fichiers chargés dans l'ordre par index.html.) */
/* ---------- Interventions ---------- */
/* Dictée vocale (Chrome, Edge, Safari) : le texte s'ajoute au champ */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition, HAS_DICT = !!SR;
let DICT = null;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-dict]'); if (!b) return; e.preventDefault();
  if (DICT){ DICT.stop(); return; }
  const ta = b.closest('form').elements[b.dataset.dict]; const r = new SR(); r.lang = 'fr-CH'; r.continuous = true; r.interimResults = true;
  const base = ta.value ? ta.value.replace(/\s+$/, '') + ' ' : ''; let fin = '';
  r.onresult = ev => { let tmp = ''; for (let i = ev.resultIndex; i < ev.results.length; i++){ const t = ev.results[i][0].transcript; if (ev.results[i].isFinal) fin += t; else tmp += t; } ta.value = base + fin + tmp; };
  r.onerror = ev => { if (ev.error === 'not-allowed') toast('Micro refusé : autorisez-le dans le navigateur.', 'bad'); };
  r.onend = () => { DICT = null; b.classList.remove('on'); ta.value = (base + fin).replace(/\s+$/, ''); };
  DICT = r; b.classList.add('on'); try { r.start(); } catch(x){ DICT = null; b.classList.remove('on'); }
}, true);
function interventionDialog(it, kksId, tache, opts = {}){
  const isNew = !it;
  const T = tache || get('taches', it?.tacheId);
  const v = it || (tache ? {num:nextNum(), date:todayISO(), type:db.listes.types.find(x => /pr[ée]ventive/i.test(x)) || db.listes.types[0] || '', statut:'terminee', kksId:tache.kksId, titre:tache.titre, constat:tache.description, travaux:'', duree:'', intervenants:tache.assign?.type === 'personne' && getPers(tache.assign.v) ? [tache.assign.v] : [], pieces:[]}
    : {num:nextNum(), date:todayISO(), type:db.listes.types[0] || '', statut:'terminee', kksId:kksId || '', titre:'', constat:'', travaux:'', duree:'', intervenants:[], pieces:[]});
  if (isNew){ const me = meId(); const add = [...(opts.who || []), ...(me ? [me] : [])].filter(id => getPers(id)); if (add.length) v.intervenants = [...new Set([...v.intervenants, ...add])]; if (opts.date) v.date = opts.date; if (opts.text && !v.travaux) v.constat = [v.constat, opts.text].filter(Boolean).join('\n'); }
  const k = getKks(v.kksId);
  const people = db.personnes.filter(p => (p.actif !== false && live(p)) || v.intervenants.includes(p.id)).sort(persSort);
  const snapFor = id => (it?.snap?.[id]) || (isFourId(id) ? fourSnap(id.slice(5)) : getPers(id) ? persSnap(getPers(id)) : {nom:'(supprimé)', prenom:'', groupe:''});
  const fUse = new Map(); for (const i of db.interventions) for (const id of i.intervenants) if (isFourId(id)) fUse.set(id.slice(5), (fUse.get(id.slice(5)) || 0) + 1);
  const fTop = [...new Set([...[...fUse].sort((a, b) => b[1] - a[1]).map(x => x[0]).filter(n => db.listes.fournisseurs.includes(n)).slice(0, 24)])];
  const recents = [...new Set(db.interventions.slice().sort((a, b) => b.date.localeCompare(a.date)).flatMap(i => i.intervenants))].filter(id => people.some(p => p.id === id)).slice(0, 12);
  const tabsP = [...(recents.length ? [['__r', 'Récents']] : []), ...db.listes.groupes.filter(g => people.some(p => p.groupe === g)).map(g => [g, g]), ...(people.some(p => !p.groupe) ? [['', 'Sans groupe']] : []), ['__f', 'Entreprises']];
  const old = new Map(); (it?.pieces || []).forEach(x => old.set(x.pieceId + '|' + x.lieuId, (old.get(x.pieceId + '|' + x.lieuId) || 0) + x.qte));
  dialog({title: isNew ? 'Nouveau rapport' : `Rapport ${esc(v.num)}`, wide:true,
    body:`${T ? `<p class="task-note">${icon('repeat')}<span>Tâche « ${esc(T.titre)} » · ${esc(freqLabel(T.freq))}${T.actif !== false ? ` · prévue le ${fmtD(T.prochaine)}` : ''}. ${it?.tacheFait ? '' : 'Elle passera à l’échéance suivante quand ce rapport sera « Terminé ».'}</span></p>` : ''}
      <label>Quoi ?<input name="titre" value="${esc(v.titre)}" required placeholder="ex. Fuite garniture pompe alimentaire"></label>
      <label>Où ? · équipement (KKS)<input name="kks" list="dl-kks" value="${k ? esc(kksLabel(k)) : ''}" placeholder="Code ou désignation" autocomplete="off"></label>
      <label>Ce qui a été fait<span class="dict-wrap"><textarea name="travaux" rows="4" placeholder="Décrivez l’intervention…">${esc(v.travaux)}</textarea>${HAS_DICT ? `<button type="button" class="dict" data-dict="travaux" title="Dicter" aria-label="Dicter le texte">${icon('mic')}</button>` : ''}</span></label>
      <div class="grid2"><label>Date<input name="date" type="date" value="${esc(v.date)}" required></label><label>Statut<select name="statut">${Object.entries(STATUTS).map(([a, b]) => opt(a, b[0], v.statut)).join('')}</select></label></div>
      <fieldset><legend>Intervenants</legend>${people.length ? `<div class="chips" data-psel></div>
        <input data-padd placeholder="Tapez un nom : personne ou entreprise externe…" aria-label="Ajouter un intervenant" autocomplete="off">` : '<p class="hint">Aucune personne enregistrée.</p>'}</fieldset>
      <details class="more" ${!isNew && (v.constat || v.duree || v.pieces.length) ? 'open' : ''}><summary>${icon('chev')}Plus de détails <span class="muted">type, durée, constat, pièces utilisées</span></summary>
      <div class="grid2"><label>Type<select name="type">${optList(db.listes.types, v.type)}</select></label><label>Durée (heures)<input name="duree" type="number" min="0" step="0.25" value="${esc(v.duree)}"></label></div>
      <label>Constat / demande<span class="dict-wrap"><textarea name="constat" rows="3">${esc(v.constat)}</textarea>${HAS_DICT ? `<button type="button" class="dict" data-dict="constat" title="Dicter" aria-label="Dicter le texte">${icon('mic')}</button>` : ''}</span></label>
      <fieldset><legend>Pièces consommées</legend><div class="plines"></div><div class="tools"><button type="button" class="btn ghost small" data-addline>${icon('plus')}Ajouter une pièce</button></div><p class="hint">Les quantités sont retirées du stock à l’enregistrement ; modifier ou supprimer une ligne remet la différence en stock.</p></fieldset></details>`,
    del: isNew ? null : archDel('interventions', it, () => HARD.interventions(it)),
    onOpen(f, d){
      d._pers = new Set(v.intervenants); d._snap = snapFor;
      const sel = $('[data-psel]', d), grid = $('[data-pgrid]', d);
      if (sel){
        const want = tache?.assign?.type === 'groupe' ? tache.assign.v : tache?.assign?.type === 'personne' ? (getPers(tache.assign.v)?.groupe || '') : '';
        let tab = want && tabsP.some(x => x[0] === want) ? want : tabsP[0][0];
        const drawSel = () => { sel.innerHTML = [...d._pers].map(id => ({id, ...snapFor(id)})).sort(persSort).map(x => `<span class="c">${esc(persName(x))}${x.groupe ? ` <small class="muted">${esc(x.groupe)}</small>` : ''}<button type="button" class="icon-btn" data-prm="${x.id}" aria-label="Retirer ${esc(persName(x))}">×</button></span>`).join('') || '<span class="muted">Aucun intervenant choisi.</span>'; };
        const drawGrid = () => { if (!grid) return;
          if (tab === '__f'){ const fs = [...new Set([...fTop, ...[...d._pers].filter(isFourId).map(id => id.slice(5))])]; grid.innerHTML = fs.map(n => `<button type="button" class="pbtn four" data-pid="four:${esc(n)}" aria-pressed="${d._pers.has('four:' + n)}">${icon('truck')}${esc(n)}</button>`).join('') + `<p class="hint" style="grid-column:1/-1;margin:4px 0 0">${fs.length ? 'Les plus utilisées. ' : ''}Pour une autre entreprise, tapez son nom dans le champ ci-dessus (liste Options › Fournisseurs).</p>`; $$('[data-ptab]', d).forEach(b => b.setAttribute('aria-selected', String(b.dataset.ptab === tab))); return; }
          const ps = tab === '__r' ? recents.map(getPers).filter(Boolean) : people.filter(p => (p.groupe || '') === tab);
          grid.innerHTML = ps.map(p => `<button type="button" class="pbtn" data-pid="${p.id}" aria-pressed="${d._pers.has(p.id)}">${esc(persName(p))}</button>`).join('')
            + (tab !== '__r' && ps.length > 1 ? `<button type="button" class="pbtn all" data-pall>${ps.every(p => d._pers.has(p.id)) ? 'Retirer tout le groupe' : 'Tout le groupe'}</button>` : '');
          $$('[data-ptab]', d).forEach(b => b.setAttribute('aria-selected', String(b.dataset.ptab === tab)));
        };
        const toggle = id => { d._pers.has(id) ? d._pers.delete(id) : d._pers.add(id); drawSel(); drawGrid(); };
        $('.ptabs', d)?.addEventListener('click', e => { const b = e.target.closest('[data-ptab]'); if (b){ tab = b.dataset.ptab; drawGrid(); } });
        grid?.addEventListener('click', e => {
          const b = e.target.closest('[data-pid]'); if (b) return toggle(b.dataset.pid);
          if (e.target.closest('[data-pall]')){ const ps = people.filter(p => (p.groupe || '') === tab), all = ps.every(p => d._pers.has(p.id)); ps.forEach(p => all ? d._pers.delete(p.id) : d._pers.add(p.id)); drawSel(); drawGrid(); }
        });
        sel.addEventListener('click', e => { const b = e.target.closest('[data-prm]'); if (b){ d._pers.delete(b.dataset.prm); drawSel(); drawGrid(); } });
        combo($('[data-padd]', d), {keep:false, items: () => { const q = ($('[data-padd]', d).value || '').trim(); const fl = db.listes.fournisseurs.filter(n => !d._pers.has('four:' + n)).map(n => ({id:'four:' + n, label:n, search:n + ' entreprise externe fournisseur', html:`${icon('truck')} ${esc(n)}`, right:'<span class="muted">Entreprise</span>'})); const add = q.length > 1 && !db.listes.fournisseurs.some(n => norm(n) === norm(q)) && !people.some(p => norm(persName(p)) === norm(q)) ? [{id:'four:' + q, label:q, search:norm(q), html:`${icon('plus')} Ajouter l’entreprise « ${esc(q)} »`, right:'<span class="muted">nouvelle</span>'}] : []; return [...people.filter(p => !d._pers.has(p.id)).map(p => ({id:p.id, label:persName(p), search:persName(p) + ' ' + (p.groupe || ''), html:esc(persName(p)), right:p.groupe ? `<span class="muted">${esc(p.groupe)}</span>` : ''})), ...fl, ...add]; }, onPick: it => { d._pers.add(it.id); drawSel(); drawGrid(); }});
        drawSel(); drawGrid();
      }
      const wrap = $('.plines', d);
      const addLine = (line = {}) => {
        const row = document.createElement('div'); row.className = 'pline';
        const p0 = getPiece(line.pieceId);
        row.innerHTML = `<input class="pl-piece" placeholder="Pièce : tapez une réf. ou un nom…" aria-label="Pièce" value="${p0 ? esc(pieceLabel(p0)) : ''}" data-id="${p0 ? p0.id : ''}" data-label="${p0 ? esc(pieceLabel(p0)) : ''}"><select class="pl-lieu" aria-label="Emplacement de prélèvement"></select><input class="pl-qte" type="number" min="0" step="any" aria-label="Quantité" value="${line.qte ?? 1}"><button type="button" class="icon-btn" aria-label="Retirer la ligne">×</button>`;
        wrap.append(row);
        const sel = $('.pl-lieu', row); let want = line.lieuId || '';
        const fill = () => {
          const p = getPiece($('.pl-piece', row).dataset.id);
          if (!p){ sel.innerHTML = '<option value="">— emplacement —</option>'; return; }
          const lines = sortedStock(p), cur = sel.value || want;
          sel.innerHTML = lines.length ? lines.map(s => `<option value="${s.lieuId}" ${s.lieuId === cur ? 'selected' : ''}>${esc(lieuCode(getLieu(s.lieuId)))} · ${num(round(s.qte + (old.get(p.id + '|' + s.lieuId) || 0)))} dispo</option>`).join('') : '<option value="">Aucun stock</option>';
          if (!cur && lines.length) sel.value = lines.reduce((a, b) => b.qte > a.qte ? b : a).lieuId;
          want = '';
        };
        combo($('.pl-piece', row), {items:pieceItems, onPick: () => { sel.value = ''; want = ''; fill(); row.querySelector('.pl-qte').focus(); }});
        $('button', row).onclick = () => row.remove();
        fill(); return row;
      };
      v.pieces.forEach(addLine);
      $('[data-addline]', d).onclick = () => $('.pl-piece', addLine()).focus();
    },
    onSave(f, d){
      const titre = val(f, 'titre'), date = val(f, 'date');
      if (!titre) throw new Error('Indiquez un titre.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Indiquez une date.');
      let kk = null;
      if (val(f, 'kks')){ kk = findKks(val(f, 'kks')); if (!kk) throw new Error('Repère KKS inconnu : choisissez-le dans la liste, ou ajoutez-le dans Options › Repères KKS.'); }
      const duree = val(f, 'duree'); if (duree && !(+duree >= 0)) throw new Error('Durée invalide.');
      const merged = new Map();
      for (const row of $$('.pline', d)){
        const inp = $('.pl-piece', row), txt = inp.value.trim(); if (!txt) continue;
        const p = getPiece(inp.dataset.id) || findPiece(txt); if (!p) throw new Error(`Pièce introuvable : « ${txt} ». Choisissez-la dans la liste proposée.`);
        const lieuId = $('.pl-lieu', row).value; if (!lieuId) throw new Error(`${p.ref} n’est rangée dans aucun emplacement : impossible de la prélever.`);
        const q = +$('.pl-qte', row).value; if (!(q > 0)) throw new Error(`Quantité invalide pour ${p.ref}.`);
        const key = p.id + '|' + lieuId; merged.set(key, round((merged.get(key) || 0) + q));
      }
      /* Rapport déjà validé : tout reste tel qu'au moment de la validation. Sinon : on reprend les données actuelles (elles seront figées à la validation). */
      const frozen = !!it && it.statut === 'terminee';
      const lines = [...merged].map(([key, qte]) => { const [pieceId, lieuId] = key.split('|'); const prev = (it?.pieces || []).find(x => x.pieceId === pieceId && x.lieuId === lieuId && x.s); return {pieceId, lieuId, qte, s:frozen && prev ? prev.s : pSnap(getPiece(pieceId), getLieu(lieuId))}; });
      const persSnapFor = id => frozen && it.snap?.[id] ? it.snap[id] : isFourId(id) ? fourSnap(id.slice(5)) : getPers(id) ? persSnap(getPers(id)) : (it?.snap?.[id] || {nom:'(supprimé)', prenom:'', groupe:''});
      for (const id of d._pers) if (isFourId(id) && !db.listes.fournisseurs.some(n => n === id.slice(5))) { db.listes.fournisseurs.push(id.slice(5)); db.listes.fournisseurs.sort(coll.compare); }
      const tk = get('taches', it ? it.tacheId : tache?.id);
      const data = {date, type:val(f, 'type'), statut:val(f, 'statut'), titre, kksId:kk ? kk.id : '', constat:val(f, 'constat'), travaux:val(f, 'travaux'), duree:duree ? +duree : '', intervenants:[...d._pers], snap:Object.fromEntries([...d._pers].map(id => [id, persSnapFor(id)])), pieces:lines,
        ks:kk ? (frozen && it.ks && it.kksId === kk.id ? it.ks : kSnap(kk)) : null,
        ts:frozen && it.ts ? it.ts : tk ? tSnap(tk) : (it?.ts || null)};
      tx(() => {
        const numero = isNew ? nextNum(date) : it.num;
        for (const key of new Set([...old.keys(), ...merged.keys()])){
          const delta = round((merged.get(key) || 0) - (old.get(key) || 0)); if (!delta) continue;
          const [pieceId, lieuId] = key.split('|'); const p = getPiece(pieceId);
          if (p && getLieu(lieuId)) addStock(p, lieuId, -delta, delta > 0 ? 'Sortie intervention' : 'Retour intervention', numero);
        }
        let rec;
        if (isNew){ rec = {id:uid(), num:numero, ...data, ...(tache ? {tacheId:tache.id} : {})}; db.interventions.push(rec); S.sel.interventions = rec.id; }
        else { Object.assign(it, data); rec = it; }
        const tt = get('taches', rec.tacheId);
        if (tt && data.statut === 'terminee' && !rec.tacheFait){ advanceTask(tt, date); rec.tacheFait = true; }
      });
      if (T && isNew){ S.view = 'taches'; render(); toast('Rapport créé' + (get('taches', T.id)?.actif === false ? ', tâche faite' : '')); return; }
      S.view = 'interventions'; S.statut = data.statut === 'terminee' ? 'terminee' : 'actives';
      render(); toast(isNew ? 'Rapport créé' : 'Rapport enregistré');
    }});
}
function pieceSheetHTML(p){
  const lines = sortedStock(p), ks = p.kks.map(getKks).filter(Boolean), ints = usedInInterventions(p.id).sort((a, b) => b.date.localeCompare(a.date));
  const four = p.fournisseur || p.fabricant;
  return `<article class="rpt">
    <header class="rpt-head"><div><div class="rpt-org">Tridel · Maintenance</div><h1>Fiche pièce</h1></div><div class="rpt-num"><div>${esc(p.ref)}</div></div></header>
    <div class="ps-top"><div>
      <div class="ps-des">${esc(p.designation)}</div>
      <table class="rpt-grid">
        <tr><th>Catégorie</th><td>${esc(p.categorie) || '—'}</td><th>Unité</th><td>${esc(p.unite)}</td></tr>
        <tr><th>Marque</th><td>${esc(p.fabricant) || '—'}</td><th>Réf. marque</th><td class="mono">${esc(p.refFab) || '—'}</td></tr>
        <tr><th>Fournisseur</th><td colspan="3">${esc(four) || '—'}</td></tr>
        <tr><th>Stock total</th><td><strong>${num(total(p))} ${esc(p.unite)}</strong></td><th>Stock mini</th><td>${+p.stockMin ? num(p.stockMin) + ' ' + esc(p.unite) : '—'}</td></tr>
      </table></div>
      <div class="ps-qr">${qrSvg(qrText(p))}<div class="mono">${esc(p.ref)}</div></div></div>
    <h2>Lieux de stockage</h2>${lines.length ? `<table class="rpt-tbl"><thead><tr><th>Emplacement</th><th class="n">Quantité</th></tr></thead><tbody>${lines.map(x => { const l = getLieu(x.lieuId), nm = getSalle(l.salleId)?.nom; return `<tr><td class="mono"><strong>${esc(lieuCode(l))}</strong>${nm ? ` <span style="font-family:sans-serif;color:#555">· ${esc(nm)}</span>` : ''}</td><td class="n">${num(x.qte)} ${esc(p.unite)}</td></tr>`; }).join('')}</tbody></table>` : '<p>Rangée nulle part.</p>'}
    <h2>Repères KKS (montée sur)</h2>${ks.length ? `<table class="rpt-tbl"><thead><tr><th>Code KKS</th><th>Équipement</th></tr></thead><tbody>${ks.map(k => `<tr><td class="mono"><strong>${esc(k.code)}</strong></td><td>${esc(k.designation)}</td></tr>`).join('')}</tbody></table>` : '<p>Aucun repère lié.</p>'}
    ${p.notes ? `<h2>Notes</h2><div class="rpt-box" style="min-height:0">${esc(p.notes)}</div>` : ''}
    ${ints.length ? `<h2>Dernières interventions</h2><table class="rpt-tbl"><thead><tr><th>N°</th><th>Date</th><th>Objet</th><th class="n">Qté</th></tr></thead><tbody>${ints.slice(0, 10).map(i => `<tr><td class="mono">${esc(i.num)}</td><td>${fmtD(i.date)}</td><td>${esc(i.titre)}</td><td class="n">${num(i.pieces.filter(x => x.pieceId === p.id).reduce((a, x) => a + x.qte, 0))}</td></tr>`).join('')}</tbody></table>` : ''}
    <footer class="rpt-foot">Imprimé le ${fmtDT(new Date().toISOString())} · TriFlow</footer></article>`;
}
function reportHTML(i){
  const k = kInfo(i), T = tInfo(i);
  return `<article class="rpt">
    <header class="rpt-head"><div><div class="rpt-org">Tridel · Maintenance</div><h1>Rapport d’intervention</h1></div><div class="rpt-num"><div>${esc(i.num)}</div><div>${fmtD(i.date)}</div></div></header>
    <table class="rpt-grid"><tr><th>Type</th><td>${esc(i.type || '')}</td><th>Statut</th><td>${STATUTS[i.statut]?.[0] || ''}</td></tr>
      <tr><th>Objet</th><td colspan="3"><strong>${esc(i.titre)}</strong></td></tr>
      <tr><th>Équipement</th><td colspan="3">${k ? `<span class="mono">${esc(k.code)}</span> — ${esc(k.designation)} <span style="color:#555">${k.aic ? `AIC ${esc(k.aic)} · ` : ''}${esc(sysLabel(k.code))}</span>` : '—'}</td></tr>
      ${T ? `<tr><th>Tâche</th><td colspan="3">${esc(T.titre)} <span style="color:#555">· ${esc(T.freq)}</span></td></tr>` : ''}
      <tr><th>Intervenants</th><td colspan="3">${esc(intPers(i).map(snapLabel).join(', ')) || '—'}</td></tr>
      <tr><th>Durée</th><td>${i.duree ? num(i.duree) + ' h' : ''}</td><th>Date</th><td>${fmtD(i.date)}</td></tr></table>
    <h2>Constat / demande</h2><div class="rpt-box">${esc(i.constat)}</div>
    <h2>Travaux réalisés</h2><div class="rpt-box tall">${esc(i.travaux)}</div>
    <h2>Pièces consommées</h2>${i.pieces.length ? `<table class="rpt-tbl"><thead><tr><th>ID</th><th>Désignation</th><th>Prélevé en</th><th class="n">Qté</th></tr></thead><tbody>${i.pieces.map(x => { const s = lineInfo(x, i); return `<tr><td class="mono">${esc(s.ref)}</td><td>${esc(s.designation)}</td><td class="mono">${esc(s.lieu)}</td><td class="n">${num(x.qte)} ${esc(s.unite || '')}</td></tr>`; }).join('')}</tbody></table>` : '<p>Aucune pièce consommée.</p>'}
    <div class="rpt-sign"><div><span>Intervenant(s)</span><div class="sigbox"></div><small>Nom, date, signature</small></div><div><span>Responsable</span><div class="sigbox"></div><small>Nom, date, visa</small></div></div>
    <footer class="rpt-foot">Imprimé le ${fmtDT(new Date().toISOString())} · TriFlow</footer></article>`;
}

/* ---------- KKS ---------- */
function kksDialog(k){
  const isNew = !k, v = k || {code:'', designation:'', aic:''};
  dialog({title: isNew ? 'Nouvel équipement' : 'Modifier l’équipement',
    body:`<label>Code KKS<input name="code" value="${esc(v.code)}" required placeholder="ex. 1LCF10AA710" style="font-family:var(--f-mono)"></label><label>Désignation<input name="designation" value="${esc(v.designation)}" required placeholder="ex. Vanne condensats EC1 fumées"></label>
      <label>Code AIC <span class="muted">(facultatif)</span><input name="aic" value="${esc(v.aic || '')}" placeholder="ex. 14 DF J1" style="font-family:var(--f-mono)"></label>
      <p class="preview-code">Système : <span data-zone></span></p>`,
    onOpen(f, d){ const u = () => $('[data-zone]', d).textContent = sysLabel(val(f, 'code')) || '—'; f.addEventListener('input', u); u(); },
    del: isNew ? null : archDel('kks', k, function(){
      if (db.interventions.some(i => i.kksId === k.id)) throw new Error('Cet équipement est utilisé dans des rapports d’intervention.');
      tx(() => { db.kks = db.kks.filter(x => x !== k); db.pieces.forEach(p => p.kks = p.kks.filter(id => id !== k.id)); });
      S.sel.kks = null; render(); toast('Équipement supprimé');
    }),
    onSave(f){
      const code = normCode(val(f, 'code')), designation = val(f, 'designation'), aic = val(f, 'aic');
      if (!code) throw new Error('Indiquez le code KKS.');
      if (!designation) throw new Error('Indiquez une désignation.');
      if (db.kks.some(x => x !== k && x.code.toUpperCase() === code)) throw new Error(`Le code ${code} existe déjà.`);
      tx(() => { if (isNew){ const n = {id:uid(), code, designation, aic}; db.kks.push(n); S.sel.kks = n.id; } else Object.assign(k, {code, designation, aic}); });
      render(); toast(isNew ? 'Équipement ajouté' : 'Équipement enregistré');
    }});
}
function importKksDialog(){
  dialog({title:'Coller une liste d’équipements', saveLabel:'Importer', wide:true,
    body:`<p>Une ligne par équipement : code KKS, désignation, puis le code AIC s’il existe, séparés par une tabulation (copier-coller depuis Excel) ou un point-virgule. Un code déjà connu est mis à jour. Une ligne avec seulement des lettres (ex. « HAC;Economiseurs ») donne le nom d’un système.</p>
      <label>Liste<textarea name="txt" rows="10" style="font-family:var(--f-mono);font-size:.85rem" placeholder="1LCF10AA710;Vman condens EC1 Fumées;14 DF J1&#10;1HNC10AN001;Ventilateur de tirage, ligne 1"></textarea></label>`,
    onSave(f){
      const lines = val(f, 'txt').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (!lines.length) throw new Error('Collez au moins une ligne.');
      let add = 0, upd = 0, sys = 0;
      const byCode = new Map(db.kks.map(x => [x.code.toUpperCase(), x]));
      tx(() => { for (const ln of lines){
        const [c, designation = '', aic = ''] = ln.split(/\t|;/).map(x => x.trim()); const code = normCode(c);
        if (!code || /^code/i.test(code) || /^\W*#/.test(code)) continue;
        if (/^[A-Z]{1,3}$/.test(code)){ if (designation && db.listes.systemes[code] !== designation){ db.listes.systemes[code] = designation; sys++; } continue; }
        const ex = byCode.get(code);
        if (ex){ let ch = false; if (designation && ex.designation !== designation){ ex.designation = designation; ch = true; } if (aic && ex.aic !== aic){ ex.aic = aic; ch = true; } if (ch) upd++; }
        else { const n = {id:uid(), code, designation: designation || code, aic}; db.kks.push(n); byCode.set(code, n); add++; }
      }});
      render(); toast(`${add} équipement(s) ajouté(s), ${upd} mis à jour${sys ? `, ${sys} nom(s) de système` : ''}`);
    }});
}

/* ---------- Personnes ---------- */
function persDialog(p){
  const isNew = !p, v = p || {prenom:'', nom:'', groupe:'', actif:true};
  dialog({title: isNew ? 'Nouvelle personne' : 'Modifier la personne',
    body:`<div class="grid2"><label>Nom<input name="nom" value="${esc(v.nom)}" required></label><label>Prénom (facultatif)<input name="prenom" value="${esc(v.prenom || '')}"></label></div>
      <label>Groupe<select name="groupe">${optList(db.listes.groupes, v.groupe, '—')}</select></label>
      ${v.src === 'planning' ? '<p class="hint">Personne reprise du Planning Tridel : son groupe est remis à jour automatiquement depuis le planning.</p>' : ''}`,
    del: isNew ? null : archDel('personnes', p, function(){
      tx(() => db.personnes = db.personnes.filter(x => x !== p)); render(); toast('Personne supprimée');
    }),
    onSave(f){
      const data = {prenom:val(f, 'prenom'), nom:val(f, 'nom'), groupe:val(f, 'groupe')};
      if (!data.nom) throw new Error('Indiquez le nom.');
      tx(() => { if (isNew) db.personnes.push({id:uid(), fonction:'', actif:true, ...data}); else Object.assign(p, data); });
      render(); toast(isNew ? 'Personne ajoutée' : 'Personne enregistrée');
    }});
}
/* Personnel : repris du Planning Tridel en ligne à l'ouverture (au plus une fois par jour, en silence).
   Sans connexion, la liste intégrée au fichier sert de base. */
async function syncPlanning(){
  const today = todayISO();
  if (db.meta.staffSync === today) return;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`${PLANNING_URL}planning-${today.slice(0, 4)}.json`, {cache:'no-store', signal:ctl.signal}); clearTimeout(t);
    if (!r.ok) return;
    const j = await r.json(), fb = Object.fromEntries(PLANNING_STAFF);
    const list = (j.employes || []).map(e => { const nom = String(e.nom || '').trim(); const cat = String(e.categorie || '').trim(); return [nom, PLANNING_CAT[cat] || cat || fb[nom.toUpperCase()] || '']; }).filter(x => x[0]);
    if (list.length < 5) return;
    CLOUD.auto = true; tx(() => { mergeStaff(db, list, true); db.meta.staffSync = today; });
    if (S.view === 'options') render();
  } catch(e){ /* hors ligne ou bloqué : on garde la liste actuelle */ }
}

/* ---------- Exports ---------- */
function download(name, text, type){
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name;
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const csvCell = v => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = rows => '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n');
/* Fichier Excel (.xlsx) écrit directement, sans bibliothèque externe */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zipStore(files){
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  for (const f of files){
    const nm = enc.encode(f.name), d = enc.encode(f.text), c = crc32(d);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, 0x21, true); h.setUint32(14, c, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, d);
    const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, c, true); ch.setUint32(20, d.length, true); ch.setUint32(24, d.length, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    cen.push(new Uint8Array(ch.buffer), nm);
    off += 30 + nm.length + d.length;
  }
  const size = cen.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cen, new Uint8Array(e.buffer)], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function downloadXlsx(name, sheet, rows){
  const x = v => String(v ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
  const col = i => { let r = ''; i++; while (i){ const m = (i - 1) % 26; r = String.fromCharCode(65 + m) + r; i = Math.floor((i - 1) / 26); } return r; };
  const widths = rows[0].map((_, i) => Math.min(60, Math.max(8, ...rows.slice(0, 400).map(r => String(r[i] ?? '').split('\n')[0].length + 2))));
  const data = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => { const ref = col(ci) + (ri + 1), st = ri === 0 ? ' s="1"' : ''; return typeof v === 'number' && isFinite(v) ? `<c r="${ref}"${st}><v>${v}</v></c>` : v === '' || v == null ? '' : `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${x(v)}</t></is></c>`; }).join('')}</row>`).join('');
  const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const files = [
    {name:'[Content_Types].xml', text:`${H}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`},
    {name:'_rels/.rels', text:`${H}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:'xl/workbook.xml', text:`${H}<workbook ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${x(String(sheet).replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`},
    {name:'xl/_rels/workbook.xml.rels', text:`${H}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:'xl/styles.xml', text:`${H}<styleSheet ${NS}><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6EFE8"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`},
    {name:'xl/worksheets/sheet1.xml', text:`${H}<worksheet ${NS}><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${data}</sheetData></worksheet>`}];
  const a = document.createElement('a'); a.href = URL.createObjectURL(zipStore(files)); a.download = name;
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const xlName = what => `triflow-${what}-${todayISO()}.xlsx`;
function xlPieces(){
  const rows = filteredPieces(), out = [['ID', 'Désignation', 'Marque', 'Réf. marque', 'Fournisseur', 'Emplacement principal', 'Autres emplacements', 'En magasin', 'Unité', 'Stock minimum', 'Équipements (KKS)', 'Notes']];
  for (const p of rows){ const ls = sortedStock(p).map(x => getLieu(x.lieuId)).filter(Boolean), mp = mainPlace(p); out.push([/^\d+$/.test(p.ref) ? +p.ref : p.ref, p.designation, p.fabricant || '', p.refFab || '', p.fournisseur || '', mp ? lieuCode(mp) : '', ls.filter(l => l !== mp).map(lieuCode).join(', '), dispo(p), p.unite || '', p.stockMin || '', p.kks.map(id => getKks(id)?.code).filter(Boolean).join(', '), p.notes || '']); }
  downloadXlsx(xlName(S.arch.pieces ? 'pieces-archivees' : 'pieces'), 'Pièces', out); toast(`${rows.length} pièce(s) exportée(s)`);
}
function xlInts(){
  const rows = filteredInts(), out = [['N°', 'Date', 'Type', 'Statut', 'Titre', 'Repère KKS', 'Équipement', 'Intervenants', 'Durée (h)', 'Constat', 'Travaux', 'Pièces consommées']];
  for (const i of rows){ const k = kInfo(i); out.push([i.num, fmtD(i.date), i.type || '', (STATUTS[i.statut] || [i.statut])[0], i.titre, k ? k.code : '', k ? k.designation : '', intPers(i).map(persName).join(', '), i.duree ? +i.duree : '', i.constat || '', i.travaux || '', i.pieces.map((x, n) => { const s = lineInfo(x, i); return `${x.qte} × ${s.ref} ${s.designation}`; }).join('\n')]); }
  downloadXlsx(xlName('rapports'), 'Rapports', out); toast(`${rows.length} rapport(s) exporté(s)`);
}
function xlTaches(){
  const rows = filteredTaches(), out = [['Tâche', 'Repère KKS', 'Équipement', 'Pour', 'Fréquence', 'Prochaine fois', 'Dernière fois', 'Ce qu’il faut faire']];
  for (const t of rows){ const k = getKks(t.kksId); out.push([t.titre, k ? k.code : '', k ? k.designation : '', assignLabel(t.assign), freqLabel(t.freq), t.actif === false ? 'Faite' : fmtD(t.prochaine), t.derniere ? fmtD(t.derniere) : '', t.description || '']); }
  downloadXlsx(xlName('taches'), 'Tâches', out); toast(`${rows.length} tâche(s) exportée(s)`);
}
function xlKks(){
  const q = norm(S.q.kks), cur = S.sys && S.sys !== '?' ? S.sys : '';
  const rows = db.kks.filter(k => S.arch.kks ? k.arch : live(k)).filter(k => q ? norm(`${k.code} ${k.designation} ${k.aic || ''}`).includes(q) : !cur || (sysEff(k.code) || '').startsWith(cur)).sort(kksSort);
  const out = [['Code KKS', 'Désignation', 'AIC', 'Système', 'Pièces liées', 'Rapports']];
  const np = new Map(), ni = new Map(); for (const p of db.pieces) if (live(p)) for (const id of p.kks) np.set(id, (np.get(id) || 0) + 1); for (const i of db.interventions) if (live(i) && i.kksId) ni.set(i.kksId, (ni.get(i.kksId) || 0) + 1);
  for (const k of rows) out.push([k.code, k.designation, k.aic || '', sysLabel(k.code) || '', np.get(k.id) || 0, ni.get(k.id) || 0]);
  downloadXlsx(xlName(cur ? 'installation-' + cur : 'installation'), cur ? 'Installation ' + cur : 'Installation', out); toast(`${rows.length} équipement(s) exporté(s)`);
}
function exportStock(){
  const rows = [["ID", 'Désignation', 'Catégorie', 'Marque', 'Réf. marque', 'Fournisseur', 'Emplacement', 'Salle', 'Quantité', 'Unité', 'Stock total', 'Stock minimum', 'Repères KKS']];
  for (const p of db.pieces.filter(live).sort((a, b) => coll.compare(a.ref, b.ref))){
    const kk = p.kks.map(id => getKks(id)?.code).filter(Boolean).join(', ');
    const lines = p.stock.length ? p.stock : [null];
    for (const s of lines){ const l = s && getLieu(s.lieuId); rows.push([p.ref, p.designation, p.categorie, p.fabricant, p.refFab, p.fournisseur || p.fabricant, l ? lieuCode(l) : '', l ? getSalle(l.salleId)?.nom : '', s ? s.qte : '', p.unite, total(p), p.stockMin || '', kk]); }
  }
  downloadXlsx(xlName('stock'), 'Stock', rows); toast('Export du stock téléchargé');
}
function exportInts(){
  const rows = [['N°', 'Date', 'Type', 'Statut', 'Titre', 'Repère KKS', 'Équipement', 'Zone', 'Intervenants', 'Durée (h)', 'Constat', 'Travaux', 'Pièces consommées']];
  for (const i of [...db.interventions].sort((a, b) => a.num.localeCompare(b.num))){
    const k = kInfo(i);
    rows.push([i.num, fmtD(i.date), i.type || '', STATUTS[i.statut]?.[0] || '', i.titre, k?.code || '', k?.designation || '', k ? sysLabel(k.code) : '', intPers(i).map(snapLabel).join(', '), i.duree, i.constat, i.travaux, i.pieces.map(x => { const s = lineInfo(x, i); return `${num(x.qte)} × ${s.ref || '?'} ${s.designation} (${s.lieu})`; }).join(', ')]);
  }
  downloadXlsx(xlName('rapports'), 'Rapports', rows); toast('Export des rapports téléchargé');
}
function exportKksLinks(){
  const rows = [['Repère KKS', 'Équipement', "Système", "ID pièce", 'Désignation pièce', 'Stock']];
  for (const k of [...db.kks].sort((a, b) => coll.compare(a.code, b.code))){
    const ps = db.pieces.filter(p => p.kks.includes(k.id));
    if (!ps.length) rows.push([k.code, k.designation, sysLabel(k.code), '', '', '']);
    ps.forEach(p => rows.push([k.code, k.designation, sysLabel(k.code), p.ref, p.designation, total(p)]));
  }
  downloadXlsx(xlName('kks-pieces'), 'Pièces et KKS', rows); toast('Export des liens téléchargé');
}

