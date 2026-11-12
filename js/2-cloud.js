'use strict';
/* TriFlow — Base partagée Supabase : COLS, CLOUD (chargement, cache, enregistrement, temps réel). (Fichiers chargés dans l'ordre par index.html.) */
/* =====================================================================
   BASE PARTAGÉE (Supabase)
   Renseignez l'adresse du projet et la clé publique ici, ou dans Options › Connexion.
   Sans elles, l'application fonctionne comme avant, avec les données dans ce navigateur.
   ===================================================================== */
const SUPABASE_URL = 'https://gzwmoevwapliqremrqpp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Mslbg2kd3UQp5lhVkhrXkA_XXN2H9vK';
const SUPABASE_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.0/dist/umd/supabase.js';
/* Copie locale de la base (IndexedDB) : le site s'ouvre tout de suite, puis ne télécharge que ce qui a changé */
const IDB = {
  h: null,
  open() {
    return (
      this.h ||
      (this.h = new Promise((ok, ko) => {
        const r = indexedDB.open('triflow-cache', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ko(r.error);
      }))
    );
  },
  async get(k) {
    try {
      const d = await this.open();
      return await new Promise(ok => {
        const r = d.transaction('kv').objectStore('kv').get(k);
        r.onsuccess = () => ok(r.result || null);
        r.onerror = () => ok(null);
      });
    } catch (e) {
      return null;
    }
  },
  async set(k, v) {
    try {
      const d = await this.open();
      await new Promise(ok => {
        const t = d.transaction('kv', 'readwrite');
        t.objectStore('kv').put(v, k);
        t.oncomplete = ok;
        t.onerror = ok;
      });
    } catch (e) {}
  },
  async del(k) {
    try {
      const d = await this.open();
      await new Promise(ok => {
        const t = d.transaction('kv', 'readwrite');
        t.objectStore('kv').delete(k);
        t.oncomplete = ok;
        t.onerror = ok;
      });
    } catch (e) {}
  }
};
const COLS = ['salles', 'lieux', 'personnes', 'kks', 'pieces', 'interventions', 'mouvements', 'taches', 'histo', 'plan'];
const CLOUD = {
  on: false,
  sb: null,
  user: null,
  synced: new Map(),
  revs: new Map(),
  pushing: false,
  again: false,
  timer: null,
  state: 'ok',
  cfg() {
    let c = {};
    try {
      c = JSON.parse(localStorage.getItem('gmao-cloud') || '{}');
    } catch (e) {}
    return {url: (SUPABASE_URL || c.url || '').trim(), key: (SUPABASE_KEY || c.key || '').trim(), fixed: !!SUPABASE_URL};
  },
  docsOf(d) {
    const m = new Map();
    for (const c of COLS) for (const x of d[c] || []) m.set(c + '|' + x.id, x);
    m.set('config|main', {version: d.version, meta: d.meta, reglages: d.reglages, listes: d.listes});
    return m;
  },
  status(st) {
    this.state = st || this.state;
    const el = $('#sync');
    if (!el) return;
    const txt =
      {
        sync: 'Mise à jour…',
        ok: 'Enregistré',
        saving: 'Enregistrement…',
        offline: 'Hors ligne : modifications en attente',
        error: 'Erreur d’enregistrement'
      }[this.state] || '';
    el.textContent = txt;
    el.dataset.state = this.state;
    const h = $('#hsync');
    if (h) {
      h.hidden = !txt;
      h.dataset.state = this.state;
      h.title = txt;
      h.querySelector('span').textContent = {offline: 'Hors ligne', error: 'Erreur', sync: 'Mise à jour…', saving: ''}[this.state] || '';
    }
  },
  schedule() {
    clearTimeout(this.timer);
    this.status('saving');
    this.timer = setTimeout(() => this.push(), 120);
  },
  /* Modifications faites sans réseau, gardées sur l'appareil jusqu'à leur envoi */
  pendKey() {
    return 'pend:' + this.cacheKey();
  },
  /* Démarrage depuis la copie locale, en gardant l'état « déjà envoyé » pour pouvoir envoyer la différence plus tard */
  async fromCacheKeep() {
    const c = await IDB.get(this.cacheKey());
    if (!c || !Array.isArray(c.rows) || !c.rows.length) return null;
    return this.build(c.rows).d;
  },
  cacheKey() {
    return 'snap:' + (this.cfg().url || '') + ':' + (this.user?.email || '');
  },
  /* Toute la table (sauf le journal), par pages de 1000. Si la base donne le total, 4 pages partent en même temps
     (premier chargement d'un poste nettement plus rapide) et onProg(reçues, total) fait avancer la barre. */
  async fetchAll(cols, onProg) {
    const page = async from => {
      const {data, error} = await this.sb
        .from('docs')
        .select(cols)
        .neq('collection', 'journal')
        .order('collection')
        .order('id')
        .range(from, from + 999);
      if (error) throw error;
      return data || [];
    };
    let total = null;
    try {
      const {count, error} = await this.sb.from('docs').select('id', {count: 'exact', head: true}).neq('collection', 'journal');
      if (!error && typeof count === 'number') total = count;
    } catch (e) {}
    const rows = [];
    if (total === null) {
      for (let from = 0; ; from += 1000) {
        const d = await page(from);
        rows.push(...d);
        onProg?.(rows.length, null);
        if (d.length < 1000) break;
      }
      return rows;
    }
    const n = Math.max(1, Math.ceil(total / 1000)),
      out = new Array(n);
    let next = 0,
      got = 0;
    const worker = async () => {
      while (next < n) {
        const i = next++;
        out[i] = await page(i * 1000);
        got += out[i].length;
        onProg?.(got, total);
      }
    };
    await Promise.all(Array.from({length: Math.min(4, n)}, worker));
    for (const d of out) rows.push(...d);
    /* Des fiches ajoutées pendant le chargement : on prend la suite */
    for (let from = n * 1000, last = out[n - 1]; last.length === 1000; from += 1000) {
      last = await page(from);
      rows.push(...last);
    }
    return rows;
  },
  async loadAll() {
    const cache = await IDB.get(this.cacheKey());
    let rows;
    if (cache && Array.isArray(cache.rows) && cache.rows.length) {
      const idx = await this.fetchAll('collection,id,rev'),
        cm = new Map(cache.rows.map(r => [r.collection + '|' + r.id, r]));
      const need = idx.filter(r => cm.get(r.collection + '|' + r.id)?.rev !== r.rev),
        got = new Map();
      const byCol = new Map();
      for (const r of need) {
        if (!byCol.has(r.collection)) byCol.set(r.collection, []);
        byCol.get(r.collection).push(r.id);
      }
      for (const [c, ids] of byCol)
        for (let i = 0; i < ids.length; i += 150) {
          const {data, error} = await this.sb
            .from('docs')
            .select('collection,id,data,rev')
            .eq('collection', c)
            .in('id', ids.slice(i, i + 150));
          if (error) throw error;
          for (const r of data) got.set(r.collection + '|' + r.id, r);
        }
      rows = idx.map(r => got.get(r.collection + '|' + r.id) || cm.get(r.collection + '|' + r.id)).filter(Boolean);
    } else rows = await this.fetchAll('collection,id,data,rev', (n, t) => typeof loadProgress === 'function' && loadProgress(n, t));
    IDB.set(this.cacheKey(), {rows, at: Date.now()});
    return this.build(rows);
  },
  build(rows) {
    const d = blank();
    let cfg = null;
    this.synced.clear();
    this.revs.clear();
    for (const r of rows) {
      const k = r.collection + '|' + r.id;
      this.revs.set(k, r.rev);
      this.synced.set(k, JSON.stringify(r.data));
      if (r.collection === 'config') cfg = r.data;
      else if (d[r.collection]) d[r.collection].push(r.data);
    }
    if (cfg)
      Object.assign(d, {
        version: cfg.version,
        meta: cfg.meta || d.meta,
        reglages: cfg.reglages || d.reglages,
        listes: cfg.listes || d.listes
      });
    d.mouvements.sort((a, b) => b.date.localeCompare(a.date));
    return {d, empty: !rows.length};
  },
  /* Affichage immédiat depuis la copie locale (lecture seule le temps de la mise à jour) */
  async fromCache() {
    const c = await IDB.get(this.cacheKey());
    if (!c || !Array.isArray(c.rows) || !c.rows.length) return null;
    const b = this.build(c.rows);
    this.synced.clear();
    this.revs.clear();
    return b.d;
  },
  async push() {
    if (this.pushing) {
      this.again = true;
      return;
    }
    this.pushing = true;
    try {
      do {
        this.again = false;
        const cur = this.docsOf(db),
          changes = [];
        for (const [k, v] of cur) {
          const j = JSON.stringify(v);
          if (this.synced.get(k) !== j) changes.push({k, j, v});
        }
        /* « Modifié par » : seulement pour les vraies modifications (pas les imports ni les mises à jour en masse) */
        {
          const per = new Map();
          for (const x of changes) {
            const c = x.k.slice(0, x.k.indexOf('|'));
            per.set(c, (per.get(c) || 0) + 1);
          }
          for (const x of changes) {
            const c = x.k.slice(0, x.k.indexOf('|'));
            if (c !== 'config' && this.user?.email && !this.auto && per.get(c) <= 40) {
              x.v._by = this.user.email;
              x.v._at = new Date().toISOString();
              x.j = JSON.stringify(x.v);
            }
          }
        }
        for (const k of this.synced.keys()) if (!cur.has(k)) changes.push({k, del: true});
        if (!changes.length) break;
        let jr = [];
        try {
          jr = JRN.entries(changes, this.synced, this.auto);
        } catch (e) {}
        this.auto = false;
        for (let i = 0; i < changes.length; i += 400) {
          const part = changes.slice(i, i + 400);
          const payload = part.map(x => {
            const p = x.k.indexOf('|');
            return {c: x.k.slice(0, p), id: x.k.slice(p + 1), rev: this.revs.get(x.k) || 0, del: !!x.del, data: x.del ? null : x.v};
          });
          const {error} = await this.sb.rpc('save_docs', {changes: payload});
          if (error) {
            if (/GMAO_CONFLIT/.test(error.message || '')) {
              const {d} = await this.loadAll();
              db = migrate(d);
              render();
              toast(
                'Quelqu’un a modifié la même fiche au même moment. Les données à jour ont été rechargées : refaites votre dernière modification.',
                'bad'
              );
              this.status('ok');
              this.pushing = false;
              return;
            }
            throw error;
          }
          for (const x of part) {
            if (x.del) {
              this.synced.delete(x.k);
              this.revs.delete(x.k);
            } else {
              this.synced.set(x.k, x.j);
              this.revs.set(x.k, (this.revs.get(x.k) || 0) + 1);
            }
          }
        }
        JRN.write(jr);
        jr = [];
      } while (this.again);
      this.status('ok');
      IDB.del(this.pendKey());
    } catch (e) {
      IDB.set(this.pendKey(), {db: JSON.parse(JSON.stringify(db)), at: Date.now()});
      this.status(navigator.onLine === false || /fetch|network/i.test(String(e.message || e)) ? 'offline' : 'error');
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.push(), 5000);
    }
    this.pushing = false;
  },
  applyRemote(ev) {
    const row = ev.new && ev.new.collection ? ev.new : ev.old;
    if (!row || !row.collection) return;
    if (row.collection === 'journal') {
      clearTimeout(this.jt);
      this.jt = setTimeout(() => {
        if ($('[data-jrn]')) jrnRefresh();
      }, 400);
      return;
    }
    const k = row.collection + '|' + row.id;
    if (ev.eventType === 'DELETE') {
      if (!this.synced.has(k)) return;
      this.synced.delete(k);
      this.revs.delete(k);
      if (db[row.collection]) db[row.collection] = db[row.collection].filter(x => x.id !== row.id);
    } else {
      if ((ev.new.rev || 0) <= (this.revs.get(k) || 0)) return;
      this.revs.set(k, ev.new.rev);
      this.synced.set(k, JSON.stringify(ev.new.data));
      if (row.collection === 'config')
        Object.assign(db, {meta: ev.new.data.meta, reglages: ev.new.data.reglages, listes: ev.new.data.listes});
      else if (db[row.collection]) {
        const arr = db[row.collection],
          i = arr.findIndex(x => x.id === row.id);
        if (i >= 0) arr[i] = ev.new.data;
        else row.collection === 'mouvements' ? arr.unshift(ev.new.data) : arr.push(ev.new.data);
      }
    }
    clearTimeout(this.rt);
    this.rt = setTimeout(() => {
      if (!document.querySelector('dialog[open]')) render();
      else this.dirty = true;
    }, 250);
  }
};
