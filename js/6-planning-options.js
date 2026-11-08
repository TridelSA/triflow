'use strict';
/* TriFlow — Planning de la semaine (grille, À planifier, saisie, impression A3), emplacements, accès, options. (Fichiers chargés dans l'ordre par index.html.) */
/* ---------- Options ---------- */
/* ---------- Planning de la semaine ---------- */
/* Présences lues dans le Planning Tridel (même fichier que la liste du personnel) ; affectations enregistrées dans la collection « plan » :
   {id, date:'AAAA-MM-JJ', who:id de personne ou 'row:autres' | 'row:ext' | 'row:nacelle', tacheId?, text} */
const PLAN_ROWS = [
  ['row:autres', 'Autres tâches à effectuer', 'list'],
  ['row:ext', 'Entreprises extérieures', 'truck'],
  ['row:nacelle', 'Réservation nacelles', 'shelf']
];
const EQUIPE_NO = {
  AQUILLON: 1,
  HODZIC: 1,
  MIGUEL: 1,
  DUC: 2,
  IONITA: 2,
  YILDIRIM: 2,
  GARCIA: 3,
  FELISBERTO: 3,
  BRAHIMI: 3,
  SIMONIN: 4,
  LAUNAZ: 4,
  NAHOUNOU: 4,
  MERMOUD: 5,
  SERRANO: 5,
  'DA ROCHA': 5
};
const PCODE = {
  R: ['Réserve', 'on'],
  PO: ['Portes', 'on'],
  CA: ['Camion', 'on'],
  EN: ['Entretien', 'on'],
  GR: ['Groupe', 'on'],
  RF: ['Reprise férié', 'off'],
  PIQ: ['Piquet', 'piq'],
  RM: ['Rotation matin', 'rot'],
  RA: ['Rotation après-midi', 'rot'],
  RN: ['Rotation nuit', 'rot'],
  VA: ['Vacances', 'abs'],
  VJ: ['Vacances', 'abs'],
  HOR: ['Récupération', 'abs'],
  HSR: ['Récupération', 'abs'],
  PI: ['Reprise de piquet', 'abs'],
  FE: ['Formation externe', 'abs'],
  MI: ['Militaire', 'abs'],
  PC: ['Protection civile', 'abs'],
  EM: ['Enfant malade', 'abs'],
  AN: ['Ancienneté', 'abs'],
  AP: ['Accident', 'abs'],
  PR: ['Personnel', 'abs'],
  MS: ['Maladie', 'abs'],
  MC: ['Maladie', 'abs'],
  NS: ['Naissance', 'abs'],
  PA: ['Congé parental', 'abs'],
  DE: ['Déménagement', 'abs'],
  DL: ['Délégation', 'abs'],
  DC: ['Congé décès', 'abs'],
  JT: ['Congé', 'abs']
};
const PLANS = {};
async function loadPresence(year) {
  if (PLANS[year]) return PLANS[year];
  PLANS[year] = {loading: true, byNom: new Map(), order: new Map()};
  try {
    const r = await fetch(`${PLANNING_URL}planning-${year}.json`, {cache: 'no-store'});
    if (r.ok) {
      const j = await r.json();
      (j.employes || []).forEach((e, i) => {
        const n = String(e.nom || '')
          .trim()
          .toUpperCase();
        PLANS[year].byNom.set(n, e);
        PLANS[year].order.set(n, i);
      });
    }
  } catch (e) {}
  PLANS[year].loading = false;
  if (S.view === 'planning' || S.view === 'accueil') render();
  return PLANS[year];
}
const presOf = (p, iso) => {
  const P = PLANS[iso.slice(0, 4)];
  if (!P) return null;
  const e = P.byNom.get(String(p.nom || '').toUpperCase());
  if (!e) return null;
  return {code: e.planning?.[iso] || '', note: e.commentaires?.[iso] || ''};
};
const isoAdd = (iso, n) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
/* Semaine « en cours » : le week-end, c'est déjà la semaine suivante qu'on prépare */
/* Le planning s'ouvre sur la semaine suivante (c'est celle qu'on prépare) */
const planWeek = () => isoAdd(mondayOf(todayISO()), 7);
const thisWeek = () => {
  const t = todayISO(),
    m = mondayOf(t);
  return (new Date(t + 'T12:00:00').getDay() + 6) % 7 >= 5 ? isoAdd(m, 7) : m;
};
const mondayOf = iso => {
  const d = new Date(iso + 'T12:00:00'),
    w = (d.getDay() + 6) % 7;
  return isoAdd(iso, -w);
};
const isoWeek = iso => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const y = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - y) / 864e5 - 3 + ((y.getDay() + 6) % 7)) / 7);
};
const DAYN = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],
  DAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dayLbl = iso =>
  `${DAYN[(new Date(iso + 'T12:00:00').getDay() + 6) % 7].toLowerCase()} ${+iso.slice(8)} ${MOIS[+iso.slice(5, 7) - 1]}`;
