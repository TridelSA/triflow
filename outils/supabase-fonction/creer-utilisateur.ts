// =====================================================================
//  TriFlow — fonction Supabase « creer-utilisateur »
//  Crée un compte TriFlow depuis l'application (bouton Options › Personnes › Créer un accès).
//  Seuls les cadres peuvent l'utiliser (vérifié par la fonction is_cadre() de outils/acces.sql).
//  La clé d'administration (service_role) reste dans Supabase : elle n'est jamais dans le site.
//
//  Installation (une seule fois) : Supabase › Edge Functions › Deploy a new function › Via Editor
//  Nom : creer-utilisateur  · coller ce fichier · Deploy.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reponse = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reponse({ erreur: 'Méthode non autorisée' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const cleAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const cleAdmin = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const jeton = req.headers.get('Authorization') ?? '';

  // 1. La personne qui demande doit être connectée et cadre
  const commeUtilisateur = createClient(url, cleAnon, { global: { headers: { Authorization: jeton } } });
  const { data: estCadre, error: errCadre } = await commeUtilisateur.rpc('is_cadre');
  if (errCadre) return reponse({ erreur: 'Vérification des droits impossible : lancez d’abord outils/droits.sql.' }, 500);
  if (!estCadre) return reponse({ erreur: 'Seuls les cadres peuvent créer des accès.' }, 403);

  // 2. Données du nouveau compte
  let corps: { email?: string; password?: string } = {};
  try { corps = await req.json(); } catch { return reponse({ erreur: 'Demande illisible' }, 400); }
  const email = String(corps.email ?? '').trim().toLowerCase();
  const password = String(corps.password ?? '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reponse({ erreur: 'Adresse e-mail invalide.' }, 400);
  if (password.length < 10) return reponse({ erreur: 'Mot de passe trop court (10 caractères minimum).' }, 400);

  // 3. Création du compte, déjà confirmé
  const admin = createClient(url, cleAdmin, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    const deja = /already|registered|exists/i.test(error.message);
    return reponse({ erreur: deja ? 'Un compte existe déjà avec cette adresse.' : error.message }, deja ? 409 : 400);
  }
  // 4. Adresse hors @tridelsa.ch créée par un cadre : on l'autorise (table tf_exceptions de outils/acces.sql)
  if (!email.endsWith('@tridelsa.ch')) {
    await admin.from('tf_exceptions').upsert({ email, note: 'créé depuis TriFlow' }, { onConflict: 'email', ignoreDuplicates: true });
  }
  return reponse({ ok: true, email });
});
