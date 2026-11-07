'use strict';
/* TriFlow — Recherche globale et scan QR. (Fichiers chargés dans l'ordre par index.html.) */
/* =====================================================================
   RECHERCHE GLOBALE / SCAN
   ===================================================================== */
let gHits = [];
function searchAll(raw){
  let q = String(raw || '').trim(); if (!q) return null;
  const m = q.match(/#(piece|lieu|int)=(.+)$/); if (m){ try { q = decodeURIComponent(m[2]); } catch(e){ q = m[2]; } }
  const n = norm(q), has = s => norm(s).includes(n);
  return {
    pieces: db.pieces.filter(p => live(p) && has([p.ref, p.designation, p.fabricant, p.refFab].join(' '))).slice(0, 6),
    lieux: db.lieux.filter(l => liveLieu(l) && has(lieuCode(l) + ' ' + (getSalle(l.salleId)?.nom || ''))).sort(lieuSort).slice(0, 5),
    kks: db.kks.filter(k => live(k) && has(`${k.code} ${k.designation} ${k.aic || ''}`)).slice(0, 5),
    ints: db.interventions.filter(i => live(i) && has(i.num + ' ' + i.titre)).slice(0, 4), q
  };
}
function renderSearch(){
  const box = $('#gres'), r = searchAll($('#gq').value);
  if (!r){ box.hidden = true; gHits = []; return; }
  gHits = [];
  const item = (view, id, left, text, right) => { gHits.push({view, id}); return `<button data-act="goto" data-view="${view}" data-id="${id}" class="${gHits.length === 1 ? 'hot' : ''}">${left}<span class="t">${text}</span>${right ? `<span class="r">${right}</span>` : ''}</button>`; };
  let html = '';
  if (r.pieces.length) html += '<h4>Pièces</h4>' + r.pieces.map(p => item('pieces', p.id, `<span class="ref">${esc(p.ref)}</span>`, esc(p.designation), `<span class="qty">${num(total(p))} ${esc(p.unite)}</span>`)).join('');
  if (r.lieux.length) html += '<h4>Emplacements</h4>' + r.lieux.map(l => item('lieux', l.id, `<span class="plate">${esc(lieuCode(l))}</span>`, esc(getSalle(l.salleId)?.nom || ''), '')).join('');
  if (r.kks.length) html += '<h4>Installation</h4>' + r.kks.map(k => item('kks', k.id, `<span class="kks">${esc(k.code)}</span>`, esc(k.designation), '')).join('');
  if (r.ints.length) html += '<h4>Rapports</h4>' + r.ints.map(i => item('interventions', i.id, `<span class="ref">${esc(i.num)}</span>`, esc(i.titre), statutChip(i.statut))).join('');
  box.innerHTML = html || `<p class="none">Rien trouvé pour « ${esc(r.q)} ».</p>`;
  box.hidden = false;
}
function closeSearch(){ $('#gres').hidden = true; }
$('#gq').addEventListener('input', renderSearch);
$('#gq').addEventListener('focus', () => { if ($('#gq').value.trim()) renderSearch(); });
$('#gq').addEventListener('keydown', e => {
  if (e.key === 'Escape'){ $('#gq').value = ''; closeSearch(); $('#gq').blur(); }
  if (e.key === 'Enter'){
    e.preventDefault();
    const r = searchAll($('#gq').value); if (!r) return;
    const qn = normCode(r.q);
    const exact = db.pieces.find(p => p.ref.toUpperCase() === qn) ? {view:'pieces', id:db.pieces.find(p => p.ref.toUpperCase() === qn).id}
      : findLieu(qn) ? {view:'lieux', id:findLieu(qn).id}
      : db.kks.find(k => k.code.toUpperCase() === qn) ? {view:'kks', id:db.kks.find(k => k.code.toUpperCase() === qn).id}
      : db.interventions.find(i => i.num.toUpperCase() === qn) ? {view:'interventions', id:db.interventions.find(i => i.num.toUpperCase() === qn).id} : gHits[0];
    if (exact){ $('#gq').value = ''; go(exact.view, exact.id); }
  }
});
window.addEventListener('scroll', e => { if (!e.target.closest?.('.menu-list')) closeMenus(); }, true);
window.addEventListener('resize', () => closeMenus());
document.addEventListener('mousedown', e => { if (!e.target.closest('.gsearch')) closeSearch(); if (!e.target.closest('.menu')) closeMenus(); if (!e.target.closest('#fab .fab-btn')){ const m = $('#fab .fab-menu'); if (m && !m.hidden && !e.target.closest('#fab .fab-menu')){ m.hidden = true; $('#fab .fab-btn').setAttribute('aria-expanded', 'false'); } } });
document.addEventListener('mousedown', e => { const ns = $('#navsheet'); if (ns && !ns.hidden && !e.target.closest('#navsheet') && !e.target.closest('.nav-plus')) ns.hidden = true; });
document.getElementById('fab').addEventListener('click', e => { if (e.target.closest('.fab-menu button')){ setTimeout(() => { $('#fab .fab-menu').hidden = true; $('#fab .fab-btn').setAttribute('aria-expanded', 'false'); }, 0); } });
document.addEventListener('keydown', e => {
  const list = e.target.closest?.('.menu-list');
  if (e.key === 'Escape' && document.querySelector('.menu-list:not([hidden])')){ const open = document.querySelector('.menu-list:not([hidden])'); closeMenus(); open.previousElementSibling.focus(); }
  if (list && (e.key === 'ArrowDown' || e.key === 'ArrowUp')){ e.preventDefault(); const b = [...list.querySelectorAll('button')], i = b.indexOf(e.target); b[(i + (e.key === 'ArrowDown' ? 1 : b.length - 1)) % b.length].focus(); }
});

/* Scanner un QR code avec la caméra (téléphone ou PC) */
let jsQRp = null;
const loadJsQR = () => window.jsQR ? Promise.resolve() : jsQRp || (jsQRp = new Promise((ok, ko) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'; sc.onload = ok; sc.onerror = () => { jsQRp = null; ko(new Error('Lecteur de QR indisponible (pas de connexion ?).')); }; document.head.append(sc); }));
function openCode(raw){
  const t = String(raw || '').trim(); if (!t) return false;
  const m = t.match(/#(piece|lieu|int)=(.+)$/); let v = m ? m[2] : t; try { v = decodeURIComponent(v); } catch(e){}
  const c = normCode(v);
  const p = (!m || m[1] === 'piece') && (db.pieces.find(x => x.ref.toUpperCase() === c) || (!m ? null : findPiece(v)));
  if (p){ go('pieces', p.id); return true; }
  const l = (!m || m[1] === 'lieu') && findLieu(c); if (l){ go('lieux', l.id); return true; }
  const k = !m && db.kks.find(x => x.code.replace(/\s+/g, '').toUpperCase() === c.replace(/\s+/g, '')); if (k){ go('kks', k.id); return true; }
  const i = (!m || m[1] === 'int') && db.interventions.find(x => x.num.toUpperCase() === c); if (i){ go('interventions', i.id); return true; }
  toast(`Code « ${v} » : rien trouvé.`, 'bad'); return false;
}
function scanDialog(){
  let stream = null, raf = 0, done = false;
  const d = dialog({title:'Scanner un QR code', saveLabel:'Fermer', body:`<div class="scanbox"><video playsinline muted></video><span class="scan-frame"></span></div><p class="hint" data-sm>Visez l’étiquette QR d’une pièce ou d’un emplacement.</p>
      <label>Ou tapez le code<input name="code" placeholder="ID de pièce, emplacement, KKS ou n° de rapport" autocomplete="off"></label>`,
    onSave(f){ const v = val(f, 'code'); if (!v) return; if (!openCode(v)) return false; },
    async onOpen(f, dd){
      const video = $('video', dd), msg = $('[data-sm]', dd), cv = document.createElement('canvas'), cx = cv.getContext('2d', {willReadFrequently:true});
      dd.addEventListener('close', () => { done = true; cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); });
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('La caméra n’est pas disponible dans ce navigateur.');
        stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}, audio:false});
        if (done){ stream.getTracks().forEach(t => t.stop()); return; }
        video.srcObject = stream; await video.play();
        const det = 'BarcodeDetector' in window ? new BarcodeDetector({formats:['qr_code']}) : null;
        if (!det) await loadJsQR();
        const hit = txt => { if (done || !txt) return; done = true; try { navigator.vibrate?.(35); } catch(e){} dd.classList.add('scan-ok'); setTimeout(() => { dd.close(); openCode(txt); }, 180); };
        const tick = async () => {
          if (done) return;
          if (video.readyState >= 2){
            try {
              if (det){ const r = await det.detect(video); if (r[0]) return hit(r[0].rawValue); }
              else { const w = cv.width = video.videoWidth, h = cv.height = video.videoHeight; cx.drawImage(video, 0, 0, w, h); const r = window.jsQR(cx.getImageData(0, 0, w, h).data, w, h, {inversionAttempts:'dontInvert'}); if (r) return hit(r.data); }
            } catch(e){}
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch(e){ msg.textContent = (e.name === 'NotAllowedError' ? 'Accès à la caméra refusé. Autorisez-le dans le navigateur, ou tapez le code ci-dessous.' : e.message || 'Caméra indisponible.'); $('.scanbox', dd).hidden = true; }
    }});
  return d;
}

