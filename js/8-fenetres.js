'use strict';
/* TriFlow — Fenêtres : dialog(), pièce, mouvement, emplacements, imports, étiquettes, impression, combo(). (Fichiers chargés dans l'ordre par index.html.) */
/* =====================================================================
   DIALOGUES
   ===================================================================== */
function dialog({title, body, onSave, saveLabel = 'Enregistrer', wide = false, del = null, onOpen = null, info = false, cls = ''}) {
  closeSearch();
  const d = document.createElement('dialog');
  d.className = 'dlg' + (wide ? ' wide' : '') + (cls ? ' ' + cls : '');
  d.innerHTML = `<form novalidate><header><h2>${title}</h2><button type="button" class="icon-btn" data-close aria-label="Fermer">×</button></header>
    <div class="dlg-body">${body}</div><p class="dlg-err" hidden></p>
    <footer>${del ? `<button type="button" class="btn ${del.soft ? 'ghost' : 'danger-ghost'} left" data-del>${del.soft ? icon('archive') : ''}${del.label}</button>` : ''}${info ? '' : '<button type="button" class="btn" data-close>Annuler</button>'}<button type="submit" class="btn primary">${saveLabel}</button></footer></form>`;
  document.body.append(d);
  const f = $('form', d),
    err = $('.dlg-err', d);
  const fail = e => {
    err.textContent = e.message;
    err.hidden = false;
    err.scrollIntoView({block: 'nearest'});
  };
  $$('[data-close]', d).forEach(b => (b.onclick = () => d.close()));
  d.addEventListener('close', () => {
    d.remove();
    if (CLOUD.dirty && !document.querySelector('dialog[open]')) {
      CLOUD.dirty = false;
      render();
    }
  });
  f.addEventListener('submit', e => {
    e.preventDefault();
    let r;
    try {
      r = onSave(f, d);
    } catch (x) {
      fail(x);
      return;
    }
    if (r && typeof r.then === 'function') {
      const b = f.querySelector('button[type=submit]'),
        t = b.textContent;
      b.disabled = true;
      b.textContent = 'Un instant…';
      r.then(
        v => {
          if (v !== false) d.close();
        },
        x => fail(x)
      ).finally(() => {
        b.disabled = false;
        b.textContent = t;
      });
      return;
    }
    if (r !== false) d.close();
  });
  if (del) {
    const b = $('[data-del]', d);
    let armed = false;
    b.onclick = () => {
      if (!armed && !del.soft) {
        armed = true;
        b.textContent = 'Confirmer la suppression définitive';
        b.classList.replace('danger-ghost', 'danger');
        return;
      }
      try {
        del.run();
        d.close();
      } catch (x) {
        fail(x);
      }
    };
  }
  /* Téléphone : la page derrière ne bouge plus pendant qu'une fenêtre est ouverte, et le clavier ne s'ouvre pas tout seul */
  const phone = matchMedia('(max-width: 760px)').matches;
  if (phone) scrollLock(true);
  d.addEventListener('close', () => phone && scrollLock(false));
  d.showModal();
  onOpen && onOpen(f, d);
  const first = $('input:not([disabled]):not([type=hidden]):not([type=radio]),select,textarea', $('.dlg-body', d));
  if (first && !phone) first.focus({preventScroll: true});
  else if (phone) {
    d.setAttribute('tabindex', '-1');
    d.focus({preventScroll: true});
  }
  return d;
}
function scrollLock(on) {
  const b = document.body;
  if (on) {
    if (scrollLock.n++) return;
    scrollLock.y = scrollY;
    Object.assign(b.style, {position: 'fixed', top: -scrollLock.y + 'px', left: '0', right: '0'});
  } else {
    if (--scrollLock.n > 0) return;
    scrollLock.n = 0;
    Object.assign(b.style, {position: '', top: '', left: '', right: ''});
    scrollTo(0, scrollLock.y || 0);
  }
}
scrollLock.n = 0;
const val = (f, n) => {
  const el = f.elements[n];
  if (!el) return '';
  return String(el.value ?? '').trim();
};
const opt = (v, t, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(t)}</option>`;
const optList = (list, cur, emptyLabel) =>
  (emptyLabel != null ? opt('', emptyLabel, cur) : '') + [...new Set([...list, ...(cur ? [cur] : [])])].map(v => opt(v, v, cur)).join('');
function confirmDialog(title, text, label, run) {
  dialog({
    title,
    body: `<p>${text}</p>`,
    saveLabel: label,
    onSave() {
      run();
    }
  });
}

/* ---------- Pièce ---------- */
function pieceDialog(p, kksId) {
  const isNew = !p;
  const v = p || {
    ref: nextRef(),
    designation: '',
    categorie: '',
    fabricant: '',
    refFab: '',
    fournisseur: '',
    unite: 'pce',
    stockMin: '',
    notes: ''
  };
  dialog({
    title: isNew ? 'Nouvelle pièce' : 'Modifier la pièce',
    wide: true,
    body: `<div class="grid3"><label>ID<input name="ref" value="${esc(v.ref)}" readonly tabindex="-1" class="ro" title="Attribué automatiquement"></label><label>Catégorie<select name="categorie">${optList(db.listes.categories, v.categorie, '—')}</select></label><label>Unité<select name="unite">${optList(db.listes.unites, v.unite)}</select></label></div>
      <label>Désignation<input name="designation" value="${esc(v.designation)}" required placeholder="ex. Roulement à billes 6205-2RS"></label>
      <fieldset><legend>Marque et fournisseur</legend>
        <div class="grid2"><label>Marque<input name="fabricant" list="dl-marques" value="${esc(v.fabricant)}" autocomplete="off" placeholder="ex. SKF"></label><label>Réf. de la marque<input name="refFab" value="${esc(v.refFab)}" placeholder="ex. 6205-2RSH"></label></div>
        <label class="toggle"><input type="checkbox" name="fsame" ${!v.fournisseur || v.fournisseur === v.fabricant ? 'checked' : ''}> Fournisseur identique à la marque</label>
        <div class="grid2" data-four><label>Fournisseur<input name="fournisseur" list="dl-marques" value="${esc(v.fournisseur && v.fournisseur !== v.fabricant ? v.fournisseur : '')}" autocomplete="off" placeholder="ex. distributeur, grossiste"></label></div>
