-- Base de DEMONSTRAÇÃO (estrutura) — schema co. Dados 100% fictícios.
-- Gerado a partir da estrutura do app original, com nomes anonimizados.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create schema if not exists co;
grant usage on schema co to anon, authenticated, service_role;
set check_function_bodies = false;
set search_path = co, public, extensions;


create type co.formato_planilha as enum ('XXX000', 'MOD006');

create type co.papel as enum ('admin_nexo', 'editor_nexo', 'viewer_cliente');

create type co.status_cotacao as enum ('rascunho', 'ativa', 'fechada', 'historico');

create type co.status_proponente as enum ('nao_entregue', 'entregue', 'declinou');

create type co.tipo_item as enum ('macro', 'secao', 'item', 'omissos', 'subitem_omissos', 'subtotal', 'total');

create type co.tipo_organizacao as enum ('gerenciadora', 'cliente');

create type co.tipo_upload as enum ('cot_inicial', 'cot_atualizado', 'por_proponente');

create sequence if not exists audit_log_id_seq;

create table audit_log (id bigint default nextval('audit_log_id_seq'::regclass) not null, cotacao_id uuid, entidade text not null, entidade_id text not null, acao text not null, campo text, valor_anterior jsonb, valor_novo jsonb, usuario_id uuid, ip_origem inet, ocorreu_em timestamp with time zone default now());

create table cadastro_dados (cotacao_id uuid not null, dados_rodadas_anteriores jsonb, short_list_ativo boolean default true, observacoes text);

create table convites_pendentes (id uuid default extensions.uuid_generate_v4() not null, email text not null, organizacao_id uuid not null, papel papel not null, convidado_por uuid, criado_em timestamp with time zone default now(), expira_em timestamp with time zone default (now() + '7 days'::interval), aceito_em timestamp with time zone);

create table cotacoes (id uuid default extensions.uuid_generate_v4() not null, projeto_id uuid not null, numero_rodada smallint not null, data_rodada date, formato formato_planilha not null, template_xlsx_path text not null, status status_cotacao default 'ativa'::status_cotacao, criado_por uuid, criada_em timestamp with time zone default now(), atualizado_em timestamp with time zone default now(), numero_pacote integer default 1 not null, numero_revisao integer default 0 not null, short_list_ativo boolean default false not null, observacoes text);

create table empresas (id uuid default extensions.uuid_generate_v4() not null, cotacao_id uuid not null, indice smallint not null, letra_id character(2), nome text not null, contato text, telefone text, email text, short_list boolean default true, com_faturamento_direto boolean default true, prazo_dias integer, observacoes text, prazo_unidade text default 'dias'::text, numero_revisao integer default 0 not null, status status_proponente default 'nao_entregue'::status_proponente not null, bdi_percentual numeric);

create table item_propostas (item_id uuid not null, empresa_id uuid not null, quantidade_proponente numeric(18,6), preco_unit_material numeric(18,6), preco_unit_mao_obra numeric(18,6), observacao_proponente text, status_analise text, atualizado_em timestamp with time zone default now(), preco_unitario numeric);

create table item_propostas_historico (id uuid default gen_random_uuid() not null, item_id uuid not null, empresa_id uuid not null, numero_revisao integer not null, quantidade_proponente numeric, preco_unit_material numeric, preco_unit_mao_obra numeric, observacao_proponente text, arquivo_path text, arquivado_em timestamp with time zone default now() not null, preco_unitario numeric);

create table itens (id uuid default extensions.uuid_generate_v4() not null, cotacao_id uuid not null, codigo_item text not null, descricao text, unidade text, quantidade_projeto numeric(18,6), parent_codigo text, nivel smallint not null, ordem integer not null, tipo tipo_item, eh_expansivel boolean default false, formula_total text, criado_em timestamp with time zone default now(), origem_omisso boolean default false not null, empresa_origem_id uuid, status_omisso text, macro text);

create table organizacoes (id uuid default extensions.uuid_generate_v4() not null, nome text not null, tipo tipo_organizacao not null, criada_em timestamp with time zone default now());

