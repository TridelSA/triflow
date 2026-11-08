/* Fausse base Supabase pour les tests (aucune donnée réelle, aucune connexion) : mot de passe de test « secret ».
   Remplace la bibliothèque supabase-js chargée par index.html. Reproduit : connexion, lecture de la table docs (filtres eq/neq/in), rpc save_docs (avec contrôle de version), functions.invoke, temps réel (canal muet). */
window.__srv = window.__srv || {rows:new Map(), handlers:[], session:null, rpcCalls:0};
(function(){
  const S = window.__srv;
  const persist = () => { try { localStorage.setItem('__mockdb', JSON.stringify([...S.rows])); } catch(e){} };
  try { const t = localStorage.getItem('__mockdb'); if (t) S.rows = new Map(JSON.parse(t)); } catch(e){}
  try { const t = localStorage.getItem('__mocksess'); if (t) S.session = JSON.parse(t); } catch(e){}
  window.supabase = {createClient(){ return {
    auth:{
      async getSession(){ return {data:{session:S.session}}; },
      async getUser(){ return {data:{user:S.session ? S.session.user : null}}; },
      async signInWithPassword({email, password}){ if (password !== 'secret') return {error:{message:'Invalid login credentials'}}; S.session = {user:{email, id:'u1'}}; localStorage.setItem('__mocksess', JSON.stringify(S.session)); return {data:{}, error:null}; },
      async signOut(){ S.session = null; localStorage.removeItem('__mocksess'); },
      async signUp({email, password}){ (S.mails = S.mails || []).push(['signup', email]); return {data:{}, error:null}; },
      async resetPasswordForEmail(email){ (S.mails = S.mails || []).push(['reset', email]); return {data:{}, error:null}; },
      async updateUser({password}){ S.newPw = password; return {data:{}, error:null}; },
      onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; }
    },
    from(){ return {select(cols){ const f = {c:null, ids:null, eqs:[], neq:null}; const pick = r => { const o = {}; for (const k of cols.split(',')) o[k] = k === 'data' ? JSON.parse(JSON.stringify(r.data)) : r[k]; return o; };
      const list = () => [...S.rows.values()].filter(r => (!f.c || r.collection === f.c) && (!f.neq || r.collection !== f.neq) && f.eqs.every(([k, v]) => String(r.data?.[k]) === String(v)) && (!f.ids || f.ids.includes(r.id))).sort((a, b) => (a.collection + '|' + a.id).localeCompare(b.collection + '|' + b.id));
      const q = {order(){ return q; }, eq(k, v){ if (k === 'collection') f.c = v; else f.eqs.push([k.replace('data->>', ''), v]); return q; }, neq(k, v){ f.neq = v; return q; }, in(k, v){ f.ids = v; return q; }, async range(a, b){ S.reads = (S.reads || 0) + 1; return {data:list().slice(a, b + 1).map(pick), error:null}; }, then(ok, ko){ S.reads = (S.reads || 0) + 1; return Promise.resolve({data:list().map(pick), error:null}).then(ok, ko); }};
      return q; }}; },
    storage: {from(){ return {
      async upload(path, blob){ S.photos = S.photos || new Map(); S.photos.set(path, 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#9cd"/></svg>')); return {data:{path}, error:null}; },
      async createSignedUrls(paths){ return {data: paths.map(p => ({path:p, signedUrl:(S.photos && S.photos.get(p)) || ''})), error:null}; }
    }; }},
    async rpc(name, args){
      if (S.offline) throw new TypeError('Failed to fetch');
      /* Accès (outils/acces.sql) : window.__noAccess = refusé ; is_cadre seulement si window.__cadre est défini */
      if (name === 'tf_ok') return {data: !window.__noAccess, error:null};
      if (name === 'is_cadre') return window.__cadre === undefined ? {data:null, error:{message:'function is_cadre() does not exist'}} : {data: window.__cadre, error:null};
      const {changes} = args;
      S.rpcCalls++;
      for (const c of changes){ const k = c.c + '|' + c.id; const cur = S.rows.get(k); if ((cur ? cur.rev : 0) !== (c.rev || 0)) return {error:{message:'GMAO_CONFLIT ' + k}}; }
      for (const c of changes){ const k = c.c + '|' + c.id; const cur = S.rows.get(k);
        if (c.del) S.rows.delete(k); else S.rows.set(k, {collection:c.c, id:c.id, data:JSON.parse(JSON.stringify(c.data)), rev:(cur ? cur.rev : 0) + 1}); }
      persist(); return {error:null};
    },
    functions:{ async invoke(name, {body}){ if (window.__fnMissing) return {data:null, error:{message:'Failed to send a request to the Edge Function'}}; (window.__fnCalls = window.__fnCalls || []).push([name, body]); return {data:{ok:true, email:body.email}, error:null}; } },
    channel(){ const ch = {on(_, __, cb){ S.handlers.push(cb); return ch; }, subscribe(){ return ch; }}; return ch; }
  }; }};
})();
