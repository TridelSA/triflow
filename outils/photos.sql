-- =====================================================================
--  TriFlow — photos des pièces et des rapports
--  À coller UNE FOIS dans Supabase : SQL Editor › New query › Run.
--  Crée un seau privé « photos » : seules les personnes connectées
--  peuvent voir et ajouter des photos ; seuls les cadres peuvent en effacer.
--  (Nécessite outils/droits.sql pour la fonction is_cadre.)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "photos_lecture" on storage.objects;
create policy "photos_lecture" on storage.objects for select to authenticated using (bucket_id = 'photos');

drop policy if exists "photos_ajout" on storage.objects;
create policy "photos_ajout" on storage.objects for insert to authenticated with check (bucket_id = 'photos');

drop policy if exists "photos_effacement" on storage.objects;
create policy "photos_effacement" on storage.objects for delete to authenticated using (bucket_id = 'photos' and public.is_cadre());