create table perfis (id uuid not null, organizacao_id uuid not null, papel papel not null, nome_completo text, email text, criado_em timestamp with time zone default now(), atualizado_em timestamp with time zone default now());

create table projetos (id uuid default extensions.uuid_generate_v4() not null, organizacao_id uuid not null, cliente_organizacao_id uuid, nome text not null, empreendedor text, empreendimento text, cidade_uf text, escopo_pa text, referencia text, disciplina text, formato_default formato_planilha default 'XXX000'::formato_planilha not null, criado_por uuid, criado_em timestamp with time zone default now(), atualizado_em timestamp with time zone default now(), codigo_projeto text);

create table questionamento_respostas (questionamento_id uuid not null, empresa_id uuid not null, resposta text, status text);

create table questionamentos (id uuid default extensions.uuid_generate_v4() not null, cotacao_id uuid not null, categoria text, numero text, pergunta text not null, ordem integer not null, criado_em timestamp with time zone default now());

create table uploads_historico (id uuid default extensions.uuid_generate_v4() not null, cotacao_id uuid not null, tipo tipo_upload not null, empresa_id uuid, arquivo_path text not null, arquivo_nome text, tamanho_bytes bigint, formato_detectado formato_planilha, resumo_processamento jsonb, upado_por uuid, upado_em timestamp with time zone default now());

alter table audit_log add constraint audit_log_pkey PRIMARY KEY (id);

alter table cadastro_dados add constraint cadastro_dados_pkey PRIMARY KEY (cotacao_id);

alter table convites_pendentes add constraint convites_pendentes_pkey PRIMARY KEY (id);

alter table cotacoes add constraint cotacoes_pkey PRIMARY KEY (id);

alter table cotacoes add constraint cotacoes_projeto_pacote_rodada_rev_key UNIQUE (projeto_id, numero_pacote, numero_rodada, numero_revisao);

alter table empresas add constraint empresas_prazo_unidade_check CHECK ((prazo_unidade = ANY (ARRAY['dias'::text, 'meses'::text])));

alter table empresas add constraint empresas_cotacao_id_indice_key UNIQUE (cotacao_id, indice);

alter table empresas add constraint empresas_pkey PRIMARY KEY (id);

alter table empresas add constraint empresas_indice_check CHECK (((indice >= 1) AND (indice <= 10)));

alter table item_propostas add constraint item_propostas_pkey PRIMARY KEY (item_id, empresa_id);

alter table item_propostas_historico add constraint item_propostas_historico_pkey PRIMARY KEY (id);

alter table itens add constraint itens_status_omisso_check CHECK ((status_omisso = ANY (ARRAY['pendente_aprovacao'::text, 'promovido'::text, 'mantido_em_omissos'::text, 'rejeitado'::text])));

alter table itens add constraint itens_pkey PRIMARY KEY (id);

alter table itens add constraint itens_cotacao_macro_codigo_ordem_key UNIQUE NULLS NOT DISTINCT (cotacao_id, macro, codigo_item, ordem);

alter table organizacoes add constraint organizacoes_pkey PRIMARY KEY (id);

alter table perfis add constraint perfis_pkey PRIMARY KEY (id);

alter table projetos add constraint projetos_pkey PRIMARY KEY (id);

alter table questionamento_respostas add constraint questionamento_respostas_pkey PRIMARY KEY (questionamento_id, empresa_id);

alter table questionamentos add constraint questionamentos_pkey PRIMARY KEY (id);

alter table uploads_historico add constraint uploads_historico_pkey PRIMARY KEY (id);

alter table audit_log add constraint audit_log_cotacao_id_fkey FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE CASCADE;

alter table audit_log add constraint audit_log_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id);

alter table cadastro_dados add constraint cadastro_dados_cotacao_id_fkey FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE CASCADE;

alter table convites_pendentes add constraint convites_pendentes_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES organizacoes(id);

alter table convites_pendentes add constraint convites_pendentes_convidado_por_fkey FOREIGN KEY (convidado_por) REFERENCES auth.users(id);

