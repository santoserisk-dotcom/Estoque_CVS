# Estoque Pro - Sistema de Gestão de Estoque

Sistema de gestão de estoque com frontend independente (HTML/CSS/JS) hospedado na Vercel e backend rodando no Google Apps Script integrado ao Google Sheets.

## ✨ Funcionalidades

- Controle de estoque em tempo real
- Login seguro com senha da equipe + PIN do técnico
- Retirada de itens com registro de patrimônio (quando aplicável)
- Busca rápida por itens
- Lista de itens críticos (estoque abaixo do mínimo)
- Histórico local de retiradas recentes
- Cache local do estoque (5 minutos) para melhor performance
- Layout responsivo (mobile-first)

## 🏗️ Arquitetura

| Camada       | Tecnologia                          | Hospedagem                     |
|--------------|-------------------------------------|--------------------------------|
| Frontend     | HTML, CSS, JavaScript puro          | Vercel (via GitHub)            |
| Backend API  | Google Apps Script (doGet/doPost)   | Google Scripts (Web App)       |
| Banco de Dados | Google Sheets                      | Google Drive                   |

## 🚀 Deploy

### Backend (Google Apps Script)

1. Abra o [Google Apps Script](https://script.google.com/).
2. Crie um novo projeto e cole o código do `apps_script.gs`.
3. Substitua `SPREADSHEET_ID` pelo ID da sua planilha.
4. Publique como **Web App**:
   - **Execute as:** `Me`
   - **Quem tem acesso:** `Anyone` (qualquer pessoa)
5. Copie a URL gerada (ex: `https://script.google.com/macros/s/.../exec`).

### Frontend (Vercel)

1. Faça o fork ou clone deste repositório.
2. Conecte o repositório à [Vercel](https://vercel.com).
3. Adicione a variável de ambiente `API_URL` com a URL do Web App do Google Script.
4. Faça o deploy – a Vercel detectará automaticamente os arquivos estáticos.

A cada `git push` na branch `main`, a Vercel fará um novo deploy automático.

## 💻 Desenvolvimento Local

### Pré-requisitos
- Node.js (para o proxy CORS)
- Navegador (Chrome recomendado)

### Passo a passo

1. **Clone o repositório**
   ```bash
   git clone https://github.com/seu-usuario/Estoque_CVS.git
   cd estoque-app
   ```

2. **Configure a API_URL**  

    Edite o arquivo app.html e   altere a constante API_URL para a URL do seu Web App (Google Script).

    Se ainda não tiver o backe  nd publicado, use uma URL dummy temporária.


    ```bash
    npx cors-anywhere --port 3001
    O proxy vai rodar em http://localhost:3001.
    ```
    
    ## Inicie o servidor estático (live-server)

        ```bash
        npx live-server
        O frontend estará disponível em http://127.0.0.1:8080.
        ```

# 📁 Estrutura do Projeto

    Estoque_CSV/
    ├── index.html          # Estrutura HTML (telas)
    ├── style.html          # CSS (estilos responsivos)
    ├── app.html            # JavaScript (lógica, API, cache)
    ├── apps_script.gs      # Backend Google Apps Script
    ├── vercel.json         # Configuração de deploy na Vercel
    └── README.md           # Este arquivo