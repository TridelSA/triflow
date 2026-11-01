-- =====================================================================
--  GMAO Tridel — base de données Supabase
--  À coller UNE FOIS dans Supabase : SQL Editor › New query › Run.
--  Le script peut être relancé sans risque (il ne supprime aucune donnée).
-- =====================================================================

-- Une seule table : chaque fiche (pièce, emplacement, rapport, tâche…) est un document.
create table if not exists public.docs (
  collection  text        not null,               -- pieces, lieux, salles, kks, personnes, interventions, mouvements, taches, config
  id          text        not null,
  data        jsonb       not null,
  rev         integer     not null default 1,     -- numéro de version (évite d'écraser une modification faite en même temps)
  updated_at  timestamptz not null default now(),
  updated_by  uuid                 default auth.uid(),
  primary key (collection, id)
);

-- Sécurité : personne ne lit ni n'écrit sans être connecté avec un compte.
alter table public.docs enable row level security;

drop policy if exists "gmao_lecture"     on public.docs;
drop policy if exists "gmao_ajout"       on public.docs;
drop policy if exists "gmao_modif"       on public.docs;
drop policy if exists "gmao_suppression" on public.docs;
create policy "gmao_lecture"     on public.docs for select to authenticated using (true);
create policy "gmao_ajout"       on public.docs for insert to authenticated with check (true);
create policy "gmao_modif"       on public.docs for update to authenticated using (true) with check (true);
create policy "gmao_suppression" on public.docs for delete to authenticated using (true);

revoke all on public.docs from anon;
grant select, insert, update, delete on public.docs to authenticated;

-- Enregistrement groupé : tout passe ou rien ne passe.
-- Si une fiche a été modifiée entre-temps par quelqu'un d'autre, l'enregistrement est refusé
-- (l'application recharge alors les données au lieu d'écraser le travail de l'autre).
create or replace function public.save_docs(changes jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  c   jsonb;
  cur integer;
begin
  for c in select * from jsonb_array_elements(changes) loop
    select rev into cur from public.docs
      where collection = c->>'c' and id = c->>'id'
      for update;
    if coalesce(cur, 0) <> coalesce((c->>'rev')::int, 0) then
      raise exception 'GMAO_CONFLIT %/%', c->>'c', c->>'id' using errcode = '40001';
    end if;
    if coalesce((c->>'del')::boolean, false) then
      delete from public.docs where collection = c->>'c' and id = c->>'id';
    else
      insert into public.docs (collection, id, data, rev, updated_at, updated_by)
        values (c->>'c', c->>'id', c->'data', 1, now(), auth.uid())
      on conflict (collection, id) do update
        set data = excluded.data, rev = public.docs.rev + 1, updated_at = now(), updated_by = auth.uid();
    end if;
  end loop;
end;
$$;

revoke all on function public.save_docs(jsonb) from public, anon;
grant execute on function public.save_docs(jsonb) to authenticated;

-- Mise à jour en direct : un changement fait sur un poste apparaît sur les autres.
alter table public.docs replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'docs') then
    alter publication supabase_realtime add table public.docs;
  end if;
end $$;
