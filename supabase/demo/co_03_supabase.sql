-- Peças do Supabase da demo (schema co): login por convite, Storage e proteções do projeto compartilhado.

-- login compartilhado: o gatilho de convite só age em contas do app (raw_user_meta_data.app = 'co')
drop trigger if exists co_on_auth_user_created on auth.users;
create trigger co_on_auth_user_created after insert on auth.users
  for each row when (new.raw_user_meta_data->>'app' = 'co') execute function co.on_auth_user_created();
revoke execute on function co.on_auth_user_created() from public, anon, authenticated;

-- ninguém remove o próprio perfil (evita trancar o admin da demo)
drop policy if exists demo_nao_exclui_a_si_mesmo on co.perfis;
create policy demo_nao_exclui_a_si_mesmo on co.perfis as restrictive for delete to authenticated using (id <> auth.uid());

-- Storage privado: só quem tem perfil no app lê e escreve
create or replace function co.tem_perfil() returns boolean
language sql stable security definer set search_path = co as $$
  select exists (select 1 from co.perfis where id = auth.uid())
$$;
grant execute on function co.tem_perfil() to authenticated;

drop policy if exists "co le arquivos" on storage.objects;
drop policy if exists "co envia arquivos" on storage.objects;
drop policy if exists "co remove arquivos" on storage.objects;
create policy "co le arquivos" on storage.objects for select to authenticated
  using (bucket_id in ('co-cotacoes', 'co-downloads', 'co-templates', 'co-uploads') and co.tem_perfil());
create policy "co envia arquivos" on storage.objects for insert to authenticated
  with check (bucket_id in ('co-cotacoes', 'co-downloads', 'co-templates', 'co-uploads') and co.user_eh_nexo(auth.uid()));
create policy "co remove arquivos" on storage.objects for delete to authenticated
  using (bucket_id in ('co-cotacoes', 'co-downloads', 'co-templates', 'co-uploads') and co.user_eh_admin(auth.uid()));

notify pgrst, 'reload schema';

-- o app só funciona logado: visitante anônimo (chave pública) não acessa tabelas nem funções
revoke all on all tables in schema co from anon;
revoke all on all sequences in schema co from anon;
revoke execute on all functions in schema co from anon, public;
alter default privileges in schema co revoke all on tables from anon;
alter default privileges in schema co revoke all on sequences from anon;
alter default privileges in schema co revoke execute on functions from anon, public;
grant execute on all functions in schema co to authenticated, service_role;
revoke execute on function co.on_auth_user_created() from authenticated;
notify pgrst, 'reload schema';
