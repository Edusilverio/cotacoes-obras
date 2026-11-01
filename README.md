# Nexo Cotações Pro

Sistema interno de gestão de cotações de obras para a empresa Nexo, nome nexo-cotações

Será um app web com:

- Login via email/senha (Supabase Auth)

- Lista de projetos de obra

- Para cada projeto, listagem de rodadas de cotação

- Upload de planilhas Excel (.xlsx) que sobrescrevem a cotação atual

- Edição das abas Cadastro, Propostas Originais e Questionamentos

- Download da cotação em .xlsx

Identidade visual:

- Layout limpo, profissional, com sidebar à esquerda

- Cor primária: azul escuro corporativo (#1E3A5F)

- Tipografia: Inter

- Use shadcn/ui para os componentes

Não conecte ao Lovable Cloud. Eu vou configurar manualmente uma instância 

Supabase externa em seguida.

Por agora, comece criando apenas:

- Página de login (email + senha)

- Layout principal com sidebar (Projetos, Configurações, Sair)

- Página de "Projetos" com tabela vazia (sem queries ainda)

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://placehold.co/1200x630?text=Nexo+Engenharia

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

---

> **Nota:** projeto adaptado de um trabalho profissional para fins de portfólio. Nomes de clientes, credenciais e dados foram substituídos por valores fictícios.
