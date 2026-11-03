-- =====================================================================
--  TriFlow — droits et journal
--  À coller UNE FOIS dans Supabase : SQL Editor › New query › Run.
--  Peut être relancé sans risque.
--
--  1. Seuls les CADRES peuvent supprimer définitivement une fiche.
--     Un cadre = une personne du groupe « Cadres » (repris du Planning Tridel)
--     dont le nom de famille se trouve dans son adresse e-mail
--     (thomas.bonnant@… → BONNANT).
--     Les autres peuvent toujours archiver, retirer une case du planning,
--     et annuler leur propre création du jour.
--  2. Journal : la base garde l'ancienne version de chaque fiche modifiée
--     ou supprimée, avec l'adresse de la personne. Personne ne peut le
--     modifier depuis le site ; seuls les cadres peuvent le lire.
-- =====================================================================

-- Lettres seules, sans accents ni majuscules (« Wüthrich » → « wuthrich »)
create or replace function public.tf_lettres(x text) returns text
language sql immutable as $$
  select regexp_replace(translate(lower(coalesce(x, '')),
    'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'), '[^a-z]', '', 'g');
$$;

-- La personne connectée est-elle cadre ?
create or replace function public.is_cadre() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.docs
    where collection = 'personnes'
      and data->>'groupe' = 'Cadres'
      and coalesce(data->>'actif', 'true') <> 'false'
      and data->>'arch' is null
      and length(public.tf_lettres(data->>'nom')) >= 4
      and position(public.tf_lettres(data->>'nom')
                   in public.tf_lettres(split_part(coalesce(auth.jwt()->>'email', ''), '@', 1))) > 0
  );
$$;
revoke all on function public.is_cadre() from public, anon;
grant execute on function public.is_cadre() to authenticated;

-- Suppression : cadres ; planning pour tous ; sa propre fiche modifiée il y a moins d'un jour (bouton « Annuler »)
drop policy if exists "gmao_suppression" on public.docs;
create policy "gmao_suppression" on public.docs for delete to authenticated
  using (
    collection <> 'journal' and (public.is_cadre()
    or collection = 'plan'
    or (updated_by = auth.uid() and updated_at > now() - interval '1 day'))
  );

-- Journal des modifications (tenu par la base, non falsifiable depuis le site)
create table if not exists public.docs_journal (
  n           bigserial   primary key,
  at          timestamptz not null default now(),
  par         text,                 -- adresse e-mail
  par_uid     uuid,
  op          text        not null, -- UPDATE ou DELETE
  collection  text        not null,
  id          text        not null,
  avant       jsonb                 -- version d'avant
);
create index if not exists docs_journal_doc on public.docs_journal (collection, id, at desc);
alter table public.docs_journal enable row level security;
drop policy if exists "journal_lecture_cadres" on public.docs_journal;
create policy "journal_lecture_cadres" on public.docs_journal for select to authenticated using (public.is_cadre());
revoke all on public.docs_journal from anon, authenticated;
grant select on public.docs_journal to authenticated;

create or replace function public.tf_journal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.docs_journal (par, par_uid, op, collection, id, avant)
  values (auth.jwt()->>'email', auth.uid(), tg_op, old.collection, old.id, old.data);
  -- garde 1 an d'historique
  if random() < 0.002 then
    delete from public.docs_journal where at < now() - interval '1 year';
  end if;
  return null;
end;
$$;

drop trigger if exists tf_journal on public.docs;
create trigger tf_journal after update or delete on public.docs
  for each row when (old.collection <> 'journal') execute function public.tf_journal();

-- L'historique lisible de l'application (collection « journal ») ne peut être ni modifié par d'autres, ni effacé
drop policy if exists "gmao_modif" on public.docs;
create policy "gmao_modif" on public.docs for update to authenticated
  using (collection <> 'journal' or updated_by = auth.uid()) with check (true);
