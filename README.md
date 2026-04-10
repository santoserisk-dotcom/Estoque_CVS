# Estoque CVS - PWA Offline-First

Sistema mobile-first para gestão de estoque da equipe técnica de campo com GitHub Pages + Google Apps Script + Google Sheets.

## 1) Arquitetura da solução

- **Frontend PWA (GitHub Pages)**: HTML/CSS/JS puro, Service Worker para cache, IndexedDB para dados e fila offline.
- **Backend serverless (Apps Script Web App)**: valida autenticação real, regras de negócio e gravações na planilha.
- **Persistência oficial (Google Sheets)**:
  - Aba `CVS` preservada com colunas A:P.
  - Coluna D atualizada no ato da retirada.
  - Colunas F:P não são editadas pelo sistema.
  - Aba `LOG_RETIRADAS` para trilha completa.

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

## 3) Fluxo técnico (frontend + Apps Script)

1. Usuário entra com Google (frontend para UX).
2. App faz carga completa da planilha e salva em IndexedDB.
3. Técnico realiza retirada em poucos toques.
4. Saldo é reduzido **imediatamente local** e inserido na fila.
5. Se online, envio instantâneo ao Apps Script.
6. Apps Script valida usuário, estoque e regras.
7. Apps Script grava retirada na `LOG_RETIRADAS` e atualiza coluna D.
8. Se offline, fila fica pendente e sincroniza no retorno da conexão.

## 4) Deploy rápido

### Frontend (GitHub Pages)

1. Suba os arquivos no repositório.
2. Ative GitHub Pages apontando para branch principal.
3. Ao abrir o app, use **Configurar integração (URL Web App)** na Home e cole a URL `/exec` do Apps Script.

### Backend (Apps Script)

1. Crie projeto Apps Script vinculado à planilha oficial.
2. Cole `apps_script.gs`.
3. Ajuste:
   - `ALLOWED_DOMAIN`
   - `ALLOWED_EMAILS`
4. Publique como Web App:
   - Executar como: **Você**
   - Quem tem acesso: **Usuários do domínio** (ou conforme sua política)

## Segurança

- Segurança efetiva está no Apps Script via `Session.getActiveUser().getEmail()`.
- Frontend **não** é fonte de verdade para autorização.
- O token no frontend é apenas suporte de UX/integração.

## Como saber se sincronizou com sucesso

Na tela Home, o card **Status da sincronização** mostra:
- data/hora da última sync
- quantidade na fila pendente
- resultado da última tentativa

Se categorias não aparecerem:
1. Verifique se a URL do Web App foi configurada.
2. Confirme se o usuário logado está permitido por domínio/whitelist no Apps Script.
3. Execute o botão **Sincronizar agora**.
4. Valide se a aba `CVS` possui linhas a partir da linha 2 e categoria preenchida.

## Regras de negócio atendidas

- Validação de quantidade > 0.
- Bloqueio de retirada maior que saldo.
- Técnico obrigatório.
- Patrimônio obrigatório para item patrimonial (1:1 com quantidade).
- Observação opcional.
- Estoque crítico com base em `stock <= minStock`.

## Próximos passos recomendados

- Integrar Google Identity Services real no `auth.js`.
- Adicionar telemetria e auditoria por tentativa inválida.
- Implementar paginação/filtros avançados para bases maiores.