/* Personnes masquées du planning : réglage commun à tous (Options partagées). Par défaut : équipes de rotation, administration et la dernière personne de la liste. */
function planHide() {
  const h = db.reglages.planHide;
  if (h) return {g: new Set(h.g || []), p: new Set(h.p || [])};
  const P = PLANS[(S.pweek || todayISO()).slice(0, 4)];
  let last = null;
  if (P && P.order.size) {
    let mx = -1;
    for (const x of db.personnes) {
      const o = P.order.get(String(x.nom).toUpperCase());
      if (live(x) && x.actif !== false && o != null && o > mx) {
        mx = o;
        last = x.id;
      }
    }
  }
  return {g: new Set(['Équipe', 'Administration']), p: new Set(last ? [last] : [])};
}
function planHideDialog() {
  const h = planHide(),
    ppl = db.personnes.filter(p => live(p) && p.actif !== false).sort(persSort),
    grps = db.listes.groupes.filter(g => ppl.some(p => p.groupe === g));
  planPeople();
  const auto = new Set((planPeople.conge || []).map(p => p.id)),
    mon = S.pweek || planWeek();
  const why = p => {
    const c = [...new Set(Array.from({length: 5}, (_, i) => presOf(p, isoAdd(mon, i))?.code).filter(Boolean))];
    return c.join(', ');
  };
  dialog({
    title: 'Qui apparaît dans le planning ?',
    saveLabel: 'Enregistrer',
    wide: true,
    body: `<p class="hint">Réglage commun à tous les postes. Décochez un groupe entier, ou seulement certaines personnes.<br>Les personnes cochées mais <b>sans R, PIQ, EN, PI ou CA</b> dans la semaine sont masquées automatiquement (indiqué en gris).</p>${grps
      .map(
        g =>
          `<fieldset data-g="${esc(g)}"><legend><label class="chk"><input type="checkbox" name="g" value="${esc(g)}"> ${esc(g === 'Équipe' ? 'Équipes de rotation' : g)}</label></legend><div class="pdchk">${ppl
            .filter(p => p.groupe === g)
            .map(
              p =>
                `<label class="chk ${auto.has(p.id) ? 'abs' : ''}"><input type="checkbox" name="p" value="${p.id}" ${h.g.has(g) || h.p.has(p.id) ? '' : 'checked'}> ${esc(persName(p))}${auto.has(p.id) ? ` <small>masqué cette semaine${why(p) ? ' (' + esc(why(p)) + ')' : ''}</small>` : ''}</label>`
            )
            .join('')}</div></fieldset>`
      )
      .join('')}`,
    onOpen(f) {
      const sync = fs => {
        const ps = [...fs.querySelectorAll('input[name=p]')],
          n = ps.filter(x => x.checked).length,
          gi = fs.querySelector('input[name=g]');
        gi.checked = n > 0;
        gi.indeterminate = n > 0 && n < ps.length;
      };
      f.querySelectorAll('fieldset[data-g]').forEach(fs => {
        sync(fs);
        fs.querySelector('input[name=g]').addEventListener('change', e => {
          fs.querySelectorAll('input[name=p]').forEach(x => {
            x.checked = e.target.checked;
          });
          sync(fs);
        });
        fs.querySelectorAll('input[name=p]').forEach(x => x.addEventListener('change', () => sync(fs)));
      });
    },
    onSave(f) {
      const g = [],
        pp = [];
      f.querySelectorAll('fieldset[data-g]').forEach(fs => {
        const ps = [...fs.querySelectorAll('input[name=p]')];
        if (ps.every(x => !x.checked)) g.push(fs.dataset.g);
        else ps.filter(x => !x.checked).forEach(x => pp.push(x.value));
      });
      tx(() => {
        db.reglages.planHide = {g, p: pp};
      });
      render();
      toast('Planning mis à jour', '', true);
    }
  });
}
const CONGE = new Set(['VA', 'VJ', 'HOR', 'HSR', 'PI']);
const DISPO = new Set(['R', 'PIQ', 'EN', 'PI', 'CA']);
function enConge(p, mon) {
  const days = Array.from({length: 5}, (_, i) => isoAdd(mon, i)),
    codes = days.map(d => presOf(p, d)?.code || '');
  return (
    !codes.some(c => DISPO.has(c)) &&
    codes.some(Boolean) &&
    !db.plan.some(x => x.who === p.id && x.date >= days[0] && x.date <= isoAdd(mon, 6))
  );
}
function planPeople(withLeave = false) {
  const hide = planHide(),
    mon = S.pweek || planWeek();
  const P = PLANS[mon.slice(0, 4)],
    ord = n => P?.order.get(String(n).toUpperCase()) ?? 999;
  const all = db.personnes.filter(p => live(p) && p.actif !== false && !hide.g.has(p.groupe || '') && !hide.p.has(p.id));
  planPeople.conge = all.filter(p => enConge(p, mon));
  return all
    .filter(p => withLeave || !planPeople.conge.includes(p))
    .sort(
      (a, b) =>
        (a.groupe === 'Équipe' ? -1 : grpIdx(a.groupe)) - (b.groupe === 'Équipe' ? -1 : grpIdx(b.groupe)) ||
        ord(a.nom) - ord(b.nom) ||
        coll.compare(a.nom, b.nom)
    );
}
/* Disponible ce jour-là (R, PIQ, EN, PI, CA, PO…) : case blanche, sans code */
const isDispo = code => !!code && (DISPO.has(code) || ['on', 'piq'].includes((PCODE[code] || [])[1]));
function planCell(who, iso, p) {
  const items = db.plan.filter(x => x.who === who && x.date === iso),
    pr = p ? presOf(p, iso) : null,
    pc = pr && pr.code && !isDispo(pr.code) ? PCODE[pr.code] || [pr.code, 'on'] : null;
  const done = x => {
    const t = x.tacheId && get('taches', x.tacheId);
    return !!t && doneOn(t, iso);
  };
  return `<div class="pc ${pc ? 'k-' + pc[1] : p && pr && !pr.code ? 'k-none' : ''} ${S.pdrop === who + '|' + iso ? 'drop' : ''}" data-act="plan-add" data-who="${esc(who)}" data-date="${iso}">
    ${pc ? `<span class="pcode" title="${esc(pc[0])}${pr.note ? ' · ' + esc(pr.note) : ''}">${esc(pr.code)}</span>` : ''}
    ${items
      .map(x => {
        const t = x.tacheId ? get('taches', x.tacheId) : null,
          k = t ? getKks(t.kksId) : null;
        return `<button class="pit ${t ? 'task' : ''} ${done(x) ? 'done' : ''}" data-act="plan-edit" data-id="${x.id}" title="${esc(t ? t.titre : x.text)}"><span>${esc(t ? t.titre : x.text)}</span>${k ? `<small>${esc(k.code)}</small>` : ''}${t && x.text ? `<small>${esc(x.text)}</small>` : ''}${t ? `<span class="pdel" data-act="plan-del" data-id="${x.id}" role="button" aria-label="Retirer du planning" title="Retirer du planning">×</span>` : ''}</button>`;
      })
      .join('')}
    ${pr && pr.note ? `<span class="pnote">${esc(pr.note)}</span>` : ''}</div>`;
}
VIEWS.planning = {
  shell() {
    const mon = S.pweek || (S.pweek = planWeek());
    loadPresence(mon.slice(0, 4));
    if (isoAdd(mon, 6).slice(0, 4) !== mon.slice(0, 4)) loadPresence(isoAdd(mon, 6).slice(0, 4));
    const nd = S.pwe ? 7 : 5,
      days = Array.from({length: nd}, (_, i) => isoAdd(mon, i)),
      today = todayISO();
    const ppl = planPeople(),
      conge = planPeople.conge,
      me = meId(),
      P = PLANS[mon.slice(0, 4)];
    const grps = db.listes.groupes.filter(g => db.personnes.some(p => live(p) && p.actif !== false && p.groupe === g));
    const d0 = days[0],
      d1 = days[nd - 1];
    const range =
      d0.slice(5, 7) === d1.slice(5, 7)
        ? `${+d0.slice(8)} – ${+d1.slice(8)} ${MOIS[+d1.slice(5, 7) - 1]} ${d1.slice(0, 4)}`
        : `${+d0.slice(8)} ${MOIS[+d0.slice(5, 7) - 1]} – ${+d1.slice(8)} ${MOIS[+d1.slice(5, 7) - 1]} ${d1.slice(0, 4)}`;
    const mday = Math.min(S.pday ?? Math.max(0, Math.min(nd - 1, days.indexOf(today))), nd - 1);
    let rows = '',
      lastG = null,
      lastEq = null;
    for (const p of ppl) {
      const g = p.groupe || 'Sans groupe',
        eq = g === 'Équipe' ? EQUIPE_NO[String(p.nom).toUpperCase()] || '' : '';
      if (g !== lastG) {
        const mk = metOf(g);
        rows += `<tr class="pg ${mk && S.pmet === mk ? 'on' : ''}"><th colspan="${nd + 1}">${mdot(mk)}${esc(g === 'Équipe' ? 'Équipes de rotation' : g)}</th></tr>`;
        lastG = g;
        lastEq = null;
      }
      if (eq && eq !== lastEq && lastEq !== null) rows += `<tr class="peq"><td colspan="${nd + 1}"></td></tr>`;
      lastEq = eq || lastEq;
      rows += `<tr class="${p.id === me ? 'me' : ''}"><th class="pn">${esc(persName(p))}${eq ? `<small>Éq. ${eq}</small>` : ''}</th>${days.map(d => `<td class="${d === today ? 'today' : ''}">${planCell(p.id, d, p)}</td>`).join('')}</tr>`;
    }
    rows +=
      `<tr class="pg"><th colspan="${nd + 1}">Général</th></tr>` +
      PLAN_ROWS.map(
        ([w, t, ic]) =>
          `<tr class="prow2"><th class="pn">${icon(ic)}${t}</th>${days.map(d => `<td class="${d === today ? 'today' : ''}">${planCell(w, d, null)}</td>`).join('')}</tr>`
      ).join('');
    const mobile = `<div class="pdays">${days.map((d, i) => `<button class="pday ${i === mday ? 'on' : ''} ${d === today ? 'today' : ''}" data-act="pday" data-i="${i}"><b>${DAYS[i]}</b><span>${+d.slice(8)}</span></button>`).join('')}</div>
      <div class="pmlist">${(() => {
        const d = days[mday];
        let h = '',
          lg = null;
        for (const p of ppl) {
          const g = p.groupe || 'Sans groupe';
          if (g !== lg) {
            h += `<div class="pmg">${mdot(metOf(g))}${esc(g === 'Équipe' ? 'Équipes de rotation' : g)}</div>`;
            lg = g;
          }
          h += `<div class="pmr ${p.id === me ? 'me' : ''}"><span class="pn">${esc(persName(p))}</span>${planCell(p.id, d, p)}</div>`;
        }
        h +=
          '<div class="pmg">Général</div>' +
          PLAN_ROWS.map(([w, t]) => `<div class="pmr"><span class="pn">${t}</span>${planCell(w, d, null)}</div>`).join('');
        return h;
      })()}</div>`;
    return `<header class="page-head"><h1>Planning</h1><div class="tools">
        <div class="pweek"><button class="btn icon-only" data-act="pweek" data-n="-7" aria-label="Semaine précédente">${icon('chev')}</button><div class="pw-l"><b>Semaine ${isoWeek(mon)}</b><span>${range}</span></div><button class="btn icon-only" data-act="pweek" data-n="7" aria-label="Semaine suivante">${icon('chev')}</button></div>
        <button class="btn side-tg ${S.pside ? 'on' : ''}" data-act="plan-side" title="Liste des travaux à glisser dans le planning">${icon('list')}Travaux à planifier${(() => {
          const n = planSideCount(days, ppl);
          return n ? ` <span class="badge">${n}</span>` : '';
        })()}</button>
        ${mon !== planWeek() ? `<button class="btn" data-act="pweek" data-n="0">Semaine prochaine</button>` : `<button class="btn" data-act="pweek" data-n="-7">Cette semaine</button>`}
        <button class="btn primary" data-act="plan-print" data-f="a3" title="Imprimer la semaine sur une feuille A3 paysage">${icon('printer')}Imprimer A3</button>${(() => {
          const r = db.reglages.planPret?.[mon];
          return r
            ? `<span class="chip ok plan-ready" title="Imprimée le ${fmtDT(r.at)}">${icon('check')}Prête${getPers(r.by) ? ' · ' + esc(getPers(r.by).nom) : ''}</span>`
            : '';
        })()}
        ${menu([['plan-hide', 'Personnes affichées', 'person', {}]])}</div></header>
      <div class="ptip-row"><p class="hint ptip">${P && !P.loading && !P.byNom.size ? 'Présences indisponibles (Planning Tridel non joignable). ' : ''}Cliquez une case et tapez le travail : <b>Entrée</b> valide, <b>Tab</b> passe au jour suivant, <b>⋯</b> pour plus de choix.</p>${planLegend()}</div>
      <div class="pwrap ${S.pside ? '' : 'noside'}"><div class="wkgrid-wrap"><table class="wkgrid"><thead><tr><th></th>${days.map((d, i) => `<th class="${d === today ? 'today' : ''}">${DAYN[i]}<small>${+d.slice(8)}.${d.slice(5, 7)}</small></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>${S.pside ? planSideHTML(days, ppl) : ''}</div>
      ${
        conge.length
          ? `<p class="hint pconge">${icon('calendar')}Pas disponibles cette semaine : ${conge
              .sort(persSort)
              .map(p => esc(persName(p)))
              .join(', ')}.</p>`
          : ''
      }
      <div class="pmobile">${mobile}</div>`;
  },
  list: () => '',
  detail: () => ''
};
function planLegend() {
  const seen = new Map();
  for (const [c, [t, k]] of Object.entries(PCODE)) {
    const key = k + '|' + t;
    if (!seen.has(key)) seen.set(key, {k, t, c: []});
    seen.get(key).c.push(c);
  }
  const g = (k, title) => {
    const l = [...seen.values()].filter(x => x.k === k);
    return l.length
      ? `<b>${title}</b>${l.map(x => `<span>${x.c.map(c => `<span class="pcode k-${k}">${c}</span>`).join('')}${esc(x.t)}</span>`).join('')}`
      : '';
  };
  return `<details class="plegend"><summary>${icon('list')}Que veulent dire les codes ?</summary><div class="lg">${g('on', 'Présent')}${g('rot', 'Rotation')}${g('piq', 'Piquet')}${g('off', 'Congé')}${g('abs', 'Absent')}</div></details>`;
}
/* Les quatre métiers qui reviennent le plus : même nom et même couleur dans « À planifier » et dans la grille */
const METIERS = [
  ['elec', 'Électricien', /^elec/],
  ['auto', 'Automaticien', /^auto/],
  ['meca', 'Mécanicien', /^meca/],
  ['intend', 'Intendance', /^intend/]
];
const metOf = g => (METIERS.find(m => m[2].test(norm(g || ''))) || [''])[0];
const tMet = t => metOf(t.assign?.type === 'personne' ? getPers(t.assign.v)?.groupe : t.assign?.v);
const mdot = k => (k ? `<i class="mdot m-${k}" aria-hidden="true"></i>` : '');
/* Quand ? par rapport à la semaine affichée */
const pKey = (t, start, end) =>
  t.arret && !arretFait(t)
    ? arretOn(start, end)
      ? 'semaine'
      : 'arret'
    : !t.prochaine
      ? 'asap'
      : daysTo(t.prochaine) < -365
        ? 'vieux'
        : t.prochaine < start
          ? 'retard'
          : t.prochaine <= end
            ? 'semaine'
            : 'plus';
const P_URG = ['retard', 'semaine', 'asap'];
/* Travaux pas encore placés cette semaine, pour les personnes affichées, à glisser dans une case */
/* Avant d'imprimer : ce qui manque dans la semaine, puis « semaine prête » */
function planCheckDialog() {
  const mon = S.pweek || planWeek(),
    days = Array.from({length: 5}, (_, i) => isoAdd(mon, i)),
    ppl = planPeople(),
    conge = planPeople.conge || [];
  const late = planSideTasks(days, ppl).filter(t => pKey(t, days[0], days[4]) === 'retard');
  const wk = planSideTasks(days, ppl).filter(t => pKey(t, days[0], days[4]) === 'semaine');
  const empty = ppl.filter(
    p => days.some(d => isDispo(presOf(p, d)?.code)) && !db.plan.some(x => x.who === p.id && x.date >= days[0] && x.date <= days[4])
  );
  const names = l =>
    l
      .slice(0, 12)
      .map(p => esc(p.nom))
      .join(', ') + (l.length > 12 ? ` et ${nbs(l.length - 12, 'autre', 'autres')}` : '');
  const titles = l =>
    l
      .slice(0, 5)
      .map(t => `<li>${mdot(tMet(t))}${esc(t.titre)}</li>`)
      .join('') + (l.length > 5 ? `<li class="muted">et ${nbs(l.length - 5, 'autre', 'autres')}</li>` : '');
  const row = (ok, tone, txt, more = '') =>
    `<div class="pc-row ${ok ? 'ok' : tone}"><span class="pc-i">${ok ? icon('check') : '!'}</span><div><b>${txt}</b>${more}</div></div>`;
  dialog({
    title: `Semaine ${isoWeek(mon)} : avant d’imprimer`,
    saveLabel: `${icon('printer')}Imprimer A3`,
    body: `<div class="pcheck">
      ${row(!late.length, 'bad', late.length ? `${late.length} travail${late.length > 1 ? 'x' : ''} en retard pas encore placé${late.length > 1 ? 's' : ''}` : 'Aucun travail en retard oublié', late.length ? `<ul>${titles(late)}</ul>` : '')}
      ${row(!wk.length, 'warn', wk.length ? `${wk.length} travail${wk.length > 1 ? 'x' : ''} prévu${wk.length > 1 ? 's' : ''} cette semaine, pas encore placé${wk.length > 1 ? 's' : ''}` : 'Les travaux de la semaine sont placés', wk.length ? `<ul>${titles(wk)}</ul>` : '')}
      ${row(!empty.length, 'warn', empty.length ? `${empty.length} personne${empty.length > 1 ? 's' : ''} disponible${empty.length > 1 ? 's' : ''} sans rien de prévu` : 'Tout le monde a quelque chose de prévu', empty.length ? `<p>${names(empty)}</p>` : '')}
      ${conge.length ? row(true, '', `Pas disponibles cette semaine : ${conge.length}`, `<p>${names(conge)}</p>`) : ''}</div>
      <p class="hint">Vous pouvez imprimer quand même. La semaine sera notée « prête ».</p>`,
    onSave() {
      tx(() => {
        db.reglages.planPret = {...(db.reglages.planPret || {}), [mon]: {at: new Date().toISOString(), by: meId() || ''}};
      });
      setTimeout(() => {
        render();
        ACT['plan-print']({f: 'a3', ok: '1'});
      }, 60);
    }
  });
}
function planSideTasks(days, ppl) {
  const end = days[days.length - 1],
    start = days[0],
    q = norm(S.q.planside || '');
  const whoKeys = ppl.map(p => 'p:' + p.id),
    planned = new Set(db.plan.filter(x => x.tacheId && x.date >= start && x.date <= end).map(x => x.tacheId));
  let ts = db.taches.filter(t => live(t) && t.actif !== false && !planned.has(t.id) && (!t.assign?.v || whoKeys.some(k => forWho(t, k))));
  if (q) ts = ts.filter(t => norm(`${t.titre} ${getKks(t.kksId)?.code || ''} ${assignLabel(t.assign)}`).includes(q));
  return ts;
}
const planSideCount = (days, ppl) => planSideTasks(days, ppl).filter(t => P_URG.includes(pKey(t, days[0], days[days.length - 1]))).length;
/* Panneau « À planifier » : pastilles par métier, puis En retard / Cette semaine / Dès que possible / Plus tard. Glisser dans une case, ou cliquer puis cliquer la case */
function planSideHTML(days, ppl) {
  const start = days[0],
    end = days[days.length - 1],
    met = S.pmet || '',
    all = planSideTasks(days, ppl),
    ts = met ? all.filter(t => tMet(t) === met) : all;
  const cnt = m => all.filter(t => (!m || tMet(t) === m) && P_URG.includes(pKey(t, start, end))).length;
  const chip = (k, lbl) =>
    `<button role="tab" class="ychip" data-act="plan-met" data-m="${k}" aria-selected="${met === k}">${mdot(k)}${lbl} <small>${cnt(k)}</small></button>`;
  const sec = {retard: [], semaine: [], asap: [], plus: [], arret: [], vieux: []};
  for (const t of ts) sec[pKey(t, start, end)].push(t);
  for (const k of ['retard', 'semaine', 'plus', 'arret', 'vieux'])
    sec[k].sort((a, b) => (a.prochaine || '').localeCompare(b.prochaine || '') || petitSort(a, b));
  sec.asap.sort(petitSort);
  const when = t => {
    if (!t.prochaine) return '';
    const n = daysTo(t.prochaine);
    return t.prochaine < start
      ? n < -365
        ? t.prochaine.slice(0, 4)
        : lateLbl(-n)
      : t.prochaine <= end
        ? DAYS[(new Date(t.prochaine + 'T12:00:00').getDay() + 6) % 7] + ' ' + +t.prochaine.slice(8)
        : fmtD(t.prochaine);
  };
  const card = (t, cls) => {
    const k = getKks(t.kksId);
    return `<div class="ps-t ${cls} ${S.ppick === t.id ? 'picked' : ''}" draggable="true" data-tid="${t.id}" data-act="plan-pick" data-id="${t.id}" tabindex="0" title="Glissez dans une case, ou cliquez puis cliquez la case"><span class="t">${mdot(tMet(t))}${esc(t.titre)}</span><small>${isPetit(t) && prioOf(t) === 'haute' ? '<span class="chip prio bad">Haute</span>' : ''}${k ? `<span class="kks">${esc(k.code)}</span>` : ''}<span class="who">${esc(assignLabel(t.assign))}</span>${isPetit(t) ? '' : `<span class="rep">${icon('repeat')}${esc(freqLabel(t.freq))}</span>`}<span class="when">${when(t)}</span></small></div>`;
  };
  const block = (key, title, cls, open = true) => {
    const l = sec[key];
    if (!l.length) return '';
    const shown = l.slice(0, 120);
    return `<details class="ps-g ${cls}" ${open ? 'open' : ''}><summary><span>${title}</span><b>${l.length}</b></summary>${shown.map(t => card(t, cls)).join('')}${l.length > shown.length ? `<p class="list-note">${nbs(l.length - shown.length, 'autre', 'autres')} : filtrez.</p>` : ''}</details>`;
  };
  const pk = S.ppick && get('taches', S.ppick);
  const body =
    block('retard', 'En retard', 'late') +
    block('semaine', 'Cette semaine', 'week') +
    block('asap', 'Dès que possible', 'week') +
    block('plus', 'Plus tard', 'later', false) +
    block('arret', 'Pour l’arrêt', 'later', false) +
    block('vieux', 'Anciens retards', 'old', false);
  return `<aside class="pside"><div class="ps-h"><div class="ps-top"><b>À planifier</b><button class="icon-btn" data-act="plan-side" aria-label="Fermer la liste" title="Fermer">×</button></div>
      <div class="ps-met" role="tablist" aria-label="Métier">${chip('', 'Tout')}${METIERS.map(m => chip(m[0], m[1])).join('')}</div>
      <input type="search" data-search="planside" data-pside="1" placeholder="Filtrer : mot, KKS, nom…" value="${esc(S.q.planside || '')}" aria-label="Filtrer les travaux à planifier"></div>
    ${pk ? `<div class="ps-pick">${icon('calendar')}<span>Cliquez la case où placer <b>${esc(pk.titre)}</b></span><button class="link" data-act="plan-pick" data-id="${pk.id}">Annuler</button></div>` : ''}
    <div class="ps-l">${ts.length ? body : `<p class="empty-line" style="padding:12px">Rien à planifier${met ? ' pour ce métier' : ''}.</p>`}</div>
    <p class="hint ps-f">Glissez un travail dans une case, ou cliquez-le puis cliquez la case. Les cases des personnes concernées s’éclairent.</p></aside>`;
}
function planSuggest(tid) {
  $$('.wkgrid .pc.sug').forEach(x => x.classList.remove('sug'));
  const t = tid && get('taches', tid);
  if (!t) return;
  $$('.wkgrid .pc[data-who]').forEach(c => {
    if (getPers(c.dataset.who) && forWho(t, 'p:' + c.dataset.who)) c.classList.add('sug');
  });
}
function placeTask(tid, who, date) {
  const t = get('taches', tid);
  if (!t) return;
  const p = getPers(who),
    pr = p ? presOf(p, date) : null,
    abs = pr && PCODE[pr.code]?.[1] === 'abs';
  S.ppick = null;
  tx(() => {
    db.plan.push({id: uid(), date, who, tacheId: t.id, text: ''});
  });
  render();
  const cell = $(`.wkgrid .pc[data-who="${CSS.escape(who)}"][data-date="${date}"]`);
  if (cell) {
    cell.classList.add('flash', 'm-' + (tMet(t) || 'none'));
    setTimeout(() => cell.classList.remove('flash'), 600);
  }
  toast(
    `${t.titre} → ${p ? persName(p) : PLAN_ROWS.find(r => r[0] === who)?.[1] || ''}, ${dayLbl(date)}${abs ? ` · attention : absent (${pr.code})` : ''}`,
    abs ? 'bad' : '',
    true
  );
}
document.addEventListener('dragstart', e => {
  const t = e.target.closest?.('[data-tid]');
  if (!t) return;
  e.dataTransfer.setData('text/plain', 'tid:' + t.dataset.tid);
  e.dataTransfer.effectAllowed = 'copy';
  t.classList.add('drag');
  document.body.classList.add('placing');
  planSuggest(t.dataset.tid);
});
document.addEventListener('dragend', e => {
  e.target.closest?.('[data-tid]')?.classList.remove('drag');
  $$('.pc.drop').forEach(x => x.classList.remove('drop'));
  if (!S.ppick) {
    document.body.classList.remove('placing');
    planSuggest(null);
  }
});
document.addEventListener('dragover', e => {
  const c = e.target.closest?.('.pc[data-who]');
  if (!c) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  if (!c.classList.contains('drop')) {
    $$('.pc.drop').forEach(x => x.classList.remove('drop'));
    c.classList.add('drop');
  }
});
document.addEventListener('dragleave', e => {
  const c = e.target.closest?.('.pc[data-who]');
  if (c && !c.contains(e.relatedTarget)) c.classList.remove('drop');
});
document.addEventListener('drop', e => {
  const c = e.target.closest?.('.pc[data-who]');
  if (!c) return;
  e.preventDefault();
  c.classList.remove('drop');
  const v = e.dataTransfer.getData('text/plain') || '';
  if (!v.startsWith('tid:')) return;
  document.body.classList.remove('placing');
  placeTask(v.slice(4), c.dataset.who, c.dataset.date);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && S.ppick && S.view === 'planning') {
    S.ppick = null;
    document.body.classList.remove('placing');
    render();
  }
});
/* Pièces sous le minimum (stock minimum renseigné), regroupées par fournisseur */
function orderRows() {
  return db.pieces
    .filter(p => live(p) && p.stockMin > 0 && dispo(p) < p.stockMin)
    .map(p => ({p, four: p.fournisseur || p.fabricant || 'Sans fournisseur', qty: round(p.stockMin - dispo(p))}))
    .sort((a, b) => coll.compare(a.four, b.four) || coll.compare(a.p.designation, b.p.designation));
}
function orderHTML(rows, print) {
  const g = new Map();
  for (const r of rows) {
    if (!g.has(r.four)) g.set(r.four, []);
    g.get(r.four).push(r);
  }
  return [...g]
    .map(
      ([f, list]) =>
        `<${print ? 'tbody' : 'div class="ord-g"'}>${print ? `<tr><th colspan="5" class="g">${esc(f)}</th></tr>` : `<div class="ord-h">${icon('truck')}${esc(f)} <span class="muted">${list.length}</span></div>`}${list.map(({p, qty}) => (print ? `<tr><td class="mono">${esc(p.ref)}</td><td>${esc(p.designation)}${p.refFab ? `<br><small>réf. ${esc(p.refFab)}</small>` : ''}</td><td class="n">${num(dispo(p))}</td><td class="n">${num(p.stockMin)}</td><td class="n"><b>${num(qty)}</b> ${esc(p.unite)}</td></tr>` : `<button class="four-p" data-goto-p="${p.id}"><span class="pid">${esc(p.ref)}</span><span class="t">${esc(p.designation)}</span><span class="muted">${num(dispo(p))} / min ${num(p.stockMin)}</span><span class="q">+${num(qty)} <small>${esc(p.unite)}</small></span></button>`)).join('')}</${print ? 'tbody' : 'div'}>`
    )
    .join('');
}
function orderDialog() {
  const rows = orderRows();
  dialog({
    title: 'Liste à commander',
    wide: true,
    saveLabel: 'Imprimer',
    body: rows.length
      ? `<p class="hint">${nbs(rows.length, 'pièce', 'pièces')} sous leur stock minimum, regroupées par fournisseur. La quantité proposée ramène le stock au minimum.</p>${orderHTML(rows, false)}<div class="tools"><button type="button" class="btn small" data-ord-xl>${icon('excel')}Exporter (Excel)</button></div>`
      : '<p>Aucune pièce sous son stock minimum.</p>',
    onOpen(f, d) {
      d.addEventListener('click', e => {
        const b = e.target.closest('[data-goto-p]');
        if (b) {
          d.close();
          go('pieces', b.dataset.gotoP);
        }
        if (e.target.closest('[data-ord-xl]'))
          downloadXlsx(xlName('a-commander'), 'À commander', [
            ['Fournisseur', 'ID', 'Désignation', 'Réf. fabricant', 'En stock', 'Minimum', 'À commander', 'Unité'],
            ...rows.map(r => [
              r.four,
              /^\d+$/.test(r.p.ref) ? +r.p.ref : r.p.ref,
              r.p.designation,
              r.p.refFab || '',
              dispo(r.p),
              r.p.stockMin,
              r.qty,
              r.p.unite || ''
            ])
          ]);
      });
    },
    onSave() {
      if (!rows.length) return;
      doPrint(
        `<article class="rpt"><header class="rpt-head"><div><div class="rpt-org">Tridel · Maintenance</div><h1>Pièces à commander</h1></div><div class="rpt-num"><div>${fmtD(todayISO())}</div></div></header><table class="rpt-tbl"><thead><tr><th>ID</th><th>Désignation</th><th class="n">Stock</th><th class="n">Min.</th><th class="n">À commander</th></tr></thead>${orderHTML(rows, true)}</table><footer class="rpt-foot">TriFlow</footer></article>`
      );
    }
  });
}
/* Saisie directe dans la case (grand écran) : on tape, Entrée valide, Tab passe au jour suivant */
const PLAN_TYPE = () => matchMedia('(min-width: 761px)').matches;
function planInline(pc, who, date, item, pit) {
  const prev = $('.pinl');
  if (prev) {
    const ch = prev._commit ? prev._commit() : (prev.remove(), false);
    if (ch) {
      render();
      pc = $(`.wkgrid .pc[data-who="${CSS.escape(who)}"][data-date="${date}"]`);
      pit = item && pc ? pc.querySelector(`.pit[data-id="${item.id}"]`) : null;
    }
  }
  if (!pc) return;
  const p = getPers(who),
    pr = p ? presOf(p, date) : null,
    pc2 = pr && pr.code ? PCODE[pr.code] : null,
    abs = pc2 && pc2[1] === 'abs';
  const box = document.createElement('div');
  box.className = 'pinl';
  box.innerHTML = `${abs ? `<span class="pinl-w">${icon('out')}Absent : ${esc(pc2[0])}</span>` : ''}<textarea rows="2" placeholder="Travail à faire…" aria-label="Travail à faire">${esc(item?.text || '')}</textarea><button type="button" class="pinl-more" data-more title="Lier une tâche, plusieurs jours, plusieurs personnes" aria-label="Plus d’options">⋯</button>`;
  if (pit) {
    pit.classList.add('editing');
    pit.after(box);
  } else pc.append(box);
  const ta = box.querySelector('textarea'),
    fit = () => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    };
  ta.addEventListener('input', fit);
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  requestAnimationFrame(fit);
  /* Enregistrement au fur et à mesure : chaque pause de frappe enregistre le texte (rien ne se perd si on ferme la page) */
  const orig = item ? item.text || '' : '';
  let done = false,
    curId = item ? item.id : null,
    dirty = false,
    timer = null;
  const persist = text => {
    const cur = curId && db.plan.find(x => x.id === curId);
    if (cur) {
      if (!text || text === (cur.text || '')) return;
      tx(() => {
        cur.text = text;
      });
      dirty = true;
      return;
    }
    if (!text) return;
    const id = uid();
    tx(() => {
      db.plan.push({id, date, who, text});
    });
    curId = id;
    dirty = true;
  };
  ta.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!done)
        try {
          persist(ta.value.trim());
        } catch (e) {}
    }, 600);
  });
  const save = () => {
    if (done) return false;
    done = true;
    clearTimeout(timer);
    const text = ta.value.trim(),
      cur = curId && db.plan.find(x => x.id === curId);
    if (cur && !text) {
      tx(() => {
        db.plan = db.plan.filter(x => x.id !== curId);
      });
      toast('Retiré du planning', '', true);
      return true;
    }
    persist(text);
    return dirty;
  };
  box._flush = () => {
    clearTimeout(timer);
    if (!done)
      try {
        persist(ta.value.trim());
      } catch (e) {}
  };
  box._commit = () => {
    const ch = save();
    box.remove();
    pit?.classList.remove('editing');
    return ch;
  };
  const next = n => {
    const nd = S.pwe ? 7 : 5,
      mon = S.pweek,
      i = Math.round((new Date(date + 'T12:00:00') - new Date(mon + 'T12:00:00')) / 864e5) + n;
    if (i < 0 || i >= nd) return;
    const c = $(`.wkgrid .pc[data-who="${CSS.escape(who)}"][data-date="${isoAdd(mon, i)}"]`);
    if (c) planInline(c, who, isoAdd(mon, i), null);
  };
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      save();
      render();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      done = true;
      clearTimeout(timer);
      if (dirty)
        tx(() => {
          if (item) {
            const c = db.plan.find(x => x.id === curId);
            if (c) c.text = orig;
          } else db.plan = db.plan.filter(x => x.id !== curId);
        });
      render();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const ch = save();
      if (ch) render();
      else {
        box.remove();
        pit?.classList.remove('editing');
      }
      next(e.shiftKey ? -1 : 1);
    }
  });
  ta.addEventListener('blur', () =>
    setTimeout(() => {
      if (done || !box.isConnected) return;
      if (box.contains(document.activeElement)) return;
      const ch = save();
      if (ch) render();
      else {
        box.remove();
        pit?.classList.remove('editing');
      }
    }, 120)
  );
  const more = box.querySelector('[data-more]');
  more.addEventListener('mousedown', e => e.preventDefault());
  more.addEventListener('click', () => {
    done = true;
    const t = ta.value.trim();
    box.remove();
    pit?.classList.remove('editing');
    planDialog(who, date, item, t);
  });
}
window.addEventListener('pagehide', () => {
  const b = document.querySelector('.pinl');
  if (b && b._flush) {
    b._flush();
    try {
      CLOUD.push();
    } catch (e) {}
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    const b = document.querySelector('.pinl');
    if (b && b._flush) b._flush();
  }
});
/* Texte libre d'une case (un seul par case ; s'il y en a plusieurs, ils sont fusionnés) */
function planTextItem(who, date) {
  const l = db.plan.filter(x => x.who === who && x.date === date && !x.tacheId);
  if (!l.length) return null;
  if (l.length > 1) {
    tx(() => {
      l[0].text = l
        .map(x => x.text)
        .filter(Boolean)
        .join('\n');
      const rm = new Set(l.slice(1).map(x => x.id));
      db.plan = db.plan.filter(x => !rm.has(x.id));
    });
    render();
  }
  return db.plan.find(x => x.id === l[0].id);
}
/* Création d'un compte TriFlow (cadres) : passe par la fonction Supabase « creer-utilisateur » (outils/supabase-fonction) */
function genPass() {
  const c = 'bcdfghjkmnprstvz',
    v = 'aeiou',
    r = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  let w = '';
  for (let i = 0; i < 4; i++) w += c[r(c.length)] + v[r(v.length)];
  return w[0].toUpperCase() + w.slice(1) + '-' + String(r(90) + 10) + String(r(90) + 10);
}
function accessDialog() {
  const dom = (CLOUD.user?.email || '').split('@')[1] || 'tridelsa.ch',
    ppl = db.personnes.filter(p => live(p) && p.actif !== false).sort(persSort);
  const taken = new Set(Object.keys(db.reglages.moi || {}));
  dialog({
    title: 'Créer un accès à TriFlow',
    saveLabel: 'Créer le compte',
    body: `<p class="hint">Le compte est créé directement, sans e-mail de confirmation. Transmettez ensuite l’adresse et le mot de passe au collègue.</p>
      <label>Pour qui ? <span class="muted">(facultatif : propose l’adresse)</span><select name="p"><option value="">—</option>${ppl.map(p => `<option value="${p.id}">${esc(persName(p))}${p.groupe ? ' · ' + esc(p.groupe) : ''}</option>`).join('')}</select></label>
      <label>Adresse e-mail<input type="email" name="email" placeholder="prenom.nom@${esc(dom)}" autocomplete="off" required></label>
      <label>Mot de passe<span class="pw-row"><input name="pw" value="${genPass()}" autocomplete="off" spellcheck="false"><button type="button" class="btn small" data-regen>Autre</button></span></label>
      <p class="hint">Pour que TriFlow reconnaisse la personne, son nom de famille doit figurer dans l’adresse (prenom.<b>nom</b>@…).</p>`,
    onOpen(f, d) {
      f.elements.p.onchange = () => {
        const p = getPers(f.elements.p.value);
        if (p) f.elements.email.value = `${p.prenom ? letters(p.prenom) + '.' : ''}${letters(p.nom)}@${dom}`;
      };
      $('[data-regen]', d).onclick = () => {
        f.elements.pw.value = genPass();
      };
    },
    async onSave(f) {
      const email = val(f, 'email').toLowerCase(),
        password = val(f, 'pw');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Adresse e-mail invalide.');
      if (password.length < 10) throw new Error('Mot de passe trop court (10 caractères minimum).');
      const {data, error} = await CLOUD.sb.functions.invoke('creer-utilisateur', {body: {email, password}});
      if (error) {
        let m = '';
        try {
          m = (await error.context?.json())?.erreur || '';
        } catch (e) {}
        throw new Error(
          m ||
            (/not found|404|Failed to send/i.test(error.message || '')
              ? 'La fonction « creer-utilisateur » n’est pas encore installée dans Supabase (voir le README, §2).'
              : error.message)
        );
      }
      if (data && data.erreur) throw new Error(data.erreur);
      const site = location.origin + location.pathname,
        msg = `Ton accès à TriFlow :\n${site}\nAdresse : ${email}\nMot de passe : ${password}`;
      setTimeout(
        () =>
          dialog({
            title: 'Compte créé',
            saveLabel: 'Fermer',
            info: true,
            body: `<p>Transmettez ces informations au collègue :</p><pre class="acc-msg">${esc(msg)}</pre><button type="button" class="btn small" data-copy>Copier le message</button>`,
            onOpen(ff, dd) {
              $('[data-copy]', dd).onclick = async () => {
                try {
                  await navigator.clipboard.writeText(msg);
                  toast('Message copié');
                } catch (e) {
                  toast('Copie impossible : sélectionnez le texte.', 'bad');
                }
              };
            },
            onSave() {}
          }),
        50
      );
    }
  });
}
/* Recherche des pièces par emplacement : on descend Local › allée › étagère… et on voit combien de pièces il y a à chaque niveau */
function locIndex() {
  if (locIndex.c && locIndex.c.rev === REV && locIndex.c.db === db) return locIndex.c;
  const live2 = db.lieux.filter(liveLieu),
    codes = new Map(live2.map(l => [l.id, lieuCode(l)]));
  const per = new Map();
  for (const p of db.pieces)
    if (live(p))
      for (const x of p.stock) {
        const c = codes.get(x.lieuId);
        if (!c) continue;
        if (!per.has(c)) per.set(c, new Set());
        per.get(c).add(p.id);
      }
  const allCodes = [...new Set(codes.values())];
  const under = pre => {
    const set = new Set();
    for (const [c, ids] of per) if (!pre || c === pre || c.startsWith(pre + ' / ')) ids.forEach(i => set.add(i));
    return set.size;
  };
  const salleName = code => {
    const sa = db.salles.find(x => salleCode(x) === code);
    return sa && sa.nom && sa.nom !== code ? sa.nom : '';
  };
  const kids = pre => {
    const m = new Map();
    for (const c of allCodes) {
      if (pre && !(c === pre || c.startsWith(pre + ' / '))) continue;
      const rest = pre ? c.slice(pre.length + 3) : c;
      if (!rest) continue;
      const seg = rest.split(' / ')[0];
      const k = pre ? pre + ' / ' + seg : seg;
      if (!m.has(k)) m.set(k, seg);
    }
    return [...m].sort((a, b) => coll.compare(a[1], b[1]));
  };
  return (locIndex.c = {rev: REV, db, under, kids, salleName});
}
const locTile = (k, seg, c, leaf, name) =>
  `<button type="button" class="loc-i ${c ? '' : 'empty'}" title="${esc(k + (name ? ' · ' + name : ''))}" data-go="${esc(k)}" data-leaf="${leaf ? 1 : ''}"><span class="plate">${esc(seg)}</span><span class="t">${esc(name || '')}</span><span class="cnt">${c ? num(c) + ' pièce' + (c > 1 ? 's' : '') : 'vide'}</span>${leaf ? '' : icon('chev')}</button>`;
/* Clic dans la recherche des pièces (vide) : les locaux sont proposés tout de suite */
function locPop(show) {
  const inp = $('#q-pieces');
  let pop = $('#locpop');
  if (!show || !inp || inp.value.trim()) {
    if (pop) pop.remove();
    return;
  }
  const {under, kids, salleName} = locIndex(),
    top = kids('');
  const host = inp.closest('.page-head') || inp.parentElement;
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'locpop';
    pop.className = 'locpop';
    host.style.position = 'relative';
    host.append(pop);
  }
  const r = inp.getBoundingClientRect(),
    pr = host.getBoundingClientRect();
  pop.style.left = r.left - pr.left + 'px';
  pop.style.top = r.bottom - pr.top + 6 + 'px';
  pop.innerHTML = `<div class="locpop-h">${icon('shelf')}<b>Chercher par emplacement</b><small>ou tapez un nom, un ID, une référence…</small></div><div class="locpop-g">${top.map(([k, seg]) => locTile(k, seg, under(k), !kids(k).length, salleName(seg))).join('')}</div>`;
}
document.addEventListener('focusin', e => {
  if (e.target.id === 'q-pieces') locPop(true);
});
document.addEventListener('input', e => {
  if (e.target.id === 'q-pieces') locPop(true);
});
document.addEventListener('mousedown', e => {
  if ($('#locpop') && !e.target.closest('#locpop') && e.target.id !== 'q-pieces') locPop(false);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#locpop')) locPop(false);
});
document.addEventListener('click', e => {
  const b = e.target.closest('#locpop [data-go]');
  if (!b) return;
  e.preventDefault();
  const k = b.dataset.go;
  locPop(false);
  if (b.dataset.leaf) {
    S.ploc = k;
    S.lowOnly = S.zeroOnly = false;
    S.plimit = 200;
    S.sel.pieces = null;
    go('pieces');
  } else locDialog(k);
});
function locDialog(start) {
  const {under, kids, salleName} = locIndex();
  let cur = start;
  dialog({
    title: 'Pièces par emplacement',
    saveLabel: 'Voir les pièces',
    wide: true,
    body: `<input type="search" data-lq placeholder="Filtrer : E1.14, palette, ratelier…" aria-label="Filtrer les emplacements" autocomplete="off"><nav class="crumbs loc-crumbs" data-lcr></nav><div class="loc-list" data-ll></div>`,
    onOpen(f, d) {
      const ll = $('[data-ll]', d),
        cr = $('[data-lcr]', d),
        q = $('[data-lq]', d),
        btn = $('button[type=submit]', d);
      const draw = () => {
        const segs = cur ? cur.split(' / ') : [];
        cr.innerHTML =
          `<button type="button" class="link" data-go="">Tous les locaux</button>` +
          segs
            .map(
              (sg, i) =>
                ` <span class="muted">›</span> ${i === segs.length - 1 ? `<strong>${esc(sg)}</strong>` : `<button type="button" class="link" data-go="${esc(segs.slice(0, i + 1).join(' / '))}">${esc(sg)}</button>`}`
            )
            .join('');
        const n = norm(q.value || '');
        let ks = kids(cur);
        if (n) ks = ks.filter(([k, seg]) => norm(k + ' ' + (cur ? '' : salleName(seg))).includes(n));
        ll.innerHTML = ks.length
          ? ks.map(([k, seg]) => locTile(k, seg, under(k), !kids(k).length, cur ? '' : salleName(seg))).join('')
          : '<p class="empty-line">Aucun emplacement plus détaillé.</p>';
        const total = under(cur);
        btn.textContent = cur ? `Voir les ${num(total)} pièce${total > 1 ? 's' : ''} de ${cur}` : 'Choisissez un local';
        btn.disabled = !cur;
      };
      d.addEventListener('click', e => {
        const b = e.target.closest('[data-go]');
        if (!b) return;
        cur = b.dataset.go;
        q.value = '';
        if (b.dataset.leaf) {
          S.ploc = cur;
          S.lowOnly = S.zeroOnly = false;
          S.plimit = 200;
          S.sel.pieces = null;
          d.close();
          go('pieces');
          return;
        }
        draw();
      });
      q.addEventListener('input', draw);
      draw();
      setTimeout(() => q.focus(), 50);
    },
    onSave() {
      if (!cur) return false;
      S.ploc = cur;
      S.lowOnly = S.zeroOnly = false;
      S.plimit = 200;
      S.sel.pieces = null;
      go('pieces');
    }
  });
}
function planDialog(who, date, item, pre = '') {
  const isNew = !item,
    p = getPers(who),
    row = PLAN_ROWS.find(r => r[0] === who),
    mon = mondayOf(date);
  const t0 = item?.tacheId ? get('taches', item.tacheId) : null,
    pr = p ? presOf(p, date) : null,
    pc = pr && pr.code ? PCODE[pr.code] : null;
  const days = Array.from({length: S.pwe ? 7 : 5}, (_, i) => isoAdd(mon, i));
  const mates = p ? db.personnes.filter(x => live(x) && x.actif !== false && x.groupe === p.groupe && x.id !== p.id).sort(persSort) : [];
  const titre = `${p ? esc(persName(p)) : esc(row ? row[1] : '')} · ${dayLbl(date)}`;
  dialog({
    title: isNew ? `Planifier · ${titre}` : titre,
    saveLabel: isNew ? 'Ajouter' : 'Enregistrer',
    body: `${pc && pc[1] === 'abs' ? `<p class="dlg-warn">${icon('out')}${esc(persName(p))} est absent ce jour-là : ${esc(pc[0])}${pr.note ? ' · ' + esc(pr.note) : ''}.</p>` : pc ? `<p class="hint">Au planning : <b>${esc(pr.code)}</b> · ${esc(pc[0])}${pr.note ? ' · ' + esc(pr.note) : ''}</p>` : ''}
      ${row && who !== 'row:autres' ? '' : `<label>Travail de TriFlow <span class="muted">(facultatif)</span><input name="tache" data-id="${t0 ? t0.id : ''}" data-label="${t0 ? esc(t0.titre) : ''}" value="${t0 ? esc(t0.titre) : ''}" placeholder="Choisir une tâche : tapez un mot ou un KKS…"></label>`}
      <label>${row && who !== 'row:autres' ? (who === 'row:ext' ? 'Entreprise et travail' : 'Réservation') : 'Travail à faire / remarque'}<textarea name="text" rows="3" ${who === 'row:ext' ? 'list="dl-marques"' : ''} placeholder="${who === 'row:ext' ? 'ex. Caliqua : révision vanne 1LAB40AA410' : who === 'row:nacelle' ? 'ex. Nacelle 20 m · halle chaudière · 8h–12h' : 'ex. Aider Lima au remplacement des toiles'}">${esc(item?.text || pre)}</textarea></label>
      ${
        isNew
          ? `<fieldset><legend>Jours</legend><div class="pdchk">${days.map((d, i) => `<label class="chk"><input type="checkbox" name="d" value="${d}" ${d === date ? 'checked' : ''}> ${DAYS[i]} ${+d.slice(8)}</label>`).join('')}</div></fieldset>
      ${
        mates.length
          ? `<fieldset><legend>Aussi pour</legend><div class="pdchk">${mates
              .map(x => {
                const q = presOf(x, date),
                  a = q && PCODE[q.code]?.[1] === 'abs';
                return `<label class="chk ${a ? 'abs' : ''}"><input type="checkbox" name="m" value="${x.id}"> ${esc(persName(x))}${a ? ` <small>(${esc(q.code)})</small>` : ''}</label>`;
              })
              .join('')}</div></fieldset>`
          : ''
      }`
          : ''
      }
      ${!isNew ? `<div class="tools">${t0 ? `<button type="button" class="btn small" data-go-task="${t0.id}">${icon('repeat')}Ouvrir la tâche</button>` : ''}<button type="button" class="btn small primary" data-plan-done="${item.id}">${icon('check')}${t0 ? 'C’est fait' : 'C’est fait : faire le rapport'}</button></div>` : ''}`,
    del: isNew
      ? null
      : {
          label: 'Retirer du planning',
          soft: true,
          run() {
            tx(() => {
              db.plan = db.plan.filter(x => x !== item);
            });
            render();
            toast('Retiré du planning', '', true);
          }
        },
    onOpen(f, d) {
      if (f.elements.tache) {
        const wantG = p ? 'p:' + p.id : '';
        combo(f.elements.tache, {
          items: () =>
            db.taches
              .filter(t => live(t) && t.actif !== false)
              .sort((a, b) => (wantG ? forWho(b, wantG) - forWho(a, wantG) : 0) || a.prochaine.localeCompare(b.prochaine))
              .map(t => {
                const k = getKks(t.kksId);
                return {
                  id: t.id,
                  label: t.titre,
                  search: `${t.titre} ${k ? k.code + ' ' + k.designation : ''} ${assignLabel(t.assign)}`,
                  html: `${esc(t.titre)}${k ? ` <span class="kks">${esc(k.code)}</span>` : ''}`,
                  right: `<span class="muted">${esc(assignLabel(t.assign))} · ${fmtD(t.prochaine)}</span>`
                };
              })
        });
      }
      const gb = $('[data-go-task]', d);
      if (gb)
        gb.onclick = () => {
          d.close();
          go('taches', gb.dataset.goTask);
        };
      const db2 = $('[data-plan-done]', d);
      if (db2)
        db2.onclick = () => {
          d.close();
          ACT['plan-done']({id: db2.dataset.planDone});
        };
    },
    onSave(f) {
      const ti = f.elements.tache;
      let tid = '';
      if (ti && ti.value.trim()) {
        tid = ti.dataset.id || '';
        if (!get('taches', tid)) throw new Error('Choisissez la tâche dans la liste, ou videz le champ.');
      }
      const text = val(f, 'text');
      if (!tid && !text) throw new Error('Choisissez une tâche ou écrivez le travail à faire.');
      if (!isNew) {
        tx(() => {
          item.text = text;
          if (tid) item.tacheId = tid;
          else delete item.tacheId;
        });
        render();
        toast('Planning enregistré', '', true);
        return;
      }
      const ds = [...f.querySelectorAll('input[name=d]:checked')].map(x => x.value),
        ws = [who, ...[...f.querySelectorAll('input[name=m]:checked')].map(x => x.value)];
      if (!ds.length) throw new Error('Cochez au moins un jour.');
      tx(() => {
        for (const w of ws) for (const dd of ds) db.plan.push({id: uid(), date: dd, who: w, ...(tid ? {tacheId: tid} : {}), text});
      });
      render();
      toast(`${nbs(ws.length * ds.length, 'case remplie', 'cases remplies')}`, '', true);
    }
  });
}
/* Feuille imprimée : reprend la mise en page et les couleurs du modèle Excel « Planification de la maintenance » */
const XLS_GRP = [
  ['equipe', '#FCD5B5'],
  ['elect', '#FFC000'],
  ['autom', '#558ED5'],
  ['meca', '#FFFF00'],
  ['intend', '#B7DEE8'],
  ['chauff', '#CCC1DA'],
  ['admin', '#4BACC6'],
  ['cadre', '#D99694']
];
const xlsGrp = g => {
  const n = norm(g || '');
  return (XLS_GRP.find(([k]) => n.startsWith(k)) || [null, '#FFFFFF'])[1];
};
const XLS_CODE = {
  R: ['#92D050', '#000'],
  VA: ['#FF0000', '#000'],
  RA: ['#0070C0', '#fff'],
  RN: ['#FFC000', '#000'],
  RM: ['#D99694', '#000'],
  GR: ['#00B0F0', '#000'],
  C1: ['#F79646', '#000'],
  C2: ['#B3A2C7', '#000']
};
const xlsCode = c => (!c ? ['#808080', '#808080'] : /FE/i.test(c) ? ['#7030A0', '#fff'] : XLS_CODE[c] || ['#fff', '#000']);
function planSheetHTML() {
  const mon = S.pweek,
    nd = S.pwe ? 7 : 5,
    days = Array.from({length: nd}, (_, i) => isoAdd(mon, i)),
    ppl = planPeople();
  const items = (w, d) =>
    db.plan
      .filter(x => x.who === w && x.date === d)
      .map(x => {
        const t = x.tacheId ? get('taches', x.tacheId) : null,
          k = t ? getKks(t.kksId) : null;
        return `<div class="xi">${esc(t ? t.titre : x.text)}${k ? ` <span class="xk">${esc(k.code)}</span>` : ''}${t && x.text ? ` – ${esc(x.text)}` : ''}</div>`;
      })
      .join('');
  const cell = (w, d, p) => {
    const pr = p ? presOf(p, d) : null,
      code = pr ? pr.code || '' : '',
      its = items(w, d);
    if (!p) return `<td class="xc xw">${its}</td>`;
    const [bg, fg] = xlsCode(code);
    return its ? `<td class="xc xw">${its}</td>` : `<td class="xc xcode" style="background:${bg};color:${fg}">${esc(code)}</td>`;
  };
  let body = '',
    lg,
    lastEq = null;
  for (const p of ppl) {
    const g = p.groupe || '',
      eq = g === 'Équipe' ? EQUIPE_NO[String(p.nom).toUpperCase()] || '' : '';
    if (g === 'Équipe' && eq && lastEq !== null && eq !== lastEq) body += `<tr class="xsep"><td colspan="${nd + 1}"></td></tr>`;
    const first = g !== lg;
    lg = g;
    lastEq = eq || lastEq;
    body += `<tr class="${first ? 'xg' : ''}"><th class="xn" style="background:${xlsGrp(g)}">${esc(persName(p))}</th>${days.map(d => cell(p.id, d, p)).join('')}</tr>`;
  }
  body += PLAN_ROWS.map(
    ([w, t], i) => `<tr class="xo ${i ? '' : 'xg'}"><th class="xn">${t}</th>${days.map(d => cell(w, d, null)).join('')}</tr>`
  ).join('');
  const d0 = days[0],
    d1 = days[nd - 1];
  return `<article class="plan-sheet xls"><h1 class="xt">Planification des tâches pour le personnel en maintenance et les chauffeurs de réserve</h1>
    <table class="xtbl"><colgroup><col class="xcn">${days.map(() => '<col>').join('')}</colgroup>
      <thead><tr><th class="xs">Semaine ${isoWeek(mon)}</th>${days.map((d, i) => `<th class="xd">${DAYN[i]}</th>`).join('')}</tr>
      <tr><th class="xs2"></th>${days.map(d => `<th class="xd2">${d.slice(8)} ${MOIS[+d.slice(5, 7) - 1]}</th>`).join('')}</tr></thead>
      <tbody>${body}</tbody></table>
    <p class="xf">Imprimé le ${fmtDT(new Date().toISOString())} · TriFlow</p></article>`;
}

const OPT_SECS = [
  ['historique', 'Historique', 'list'],
  ['roles', 'Rôles', 'person'],
  ['lieux', 'Emplacements', 'shelf'],
  ['personnes', 'Personnes', 'person'],
  ['fournisseurs', 'Fournisseurs', 'truck'],
  ['listes', 'Listes', 'list'],
  ['etiquettes', 'Étiquettes & QR', 'qr'],
  ['donnees', 'Sauvegarde', 'save'],
  ['connexion', 'Connexion', 'person']
];
const OPT = {};
if (typeof S !== 'undefined' && S.opt === 'kks') S.opt = 'historique';
OPT.lieux = () => {
  const salles = db.salles.filter(live).sort((a, b) => !!a.statut - !!b.statut || coll.compare(salleCode(a), salleCode(b))),
    sArch = db.salles.filter(x => x.arch);
  const add = menu(
    [
      ['new-lieu', 'Un emplacement', 'shelf'],
      ['new-salle', 'Un local', 'plus'],
      ['gen-series', 'Une série (ex. A / 1 à 20)', 'list'],
      '-',
      ['import-lieux', 'Coller une liste', 'save']
    ],
    'Ajouter',
    'plus',
    'primary'
  );
  const room = (s, i) => {
    const ls = db.lieux.filter(l => l.salleId === s.id && live(l)).sort(lieuSort);
    return `${s.statut && !salles[i - 1]?.statut ? `<div class="stat-head" style="margin:0">${icon('out')}<div><strong>Hors magasin</strong><span>En prêt, en révision, en attente… : suivi, mais pas compté dans le stock.</span></div></div>` : ''}<details class="oroom"><summary><span class="chev">${icon('chev')}</span>${s.statut ? `<span class="stat">${icon('out')}${esc(salleCode(s))}</span>` : `<span class="plate">${esc(salleCode(s))}</span>`}${s.nom && s.nom !== salleCode(s) ? `<span class="rname">${esc(s.nom)}</span>` : ''}<span class="cnt">${ls.length}</span></summary>
      <div class="otree">${ls.length ? lieuTree(ls, 'edit-lieu', null) : '<span class="muted">Aucun emplacement.</span>'}
        <div class="rtools"><button class="btn small" data-act="new-lieu" data-salle="${s.id}">${icon('plus')}Emplacement</button><button class="btn small" data-act="edit-salle" data-id="${s.id}">${icon('edit')}Modifier le local</button><button class="link del-salle" data-act="arch" data-col="salles" data-id="${s.id}">Archiver</button></div></div></details>`;
  };
  return `<section class="opt-sec"><div class="head"><h2>Emplacements</h2><div class="tools">${add}</div></div>
    <div class="pad"><p class="hint">Ouvrez un local pour voir ses emplacements. Cliquez sur un emplacement pour le modifier.</p></div>
    ${salles.length ? salles.map(room).join('') : `<div class="pad">${empty('Aucun local', '<p>Utilisez « Ajouter ».</p>')}</div>`}
    ${sArch.length ? `<details class="arch-sec"><summary>${icon('archive')}Locaux archivés <span class="muted">${sArch.length}</span></summary>${sArch.map(x => `<div class="arch-line"><span class="plate">${esc(salleCode(x))}</span><span class="t">${esc(x.nom && x.nom !== salleCode(x) ? x.nom : '')} <span class="muted">· archivé le ${fmtD(x.arch)}</span></span><button class="btn small" data-act="unarch" data-col="salles" data-id="${x.id}">Restaurer</button><button class="link danger" data-act="del-salle" data-id="${x.id}">Supprimer</button></div>`).join('')}</details>` : ''}</section>`;
};
OPT.kks = () => {
  const q = norm(S.q.optkks);
  const rows = db.kks.filter(k => live(k) && (!q || norm(`${k.code} ${k.designation} ${k.aic || ''}`).includes(q))).sort(kksSort);
  return `<section class="opt-sec"><div class="head"><h2>Équipements (KKS)</h2><div class="tools">${menu(
    [
      ['new-kks', 'Un équipement', 'plus'],
      ['import-kks', 'Coller une liste', 'list']
    ],
    'Ajouter',
    'plus',
    'primary'
  )}</div></div>
    <div class="pad"><p class="hint">Le système (H › HA › HAC…) est lu directement dans le code KKS. Le code AIC est facultatif.</p>
    <input type="search" data-search="optkks" data-opt="1" placeholder="Filtrer la liste…" value="${esc(S.q.optkks)}" aria-label="Filtrer les repères" style="max-width:320px"></div>
    <div id="opt-list">${optKksTable(rows)}</div></section>`;
};
function optKksTable(rows) {
  if (!db.kks.length) return `<div class="pad">${empty('Liste vide', '<p>Ajoutez un repère ou collez la liste de l’usine.</p>')}</div>`;
  return `<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Code</th><th>Désignation</th><th>AIC</th></tr></thead><tbody>${rows
    .slice(0, 300)
    .map(
      k =>
        `<tr data-act="edit-kks" data-id="${k.id}" tabindex="0"><td><span class="kks">${esc(k.code)}</span></td><td>${esc(k.designation)}</td><td>${k.aic ? `<span class="aic">${esc(k.aic)}</span>` : ''}</td></tr>`
    )
    .join(
      ''
    )}</tbody></table></div>${rows.length > 300 ? `<p class="list-note" style="padding:10px 18px">${rows.length} équipements : filtrez pour affiner.</p>` : ''}`;
}
OPT.personnes = () => {
  const g = S.optGrp || '';
  const rows = db.personnes.filter(p => live(p) && (!g || p.groupe === g)).sort((a, b) => b.actif - a.actif || persSort(a, b)),
    pArch = db.personnes.filter(p => p.arch).sort(persSort);
  const groups = db.listes.groupes.filter(x => db.personnes.some(p => p.groupe === x));
  return `<section class="opt-sec"><div class="head"><h2>Personnes <span class="muted" style="font-family:var(--f-mono);font-size:.9rem">${db.personnes.length}</span></h2><div class="tools">${CLOUD.on && canDel() ? `<button class="btn" data-act="new-access" title="Créer un compte de connexion à TriFlow">${icon('person')}Créer un accès</button>` : ''}<button class="btn primary" data-act="new-pers">${icon('plus')}Personne</button></div></div>
    <div class="pad"><p class="hint">Le personnel et les groupes sont repris automatiquement du Planning Tridel. Une personne qui n’y figure plus n’est plus proposée dans les nouveaux rapports, mais reste dans les anciens.</p>
    ${groups.length ? `<div><select class="mini" data-change="optGrp" aria-label="Filtrer par groupe"><option value="">Tous les groupes</option>${groups.map(x => opt(x, x, g)).join('')}</select></div>` : ''}</div>
    ${
      rows.length
        ? `<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Nom</th><th>Groupe</th><th class="num hide-sm">Rapports</th></tr></thead><tbody>${rows
            .map(
              p =>
                `<tr data-act="edit-pers" data-id="${p.id}" tabindex="0"><td><strong style="font-weight:500">${esc(p.nom)}</strong> ${esc(p.prenom || '')}${respOf(
                  p.id
                )
                  .map(g => ` <span class="chip info">Resp. ${esc(g)}</span>`)
                  .join(
                    ''
                  )}${p.actif ? '' : ' <span class="chip off">Plus au planning</span>'}</td><td>${grpChip(p.groupe) || '<span class="muted">—</span>'}</td><td class="num qty hide-sm">${db.interventions.filter(i => i.intervenants.includes(p.id)).length || ''}</td></tr>`
            )
            .join('')}</tbody></table></div>`
        : `<div class="pad">${empty('Aucune personne', '<p>Utilisez « Reprendre du Planning Tridel ».</p>')}</div>`
    }
    ${pArch.length ? `<details class="arch-sec"><summary>${icon('archive')}Personnes archivées <span class="muted">${pArch.length}</span></summary>${pArch.map(p => `<div class="arch-line"><span class="t"><strong style="font-weight:500">${esc(p.nom)}</strong> ${esc(p.prenom || '')} <span class="muted">· ${esc(p.groupe || '')} · archivée le ${fmtD(p.arch)}</span></span><button class="btn small" data-act="unarch" data-col="personnes" data-id="${p.id}">Restaurer</button><button class="link" data-act="edit-pers" data-id="${p.id}">Ouvrir</button></div>`).join('')}</details>` : ''}</section>`;
};
OPT.fournisseurs = () => {
  const q = norm(S.q.optfour || '');
  const cnt = new Map();
  for (const p of db.pieces) {
    const set = new Set([p.fabricant, p.fournisseur, ...(p.fours || [])].filter(Boolean).map(norm));
    for (const k of set) cnt.set(k, (cnt.get(k) || 0) + 1);
  }
  const rows = [...db.listes.fournisseurs].filter(n => !q || norm(n).includes(q)).sort(coll.compare);
  const rc = new Map();
  if (S.fourOpen)
    for (const i of db.interventions)
      for (const id of i.intervenants) if (isFourId(id)) rc.set(id.slice(5), (rc.get(id.slice(5)) || 0) + 1);
  return `<section class="opt-sec"><div class="head"><h2>Fournisseurs <span class="muted" style="font-family:var(--f-mono);font-size:.9rem">${db.listes.fournisseurs.length}</span></h2><div class="tools">${menu(
    [
      ['new-four', 'Un fournisseur', 'plus'],
      ['import-four', 'Importer depuis CareOffice (fichier)', 'save'],
      ['link-four', 'Relier les pièces aux fournisseurs', 'repeat']
    ],
    'Ajouter',
    'plus',
    'primary'
  )}</div></div>
    <div class="pad"><p class="hint">Une pièce est reliée à un fournisseur quand son nom apparaît dans sa marque, son fournisseur, sa désignation ou ses notes.</p>
    <input type="search" data-search="optfour" data-opt4="1" placeholder="Filtrer…" value="${esc(S.q.optfour || '')}" aria-label="Filtrer les fournisseurs" style="max-width:320px"></div>
    <div id="opt-four">${
      rows.length
        ? `<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Nom</th><th class="num">Pièces</th></tr></thead><tbody>${rows
            .map(n => {
              const open = S.fourOpen === n,
                c = cnt.get(norm(n)) || 0;
              const ps = open
                ? db.pieces
                    .filter(p => [p.fabricant, p.fournisseur, ...(p.fours || [])].some(x => x && norm(x) === norm(n)))
                    .sort((a, b) => coll.compare(a.designation, b.designation))
                : [];
              return `<tr class="four-row ${open ? 'open' : ''}" data-act="four-open" data-name="${esc(n)}" tabindex="0"><td><span class="fr-n"><span class="chev ${open ? 'open' : ''}">${icon('chev')}</span>${esc(n)}</span></td><td class="num qty">${c || ''}</td></tr>
      ${
        open
          ? `<tr class="four-sub"><td colspan="2"><div class="four-tools"><button class="btn small" data-act="four-pieces" data-name="${esc(n)}">${icon('box')}Ouvrir dans Pièces</button>${rc.get(n) || 0 ? `<button class="btn small" data-act="four-ints" data-name="${esc(n)}">${icon('report')}${nbs(rc.get(n), 'rapport', 'rapports')}</button>` : ''}<button class="btn small" data-act="edit-four" data-name="${esc(n)}">${icon('edit')}Renommer</button><button class="btn small ghost" data-act="four-arch" data-name="${esc(n)}">${icon('archive')}Archiver</button></div>
        ${
          ps.length
            ? `<div class="four-list">${ps
                .slice(0, 200)
                .map(p => {
                  const mp = mainPlace(p);
                  return `<button class="four-p" data-act="goto" data-view="pieces" data-id="${p.id}"><span class="pid">${esc(p.ref)}</span><span class="t">${esc(p.designation)}</span>${mp ? plate(mp, false) : ''}<span class="q">${num(dispo(p))} <small>${esc(p.unite)}</small></span></button>`;
                })
                .join(
                  ''
                )}${ps.length > 200 ? `<p class="list-note">${nbs(ps.length - 200, 'autre', 'autres')} : « Ouvrir dans Pièces » pour tout voir.</p>` : ''}</div>`
            : '<p class="empty-line" style="padding:8px 0">Aucune pièce reliée.</p>'
        }</td></tr>`
          : ''
      }`;
            })
            .join('')}</tbody></table></div>`
        : `<div class="pad">${empty('Aucun fournisseur', '')}</div>`
    }</div>
    ${
      db.listes.fournArch.length
        ? `<details class="arch-sec"><summary>${icon('archive')}Fournisseurs archivés <span class="muted">${db.listes.fournArch.length}</span></summary>${[
            ...db.listes.fournArch
          ]
            .sort(coll.compare)
            .map(
              n =>
                `<div class="arch-line"><span class="t">${esc(n)}</span><button class="btn small" data-act="four-unarch" data-name="${esc(n)}">Restaurer</button>${canDel() ? `<button class="link danger" data-act="four-del" data-name="${esc(n)}">Supprimer</button>` : ''}</div>`
            )
            .join('')}</details>`
        : ''
    }</section>`;
};
/* Relie chaque pièce aux fournisseurs dont le nom apparaît dans sa désignation ou ses notes (à appeler dans tx) */
function linkFournisseurs() {
  const nz = t =>
    String(t || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const SUF = /\b(ag|sa|gmbh|s\.?r\.?l\.?|sarl|sàrl|ltd|inc|co|kg|sas|bv|spa|ab|oy)\b\.?/gi;
  const long = new Map(),
    acro = new Map();
  for (const n of db.listes.fournisseurs) {
    const c = nz(n)
      .replace(SUF, '')
      .replace(/[^a-z0-9&+ -]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (c.length >= 4) {
      if (!long.has(c)) long.set(c, n);
    } else {
      const a = n.replace(SUF, '').trim();
      if (/^[A-Z0-9&]{3,4}$/.test(a) && !acro.has(a)) acro.set(a, n);
    }
  }
  const esc2 = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const RL = long.size
    ? new RegExp(
        '(?<![a-z0-9])(' +
          [...long.keys()]
            .sort((a, b) => b.length - a.length)
            .map(esc2)
            .join('|') +
          ')(?![a-z0-9])',
        'g'
      )
    : null;
  const RA = acro.size
    ? new RegExp(
        '(?<![A-Za-z0-9])(' +
          [...acro.keys()]
            .sort((a, b) => b.length - a.length)
            .map(esc2)
            .join('|') +
          ')(?![A-Za-z0-9])',
        'g'
      )
    : null;
  let np = 0;
  for (const p of db.pieces) {
    const raw = `${p.designation || ''} ${p.notes || ''}`,
      txt = nz(raw),
      found = new Set();
    if (RL) for (const m of txt.matchAll(RL)) found.add(long.get(m[1]));
    if (RA) for (const m of raw.matchAll(RA)) found.add(acro.get(m[1]));
    const list = [...found].sort(coll.compare);
    if (list.length) {
      np++;
      if (!p.fournisseur) p.fournisseur = list[0];
    }
    if (list.length || p.fours) p.fours = list;
  }
  return np;
}
function importFourDialog() {
  dialog({
    title: 'Importer les fournisseurs depuis CareOffice',
    saveLabel: 'Importer',
    wide: true,
    body: `<p>Choisissez le fichier <span class="mono">fournisseurs-careoffice.json</span>. Les noms sont ajoutés à la liste (sans doublon), puis chaque pièce est reliée aux fournisseurs cités dans sa désignation ou ses notes.</p><label>Fichier<input type="file" name="file" accept=".json,application/json"></label><p class="hint" data-prev></p>`,
    onOpen(f, d) {
      f.elements.file.addEventListener('change', async () => {
        try {
          const j = JSON.parse(await f.elements.file.files[0].text());
          d._data = j;
          $('[data-prev]', d).textContent = `${nbs((j.fournisseurs || []).length, 'fournisseur', 'fournisseurs')}.`;
        } catch (e) {
          d._data = null;
          $('[data-prev]', d).textContent = 'Fichier illisible.';
        }
      });
    },
    onSave(f, d) {
      const j = d._data;
      if (!j || !Array.isArray(j.fournisseurs)) throw new Error('Choisissez le fichier fournisseurs-careoffice.json.');
      let add = 0,
        np = 0;
      const core = x =>
        norm(x)
          .replace(/\b(ag|sa|gmbh|s\.?r\.?l\.?|sarl|sàrl|ltd|inc|co|kg|sas|bv|spa|ab|oy)\b\.?/g, '')
          .replace(/[^a-z0-9&+]/g, '');
      tx(() => {
        const have = new Set(db.listes.fournisseurs.map(core));
        for (const n of j.fournisseurs) {
          const t = String(n || '').trim();
          if (t && !have.has(core(t))) {
            db.listes.fournisseurs.push(t);
            have.add(core(t));
            add++;
          }
        }
        db.listes.fournisseurs.sort(coll.compare);
        np = linkFournisseurs();
      });
      render();
      toast(`${nbs(add, 'fournisseur ajouté', 'fournisseurs ajoutés')} · ${nbs(np, 'pièce reliée', 'pièces reliées')}`);
    }
  });
}
function fourDialog(name) {
  const isNew = name == null;
  dialog({
    title: isNew ? 'Nouveau fournisseur' : 'Modifier le fournisseur',
    body: `<label>Nom<input name="nom" value="${esc(name || '')}" required placeholder="ex. SKF, Hydac, Brütsch Rüegger…"></label>`,
    del: isNew
      ? null
      : {
          label: 'Archiver',
          soft: true,
          run() {
            ACT['four-arch']({name});
          }
        },
    onSave(f) {
      const n = val(f, 'nom');
      if (!n) throw new Error('Indiquez un nom.');
      if (db.listes.fournisseurs.some(x => x !== name && norm(x) === norm(n))) throw new Error(`« ${n} » est déjà dans la liste.`);
      tx(() => {
        if (isNew) db.listes.fournisseurs.push(n);
        else {
          db.listes.fournisseurs = db.listes.fournisseurs.map(x => (x === name ? n : x));
          for (const i of db.interventions)
            if (i.intervenants.includes('four:' + name)) {
              i.intervenants = i.intervenants.map(x => (x === 'four:' + name ? 'four:' + n : x));
              if (i.snap) {
                i.snap['four:' + n] = fourSnap(n);
                delete i.snap['four:' + name];
              }
            }
          for (const p of db.pieces) {
            if (p.fabricant === name) p.fabricant = n;
            if (p.fournisseur === name) p.fournisseur = n;
            if (p.fours?.includes(name)) p.fours = p.fours.map(x => (x === name ? n : x));
          }
        }
        db.listes.fournisseurs.sort(coll.compare);
      });
      render();
      toast(isNew ? 'Fournisseur ajouté' : 'Fournisseur renommé');
    }
  });
}
OPT.historique = () => {
  if (!CLOUD.on)
    return `<section class="opt-sec"><div class="head"><h2>Historique</h2></div><div class="pad"><p>L’historique est tenu par la base partagée : il est disponible une fois connecté.</p></div></section>`;
  const f = S.jf || (S.jf = {}),
    ppl = [...new Set(Object.keys(db.reglages.moi || {}))];
  return `<section class="opt-sec"><div class="head"><h2>Historique</h2></div><div class="pad">
    <p class="hint">Qui a fait quoi, et quand : sorties et entrées de stock, rapports, tâches, pièces, planning, réglages. Les plus récents en premier.</p>
    <div class="ychips" role="tablist" style="padding:0;border:0;margin:8px 0">${J_TYPES.map(([k, t]) => `<button role="tab" class="ychip" data-act="jtype" data-k="${k}" aria-selected="${(f.col || '') === k}">${t}</button>`).join('')}</div>
    <div class="tools" style="margin-bottom:10px"><input type="search" data-jq placeholder="Chercher : nom, pièce, rapport…" value="${esc(f.q || '')}" style="max-width:340px" aria-label="Chercher dans l’historique"></div>
    <div data-jrn="" data-full="1"><p class="empty-line">Chargement…</p></div></div></section>`;
};
OPT.roles = () => {
  const R0 = db.reglages.resp || {},
    edit = canDel(),
    ppl = db.personnes.filter(p => live(p) && p.actif !== false).sort(persSort);
  const grps = db.listes.groupes.filter(g => g !== 'Cadres' && ppl.some(p => p.groupe === g));
  const cadres = ppl.filter(p => p.groupe === 'Cadres');
  return `<section class="opt-sec"><div class="head"><h2>Rôles</h2></div><div class="pad">
    <p class="hint">Un responsable par groupe (par exemple le responsable électrique). Les droits de chaque rôle seront réglés plus tard ici.${edit ? '' : ' Seuls les cadres peuvent modifier ces réglages.'}</p></div>
    <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Groupe</th><th>Responsable</th></tr></thead><tbody>
    ${grps
      .map(g => {
        const cur = R0[g] && getPers(R0[g]);
        return `<tr><td>${grpChip(g)}</td><td>${
          edit
            ? `<select class="mini" data-change="resp" data-g="${esc(g)}" aria-label="Responsable ${esc(g)}"><option value="">— Aucun —</option><optgroup label="${esc(g)}">${ppl
                .filter(p => p.groupe === g)
                .map(p => opt(p.id, persName(p), R0[g] || ''))
                .join('')}</optgroup><optgroup label="Autres">${ppl
                .filter(p => p.groupe !== g)
                .map(p => opt(p.id, persName(p) + (p.groupe ? ' · ' + p.groupe : ''), R0[g] || ''))
                .join('')}</optgroup></select>`
            : cur
              ? esc(persName(cur))
              : '<span class="muted">—</span>'
        }</td></tr>`;
      })
      .join('')}
    </tbody></table></div>
    <div class="pad"><h3 class="roles-h">Ce que chaque rôle peut faire aujourd’hui</h3>
    <dl class="roles">
      <dt>Cadres <span class="muted">(${cadres.length})</span></dt><dd>Tout, plus : supprimer définitivement, créer des accès, restaurer ou effacer la base.</dd>
      <dt>Responsables de groupe</dt><dd>Comme tout le monde pour l’instant (droits à définir).</dd>
      <dt>Tout le monde</dt><dd>Consulter, créer et modifier pièces, rapports, tâches et planning ; archiver.</dd>
    </dl></div></section>`;
};
const respOf = id =>
  Object.entries(db.reglages.resp || {})
    .filter(([, v]) => v === id)
    .map(([g]) => g);
OPT.connexion = () => {
  const c = CLOUD.cfg();
  return `<section class="opt-sec"><div class="head"><h2>Sur ce poste</h2></div><div class="pad"><p>${meId() ? `Vous êtes <strong>${esc(persName(getPers(meId())))}</strong>. ${NOFILTER_GRP.includes(getPers(meId()).groupe) ? 'Comme cadre / administration, vous voyez tout par défaut.' : 'À chaque ouverture, l’accueil, les tâches et les rapports sont filtrés sur vous et votre groupe ; le filtre se désactive avec « Tout le monde ». Les archives ne sont jamais filtrées.'}` : 'Personne n’est choisi : tout le monde voit tout.'}</p><div class="tools"><button class="btn" data-act="me">${icon('person')}${meId() ? 'Changer' : 'Choisir mon nom'}</button></div></div></section><section class="opt-sec"><div class="head"><h2>Base partagée</h2></div><div class="pad">
    ${
      CLOUD.on
        ? `<p>Connecté en tant que <strong>${esc(CLOUD.user?.email || '')}</strong>. Les données sont partagées par tous les postes connectés.</p>
      <div class="tools"><button class="btn" data-act="logout">Se déconnecter</button></div>`
        : `<p>Pour l’instant, les données sont enregistrées <strong>dans ce navigateur seulement</strong>. Pour les partager entre tous les postes et téléphones, renseignez la base Supabase.</p>`
    }</div></section>
  ${
    c.fixed
      ? ''
      : `<section class="opt-sec"><div class="head"><h2>Réglages Supabase</h2></div><form class="pad" data-form="cloud">
    <p class="hint">Dans Supabase : Project Settings › API. Utilisez la clé <strong>anon / public</strong>, jamais la clé « service_role ».</p>
    <label>Adresse du projet (Project URL)<input name="url" type="url" placeholder="https://xxxx.supabase.co" value="${esc(c.url)}"></label>
    <label>Clé publique (anon key)<input name="key" placeholder="eyJhbGciOi…" value="${esc(c.key)}" autocomplete="off"></label>
    <div class="tools"><button class="btn primary">Enregistrer et se connecter</button>${c.url ? '<button type="button" class="btn danger-ghost" data-act="cloud-off">Revenir aux données du navigateur</button>' : ''}</div></form></section>`
  }
  ${
    CLOUD.on && localStorage.getItem(KEY)
      ? `<section class="opt-sec"><div class="head"><h2>Transférer les données de ce navigateur</h2></div><div class="pad">
    <p>Ce navigateur contient encore les données de l’ancienne version (enregistrées localement). Vous pouvez les envoyer dans la base partagée : elles <strong>remplacent</strong> le contenu actuel de la base.</p>
    <div class="tools"><button class="btn" data-act="push-local">Envoyer dans la base…</button></div></div></section>`
      : ''
  }`;
};
OPT.listes = () => {
  const block = (
    key,
    title,
    hint
  ) => `<div><h3>${title}</h3><p class="hint">${hint}</p><div class="chips">${db.listes[key].map((v, i) => `<span class="c">${esc(v)}<button class="icon-btn" data-act="list-del" data-list="${key}" data-i="${i}" aria-label="Retirer ${esc(v)}">×</button></span>`).join('')}</div>
    <form class="inline-form" data-form="list-add" data-list="${key}"><input name="v" placeholder="Ajouter…" aria-label="Ajouter à ${title}"><button class="btn">Ajouter</button></form></div>`;
  return `<section class="opt-sec"><div class="head"><h2>Listes</h2></div><div class="pad"><div class="lists">
    ${block('categories', 'Catégories de pièces', 'Proposées dans la fiche pièce.')}
    ${block('unites', 'Unités', 'pce, m, kg…')}
    ${block('types', 'Types d’intervention', 'Proposés dans les rapports.')}
    ${block('pannes', 'Causes de panne', 'Proposées dans les rapports ; servent à repérer les pannes qui reviennent.')}
    ${block('groupes', 'Groupes de personnes', 'Les mêmes que sur le Planning Tridel.')}</div></div></section>`;
};
OPT.etiquettes = () => `<section class="opt-sec"><div class="head"><h2>Étiquettes & QR codes</h2></div>
  <form class="pad" data-form="settings"><p>Chaque étiquette QR mène directement à la fiche de sa pièce. ${qrBase() ? `Adresse utilisée : <span class="mono">${esc(qrBase())}</span>` : '<strong>L’application est ouverte depuis un fichier sur ce PC</strong> : le QR contient pour l’instant la référence de la pièce, qui ouvre la fiche quand on la scanne dans la barre de recherche. Une fois l’application en ligne, le QR ouvrira la fiche depuis n’importe quel téléphone, automatiquement.'}</p>
    <div class="grid2"><label>Adresse de l’application (si différente)<input name="qrBase" type="url" placeholder="https://…" value="${esc(db.reglages.qrBase)}"></label>
    <label>Format d’étiquette par défaut<select name="labelFmt">${opt('sheet', 'Planche A4 · 21 étiquettes 63,5 × 38,1 mm', db.reglages.labelFmt)}${opt('roll', 'Étiqueteuse · 62 × 29 mm', db.reglages.labelFmt)}</select></label></div>
    <div><button class="btn primary">Enregistrer</button></div></form></section>`;
OPT.donnees =
  () => `<section class="opt-sec"><div class="head"><h2>Sauvegarde</h2></div><div class="pad"><p>${CLOUD.on ? 'Les données sont dans la base partagée. Une copie de sauvegarde téléchargée de temps en temps reste une bonne précaution.' : 'Les données restent dans ce navigateur, sur ce poste. Exportez régulièrement une sauvegarde : elle permet de restaurer les données ou de les passer sur un autre ordinateur.'}</p>
    <div class="tools"><button class="btn primary" data-act="export-json">${icon('save')}Exporter la sauvegarde</button>${canDel() ? '<button class="btn" data-act="import-json">Restaurer une sauvegarde…</button>' : ''}</div>${canDel() ? '' : '<p class="hint">Restaurer une sauvegarde est réservé aux cadres.</p>'}</div></section>
  <section class="opt-sec"><div class="head"><h2>Exports pour Excel</h2></div><div class="pad"><p>Fichiers Excel (.xlsx). Chaque liste (pièces, rapports, tâches, installation) s’exporte aussi depuis son menu « Plus », avec les filtres en cours.</p>
    <div class="tools"><button class="btn" data-act="export-csv-stock">Stock par emplacement</button><button class="btn" data-act="export-csv-int">Rapports</button><button class="btn" data-act="export-csv-kks">Liens pièces ↔ KKS</button></div></div></section>
  ${
    !canDel()
      ? ''
      : `<section class="opt-sec"><div class="head"><h2>Réinitialiser</h2></div><div class="pad"><p>${db.meta.demo ? 'Les données actuelles sont des exemples. Effacez-les pour commencer avec vos vraies données.' : CLOUD.on ? 'Efface toutes les données de la base partagée, pour tout le monde.' : 'Efface toutes les pièces, emplacements, personnes, repères et rapports de ce navigateur.'}</p>
    <div class="tools">${db.meta.demo ? '<button class="btn" data-act="clear-demo">Effacer les exemples</button>' : '<button class="btn danger-ghost" data-act="clear-all">Tout effacer…</button>'}${CLOUD.on ? '' : '<button class="btn" data-act="load-demo">Recharger les exemples</button>'}</div></div></section>`
  }`;
VIEWS.options = {
  shell: () => `<header class="page-head"><h1>Options</h1></header>
    <div class="opt"><nav class="opt-nav" aria-label="Sections des options"><button data-act="nav" data-view="kks" title="Fiche de chaque équipement : rapports, tâches et pièces">${icon('plant')}Installation</button>${OPT_SECS.map(([k, t, ic]) => `<button data-act="opt" data-sec="${k}" aria-current="${S.opt === k}">${icon(ic)}${t}</button>`).join('')}</nav>
    <div class="opt-body">${(OPT[S.opt] || OPT[(S.opt = OPT_SECS[0][0])])()}</div></div>`,
  list: () => '',
  detail: () => ''
};
