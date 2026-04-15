# Estoque Pro

Aplicativo de gestão de estoque Node.js + TypeScript + Vercel.

## Estrutura do projeto

- `frontend/` - SPA em HTML/CSS/TypeScript compilado para JavaScript.
- `backend/` - API serverless Vercel em Node.js + TypeScript.
- `vercel.json` - configuração de rotas e funções.
- `tsconfig.json` - configuração TypeScript comum.

## Recursos

- Login com senha fixa `Estoque@2026` e PIN de técnico.
- Dashboard de categorias, itens críticos, busca e fluxo rápido.
- Retirada com controle de quantidade, observação e patrimônios.
- Histórico local de retiradas recentes.
- Integração com Google Sheets usando planilha existente.
- Logs de retirada gravados em `LOG_RETIRADAS`.

## Endpoints da API

- `GET /api/estoque` - retorna todos os itens do estoque.
- `POST /api/auth/login` - valida senha e PIN e gera token de sessão.
- `POST /api/auth` - alias compatível para login.
- `POST /api/retirada` - registra retirada e atualiza o estoque.
- `GET /api/tecnicos` - retorna lista de técnicos autorizados.
- `GET /api/logs` - retorna histórico de retiradas.
- `GET /api/criticos` - retorna itens com estoque abaixo ou igual ao mínimo.

## Instalação local

1. Instale o Node.js 20+
2. Acesse o diretório do projeto:

```bash
cd estoque-app
```

3. Instale dependências:

```bash
npm install
```

4. Compile o frontend TypeScript:

```bash
npm run build:frontend
```

5. Inicie o emulador Vercel (recomendado):

```bash
npm run dev
```

> O frontend será servido em `http://localhost:3000` e a API em `/api`.

## Configuração do Google Sheets API

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie ou selecione um projeto.
3. Ative a API Google Sheets.
4. Crie uma Service Account.
5. Gere uma chave JSON.
6. Copie os campos `client_email` e `private_key`.

## Compartilhar planilha

1. Abra a planilha `1FulzV2vHEAVCrmSg2jr5ozzXkqlI2cBhD0vqk4McjHY` no Google Sheets.
2. Clique em Compartilhar.
3. Adicione o `client_email` da Service Account como editor.

## Variáveis de ambiente no Vercel

Defina as seguintes variáveis:

- `GOOGLE_SHEETS_CLIENT_EMAIL`
- `GOOGLE_SHEETS_PRIVATE_KEY`
- `SPREADSHEET_ID`
- `SESSION_SECRET`

Para desenvolvimento local, crie um arquivo `.env` na raiz do `estoque-app` com esses valores.

No Vercel, vá em **Settings > Environment Variables** e adicione os valores.

## Deploy no Vercel

1. Conecte o repositório ao Vercel.
2. Garanta que `vercel.json` esteja no root.
3. Configure as variáveis de ambiente.
4. Faça deploy via Git ou pelo painel Vercel.

## Comandos úteis

- `npm run build:frontend` - compila o frontend TypeScript.
- `npm run dev` - inicia o Vercel local.
- `npm install` - instala dependências em todos os workspaces.
