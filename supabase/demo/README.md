# Base de demonstração (dados fictícios)

Gerenciadora fictícia **Nexo Engenharia** com dois clientes, 4 projetos de obra e 12 rodadas de cotação
(itens por seção, propostas de 3 a 5 proponentes, questionamentos e histórico de revisões). Nenhum dado real.

A estrutura (`co_01_estrutura.sql`) é a mesma do sistema original — tabelas, enums, RLS por organização e
papel, função de nova rodada — num schema próprio (`co`), para conviver com outros apps no mesmo projeto.

## Como subir

1. No SQL Editor, rode na ordem: `co_01_estrutura.sql`, `co_02_seed.sql`, `co_03_supabase.sql`.
2. Em **Project Settings → Data API → Exposed schemas**, adicione `co`.
3. Publique a Edge Function de upload com o prefixo do app:
   ```bash
   cp -r supabase/functions/upload-cotacao supabase/functions/co-upload-cotacao
   supabase functions deploy co-upload-cotacao --project-ref SEU-PROJETO
   supabase secrets set CO_DB_SCHEMA=co CO_STORAGE_PREFIX=co- --project-ref SEU-PROJETO
   ```
4. Usuários entram por convite: cadastre o convite e crie a conta com metadata `{"app": "co"}` —
   o gatilho cria o perfil com o papel do convite.
   ```sql
   insert into co.convites_pendentes (email, organizacao_id, papel)
   select 'seu-email@exemplo.com', id, 'admin_nexo' from co.organizacoes where nome = 'Nexo Engenharia';
   ```
5. Copie `.env.example` para `.env` e preencha URL e chave anon.

A geração do arquivo COT (`download-cot`) não faz parte deste repositório, então o botão de download
não funciona na demo.
