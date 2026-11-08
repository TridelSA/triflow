-- =====================================================================
--  TriFlow — accès réservé à Tridel
--  À coller UNE FOIS dans Supabase : SQL Editor › New query › Run,
--  APRÈS outils/supabase.sql, outils/droits.sql et outils/photos.sql.
--  Peut être relancé sans risque (ne supprime aucune donnée).
--
--  1. Seules les adresses @tridelsa.ch (et les exceptions de la table
--     tf_exceptions) peuvent lire ou modifier les données, et seulement
--     une fois l'adresse confirmée (lien reçu par e-mail).
--     Une adresse bidon peut s'inscrire : elle reçoit un e-mail, mais
--     sans clic sur le lien (et hors @tridelsa.ch), elle ne voit rien.
--  2. Les cadres sont listés dans la table tf_cadres, modifiable
--     uniquement ici dans Supabase (plus depuis le site) :
--     Table Editor › tf_cadres › Insert row › adresse e-mail.
-- =====================================================================

-- Domaine autorisé (une seule ligne à changer si besoin)
create or replace function public.tf_domaine() returns text
language sql immutable as $$ select 'tridelsa.ch' $$;

-- Adresses externes autorisées malgré tout (ex. un compte de sauvegarde, un prestataire)
create table if not exists public.tf_exceptions (
  email text primary key check (email = lower(email)),
  note  text,
  ajout timestamptz not null default now()
);
alter table public.tf_exceptions enable row level security;
revoke all on public.tf_exceptions from anon, authenticated;

-- Liste des cadres (droits de suppression définitive, journal, création d'accès)
create table if not exists public.tf_cadres (
  email text primary key check (email = lower(email)),
  ajout timestamptz not null default now()
);
alter table public.tf_cadres enable row level security;
revoke all on public.tf_cadres from anon, authenticated;

-- Première fois : reprend les cadres reconnus par l'ancienne règle
-- (groupe « Cadres » + nom de famille dans l'adresse), pour que rien ne change ce jour-là.
insert into public.tf_cadres (email)
select distinct lower(u.email)
from auth.users u
join public.docs p on p.collection = 'personnes'
  and p.data->>'groupe' = 'Cadres'
  and coalesce(p.data->>'actif', 'true') <> 'false'
  and p.data->>'arch' is null
  and length(public.tf_lettres(p.data->>'nom')) >= 4
  and position(public.tf_lettres(p.data->>'nom') in public.tf_lettres(split_part(u.email, '@', 1))) > 0
where u.email is not null
on conflict do nothing;

-- Un cadre qui se connecte aujourd'hui avec une autre adresse (ex. Gmail) garde son accès
insert into public.tf_exceptions (email, note)
select c.email, 'cadre repris automatiquement' from public.tf_cadres c
where c.email not like '%@' || public.tf_domaine()
on conflict do nothing;

-- La personne connectée a-t-elle le droit d'utiliser TriFlow ?
create or replace function public.tf_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select (lower(u.email) like '%@' || public.tf_domaine()
            or exists (select 1 from public.tf_exceptions e where e.email = lower(u.email)))
       and u.email_confirmed_at is not null
    from auth.users u where u.id = auth.uid()
  ), false);
$$;
revoke all on function public.tf_ok() from public, anon;
grant execute on function public.tf_ok() to authenticated;

-- Cadre = dans la liste tf_cadres (et accès autorisé)
create or replace function public.is_cadre() returns boolean
language sql stable security definer set search_path = public as $$
  select public.tf_ok() and exists (
    select 1 from public.tf_cadres c where c.email = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;
revoke all on function public.is_cadre() from public, anon;
grant execute on function public.is_cadre() to authenticated;

-- Règles de la table des données : tout passe par tf_ok()
drop policy if exists "gmao_lecture"     on public.docs;
drop policy if exists "gmao_ajout"       on public.docs;
drop policy if exists "gmao_modif"       on public.docs;
drop policy if exists "gmao_suppression" on public.docs;
create policy "gmao_lecture" on public.docs for select to authenticated using (public.tf_ok());
create policy "gmao_ajout"   on public.docs for insert to authenticated with check (public.tf_ok());
create policy "gmao_modif"   on public.docs for update to authenticated
  using (public.tf_ok() and (collection <> 'journal' or updated_by = auth.uid()))
  with check (public.tf_ok());
create policy "gmao_suppression" on public.docs for delete to authenticated
  using (
    public.tf_ok() and collection <> 'journal' and (public.is_cadre()
    or collection = 'plan'
    or (updated_by = auth.uid() and updated_at > now() - interval '1 day'))
  );

-- Photos : mêmes règles
drop policy if exists "photos_lecture" on storage.objects;
create policy "photos_lecture" on storage.objects for select to authenticated using (bucket_id = 'photos' and public.tf_ok());
drop policy if exists "photos_ajout" on storage.objects;
create policy "photos_ajout" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.tf_ok());
drop policy if exists "photos_effacement" on storage.objects;
create policy "photos_effacement" on storage.objects for delete to authenticated using (bucket_id = 'photos' and public.is_cadre());

-- ---------------------------------------------------------------------
--  FACULTATIF : refuser l'inscription dès le départ pour les autres adresses
--  (évite les comptes inutiles). Après avoir lancé ce script :
--  Authentication › Hooks › « Before User Created » › Postgres ›
--  schéma public, fonction tf_avant_inscription › Create.
-- ---------------------------------------------------------------------
create or replace function public.tf_avant_inscription(event jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e text := lower(coalesce(event->'user'->>'email', ''));
begin
  if e like '%@' || public.tf_domaine() or exists (select 1 from public.tf_exceptions x where x.email = e) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'TriFlow est réservé aux adresses @' || public.tf_domaine() || '.'));
end;
$$;
revoke all on function public.tf_avant_inscription(jsonb) from public, anon, authenticated;
grant execute on function public.tf_avant_inscription(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
grant select on public.tf_exceptions to supabase_auth_admin;

-- ---------------------------------------------------------------------
--  RÉSULTAT : comptes existants qui n'auront PAS accès après ce script.
--  Si l'un d'eux doit garder l'accès :
--  insert into public.tf_exceptions (email) values ('adresse@exemple.ch');
-- ---------------------------------------------------------------------
select u.email as "sans accès", case when u.email_confirmed_at is null then 'adresse non confirmée' else 'hors @' || public.tf_domaine() end as raison
from auth.users u
where not (u.email_confirmed_at is not null
  and (lower(u.email) like '%@' || public.tf_domaine()
       or exists (select 1 from public.tf_exceptions e where e.email = lower(u.email))))
order by 1;