alter table cotacoes add constraint cotacoes_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id);

alter table cotacoes add constraint cotacoes_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(id) ON DELETE CASCADE;

alter table empresas add constraint empresas_cotacao_id_fkey FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE CASCADE;

alter table item_propostas add constraint item_propostas_item_id_fkey FOREIGN KEY (item_id) REFERENCES itens(id) ON DELETE CASCADE;

alter table item_propostas add constraint item_propostas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;

alter table item_propostas_historico add constraint item_propostas_historico_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;

alter table item_propostas_historico add constraint item_propostas_historico_item_id_fkey FOREIGN KEY (item_id) REFERENCES itens(id) ON DELETE CASCADE;

alter table itens add constraint itens_empresa_origem_id_fkey FOREIGN KEY (empresa_origem_id) REFERENCES empresas(id);

alter table itens add constraint itens_cotacao_id_fkey FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE CASCADE;

alter table perfis add constraint perfis_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES organizacoes(id);

alter table perfis add constraint perfis_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table projetos add constraint projetos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id);

alter table projetos add constraint projetos_cliente_organizacao_id_fkey FOREIGN KEY (cliente_organizacao_id) REFERENCES organizacoes(id);

alter table projetos add constraint projetos_organizacao_id_fkey FOREIGN KEY (organizacao_id) REFERENCES organizacoes(id);

alter table questionamento_respostas add constraint questionamento_respostas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;

alter table questionamento_respostas add constraint questionamento_respostas_questionamento_id_fkey FOREIGN KEY (questionamento_id) REFERENCES questionamentos(id) ON DELETE CASCADE;

alter table questionamentos add constraint questionamentos_cotacao_id_fkey FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE CASCADE;

alter table uploads_historico add constraint uploads_historico_upado_por_fkey FOREIGN KEY (upado_por) REFERENCES auth.users(id);

alter table uploads_historico add constraint uploads_historico_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresas(id);

