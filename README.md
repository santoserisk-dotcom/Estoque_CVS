# Estoque CVS - PWA Offline-First

Sistema mobile-first para gestão de estoque da equipe técnica de campo com GitHub Pages + Google Apps Script + Google Sheets.

## 1) Arquitetura da solução

- **Frontend PWA (GitHub Pages)**: HTML/CSS/JS puro, Service Worker, IndexedDB e fila de sincronização offline.
- **Backend serverless (Apps Script Web App)**: valida autenticação real, regras de negócio e gravações na planilha.
- **Persistência oficial (Google Sheets)**:
  - Aba `CVS` preservada com colunas A:P.
  - Coluna D atualizada no ato da retirada.
  - Colunas F:P mantidas intactas.
  - Aba `LOG_RETIRADAS` para trilha completa e rastreabilidade.

## 2) Estrutura de pastas

```text
/
├─ index.html
├─ style.css
├─ app.js
├─ db.js
├─ sync.js
├─ auth.js
├─ ui.js
├─ sw.js
├─ manifest.json
├─ apps_script.gs
└─ README.md
```

## 3) Fluxo técnico frontend + Apps Script

1. O técnico abre o app e acessa a área de login.
2. O app chama o Web App e carrega itens da planilha para IndexedDB.
3. O técnico navega por categorias, busca ou itens recentes.
4. Ao registrar retirada, o saldo é atualizado localmente.
5. A retirada é registrada em uma fila de sincronização.
6. Se online, o app envia imediatamente ao Apps Script.
7. O Apps Script valida usuário, estoque e regras de negócio.
8. O Apps Script atualiza a coluna D e grava o registro em `LOG_RETIRADAS`.
9. Quando a conexão retorna, a fila pendente é sincronizada automaticamente.

## 4) Deploy e configuração

### Frontend (GitHub Pages)

1. Suba todos os arquivos para o repositório.
2. Ative o GitHub Pages na branch principal.
3. Abra o app no navegador.
4. Na Home, toque em **Configurar integração (URL Web App)** e cole a URL `/exec` do Apps Script.

### Backend (Google Apps Script)

1. Crie um projeto Apps Script vinculado à planilha oficial.
2. Substitua o código pelo conteúdo de `apps_script.gs`.
3. Ajuste:
   - `ALLOWED_DOMAIN`
   - `ALLOWED_EMAILS`
4. Publique o projeto como Web App:
   - Executar como: **Você**
   - Quem tem acesso: **Usuários do domínio** ou **Qualquer pessoa** conforme sua política.

### Configurar a URL do Web App

- O `sync.js` usa o placeholder padrão:
  - `https://script.google.com/macros/s/COLE_AQUI_URL_WEBAPP/exec`
- Após publicar, cole a URL real no app.

## Segurança

- A segurança real está no Apps Script via `Session.getActiveUser().getEmail()`.
- O frontend não é fonte de verdade para autorização.
- O login local melhora a experiência de usuário e permite o modo offline.

## Comportamento offline

- A primeira sincronização carrega a planilha para IndexedDB.
- Retiradas são aplicadas localmente imediatamente.
- Operações offline são mantidas em fila local.
- A fila é sincronizada automaticamente ao reconectar.
- Itens recentes e status de sincronização ficam disponíveis offline.

## Regras de negócio implementadas

- Itens patrimoniais exigem patrimônio por unidade.
- Quantidade deve ser maior que zero.
- Quantidade não pode exceder o estoque.
- Técnico é obrigatório.
- Observação é opcional.
- Estoque crítico é detectado quando `stock <= minStock`.

## Validação rápida

- Verifique se a aba `CVS` existe e inicia na linha 2.
- Confirme se a coluna D representa o saldo atual.
- Não altere fórmulas de F até P.
- A aba `LOG_RETIRADAS` será criada automaticamente se não existir.

## Observações

- Para uma autenticação Google completa, pode-se integrar o Google Identity Services.
- O Apps Script deve estar publicado para permitir retorno de `Session.getActiveUser().getEmail()`.
- O frontend está pronto para deploy no GitHub Pages.