</fieldset>
      <div class="grid3"><label>Stock minimum<input name="stockMin" type="number" min="0" step="any" value="${+v.stockMin ? esc(v.stockMin) : ''}" placeholder="0 = pas de minimum"></label></div>
      ${isNew ? `<fieldset><legend>Rangement et stock initial</legend><div class="grid2"><label>Emplacement<input name="lieu" list="dl-lieux" placeholder="ex. E1.11 C45 A" autocomplete="off"></label><label>Quantité<input name="qte" type="number" min="0" step="any"></label></div></fieldset>` : ''}
      <fieldset><legend>Repères KKS (équipements sur lesquels la pièce est montée)</legend>
        <div class="chips" data-kchips></div>
        <div class="inline-form"><input data-kin list="dl-kks" placeholder="Code ou désignation KKS" aria-label="Repère KKS à ajouter" autocomplete="off"><button type="button" class="btn" data-kadd>${icon('plus')}Ajouter</button></div>
        <p class="hint" data-kmsg>Ajoutez autant de repères que nécessaire.</p></fieldset>
      <label>Notes<textarea name="notes" rows="3">${esc(v.notes)}</textarea></label>`,
    onOpen(f, d) {
      const four = () => {
        $('[data-four]', d).hidden = f.elements.fsame.checked;
      };
      f.elements.fsame.addEventListener('change', () => {
        four();
        if (!f.elements.fsame.checked) f.elements.fournisseur.focus();
      });
      four();
      d._kks = [...(p ? p.kks : kksId ? [kksId] : [])].filter(id => getKks(id));
      const box = $('[data-kchips]', d),
        inp = $('[data-kin]', d),
        msg = $('[data-kmsg]', d);
      const draw = () => {
        box.innerHTML =
          d._kks
            .map(id => {
              const k = getKks(id);
              return `<span class="c"><span class="kks">${esc(k.code)}</span>&nbsp;${esc(k.designation)}<button type="button" class="icon-btn" data-krm="${id}" aria-label="Retirer ${esc(k.code)}">×</button></span>`;
            })
            .join('') || '<span class="muted">Aucun repère pour l’instant.</span>';
      };
      const add = () => {
        const raw = inp.value.trim();
        if (!raw) return true;
        const k = findKks(raw);
        if (!k) {
          msg.textContent = `« ${raw} » n’est pas dans la liste KKS. Choisissez un repère proposé.`;
          msg.style.color = 'var(--bad)';
          return false;
        }
        if (!d._kks.includes(k.id)) d._kks.push(k.id);
        inp.value = '';
        msg.textContent = `${k.code} ajouté.`;
        msg.style.color = '';
        draw();
        inp.focus();
        return true;
      };
      d._kadd = add;
      $('[data-kadd]', d).onclick = add;
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          add();
        }
      });
      box.addEventListener('click', e => {
        const b = e.target.closest('[data-krm]');
        if (b) {
          d._kks = d._kks.filter(id => id !== b.dataset.krm);
          draw();
        }
      });
      draw();
    },
    del: isNew ? null : archDel('pieces', p, () => HARD.pieces(p)),
    onSave(f, d) {
      if (!d._kadd()) throw new Error('Un repère KKS saisi n’existe pas dans la liste.');
      const ref = isNew ? nextRef() : p.ref,
        designation = val(f, 'designation'),
        min = val(f, 'stockMin');
      if (!ref) throw new Error('Indiquez un ID.');
      if (db.pieces.some(x => x.ref.toUpperCase() === ref && x !== p)) throw new Error(`L’ID ${ref} existe déjà.`);
      if (!designation) throw new Error('Indiquez une désignation.');
      if (min && !(+min >= 0)) throw new Error('Le stock minimum doit être un nombre positif.');
      const data = {
        ref,
        designation,
        categorie: val(f, 'categorie'),
        fabricant: val(f, 'fabricant'),
        refFab: val(f, 'refFab'),
        fournisseur: f.elements.fsame.checked ? val(f, 'fabricant') : val(f, 'fournisseur'),
        unite: val(f, 'unite'),
        stockMin: min ? +min : 0,
        notes: val(f, 'notes'),
        kks: [...d._kks]
      };
      let l = null,
        q = 0;
      if (isNew && val(f, 'lieu')) {
        l = findLieu(val(f, 'lieu'));
        if (!l)
          throw new Error(`L’emplacement « ${normCode(val(f, 'lieu'))} » n’existe pas. Créez-le d’abord dans Options › Emplacements.`);
        q = +val(f, 'qte') || 0;
        if (q < 0) throw new Error('La quantité ne peut pas être négative.');
      }
      tx(() => {
        for (const nm of [data.fabricant, data.fournisseur])
          if (nm && !db.listes.fournisseurs.some(x => norm(x) === norm(nm))) {
            db.listes.fournisseurs.push(nm);
            db.listes.fournisseurs.sort(coll.compare);
          }
        if (isNew) {
          const n = {id: uid(), ...data, stock: []};
          db.pieces.push(n);
          if (l) q ? addStock(n, l.id, q, 'Stock initial') : n.stock.push({lieuId: l.id, qte: 0});
          S.sel.pieces = n.id;
        } else Object.assign(p, data);
      });
      S.view = 'pieces';
      render();
      toast(isNew ? 'Pièce créée' : 'Pièce enregistrée');
    }
  });
}
/* Sortie / entrée rapide (après un scan ou depuis la fiche) : emplacement, quantité − / +, et « Pour quel rapport ? ».
   Une sortie liée à un rapport est ajoutée à ses « Pièces consommées » : une seule façon de sortir une pièce. */
function rapportsPourPieces() {
  const today = todayISO(),
    me = meId();
  return db.interventions
    .filter(i => live(i) && (i.statut !== 'terminee' || i.date === today))
    .sort(
      (a, b) => (b.intervenants || []).includes(me) - (a.intervenants || []).includes(me) || (b.date || '').localeCompare(a.date || '')
    );
}
function linkPieceToReport(i, p, lieuId, q) {
  const l = i.pieces.find(x => x.pieceId === p.id && x.lieuId === lieuId);
  if (l) l.qte = round(l.qte + q);
  else if (q > 0) i.pieces.push({pieceId: p.id, lieuId, qte: q});
  i.pieces = i.pieces.filter(x => x.qte > 0);
}
function quickMove(p) {
  const places = sortedStock(p).filter(x => !isStatut(getLieu(x.lieuId))),
    mp = mainPlace(p),
    reps = rapportsPourPieces().slice(0, 30);
  const place = s => {
    const l = getLieu(s.lieuId);
    return `<label class="qm-loc"><input type="radio" name="lieu" value="${l.id}" ${mp && mp.id === l.id ? 'checked' : ''}><span><b>${esc(lieuCode(l))}</b><small>${num(s.qte)} ${esc(p.unite)}</small></span></label>`;
  };
  const d = dialog({
    title: esc(p.designation),
    saveLabel: '− Sortir',
    body: `<p class="qm-ref"><span class="ref">${esc(p.ref)}</span> · ${num(dispo(p))} ${esc(p.unite)} en magasin</p>
      ${places.length ? `<fieldset class="qm-locs"><legend>Où ?</legend>${places.map(place).join('')}</fieldset>` : `<label>Emplacement<input name="lieuTxt" list="dl-lieux" autocomplete="off" placeholder="ex. E1.11 C45 A"></label>`}
      <div class="qm-step" role="group" aria-label="Quantité"><button type="button" class="btn" data-q="-1" aria-label="Un de moins">−</button><input name="qte" type="number" inputmode="decimal" min="0" step="any" value="1" aria-label="Quantité"><button type="button" class="btn" data-q="1" aria-label="Un de plus">+</button></div>
      ${reps.length ? `<label>Pour quel rapport ? <span class="muted">(facultatif)</span><select name="rap"><option value="">Aucun</option>${reps.map(i => `<option value="${i.id}">${esc(i.num)} · ${esc(i.titre || 'Sans titre')}${i.statut !== 'terminee' ? ' (en cours)' : ''}</option>`).join('')}</select></label>` : ''}
      <button type="button" class="link qm-fiche" data-fiche>Voir la fiche de la pièce</button>`,
    onOpen(f, dd) {
      $$('[data-q]', dd).forEach(
        b =>
          (b.onclick = () => {
            const v = Math.max(0, round((+f.elements.qte.value || 0) + +b.dataset.q));
            f.elements.qte.value = v;
          })
      );
      $('[data-fiche]', dd).onclick = () => {
        dd.close();
        go('pieces', p.id);
      };
      dd.classList.add('qm');
      const foot = $('footer', dd),
        inB = document.createElement('button');
      inB.type = 'button';
      inB.className = 'btn qm-in';
      inB.textContent = '+ Entrer';
      inB.onclick = () => {
        try {
          if (run(f, 1) !== false) dd.close();
        } catch (x) {
          const e = $('.dlg-err', dd);
          e.textContent = x.message;
          e.hidden = false;
        }
      };
      foot.querySelector('.primary').before(inB);
      foot.querySelector('.primary').classList.add('qm-out');
      if (!matchMedia('(max-width: 760px)').matches) setTimeout(() => f.elements.qte.select(), 50);
    },
    onSave(f) {
      return run(f, -1);
    }
  });
  function run(f, sign) {
    const l = f.elements.lieuTxt ? findLieu(val(f, 'lieuTxt')) : getLieu(val(f, 'lieu'));
    if (!l) throw new Error('Choisissez l’emplacement.');
    const q = +val(f, 'qte');
    if (!(q > 0)) throw new Error('Indiquez une quantité.');
    if (sign < 0 && q > stockAt(p, l.id)) throw new Error(`Il n’y en a que ${num(stockAt(p, l.id))} en ${lieuCode(l)}.`);
    const i = f.elements.rap && val(f, 'rap') ? getInt(val(f, 'rap')) : null;
    tx(() => {
      addStock(
        p,
        l.id,
        sign * q,
        i ? (sign < 0 ? 'Sortie intervention' : 'Retour intervention') : sign < 0 ? 'Sortie' : 'Entrée',
        i ? i.num : ''
      );
      if (i) linkPieceToReport(i, p, l.id, -sign * q);
    });
    render();
    toast(`${p.ref} : ${sign < 0 ? '−' : '+'}${num(q)} ${p.unite}${i ? ' · ' + i.num : ''} · reste ${num(dispo(p))}`, '', true);
  }
  return d;
}
function moveDialog(p0, type = 'sortie') {
  const MV = {
    sortie: ['Sortir', 'out', 'Prélever pour un travail', 'Sortir du stock'],
    entree: ['Entrer', 'in', 'Réception, retour', 'Entrer en stock'],
    transfert: ['Déplacer', 'move', 'Changer d’emplacement', 'Déplacer'],
    inventaire: ['Inventaire', 'list', 'Corriger la quantité', 'Enregistrer l’inventaire']
  };
  dialog({
    title: 'Mouvement de stock',
    saveLabel: MV[type][3],
    body: `${p0 ? `<div class="picked"><span class="ref">${esc(p0.ref)}</span><strong style="font-weight:500">${esc(p0.designation)}</strong></div>` : `<label>Pièce<input name="piece" list="dl-pieces" placeholder="Référence, désignation… ou scannez le QR code" autocomplete="off"></label>`}
      <fieldset class="mvtypes" aria-label="Que voulez-vous faire ?">${Object.entries(MV)
        .map(
          ([v, [t, ic, h]]) =>
            `<label class="mvt"><input type="radio" name="type" value="${v}" ${v === type ? 'checked' : ''}><span class="qi">${icon(ic)}</span><strong>${t}</strong><small>${h}</small></label>`
        )
        .join('')}</fieldset>
      <div class="grid2"><label><span data-lbl-lieu>Emplacement</span><input name="lieu" list="dl-lieux" autocomplete="off" placeholder="ex. E1.11 C45 A"></label><label data-dest hidden>Vers l’emplacement<input name="dest" list="dl-lieux" autocomplete="off"></label></div>
      <div class="grid2"><label><span data-lbl-qte>Quantité</span><input name="qte" type="number" min="0" step="any" required></label><label>Motif<input name="motif" placeholder="ex. bon de livraison, travail sur…"></label></div>
      <label data-rapw>Pour quel rapport ? <span class="muted">(facultatif)</span><select name="rap"><option value="">Aucun</option>${rapportsPourPieces()
        .slice(0, 30)
        .map(i => `<option value="${i.id}">${esc(i.num)} · ${esc(i.titre || 'Sans titre')}</option>`)
        .join('')}</select></label>
      <p class="hint" data-dispo></p>`,
    onOpen(f, d) {
      const P = () => p0 || findPiece(val(f, 'piece'));
      let lastP = null;
      const upd = () => {
        const t = val(f, 'type'),
          p = P();
        $('[data-dest]', d).hidden = t !== 'transfert';
        $('[data-rapw]', d).hidden = t !== 'sortie' || !rapportsPourPieces().length;
        $('[data-lbl-lieu]', d).textContent = t === 'transfert' ? 'Depuis l’emplacement' : 'Emplacement';
        $('[data-lbl-qte]', d).textContent = t === 'inventaire' ? 'Quantité comptée' : 'Quantité';
        $('button[type=submit]', d).textContent = MV[t][3];
        if (p && p !== lastP) {
          lastP = p;
          const mp = mainPlace(p);
          if (mp) f.elements.lieu.value = lieuCode(mp);
        }
        const l = findLieu(val(f, 'lieu'));
        $('[data-dispo]', d).textContent = p
          ? l
            ? `${num(stockAt(p, l.id))} ${p.unite} en ${lieuCode(l)} · ${num(total(p))} ${p.unite} au total.`
            : `Rangée en : ${
                sortedStock(p)
                  .map(s => lieuCode(getLieu(s.lieuId)) + ' (' + num(s.qte) + ')')
                  .join(', ') || 'nulle part'
              }.`
          : '';
      };
      f.addEventListener('change', upd);
      f.addEventListener('input', upd);
      upd();
      if (p0 && !matchMedia('(max-width: 760px)').matches) setTimeout(() => f.elements.qte.focus(), 0);
    },
    onSave(f) {
      const p = p0 || findPiece(val(f, 'piece'));
      if (!p) throw new Error('Choisissez une pièce dans la liste proposée.');
      const t = val(f, 'type'),
        q = +val(f, 'qte'),
        motif = val(f, 'motif');
      const l = findLieu(val(f, 'lieu'));
      if (!l) throw new Error('Choisissez un emplacement existant.');
      if (val(f, 'qte') === '' || !(q >= 0)) throw new Error('Indiquez une quantité valide.');
      if (t !== 'inventaire' && q <= 0) throw new Error('La quantité doit être supérieure à zéro.');
      tx(() => {
        if (t === 'entree') addStock(p, l.id, q, motif || 'Entrée');
        else if (t === 'sortie') {
          const ri = val(f, 'rap') ? getInt(val(f, 'rap')) : null;
          addStock(p, l.id, -q, motif || (ri ? 'Sortie intervention' : 'Sortie'), ri ? ri.num : '');
          if (ri) linkPieceToReport(ri, p, l.id, q);
        } else if (t === 'transfert') {
          const d2 = findLieu(val(f, 'dest'));
          if (!d2) throw new Error('Choisissez l’emplacement de destination.');
          if (d2 === l) throw new Error('Les deux emplacements sont identiques.');
          addStock(p, l.id, -q, motif || `Déplacé vers ${lieuCode(d2)}`);
          addStock(p, d2.id, q, motif || `Déplacé depuis ${lieuCode(l)}`);
        } else {
          const delta = round(q - stockAt(p, l.id));
          if (!p.stock.find(s => s.lieuId === l.id)) p.stock.push({lieuId: l.id, qte: 0});
          if (delta) addStock(p, l.id, delta, motif || 'Inventaire');
        }
      });
      render();
      toast(`${p.ref} : ${num(total(p))} ${p.unite} en stock`, '', true);
    }
  });
}
function addPlaceDialog(p) {
  dialog({
    title: 'Ranger à un autre emplacement',
    saveLabel: 'Ajouter',
    body: `<label>Emplacement<input name="lieu" list="dl-lieux" placeholder="ex. E1.11 C45 A" autocomplete="off" required></label><p class="hint">L’emplacement est ajouté avec une quantité de 0. Faites ensuite une entrée ou un déplacement.</p>`,
    onSave(f) {
      const l = findLieu(val(f, 'lieu'));
      if (!l) throw new Error('Cet emplacement n’existe pas. Créez-le dans Options › Emplacements.');
      if (p.stock.some(s => s.lieuId === l.id)) throw new Error('La pièce est déjà rangée à cet emplacement.');
      tx(() => p.stock.push({lieuId: l.id, qte: 0}));
      render();
      toast('Emplacement ajouté');
    }
  });
}

/* ---------- Salles & emplacements ---------- */
function salleDialog(s) {
  const isNew = !s,
    v = s || {code: '', nom: ''};
  dialog({
    title: isNew ? 'Nouveau local' : 'Modifier le local',
    body: `<label>Code du local<input name="code" value="${esc(isNew ? '' : salleCode(v))}" placeholder="ex. E1.13, S1.12 ou un nom (Atelier électrique)" required></label>
      <label>Nom (facultatif)<input name="nom" value="${esc(v.nom)}" placeholder="ex. Magasin pièces mécaniques"></label>
      <label class="toggle"><input type="checkbox" name="statut" ${v.statut ? 'checked' : ''}> Hors magasin : statut (en prêt, en révision, en attente…) et non un local physique</label>`,
    del: isNew
      ? null
      : archDel('salles', s, function () {
          if (db.lieux.some(l => l.salleId === s.id)) throw new Error('Supprimez d’abord les emplacements de ce local.');
          tx(() => (db.salles = db.salles.filter(x => x.id !== s.id)));
          render();
          toast('Local supprimé');
        }),
    onSave(f) {
      const raw = val(f, 'code').replace(/\s+/g, ' ');
      if (!raw) throw new Error('Indiquez le code ou le nom du local.');
      if (/\//.test(raw)) throw new Error('Le code du local ne peut pas contenir « / ».');
      const c = parseCode(raw),
        data =
          c && !c.libre && !c.chemin.length
            ? {code: '', batiment: c.batiment, etage: c.etage, numero: c.numero}
            : {code: raw, batiment: '', etage: '', numero: ''};
      const code = data.code || `${data.batiment}${data.etage}.${data.numero}`;
      if (db.salles.some(x => x !== s && normCode(salleCode(x)) === normCode(code))) throw new Error(`Le local ${code} existe déjà.`);
      const st = f.elements.statut.checked;
      tx(() => {
        if (isNew) db.salles.push({id: uid(), ...data, nom: val(f, 'nom'), statut: st});
        else Object.assign(s, data, {nom: val(f, 'nom'), statut: st});
      });
      render();
      toast(isNew ? `Local ${code} créé` : 'Local enregistré');
    }
  });
}

function lieuDialog(l, salleId) {
  if (!db.salles.length) {
    toast('Créez d’abord une salle.', 'bad');
    return salleDialog();
  }
  const isNew = !l,
    v = l || {salleId: salleId || db.salles[0].id, chemin: [], note: ''};
  const salles = [...db.salles].sort((a, b) => coll.compare(salleCode(a), salleCode(b)));
  dialog({
    title: isNew ? 'Nouvel emplacement' : 'Modifier l’emplacement',
    body: `<label>Local<select name="salleId">${salles.map(s => opt(s.id, `${salleCode(s)} — ${s.nom}`, v.salleId)).join('')}</select></label>
      <label>Emplacement dans le local<input name="chemin" value="${esc(pathOf(v).join(' / '))}" placeholder="ex. A / 11 / 1   ou   Armoire E (API) / E1" autocomplete="off"></label>
      <p class="hint">Les niveaux sont séparés par « / », du plus grand au plus petit. Laissez vide pour un emplacement « dans le local ».</p>
      <label>Note<input name="note" value="${esc(v.note)}" placeholder="facultatif, ex. pièces lourdes en bas"></label>
      <p class="preview-code">Code : <span class="plate" data-prev></span></p>`,
    onOpen(f, d) {
      const prev = () => {
        const s = getSalle(val(f, 'salleId'));
        const ch = val(f, 'chemin')
          .split('/')
          .map(x => x.trim())
          .filter(Boolean);
        $('[data-prev]', d).textContent = (s ? salleCode(s) : '?') + (ch.length ? ' / ' + ch.join(' / ') : '');
      };
      f.addEventListener('input', prev);
      f.addEventListener('change', prev);
      prev();
    },
    del: isNew
      ? null
      : archDel('lieux', l, function () {
          if (db.pieces.some(p => p.stock.some(s => s.lieuId === l.id && s.qte > 0)))
            throw new Error('Cet emplacement contient du stock. Déplacez-le avant de supprimer.');
          if (db.interventions.some(i => i.pieces.some(x => x.lieuId === l.id)))
            throw new Error('Cet emplacement est cité dans des rapports d’intervention.');
          tx(() => {
            db.lieux = db.lieux.filter(x => x.id !== l.id);
            db.pieces.forEach(p => (p.stock = p.stock.filter(s => s.lieuId !== l.id)));
            db.mouvements = db.mouvements.filter(m => m.lieuId !== l.id);
          });
          S.sel.lieux = null;
          render();
          toast('Emplacement supprimé');
        }),
    onSave(f) {
      const data = {
        salleId: val(f, 'salleId'),
        chemin: val(f, 'chemin')
          .split('/')
          .map(x => x.trim())
          .filter(Boolean),
        note: val(f, 'note')
      };
      const code = lieuCode(data);
      if (db.lieux.some(x => x !== l && normLieu(lieuCode(x)) === normLieu(code))) throw new Error(`L’emplacement ${code} existe déjà.`);
      tx(() => {
        if (isNew) {
          const n = {id: uid(), ...data};
          db.lieux.push(n);
          S.sel.lieux = n.id;
        } else Object.assign(l, data);
      });
      render();
      toast(isNew ? `Emplacement ${code} créé` : 'Emplacement enregistré');
    }
  });
}
function expandNums(s) {
  const out = [];
  for (const tok of String(s)
    .split(/[,;\s]+/)
    .filter(Boolean)) {
    const m = tok.match(/^(\d+)-(\d+)$/);
    if (m) {
      const w = m[1].length,
        a = +m[1],
        b = +m[2];
      if (b < a || b - a > 200) throw new Error(`Plage de niveaux invalide : ${tok}`);
      for (let i = a; i <= b; i++) out.push(String(i).padStart(w, '0'));
    } else if (/^\d+$/.test(tok)) out.push(tok);
    else throw new Error(`Niveau invalide : ${tok}`);
  }
  return out.length ? out : [''];
}
function expandLetters(s) {
  const out = [];
  for (const tok of String(s)
    .toUpperCase()
    .split(/[,;\s]+/)
    .filter(Boolean)) {
    const m = tok.match(/^([A-Z])-([A-Z])$/);
    if (m) {
      for (let c = m[1].charCodeAt(0); c <= m[2].charCodeAt(0); c++) out.push(String.fromCharCode(c));
    } else if (/^[A-Z]$/.test(tok)) out.push(tok);
    else throw new Error(`Bac invalide : ${tok}`);
  }
  return out.length ? out : [''];
}
const findLieuExact = c =>
  db.lieux.find(l => {
    const s = getSalle(l.salleId);
    return s && normCode(salleCode(s)) === normCode(c.local) && normLieu(pathOf(l).join(' / ')) === normLieu(c.chemin.join(' / '));
  });
function importLieuxDialog() {
  const analyse = txt => {
    const ok = [],
      bad = [],
      seen = new Set();
    for (const raw of txt.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const [codeTxt, ...rest] = line.split(/\t|;/).map(x => x.trim());
      const nom = rest.join(' ').trim();
      const c = parseCode(codeTxt);
      if (!c) {
        bad.push(line);
        continue;
      }
      const key = normLieu(`${c.local} / ${c.chemin.join(' / ')}`);
      if (seen.has(key)) continue;
      seen.add(key);
      ok.push({...c, nom});
    }
    return {ok, bad};
  };
  dialog({
    title: 'Coller une liste d’emplacements',
    saveLabel: 'Créer',
    wide: true,
    body: `<p>Un emplacement par ligne : le local puis les niveaux séparés par « / », par exemple <span class="plate">E1.14 / A / 11 / 1</span>. Le local peut être un code (E1.14) ou un nom (Atelier électrique). Les locaux manquants sont créés automatiquement ; vous pouvez ajouter le nom du local après un point-virgule (<span class="mono">E1.14 / A / 11 / 1;Magasin</span>). Les emplacements qui existent déjà sont ignorés.</p>
      <label>Liste<textarea name="txt" rows="12" style="font-family:var(--f-mono);font-size:.85rem" placeholder="E1.13 / A / Palette 1&#10;E1.14 / A / 11 / 1&#10;E1.14 / Armoire E (API) / E1"></textarea></label>
      <p class="hint" data-prev></p>`,
    onOpen(f, d) {
      const u = () => {
        const {ok, bad} = analyse(val(f, 'txt'));
        const nw = ok.filter(c => !findLieuExact(c));
        const salles = new Set(ok.map(c => normCode(c.local)).filter(code => !findSalle(code)));
        $('[data-prev]', d).innerHTML =
          ok.length || bad.length
            ? `${nbs(nw.length, 'nouvel emplacement', 'nouveaux emplacements')}${salles.size ? `, ${nbs(salles.size, 'nouveau local', 'nouveaux locaux')}` : ''}.${bad.length ? ` <span style="color:var(--bad)">${nbs(bad.length, 'ligne non reconnue', 'lignes non reconnues')} : ${esc(bad.slice(0, 5).join(' · '))}${bad.length > 5 ? '…' : ''}</span>` : ''}`
            : '';
      };
      f.addEventListener('input', u);
      u();
    },
    onSave(f) {
      const {ok, bad} = analyse(val(f, 'txt'));
      if (!ok.length)
        throw new Error(bad.length ? 'Aucune ligne reconnue. Format attendu : E1.14 / A / 11 / 1' : 'Collez au moins une ligne.');
      let nl = 0,
        ns = 0;
      tx(() => {
        for (const c of ok) {
          let s = findSalle(c.local);
          if (!s) {
            s = c.libre
              ? {id: uid(), code: c.local, nom: c.nom || '', ...(STATUT_RE.test(c.local) ? {statut: true} : {})}
              : {id: uid(), batiment: c.batiment, etage: c.etage, numero: c.numero, nom: c.nom || ''};
            db.salles.push(s);
            ns++;
          } else if (c.nom && !s.nom) s.nom = c.nom;
          if (findLieuExact(c)) continue;
          db.lieux.push({id: uid(), salleId: s.id, chemin: c.chemin, note: ''});
          nl++;
        }
      });
      render();
      toast(
        `${nbs(nl, 'emplacement', 'emplacements')} et ${nbs(ns, 'local', 'locaux')} créés${bad.length ? ` · ${nbs(bad.length, 'ligne ignorée', 'lignes ignorées')}` : ''}`
      );
    }
  });
}
/* Retrouve un emplacement à partir de son code, en créant le local et l'emplacement s'ils manquent (à appeler dans tx) */
function ensureLieu(codeTxt) {
  const c = parseCode(codeTxt);
  if (!c) return null;
  const ex = findLieuExact(c);
  if (ex) return ex;
  let s = findSalle(c.local);
  if (!s) {
    s = c.libre
      ? {id: uid(), code: c.local, nom: '', ...(STATUT_RE.test(c.local) ? {statut: true} : {})}
      : {id: uid(), batiment: c.batiment, etage: c.etage, numero: c.numero, nom: ''};
    db.salles.push(s);
  }
  const l = {id: uid(), salleId: s.id, chemin: c.chemin, note: ''};
  db.lieux.push(l);
  return l;
}
/* Import des travaux CareOffice : travaux faits -> rapports terminés (figés), travaux à faire / récurrents -> tâches */
function importTravauxDialog() {
  dialog({
    title: 'Importer les travaux depuis CareOffice',
    saveLabel: 'Importer',
    wide: true,
    body: `<p>Choisissez le fichier <span class="mono">travaux-triflow.json</span>. Les travaux réalisés deviennent des <strong>rapports terminés</strong> (figés tels quels) ; les travaux récurrents ou encore à faire deviennent des <strong>tâches</strong> (celles qui ne sont plus planifiées dans CareOffice vont directement dans les archives). Un rapport ou une tâche déjà importé n’est pas créé deux fois.</p>
      <label>Fichier<input type="file" name="file" accept=".json,application/json"></label><p class="hint" data-prev></p>`,
    onOpen(f, d) {
      f.elements.file.addEventListener('change', async () => {
        try {
          const j = JSON.parse(await f.elements.file.files[0].text());
          d._data = j;
          $('[data-prev]', d).textContent =
            `${nbs((j.rapports || []).length, 'rapport', 'rapports')} et ${nbs((j.taches || []).length, 'tâche', 'tâches')}, dont ${nbs((j.taches || []).filter(t => t.freq.unite !== 'once').length, 'récurrente', 'récurrentes')}.`;
        } catch (e) {
          d._data = null;
          $('[data-prev]', d).textContent = 'Fichier illisible.';
        }
      });
    },
    onSave(f, d) {
      const j = d._data;
      if (!j || !Array.isArray(j.rapports)) throw new Error('Choisissez le fichier travaux-triflow.json.');
      const n0 = s =>
        norm(s)
          .replace(/[^a-z ]/g, '')
          .trim();
      const PS = db.personnes
          .filter(p => p.nom)
          .sort((a, b) => b.nom.length - a.nom.length)
          .map(p => [p, n0(p.nom)]),
        pm = new Map();
      const pers = name => {
        const nn = n0(name);
        if (!pm.has(nn)) pm.set(nn, (PS.find(([, pn]) => nn === pn || nn.startsWith(pn + ' ') || nn.endsWith(' ' + pn)) || [])[0]);
        return pm.get(nn);
      };
      const kByCode = new Map(db.kks.map(k => [k.code.replace(/\s+/g, '').toUpperCase(), k]));
      const kOf = code =>
        kByCode.get(
          String(code || '')
            .replace(/\s+/g, '')
            .toUpperCase()
        );
      let nr = 0,
        nt = 0,
        nu = 0;
      tx(() => {
        const tKey = new Map();
        for (const t of j.taches || []) {
          let ex = db.taches.find(x => x.coKey === t.key);
          const k = kOf(t.kks),
            p = t.inter && t.inter.length ? pers(t.inter[0]) : null;
          const desc = [
            t.description,
            !k && t.kks ? `Équipement CareOffice : ${t.kks} ${t.obj || ''}`.trim() : '',
            t.inter && t.inter.length && !p ? `Intervenant CareOffice : ${t.inter.join(', ')}` : ''
          ]
            .filter(Boolean)
            .join('\n\n');
          if (!ex) {
            ex = {
              id: uid(),
              coKey: t.key,
              titre: t.titre || '(sans titre)',
              description: desc,
              kksId: k ? k.id : '',
              assign: p ? {type: 'personne', v: p.id} : {type: 'groupe', v: ''},
              freq: t.freq,
              prochaine: t.prochaine,
              actif: true,
              ...(t.derniere ? {derniere: t.derniere} : {}),
              ...(t.arch ? {arch: todayISO()} : {})
            };
            db.taches.push(ex);
            nt++;
          }
          tKey.set(t.key, ex);
        }
        const have = new Map(db.interventions.map(i => [i.co || i.num, i]));
        for (const r of j.rapports) {
          const ex = have.get(r.num);
          if (ex) {
            if (/^CO-/.test(r.num) && r.travaux && !(ex.travaux || '').trim()) {
              ex.travaux = r.travaux;
              nu++;
            }
            continue;
          }
          have.set(r.num, true);
          const k = kOf(r.kks),
            ids = [],
            snap = {};
          for (const name of r.inter || []) {
            const p = pers(name);
            const f = p ? null : fourMatch(name, db.listes.fournisseurs);
            const id = p ? p.id : f ? 'four:' + f : 'ext:' + n0(name).replace(/ /g, '-');
            if (ids.includes(id)) continue;
            ids.push(id);
            snap[id] = p ? persSnap(p) : f ? fourSnap(f) : {nom: name, prenom: '', groupe: 'Externe'};
          }
          if (r.type && !db.listes.types.includes(r.type)) db.listes.types.push(r.type);
          const tk = r.tache ? tKey.get(r.tache) : null;
          db.interventions.push({
            id: uid(),
            num: r.num,
            co: r.num,
            date: r.date,
            type: r.type,
            statut: 'terminee',
            titre: r.titre,
            kksId: k ? k.id : '',
            constat: r.constat || '',
            travaux: r.travaux || '',
            duree: r.duree || '',
            intervenants: ids,
            snap,
            pieces: [],
            ks: k ? kSnap(k) : r.kks || r.obj ? {code: r.kks || '', designation: r.obj || '', aic: ''} : null,
            ...(tk ? {tacheId: tk.id, tacheFait: true, ts: tSnap(tk)} : {})
          });
          nr++;
        }
        if (nr) {
          renumberInts(db);
          db.meta.numV = 1;
        }
      });
      S.statut = 'toutes';
      render();
      toast(
        `${nbs(nr, 'rapport', 'rapports')} et ${nbs(nt, 'tâche', 'tâches')} importés${nu ? ` · ${nbs(nu, 'rapport complété', 'rapports complétés')} avec leur texte` : ''}${(j.taches || []).some(t => t.arch) ? ' · les tâches arrêtées dans CareOffice sont dans les archives' : ''}`
      );
    }
  });
}
/* ---------- Historique du stock repris de CareOffice (« Journal des écritures » de chaque article) ----------
   Fichiers acceptés : export Excel (.xlsx) ou CSV du journal (colonnes « N° d'écriture », « Date d'écriture »,
   « Type d'écriture », « Qté de la transaction », « Remarque », « Code article »…), ou le fichier JSON
   historique-careoffice.json de la première reprise. CareOffice note les entrées en négatif : on remet le bon signe. */
const CO_TYPES = {
  6: ['Virement d’emplacement', 0],
  8: ['Sortie aux déchets', -1],
  11: ['Sortie sur rapport d’activité', -1],
  13: ['Sortie sur rapport planifié', -1],
  14: ['Sortie non planifiée', -1],
  15: ['Entrée de marchandise', -1],
  40: ['Inventaire', 0],
  41: ['Perte sur inventaire', -1],
  42: ['Plus-value sur inventaire', 1]
};
const coTypeOf = lbl => {
  const n = norm(lbl).replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^inventaire/.test(n)) return 40;
  for (const [k, [l]] of Object.entries(CO_TYPES)) if (norm(l).replace(/[’']/g, ' ').replace(/\s+/g, ' ') === n) return +k;
  return 0;
};
/* « 10.06.2026 10:42 », « 2026-06-10 10:42 » ou nombre Excel → « 2026-06-10T10:42 » */
function coDate(v) {
  if (v instanceof Date && !isNaN(v)) return new Date(v.getTime() - v.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  if (typeof v === 'number' && v > 20000) return coDate(new Date(Math.round((v - 25569) * 864e5) + new Date().getTimezoneOffset() * 6e4));
  const s = String(v || '').trim();
  let m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T${(m[4] || '00').padStart(2, '0')}:${m[5] || '00'}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4] || '00'}:${m[5] || '00'}` : '';
}
const coNum = v =>
  typeof v === 'number'
    ? v
    : +String(v || '')
        .replace(/['’\s]/g, '')
        .replace(',', '.') || 0;
/* Une ligne d'historique TriFlow : {d, q, t, lieu?, n? (sans signe), w?, no? (n° d'écriture)} */
function coLine({no, d, ty, label, q, rem, lieu, who}) {
  const T = CO_TYPES[ty],
    neutral = !T || T[1] === 0;
  const line = {d, q: neutral ? Math.abs(q) : T[1] < 0 ? -q : q, t: (T ? T[0] : label || 'Écriture') + (rem ? ' · ' + rem : '')};
  if (neutral) line.n = 1;
  if (lieu) line.lieu = lieu;
  if (who) line.w = who;
  if (no) line.no = String(no);
  return line;
}
function coPathCode(path) {
  let parts = String(path || '')
    .split('/')
    .map(x => x.trim().replace(/\//g, '-'))
    .filter(Boolean);
  if (parts[0] === 'Tridel') parts = parts.slice(1);
  if (parts.length >= 2 && /^[A-Z]\d$/.test(parts[0])) {
    const m = parts[1].match(/^(\d+)\b/);
    if (m) return [`${parts[0]}.${m[1]}`, ...parts.slice(2)].join(' / ');
  }
  return parts.join(' / ');
}
/* Lignes lues → {ref: [lignes]} ; ref = ID ou code de l'article */
function coJournalRows(rows) {
  const out = [];
  if (rows.length && 'ty' in rows[0] && 'a' in rows[0]) {
    for (const h of rows) {
      if (h.an || !h.a) continue;
      out.push({
        ref: String(h.a),
        line: coLine({
          no: h.no || h.n,
          d: coDate(h.d),
          ty: h.ty,
          label: h.t,
          q: coNum(h.q),
          rem: h.des || h.rem,
          lieu: coPathCode(h.l),
          who: h.who
        })
      });
    }
    return out;
  }
  const key = (r, ...names) => {
    for (const k of Object.keys(r)) {
      const nk = norm(k)
        .replace(/[’'°.]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (names.some(n => nk === n || nk.startsWith(n))) return r[k];
    }
    return '';
  };
  for (const r of rows) {
    if (/^(oui|1|true|x)$/i.test(String(key(r, 'annule') || '').trim())) continue;
    const ref = String(key(r, 'id article', 'code article', 'article', 'n article') || '').trim(),
      label = String(key(r, 'type d ecriture', 'type') || '').trim(),
      d = coDate(key(r, 'date d ecriture', 'date'));
    if (!ref || !d || !label) continue;
    out.push({
      ref,
      line: coLine({
        no: key(r, 'n d ecriture', 'no d ecriture', 'numero'),
        d,
        ty: coTypeOf(label),
        label,
        q: coNum(key(r, 'qte de la transaction', 'quantite', 'qte')),
        rem: String(key(r, 'remarque') || '').trim(),
        lieu: coPathCode(key(r, 'lieu de stockage', 'emplacement', 'lieu')),
        who: String(key(r, 'utilisateur', 'cree par', 'auteur') || '').trim()
      })
    });
  }
  return out;
}
let xlsxP = null;
const loadXlsx = () =>
  window.XLSX
    ? Promise.resolve()
    : xlsxP ||
      (xlsxP = new Promise((ok, ko) => {
        const sc = document.createElement('script');
        sc.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        sc.onload = ok;
        sc.onerror = () => {
          xlsxP = null;
          ko(new Error('Lecture des fichiers Excel indisponible (pas de connexion ?).'));
        };
        document.head.append(sc);
      }));
async function coReadFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.json')) {
    const j = JSON.parse(await file.text());
    return Array.isArray(j) ? j : j.rows || j.journal || [];
  }
  await loadXlsx();
  const wb = name.endsWith('.csv')
    ? XLSX.read(await file.text(), {type: 'string', raw: true})
    : XLSX.read(await file.arrayBuffer(), {cellDates: true});
  return wb.SheetNames.flatMap(n => XLSX.utils.sheet_to_json(wb.Sheets[n], {defval: '', raw: true}));
}
function importHistoDialog() {
  const byRef = new Map();
  for (const p of db.pieces) {
    byRef.set(String(p.ref).toUpperCase(), p);
    if (p.refFab && !byRef.has(String(p.refFab).toUpperCase())) byRef.set(String(p.refFab).toUpperCase(), p);
  }
  dialog({
    title: 'Importer l’historique du stock (CareOffice)',
    saveLabel: 'Importer',
    wide: true,
    body: `<p>Choisissez l’export du <b>Journal des écritures</b> de CareOffice (Excel ou CSV, un ou plusieurs articles), ou le fichier <span class="mono">historique-careoffice.json</span>. Chaque ligne est rattachée à sa pièce par l’ID ou le code de l’article. Une ligne déjà présente n’est pas ajoutée deux fois.</p>
      <label>Fichier<input type="file" name="file" accept=".xlsx,.xls,.csv,.json"></label><p class="hint" data-prev></p>`,
    onOpen(f, d) {
      f.elements.file.addEventListener('change', async () => {
        const prev = $('[data-prev]', d);
        d._data = null;
        try {
          prev.textContent = 'Lecture…';
          const rows = coJournalRows(await coReadFile(f.elements.file.files[0]));
          const ok = rows.filter(r => byRef.has(r.ref.toUpperCase())),
            miss = [...new Set(rows.filter(r => !byRef.has(r.ref.toUpperCase())).map(r => r.ref))];
          d._data = ok;
          prev.innerHTML = rows.length
            ? `${nbs(rows.length, 'ligne lue', 'lignes lues')} · <b>${nbs(new Set(ok.map(r => r.ref.toUpperCase())).size, 'pièce trouvée', 'pièces trouvées')}</b>${miss.length ? ` · <span style="color:var(--bad)">${nbs(miss.length, 'article inconnu', 'articles inconnus')} : ${esc(miss.slice(0, 6).join(', '))}${miss.length > 6 ? '…' : ''}</span>` : ''}`
            : '<span style="color:var(--bad)">Aucune ligne reconnue : vérifiez que le fichier contient les colonnes « Date d’écriture », « Type d’écriture », « Qté de la transaction » et « Code article ».</span>';
        } catch (e) {
          prev.innerHTML = `<span style="color:var(--bad)">${esc(e.message || e)}</span>`;
        }
      });
    },
    onSave(f, d) {
      const rows = d._data;
      if (!rows || !rows.length) throw new Error('Choisissez un fichier avec des lignes reconnues.');
      const k = l => l.no || [l.d, l.q, l.t].join('|');
      let add = 0;
      const touched = new Set();
      tx(() => {
        for (const {ref, line} of rows) {
          const p = byRef.get(ref.toUpperCase());
          let h = db.histo.find(x => x.id === p.id);
          if (!h) db.histo.push((h = {id: p.id, l: []}));
          const have = new Set(h.l.map(k));
          /* Ancienne reprise sans n° d'écriture : même date, quantité et type = même ligne */
          const old = new Set(h.l.map(l => [l.d, l.q, l.t.split(' · ')[0]].join('|')));
          if (have.has(k(line)) || old.has([line.d, line.q, line.t.split(' · ')[0]].join('|'))) continue;
          h.l.push(line);
          add++;
          touched.add(h);
        }
        for (const h of touched) h.l.sort((a, b) => String(b.d).localeCompare(String(a.d)));
      });
      render();
      toast(
        add
          ? `${nbs(add, 'ligne ajoutée', 'lignes ajoutées')} à ${nbs(touched.size, 'pièce', 'pièces')}`
          : 'Rien de nouveau : tout était déjà là.'
      );
    }
  });
}
function importPiecesDialog() {
  dialog({
    title: 'Importer des pièces depuis CareOffice',
    saveLabel: 'Importer',
    wide: true,
    body: `<p>Choisissez le fichier <span class="mono">pieces-triflow.json</span>. Chaque pièce garde son ID CareOffice ; une pièce dont l’ID existe déjà est mise à jour (désignation, fournisseur, stock, repères KKS). Les emplacements et repères KKS manquants sont créés.</p>
      <label>Fichier<input type="file" name="file" accept=".json,application/json"></label><p class="hint" data-prev></p>`,
    onOpen(f, d) {
      f.elements.file.addEventListener('change', async () => {
        try {
          const j = JSON.parse(await f.elements.file.files[0].text());
          d._data = j;
          $('[data-prev]', d).textContent = `${nbs((j.pieces || []).length, 'pièce', 'pièces')}, ${nbs(
            (j.pieces || []).reduce((a, p) => a + (p.stock || []).length, 0),
            'ligne',
            'lignes'
          )} de stock, ${nbs((j.newKks || []).length, 'repère', 'repères')} KKS à créer, historique de ${nbs(Object.keys(j.histo || {}).length, 'pièce', 'pièces')}.`;
        } catch (e) {
          d._data = null;
          $('[data-prev]', d).textContent = 'Fichier illisible.';
        }
      });
    },
    onSave(f, d) {
      const j = d._data;
      if (!j || !Array.isArray(j.pieces)) throw new Error('Choisissez le fichier pieces-triflow.json.');
      let add = 0,
        upd = 0,
        nk = 0,
        nh = 0;
      const nl0 = db.lieux.length;
      tx(() => {
        const kByCode = new Map(db.kks.map(k => [k.code.replace(/\s+/g, '').toUpperCase(), k]));
        for (const k of j.newKks || []) {
          const c = normCode(k.code);
          if (!kByCode.has(c.replace(/\s+/g, ''))) {
            const n = {id: uid(), code: c, designation: k.designation || c, aic: ''};
            db.kks.push(n);
            kByCode.set(c.replace(/\s+/g, ''), n);
            nk++;
          }
        }
        const byRef = new Map(db.pieces.map(p => [String(p.ref).toUpperCase(), p]));
        for (const x of j.pieces) {
          const ref = String(x.ref).toUpperCase();
          if (!ref) continue;
          const kks = (x.kks || []).map(c => kByCode.get(String(c).replace(/\s+/g, '').toUpperCase())?.id).filter(Boolean);
          const stock = [];
          for (const s of x.stock || []) {
            const l = ensureLieu(s.lieu);
            if (!l) continue;
            const e = stock.find(y => y.lieuId === l.id);
            if (e) e.qte = round(e.qte + (+s.qte || 0));
            else stock.push({lieuId: l.id, qte: +s.qte || 0});
          }
          const data = {
            ref,
            designation: x.designation || ref,
            categorie: x.categorie || '',
            fabricant: x.fabricant || '',
            refFab: x.refFab || '',
            fournisseur: x.fournisseur || x.fabricant || '',
            unite: x.unite || 'pce',
            stockMin: +x.stockMin || 0,
            notes: x.notes || ''
          };
          for (const nm of [data.fabricant, data.fournisseur])
            if (nm && !db.listes.fournisseurs.some(y => norm(y) === norm(nm))) db.listes.fournisseurs.push(nm);
          if (data.unite && !db.listes.unites.includes(data.unite)) db.listes.unites.push(data.unite);
          const ex = byRef.get(ref);
          if (ex) {
            Object.assign(ex, data, {stock, kks: [...new Set([...(ex.kks || []), ...kks])]});
            upd++;
          } else {
            const n = {id: uid(), ...data, stock, kks};
            db.pieces.push(n);
            byRef.set(ref, n);
            add++;
          }
          const pc = byRef.get(ref);
          pc.notes = cleanMisc(pc.notes);
          pc.notes = cleanNotes(
            pc.notes,
            new Set(
              pc.kks
                .map(id =>
                  db.kks
                    .find(k => k.id === id)
                    ?.code.replace(/\s+/g, '')
                    .toUpperCase()
                )
                .filter(Boolean)
            )
          );
        }
        db.listes.fournisseurs.sort(coll.compare);
        for (const [ref, l] of Object.entries(j.histo || {})) {
          const pc = byRef.get(String(ref).toUpperCase());
          if (!pc) continue;
          const ex = db.histo.find(h => h.id === pc.id);
          if (ex) ex.l = l;
          else db.histo.push({id: pc.id, l});
          nh++;
        }
      });
      tx(() => linkPartialKks(db));
      render();
      toast(
        `${nbs(add, 'pièce ajoutée', 'pièces ajoutées')}, ${nbs(upd, 'mise', 'mises')} à jour · ${nbs(db.lieux.length - nl0, 'emplacement', 'emplacements')} et ${nbs(nk, 'repère', 'repères')} KKS créés${nh ? ` · historique de ${nbs(nh, 'pièce', 'pièces')}` : ''}`
      );
    }
  });
}
function expandAny(s) {
  const t = String(s || '').trim();
  if (!t) return [''];
  return /[A-Za-z]/.test(t) ? expandLetters(t) : expandNums(t);
}
function seriesDialog(salleId) {
  if (!db.salles.length) {
    toast('Créez d’abord une salle.', 'bad');
    return salleDialog();
  }
  const salles = [...db.salles].sort((a, b) => coll.compare(salleCode(a), salleCode(b)));
  const build = f => {
    const s = getSalle(val(f, 'salleId')),
      base = val(f, 'base')
        .split('/')
        .map(x => x.trim())
        .filter(Boolean);
    const n1 = expandAny(val(f, 'n1')),
      n2 = expandAny(val(f, 'n2'));
    if (!base.length && n1[0] === '') throw new Error('Indiquez au moins le début du chemin ou une liste.');
    return n1.flatMap(a => n2.map(b => ({salleId: s.id, chemin: [...base, a, b].filter(Boolean), note: ''})));
  };
  dialog({
    title: 'Créer une série d’emplacements',
    saveLabel: 'Créer',
    body: `<label>Local<select name="salleId">${salles.map(s => opt(s.id, `${salleCode(s)} — ${s.nom}`, salleId || salles[0].id)).join('')}</select></label>
      <div class="grid3"><label>Début du chemin<input name="base" placeholder="ex. A   ou   Armoire E"></label><label>Puis<input name="n1" placeholder="ex. 11-13, 21"></label><label>Puis<input name="n2" placeholder="ex. 1-3   ou   A-C"></label></div>
      <p class="hint">Plages avec un tiret, listes avec des virgules, chiffres ou lettres. Exemple : « A », puis « 11-13 », puis « 1-2 » donne A / 11 / 1 … A / 13 / 2. Ceux qui existent déjà sont ignorés.</p>
      <p class="preview-code" data-prev></p>`,
    onOpen(f, d) {
      const prev = () => {
        try {
          const nw = build(f).filter(x => !findLieu(lieuCode(x)));
          $('[data-prev]', d).innerHTML =
            `${nbs(nw.length, 'nouvel emplacement', 'nouveaux emplacements')}${nw.length ? ` : <span class="plate">${esc(lieuCode(nw[0]))}</span>${nw.length > 1 ? ` … <span class="plate">${esc(lieuCode(nw[nw.length - 1]))}</span>` : ''}` : ''}`;
        } catch (e) {
          $('[data-prev]', d).textContent = e.message;
        }
      };
      f.addEventListener('input', prev);
      f.addEventListener('change', prev);
      prev();
    },
    onSave(f) {
      const list = build(f).filter(x => !findLieu(lieuCode(x)));
      if (!list.length) throw new Error('Aucun nouvel emplacement à créer.');
      if (list.length > 500) throw new Error('Plus de 500 emplacements d’un coup : réduisez la série.');
      tx(() => list.forEach(x => db.lieux.push({id: uid(), ...x})));
      render();
      toast(`${nbs(list.length, 'emplacement créé', 'emplacements créés')}`);
    }
  });
}

/* ---------- Étiquettes ---------- */
const fmtBody = () => `<fieldset class="seg" aria-label="Format">${[
  ['sheet', 'Planche A4 · 21 × 63,5 × 38,1 mm'],
  ['roll', 'Étiqueteuse · 62 × 29 mm']
]
  .map(([v, t]) => `<label><input type="radio" name="fmt" value="${v}" ${db.reglages.labelFmt === v ? 'checked' : ''}>${t}</label>`)
  .join('')}</fieldset>
  <div class="grid2"><label data-start>Commencer à l’étiquette n°<input name="start" type="number" min="1" max="21" value="1"></label></div>
  ${qrBase() ? '' : '<p class="hint"><strong>À savoir :</strong> tant que l’application n’est pas en ligne, le QR contient la référence de la pièce (il ouvre la fiche via la barre de recherche). Une fois en ligne, il ouvrira la fiche directement depuis l’appareil photo du téléphone.</p>'}
  <div><h3 style="margin-bottom:6px">Aperçu</h3><div class="lbl-prev" data-lprev></div></div>
  <p class="hint">Planche Avery L7160 / Zweckform 3652 ; pour une planche entamée, indiquez la première étiquette libre. À l’impression : échelle 100 %, sans en-têtes ni pieds de page. Si la fenêtre d’impression ne s’ouvre pas, ouvrez le fichier dans Chrome ou Edge plutôt que dans un aperçu.</p>`;
const fmtOpen = (f, d, cellsFn) => {
  const u = () => {
    $('[data-start]', d).hidden = val(f, 'fmt') !== 'sheet';
    let cells = [];
    try {
      cells = cellsFn ? cellsFn() : [];
    } catch (e) {}
    const o = fmtVals(f),
      box = $('[data-lprev]', d);
    box.innerHTML = cells.length
      ? labelsHTML(cells.slice(0, o.fmt === 'roll' ? 3 : Math.max(0, 22 - o.start)), o).replace(
          /<div class="sheet">([\s\S]*?)<\/div>(?=<div class="sheet">)[\s\S]*/,
          '<div class="sheet">$1</div>'
        )
      : '<p class="hint" style="padding:12px">Aucune étiquette à afficher.</p>';
  };
  f.addEventListener('change', u);
  f.addEventListener('input', u);
  u();
};
const fmtVals = f => ({fmt: val(f, 'fmt') || 'sheet', start: Math.min(21, Math.max(1, +val(f, 'start') || 1))});
function pieceLabelsDialog(ids) {
  const pick = ids == null;
  const ps = pick ? [] : ids.map(getPiece).filter(Boolean);
  if (!pick && !ps.length) {
    toast('Aucune pièce à imprimer.', 'bad');
    return;
  }
  dialog({
    title: pick
      ? 'Étiquettes QR du matériel'
      : `Imprimer ${ps.length > 1 ? ps.length + ' étiquettes QR' : 'l’étiquette QR de ' + esc(ps[0].ref)}`,
    saveLabel: 'Imprimer',
    body: `${
      pick
        ? `<fieldset><legend>Quelles pièces ?</legend><div class="seg">${[
            ['one', 'Une pièce'],
            ['place', 'Tout un emplacement ou une salle'],
            ['all', 'Toutes les pièces']
          ]
            .map(([v, t], i) => `<label><input type="radio" name="which" value="${v}" ${i === 0 ? 'checked' : ''}>${t}</label>`)
            .join('')}</div>
      <input name="piece" list="dl-pieces" placeholder="ID ou désignation" aria-label="Pièce" autocomplete="off" data-w="one"><input name="place" list="dl-lieux" placeholder="ex. E1.11 ou E1.11 C40" aria-label="Emplacement ou salle" autocomplete="off" data-w="place" hidden><p class="hint" data-count></p></fieldset>`
        : ''
    }
      ${fmtBody()}`,
    onOpen(f, d) {
      fmtOpen(f, d, () => (pick ? choose(f) : ps).map(pieceLabelHTML));
      if (pick) {
        const u = () => {
          const w = val(f, 'which');
          $$('[data-w]', d).forEach(el => (el.hidden = el.dataset.w !== w));
          try {
            $('[data-count]', d).textContent = `${nbs(choose(f).length, 'étiquette', 'étiquettes')}`;
          } catch (e) {
            $('[data-count]', d).textContent = '';
          }
        };
        f.addEventListener('input', u);
        f.addEventListener('change', u);
        u();
      }
    },
    onSave(f) {
      const list = pick ? choose(f) : ps;
      if (!list.length) throw new Error('Aucune pièce sélectionnée.');
      printLabels(list.map(pieceLabelHTML), fmtVals(f));
    }
  });
  function choose(f) {
    const w = val(f, 'which');
    if (w === 'all') return [...db.pieces].sort((a, b) => coll.compare(a.ref, b.ref));
    if (w === 'one') {
      const p = findPiece(val(f, 'piece'));
      return p ? [p] : [];
    }
    const c = normCode(val(f, 'place'));
    if (!c) return [];
    const lids = new Set(
      db.lieux
        .filter(l => {
          const lc = lieuCode(l);
          return lc === c || lc.startsWith(c + ' ') || lc.startsWith(c);
        })
        .map(l => l.id)
    );
    return db.pieces.filter(p => p.stock.some(s => lids.has(s.lieuId) && s.qte > 0)).sort((a, b) => coll.compare(a.ref, b.ref));
  }
}
function locLabelsDialog(ids) {
  const ls = ids.map(getLieu).filter(Boolean).sort(lieuSort);
  if (!ls.length) {
    toast('Aucun emplacement à imprimer.', 'bad');
    return;
  }
  dialog({
    title: `Étiquettes d’emplacement (${ls.length})`,
    saveLabel: 'Imprimer',
    body: `<p class="hint">Étiquettes de rayonnage, sans QR code : le code de l’emplacement en grand sur fond jaune.</p>${fmtBody()}`,
    onOpen: (f, d) => fmtOpen(f, d, () => ls.map(locLabelHTML)),
    onSave(f) {
      printLabels(ls.map(locLabelHTML), fmtVals(f));
    }
  });
}
function pieceLabelHTML(p) {
  const places = sortedStock(p)
    .filter(s => s.qte > 0)
    .map(s => lieuCode(getLieu(s.lieuId)));
  const pl = places.length ? places : sortedStock(p).map(s => lieuCode(getLieu(s.lieuId)));
  return `<div class="lbl">${qrSvg(qrText(p))}<div class="lbl-txt"><div class="lbl-code">${esc(p.ref)}</div><div class="lbl-des">${esc(p.designation)}</div>${pl.length ? `<div class="lbl-room">${esc(pl[0])}${pl.length > 1 ? ` +${pl.length - 1}` : ''}</div>` : ''}<div class="lbl-org">TriFlow · Tridel</div></div></div>`;
}
function locLabelHTML(l) {
  return `<div class="lbl loc"><div class="lbl-code">${esc(lieuCode(l))}</div><div class="lbl-room">${esc(getSalle(l.salleId)?.nom || '')}</div><div class="lbl-org">TriFlow · Tridel</div></div>`;
}
function labelsHTML(cells, o) {
  let html;
  if (o.fmt === 'roll') html = cells.map(c => `<div class="roll">${c}</div>`).join('');
  else {
    const all = [...Array(o.start - 1).fill('<div></div>'), ...cells];
    html = '';
    for (let i = 0; i < all.length; i += 21) html += `<div class="sheet">${all.slice(i, i + 21).join('')}</div>`;
  }
  return html;
}
function printLabels(cells, o) {
  doPrint(labelsHTML(cells, o));
}
/* Réduit la feuille pour qu'une semaine tienne sur une seule page */
function fitSheet(html, wmm, hmm) {
  const m = document.createElement('div');
  m.style.cssText = `position:absolute;left:-99999px;top:0;width:${wmm}mm;background:#fff;color:#000`;
  m.innerHTML = html;
  document.body.append(m);
  const h = m.firstElementChild.getBoundingClientRect().height,
    avail = (hmm * 96) / 25.4;
  m.remove();
  if (h <= avail) return html;
  const z = Math.max(0.5, (avail / h) * 0.97);
  return html.replace('class="plan-sheet xls"', `class="plan-sheet xls" style="zoom:${z.toFixed(3)}"`);
}
function endPrintLand() {
  document.body.classList.remove('land', 'a3');
}
function doPrint(html) {
  setTimeout(endPrintLand, 3000);
  $('#print').innerHTML = html;
  document.body.classList.add('printing');
  setTimeout(() => {
    window.print();
    setTimeout(endPrint, 500);
  }, 60);
}
function endPrint() {
  document.body.classList.remove('printing');
  $('#print').innerHTML = '';
}
window.addEventListener('afterprint', endPrint);

/* ---------- Liste de choix avec recherche (remplace les listes du navigateur) ----------
   Clic ou focus : toute la liste s'affiche. On tape pour filtrer, flèches + Entrée pour choisir. */
function combo(input, {items, onPick, keep = true, max = 60}) {
  const list = document.createElement('div');
  list.className = 'combo-list';
  list.hidden = true;
  list.setAttribute('role', 'listbox');
  input.closest('dialog').append(list);
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  let hits = [],
    act = 0,
    picked = input.dataset.label || input.value,
    pickedId = input.dataset.id || '';
  const place = () => {
    const r = input.getBoundingClientRect(),
      below = innerHeight - r.bottom - 12,
      h = Math.min(300, Math.max(below, r.top - 12));
    list.style.left = r.left + 'px';
    list.style.width = Math.max(r.width, 260) + 'px';
    list.style.maxHeight = h + 'px';
    list.style.top = (below >= Math.min(300, h) || below > r.top ? r.bottom + 4 : r.top - 4 - Math.min(h, list.scrollHeight)) + 'px';
  };
  const draw = () => {
    const toks = norm(input.value === picked ? '' : input.value)
      .split(/\s+/)
      .filter(Boolean);
    hits = items()
      .filter(it => toks.every(t => norm(it.search).includes(t)))
      .slice(0, max);
    act = Math.min(act, Math.max(0, hits.length - 1));
    list.innerHTML = hits.length
      ? hits
          .map(
            (it, i) =>
              `<div class="combo-opt ${i === act ? 'hot' : ''}" role="option" data-i="${i}"><span class="t">${it.html}</span>${it.right ? `<span class="r">${it.right}</span>` : ''}</div>`
          )
          .join('')
      : '<div class="combo-none">Aucun résultat</div>';
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    place();
    list.querySelector('.hot')?.scrollIntoView({block: 'nearest'});
  };
  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  };
  const pick = it => {
    if (!it) return;
    if (keep) {
      input.value = picked = it.label;
      input.dataset.id = pickedId = it.id;
    } else {
      input.value = '';
      picked = '';
    }
    close();
    onPick && onPick(it);
  };
  input.addEventListener('focus', () => {
    input.select();
    act = 0;
    draw();
  });
  input.addEventListener('click', () => {
    if (list.hidden) {
      act = 0;
      draw();
    }
  });
  input.addEventListener('input', () => {
    act = 0;
    if (keep) input.dataset.id = '';
    draw();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) return draw();
      act = (act + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % Math.max(1, hits.length);
      draw();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!list.hidden) pick(hits[act]);
    } else if (e.key === 'Escape' && !list.hidden) {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') close();
  });
  input.addEventListener('blur', () =>
    setTimeout(() => {
      close();
      if (keep && !input.dataset.id && input.value.trim()) {
        const ex = items().find(
          it => norm(it.label) === norm(input.value) || norm(it.id) === norm(input.value) || norm(it.key || '') === norm(input.value)
        );
        if (ex) pick(ex);
        else if (pickedId) {
          input.value = picked;
          input.dataset.id = pickedId;
        }
      }
    }, 150)
  );
  list.addEventListener('mousedown', e => {
    e.preventDefault();
    const o = e.target.closest('.combo-opt');
    if (o) pick(hits[+o.dataset.i]);
  });
  input.closest('.dlg-body')?.addEventListener('scroll', close);
  return {close, open: draw};
}
const pieceItems = () =>
  db.pieces
    .filter(live)
    .sort((a, b) => coll.compare(a.ref, b.ref))
    .map(p => {
      const mp = mainPlace(p);
      return {
        id: p.id,
        key: p.ref,
        label: pieceLabel(p),
        search: [p.ref, p.designation, p.fabricant, p.refFab].join(' '),
        html: `<span class="ref">${esc(p.ref)}</span> ${esc(p.designation)}`,
        right: `<span class="qty">${num(total(p))} ${esc(p.unite)}</span>${mp ? ' · ' + esc(lieuCode(mp)) : ''}`
      };
    });

/* ---------- Photos (pièces et rapports) ----------
   Rangées dans Supabase Storage (seau privé « photos », voir outils/photos.sql).
   Dans la fiche, on garde seulement le chemin : photos: [{path, at, by}].
   À l'envoi, la photo est réduite (1600 px, JPEG) pour rester légère. */
const PHOTOS = {urls: new Map(), asked: new Set(), wait: null};
function photoUrl(path) {
  const u = PHOTOS.urls.get(path);
  if (u && u.exp > Date.now()) return u.url;
  if (!PHOTOS.asked.has(path)) {
    PHOTOS.asked.add(path);
    clearTimeout(PHOTOS.wait);
    PHOTOS.wait = setTimeout(photoFetch, 30);
  }
  return '';
}
async function photoFetch() {
  const paths = [...PHOTOS.asked].filter(p => !(PHOTOS.urls.get(p)?.exp > Date.now()));
  if (!paths.length || !CLOUD.sb?.storage) return;
  try {
    const {data, error} = await CLOUD.sb.storage.from('photos').createSignedUrls(paths, 3600);
    if (error) throw error;
    for (const r of data || []) if (r.signedUrl) PHOTOS.urls.set(r.path, {url: r.signedUrl, exp: Date.now() + 3500e3});
  } catch (e) {
    /* hors ligne ou seau absent : on réessaiera plus tard */
  }
  for (const p of paths) PHOTOS.asked.delete(p);
  $$('img[data-photo]').forEach(im => {
    const u = PHOTOS.urls.get(im.dataset.photo);
    if (u && im.getAttribute('src') !== u.url) im.src = u.url;
  });
}
const photoImg = (path, cls = '') =>
  `<img class="ph-img ${cls}" data-photo="${esc(path)}" src="${esc(photoUrl(path))}" alt="" loading="lazy" decoding="async">`;
function photoStrip(list, {col, id} = {}, canAdd = true) {
  const ph = list || [];
  return `<div class="ph-strip">${ph
    .map(
      (x, i) =>
        `<button type="button" class="ph-th" data-act="photo-open" data-path="${esc(x.path)}" ${col ? `data-col="${col}" data-id="${esc(id)}" data-i="${i}"` : ''} aria-label="Agrandir la photo">${photoImg(x.path)}</button>`
    )
    .join('')}${
    canAdd
      ? `<label class="ph-add" title="Ajouter une photo">${icon('plus')}<span>Photo</span><input type="file" accept="image/*" capture="environment" ${col ? `data-photo-add="${col}" data-id="${esc(id)}"` : 'data-photo-pick'} hidden></label>`
      : ''
  }</div>`;
}
/* Réduit l'image et l'envoie ; renvoie le chemin rangé */
async function photoUpload(file, prefix) {
  if (!CLOUD.sb?.storage) throw new Error('Photos indisponibles ici.');
  if (navigator.onLine === false) throw new Error('Il faut du réseau pour envoyer une photo.');
  const bmp = await createImageBitmap(file).catch(() => null);
  let blob = file;
  if (bmp) {
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)),
      c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.82));
  }
  const path = `${prefix}/${todayISO().slice(0, 7)}/${uid()}.jpg`;
  const {error} = await CLOUD.sb.storage.from('photos').upload(path, blob, {contentType: 'image/jpeg', upsert: false});
  if (error)
    throw new Error(
      /bucket|not found/i.test(error.message || '')
        ? 'Les photos ne sont pas encore activées (outils/photos.sql).'
        : error.message || 'Envoi impossible.'
    );
  return {path, at: new Date().toISOString(), by: meId() || ''};
}
function photoViewer(path, onDel) {
  const d = dialog({
    title: 'Photo',
    wide: true,
    info: true,
    saveLabel: 'Fermer',
    body: `<div class="ph-big">${photoImg(path, 'big')}</div>${onDel ? '<button type="button" class="btn danger-ghost" data-phdel>Retirer la photo</button>' : ''}`,
    onSave() {}
  });
  const b = $('[data-phdel]', d);
  if (b)
    b.onclick = () => {
      onDel();
      d.close();
    };
}
/* Ajout depuis une fiche (pièce ou rapport) */
document.addEventListener('change', async e => {
  const inp = e.target.closest('[data-photo-add]');
  if (!inp || !inp.files?.length) return;
  const col = inp.dataset.photoAdd,
    x = get(col, inp.dataset.id);
  if (!x) return;
  const lab = inp.closest('.ph-add');
  lab?.classList.add('busy');
  try {
    for (const f of inp.files) {
      const ph = await photoUpload(f, col === 'pieces' ? 'pieces' : 'rapports');
      tx(() => {
        x.photos = [...(x.photos || []), ph];
      });
    }
    render();
    toast('Photo ajoutée');
  } catch (er) {
    toast(er.message, 'bad');
  }
  lab?.classList.remove('busy');
  inp.value = '';
});