alter table uploads_historico add constraint uploads_historico_cotacao_id_fkey FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION co.criar_nova_rodada(p_cotacao_origem uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'co', 'public', 'extensions'
AS $function$
declare
  v_orig co.cotacoes%rowtype;
  v_nova_id uuid;
  v_prox_rodada smallint;
begin
  select * into v_orig from co.cotacoes where id = p_cotacao_origem;
  if not found then raise exception 'Cotação origem não encontrada'; end if;

  if not exists (
    select 1 from co.projetos p
    where p.id = v_orig.projeto_id and user_eh_nexo(auth.uid()) and p.organizacao_id = get_user_org(auth.uid())
  ) then raise exception 'Sem permissão para criar rodada neste projeto'; end if;

  select coalesce(max(numero_rodada), -1) + 1 into v_prox_rodada
  from co.cotacoes where projeto_id = v_orig.projeto_id and numero_pacote = v_orig.numero_pacote;

  update co.cotacoes set status = 'historico'
  where projeto_id = v_orig.projeto_id and numero_pacote = v_orig.numero_pacote and status = 'ativa';

  insert into co.cotacoes(projeto_id, numero_pacote, numero_rodada, numero_revisao,
    data_rodada, formato, template_xlsx_path, status, criado_por, short_list_ativo, observacoes)
  values (v_orig.projeto_id, v_orig.numero_pacote, v_prox_rodada, 0,
    current_date, v_orig.formato, v_orig.template_xlsx_path, 'ativa', auth.uid(),
    v_orig.short_list_ativo, v_orig.observacoes)
  returning id into v_nova_id;

  insert into co.itens(cotacao_id, codigo_item, descricao, unidade, quantidade_projeto,
    parent_codigo, nivel, ordem, tipo, eh_expansivel, formula_total, origem_omisso, status_omisso, macro)
  select v_nova_id, codigo_item, descricao, unidade, quantidade_projeto,
    parent_codigo, nivel, ordem, tipo, eh_expansivel, formula_total, false, null, macro
  from co.itens where cotacao_id = p_cotacao_origem and origem_omisso = false;

  insert into co.empresas(cotacao_id, indice, letra_id, nome, contato, telefone, email,
    short_list, com_faturamento_direto, prazo_dias, observacoes, prazo_unidade, numero_revisao, status)
  select v_nova_id, indice, letra_id, nome, contato, telefone, email,
    short_list, com_faturamento_direto, prazo_dias, observacoes, prazo_unidade, 0,
    case when status = 'declinou' then 'declinou'::status_proponente else 'nao_entregue'::status_proponente end
  from co.empresas where cotacao_id = p_cotacao_origem;

  insert into co.questionamentos(cotacao_id, categoria, numero, pergunta, ordem)
  select v_nova_id, categoria, numero, pergunta, ordem
  from co.questionamentos where cotacao_id = p_cotacao_origem;

  return v_nova_id;
end$function$
;

CREATE OR REPLACE FUNCTION co.get_user_org(user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'co', 'public', 'extensions'
AS $function$
    select organizacao_id from perfis where id = user_id limit 1;
$function$
;

CREATE OR REPLACE FUNCTION co.get_user_papel(user_id uuid)
 RETURNS papel
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'co', 'public', 'extensions'
AS $function$
    select papel from perfis where id = user_id limit 1;
$function$
;

CREATE OR REPLACE FUNCTION co.on_auth_user_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'co', 'public', 'extensions', 'pg_catalog'
AS $function$
declare
  convite record;
begin

  select * into convite
  from co.convites_pendentes
  where lower(email) = lower(new.email)
    and aceito_em is null
    and expira_em > now()
  order by criado_em desc
  limit 1;

  if found then

    insert into co.perfis (id, organizacao_id, papel, email, nome_completo)
    values (
      new.id,
      convite.organizacao_id,
      convite.papel,
      new.email,
      coalesce(new.raw_user_meta_data->>'nome_completo', new.email)
    )
    on conflict (id) do nothing;

    delete from co.convites_pendentes
    where id = convite.id;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION co.set_atualizado_em()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'co', 'public', 'extensions'
AS $function$
begin
    new.atualizado_em = now();
    return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION co.user_eh_nexo(user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'co', 'public', 'extensions'
AS $function$
    select get_user_papel(user_id) in ('admin_nexo', 'editor_nexo');
$function$
;

CREATE OR REPLACE FUNCTION co.user_eh_admin(user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'co', 'public', 'extensions'
AS $function$
    select get_user_papel(user_id) = 'admin_nexo';
$function$
;

CREATE INDEX idx_audit_cotacao ON co.audit_log USING btree (cotacao_id, ocorreu_em DESC);

CREATE INDEX idx_audit_entidade ON co.audit_log USING btree (entidade, entidade_id);

CREATE INDEX idx_convites_email ON co.convites_pendentes USING btree (email) WHERE (aceito_em IS NULL);

CREATE INDEX idx_cotacoes_projeto ON co.cotacoes USING btree (projeto_id);

CREATE INDEX idx_cotacoes_status ON co.cotacoes USING btree (status);

CREATE INDEX idx_empresas_cotacao ON co.empresas USING btree (cotacao_id);

CREATE INDEX idx_iph_item_empresa ON co.item_propostas_historico USING btree (item_id, empresa_id, numero_revisao);

CREATE INDEX idx_itens_cotacao ON co.itens USING btree (cotacao_id);

CREATE INDEX idx_itens_ordem ON co.itens USING btree (cotacao_id, ordem);

CREATE INDEX idx_itens_parent ON co.itens USING btree (cotacao_id, parent_codigo);

CREATE INDEX idx_itens_status_omisso ON co.itens USING btree (cotacao_id, status_omisso) WHERE (status_omisso IS NOT NULL);

CREATE INDEX idx_perfis_org ON co.perfis USING btree (organizacao_id);

CREATE INDEX idx_projetos_cliente ON co.projetos USING btree (cliente_organizacao_id);

CREATE UNIQUE INDEX idx_projetos_codigo_org ON co.projetos USING btree (organizacao_id, codigo_projeto) WHERE (codigo_projeto IS NOT NULL);

CREATE INDEX idx_projetos_org ON co.projetos USING btree (organizacao_id);

CREATE INDEX idx_propostas_empresa ON co.item_propostas USING btree (empresa_id);

CREATE INDEX idx_q_cotacao ON co.questionamentos USING btree (cotacao_id);

CREATE INDEX idx_uploads_cotacao ON co.uploads_historico USING btree (cotacao_id);

CREATE TRIGGER trg_cotacoes_atualizada_em BEFORE UPDATE ON co.cotacoes FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE TRIGGER trg_item_propostas_atualizado_em BEFORE UPDATE ON co.item_propostas FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE TRIGGER trg_perfis_atualizado_em BEFORE UPDATE ON co.perfis FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE TRIGGER trg_projetos_atualizado_em BEFORE UPDATE ON co.projetos FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

alter table audit_log enable row level security;

alter table cadastro_dados enable row level security;

alter table convites_pendentes enable row level security;

alter table cotacoes enable row level security;

alter table empresas enable row level security;

alter table item_propostas enable row level security;

alter table item_propostas_historico enable row level security;

alter table itens enable row level security;

alter table organizacoes enable row level security;

alter table perfis enable row level security;

alter table projetos enable row level security;

alter table questionamento_respostas enable row level security;

alter table questionamentos enable row level security;

alter table uploads_historico enable row level security;

create policy audit_select on co.audit_log as PERMISSIVE for SELECT to public using ((cotacao_id IN ( SELECT cotacoes.id
   FROM cotacoes)));

create policy cadastro_dados_nexo_mutate on co.cadastro_dados as PERMISSIVE for ALL to public using ((user_eh_nexo(auth.uid()) AND (cotacao_id IN ( SELECT c.id
   FROM (cotacoes c
     JOIN projetos p ON ((p.id = c.projeto_id)))
  WHERE (p.organizacao_id = get_user_org(auth.uid())))))) with check ((user_eh_nexo(auth.uid()) AND (cotacao_id IN ( SELECT c.id
   FROM (cotacoes c
     JOIN projetos p ON ((p.id = c.projeto_id)))
  WHERE (p.organizacao_id = get_user_org(auth.uid()))))));

create policy cadastro_dados_select on co.cadastro_dados as PERMISSIVE for SELECT to public using ((cotacao_id IN ( SELECT cotacoes.id
   FROM cotacoes)));

create policy convites_admin_all on co.convites_pendentes as PERMISSIVE for ALL to public using (user_eh_admin(auth.uid())) with check (user_eh_admin(auth.uid()));

create policy cotacoes_nexo_mutate on co.cotacoes as PERMISSIVE for ALL to public using ((user_eh_nexo(auth.uid()) AND (projeto_id IN ( SELECT projetos.id
   FROM projetos
  WHERE (projetos.organizacao_id = get_user_org(auth.uid())))))) with check ((user_eh_nexo(auth.uid()) AND (projeto_id IN ( SELECT projetos.id
   FROM projetos
  WHERE (projetos.organizacao_id = get_user_org(auth.uid()))))));

create policy cotacoes_select on co.cotacoes as PERMISSIVE for SELECT to public using ((projeto_id IN ( SELECT projetos.id
   FROM projetos
  WHERE ((user_eh_nexo(auth.uid()) AND (projetos.organizacao_id = get_user_org(auth.uid()))) OR ((get_user_papel(auth.uid()) = 'viewer_cliente'::papel) AND (projetos.cliente_organizacao_id = get_user_org(auth.uid())))))));

create policy empresas_select on co.empresas as PERMISSIVE for SELECT to public using ((cotacao_id IN ( SELECT cotacoes.id
   FROM cotacoes)));

create policy empresas_nexo_mutate on co.empresas as PERMISSIVE for ALL to public using ((user_eh_nexo(auth.uid()) AND (cotacao_id IN ( SELECT c.id
   FROM (cotacoes c
     JOIN projetos p ON ((p.id = c.projeto_id)))
  WHERE (p.organizacao_id = get_user_org(auth.uid())))))) with check ((user_eh_nexo(auth.uid()) AND (cotacao_id IN ( SELECT c.id
   FROM (cotacoes c
     JOIN projetos p ON ((p.id = c.projeto_id)))
  WHERE (p.organizacao_id = get_user_org(auth.uid()))))));

create policy item_propostas_select on co.item_propostas as PERMISSIVE for SELECT to public using ((item_id IN ( SELECT itens.id
   FROM itens)));

create policy item_propostas_nexo_mutate on co.item_propostas as PERMISSIVE for ALL to public using ((user_eh_nexo(auth.uid()) AND (item_id IN ( SELECT i.id
   FROM ((itens i
     JOIN cotacoes c ON ((c.id = i.cotacao_id)))
     JOIN projetos p ON ((p.id = c.projeto_id)))
  WHERE (p.organizacao_id = get_user_org(auth.uid())))))) with check ((user_eh_nexo(auth.uid()) AND (item_id IN ( SELECT i.id
   FROM ((itens i
     JOIN cotacoes c ON ((c.id = i.cotacao_id)))
     JOIN projetos p ON ((p.id = c.projeto_id)))
  WHERE (p.organizacao_id = get_user_org(auth.uid()))))));

create policy iph_select on co.item_propostas_historico as PERMISSIVE for SELECT to public using ((item_id IN ( SELECT i.id
   FROM ((itens i
     JOIN cotacoes c ON ((c.id = i.cotacao_id)))
     JOIN projetos p ON ((p.id = c.projeto_id)))
  WHERE ((user_eh_nexo(auth.uid()) AND (p.organizacao_id = get_user_org(auth.uid()))) OR ((get_user_papel(auth.uid()) = 'viewer_cliente'::papel) AND (p.cliente_organizacao_id = get_user_org(auth.uid())))))));

create policy itens_select on co.itens as PERMISSIVE for SELECT to public using ((cotacao_id IN ( SELECT cotacoes.id
   FROM cotacoes)));

create policy itens_nexo_mutate on co.itens as PERMISSIVE for ALL to public using ((user_eh_nexo(auth.uid()) AND (cotacao_id IN ( SELECT c.id
   FROM (cotacoes c
     JOIN projetos p ON ((p.id = c.projeto_id)))
  WHERE (p.organizacao_id = get_user_org(auth.uid())))))) with check ((user_eh_nexo(auth.uid()) AND (cotacao_id IN ( SELECT c.id
   FROM (cotacoes c
     JOIN projetos p ON ((p.id = c.projeto_id)))
  WHERE (p.organizacao_id = get_user_org(auth.uid()))))));

create policy org_admin_all on co.organizacoes as PERMISSIVE for ALL to public using (user_eh_admin(auth.uid())) with check (user_eh_admin(auth.uid()));

create policy org_select on co.organizacoes as PERMISSIVE for SELECT to public using (((id = get_user_org(auth.uid())) OR (id IN ( SELECT projetos.cliente_organizacao_id
   FROM projetos
  WHERE (projetos.organizacao_id = get_user_org(auth.uid())))) OR (id IN ( SELECT projetos.organizacao_id
   FROM projetos
  WHERE (projetos.cliente_organizacao_id = get_user_org(auth.uid()))))));

create policy perfis_admin_all on co.perfis as PERMISSIVE for ALL to public using (user_eh_admin(auth.uid())) with check (user_eh_admin(auth.uid()));

create policy perfis_select_minha_org on co.perfis as PERMISSIVE for SELECT to public using ((organizacao_id = get_user_org(auth.uid())));

create policy projetos_admin_delete on co.projetos as PERMISSIVE for DELETE to public using ((user_eh_admin(auth.uid()) AND (organizacao_id = get_user_org(auth.uid()))));

create policy projetos_select on co.projetos as PERMISSIVE for SELECT to public using (((user_eh_nexo(auth.uid()) AND (organizacao_id = get_user_org(auth.uid()))) OR ((get_user_papel(auth.uid()) = 'viewer_cliente'::papel) AND (cliente_organizacao_id = get_user_org(auth.uid())))));

create policy projetos_nexo_update on co.projetos as PERMISSIVE for UPDATE to public using ((user_eh_nexo(auth.uid()) AND (organizacao_id = get_user_org(auth.uid())))) with check ((user_eh_nexo(auth.uid()) AND (organizacao_id = get_user_org(auth.uid()))));

create policy projetos_nexo_insert on co.projetos as PERMISSIVE for INSERT to public with check ((user_eh_nexo(auth.uid()) AND (organizacao_id = get_user_org(auth.uid()))));

create policy q_respostas_nexo_mutate on co.questionamento_respostas as PERMISSIVE for ALL to public using ((user_eh_nexo(auth.uid()) AND (questionamento_id IN ( SELECT q.id
   FROM ((questionamentos q
     JOIN cotacoes c ON ((c.id = q.cotacao_id)))
     JOIN projetos p ON ((p.id = c.projeto_id)))
  WHERE (p.organizacao_id = get_user_org(auth.uid())))))) with check ((user_eh_nexo(auth.uid()) AND (questionamento_id IN ( SELECT q.id
   FROM ((questionamentos q
     JOIN cotacoes c ON ((c.id = q.cotacao_id)))
     JOIN projetos p ON ((p.id = c.projeto_id)))
  WHERE (p.organizacao_id = get_user_org(auth.uid()))))));

create policy q_respostas_select on co.questionamento_respostas as PERMISSIVE for SELECT to public using ((questionamento_id IN ( SELECT questionamentos.id
   FROM questionamentos)));

create policy questionamentos_nexo_mutate on co.questionamentos as PERMISSIVE for ALL to public using ((user_eh_nexo(auth.uid()) AND (cotacao_id IN ( SELECT c.id
   FROM (cotacoes c
     JOIN projetos p ON ((p.id = c.projeto_id)))
  WHERE (p.organizacao_id = get_user_org(auth.uid())))))) with check ((user_eh_nexo(auth.uid()) AND (cotacao_id IN ( SELECT c.id
   FROM (cotacoes c
     JOIN projetos p ON ((p.id = c.projeto_id)))
  WHERE (p.organizacao_id = get_user_org(auth.uid()))))));

create policy questionamentos_select on co.questionamentos as PERMISSIVE for SELECT to public using ((cotacao_id IN ( SELECT cotacoes.id
   FROM cotacoes)));

create policy uploads_historico_select on co.uploads_historico as PERMISSIVE for SELECT to public using ((cotacao_id IN ( SELECT cotacoes.id
   FROM cotacoes)));

create policy uploads_historico_nexo_mutate on co.uploads_historico as PERMISSIVE for ALL to public using ((user_eh_nexo(auth.uid()) AND (cotacao_id IN ( SELECT c.id
   FROM (cotacoes c
     JOIN projetos p ON ((p.id = c.projeto_id)))
  WHERE (p.organizacao_id = get_user_org(auth.uid())))))) with check ((user_eh_nexo(auth.uid()) AND (cotacao_id IN ( SELECT c.id
   FROM (cotacoes c
     JOIN projetos p ON ((p.id = c.projeto_id)))
  WHERE (p.organizacao_id = get_user_org(auth.uid()))))));


-- ===================== peças do Supabase
grant select, insert, update, delete on all tables in schema co to anon, authenticated, service_role;
grant usage, select on all sequences in schema co to anon, authenticated, service_role;
grant execute on all functions in schema co to anon, authenticated, service_role;
alter default privileges in schema co grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema co grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema co grant execute on functions to anon, authenticated, service_role;


insert into storage.buckets (id, name, public) values ('co-cotacoes', 'co-cotacoes', false) on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('co-downloads', 'co-downloads', false) on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('co-templates', 'co-templates', false) on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('co-uploads', 'co-uploads', false) on conflict (id) do nothing;
