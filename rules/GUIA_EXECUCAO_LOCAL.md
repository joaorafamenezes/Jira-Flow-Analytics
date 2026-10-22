# 🚀 Guia Completo de Execução Local — Jira Flow Analytics

Este documento descreve detalhadamente todos os passos, pré-requisitos, configurações e comandos necessários para executar o **Jira Flow Analytics** no seu ambiente local (Windows, macOS ou Linux).

---

## 🏗️ 1. Visão Geral da Arquitetura

O projeto é dividido em **três camadas principais**:

1. **Infraestrutura em Containers (Docker)**:
   - **PostgreSQL 16** (porta `5432`): Armazenamento relacional de métricas, histórico e dados de fluxo.
   - **Redis 7** (porta `6379`): Fila de tarefas em segundo plano e mensageria assíncrona gerenciada pelo **BullMQ**.
2. **Backend API (Node.js + Fastify + TypeScript)** (porta `3000`):
   - Conexão e sincronização com Jira Cloud REST API.
   - Cálculo de métricas de fluxo (Lead Time, Cycle Time, Throughput, WIP, Aging, CFD).
   - Validações de esquema com Zod e processamento assíncrono via BullMQ.
3. **Frontend Dashboard (HTML/CSS/JS Vanilla)** (porta `4173`):
   - Servidor estático e proxy reverso local (`server.mjs`).
   - Painel interativo com gráficos de fluxo, filtros dinâmicos e abas de configuração.

---

## 📋 2. Pré-requisitos de Sistema

Antes de começar, verifique se seu sistema atende aos seguintes requisitos:

| Requisito | Versão Mínima | Como verificar no terminal | Onde instalar |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 22.0.0` | `node -v` | [nodejs.org](https://nodejs.org/) |
| **npm** | `>= 10.0.0` | `npm -v` | Incluso no instalador do Node.js |
| **Docker Desktop** | Versão atualizada | `docker --version` | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| **Git** | Qualquer versão recente | `git --version` | [git-scm.com](https://git-scm.com/) |
| **Conta Jira Cloud** | Acesso ao Jira Cloud | — | [Atlassian Jira](https://www.atlassian.com/software/jira) |

> [!IMPORTANT]
> **Atenção no Windows**: O **Docker Desktop** precisa estar com o serviço em execução (ícone da baleia verde no canto da barra de tarefas). Se o Docker Desktop estiver fechado, os comandos `docker compose` falharão com erro de conexão com o socket/pipe.

---

## 🔑 3. Obtenção do Token de API do Jira Cloud

Para que a aplicação leia os dados do Jira, você precisa gerar um token pessoal na Atlassian:

1. Acesse: **[Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)**.
2. Faça login com a conta de e-mail que possui acesso ao seu Jira.
3. Clique no botão **"Criar token de API"** (Create API token).
4. Defina um rótulo identificador (ex.: `jira-flow-local`).
5. Copie o token gerado imediatamente e guarde-o em local seguro (ele não será exibido novamente).

---

## ⚙️ 4. Passo a Passo de Instalação e Execução

### Passo 1: Acessar a pasta do projeto
Abra o terminal (PowerShell, Git Bash ou terminal Linux/macOS) na pasta raiz do projeto:
```bash
cd "c:\Projetos\Jira Flow Analytics"
```

### Passo 2: Instalar as dependências do Node.js
Instale todos os pacotes definidos no `package.json`:
```bash
npm install
```

### Passo 3: Configurar o arquivo de variáveis de ambiente (`.env`)
Se ainda não possuir o arquivo `.env`, crie uma cópia a partir do `.env.example`:

**No Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**No Linux / macOS / Bash:**
```bash
cp .env.example .env
```

Abra o arquivo `.env` no editor e configure as variáveis:

```env
# Ambiente e Servidor
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Credenciais e Projeto Jira Cloud
JIRA_HOST=https://sua-organizacao.atlassian.net
JIRA_EMAIL=seu-email@dominio.com
JIRA_API_TOKEN=seu_token_gerado_no_passo_3
JIRA_PROJECT_KEY=KAN
JIRA_DEFAULT_JQL=project = KAN ORDER BY updated DESC

# Regras de Início e Fim para Cálculo de Lead Time
LEAD_TIME_START_MODE=boardColumn
LEAD_TIME_BOARD_ID=1
LEAD_TIME_START_COLUMN_NAME=Pronto para Desenvolvimento
LEAD_TIME_END_COLUMN_NAME=Em Produção

# Infraestrutura Local (Padrão Docker Compose)
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/jira_flow_analytics
REDIS_HOST=localhost
REDIS_PORT=6379
```

> [!TIP]
> **Modo Mock (Dados Simulados)**: Se você quiser explorar o dashboard imediatamente sem configurar credenciais reais do Jira, a aplicação possui suporte integrado a dados mockados (`source=mock`). No entanto, o arquivo `.env` ainda deve possuir URLs sintaticamente válidas para passar pela validação inicial do Zod.

---

### Passo 4: Iniciar os serviços de infraestrutura (Docker)

1. Certifique-se de que o **Docker Desktop** está aberto e operacional.
2. Inicie os containers do Redis e PostgreSQL:
```bash
npm run docker:up
```
*(Ou execute diretamente: `docker compose up -d`)*

3. Confirme que os containers estão saudáveis (`Up`):
```bash
npm run docker:ps
```
Você verá dois containers ativos:
- `jira-flow-analytics-postgres` (porta `0.0.0.0:5432->5432/tcp`)
- `jira-flow-analytics-redis` (porta `0.0.0.0:6379->6379/tcp`)

---

### Passo 5: Inicializar a Aplicação

Você tem duas opções para rodar a aplicação:

#### 🌟 Opção A: Iniciar tudo com 1 comando (Recomendado)
Execute:
```bash
npm run dev:all
```
O script iniciará concorrentemente o **Backend API** e o **Frontend Dashboard**. Você verá saídas coloridas no terminal com os links de acesso.

#### 🔀 Opção B: Iniciar em terminais separados

- **Terminal 1 — Backend API:**
  ```bash
  npm run dev
  ```
  *Inicia o Fastify na porta 3000 com recarga automática (`tsx watch`). O script `predev` verifica automaticamente a conectividade com o Redis.*

- **Terminal 2 — Frontend UI:**
  ```bash
  npm run dev:ui
  ```
  *Inicia o servidor de interface e proxy na porta 4173.*

---

## 🌐 5. Acessando a Aplicação

| Interface / Serviço | URL de Acesso | O que é exibido |
| :--- | :--- | :--- |
| **Dashboard Visual (UI)** | **[http://localhost:4173](http://localhost:4173)** | Interface completa de métricas de fluxo, gráficos CFD, Lead Time, Throughput e configurações |
| **API Health Check** | **[http://localhost:3000/health](http://localhost:3000/health)** | Status operacional da API em JSON: `{"ok": true, ...}` |
| **API Raiz** | **[http://localhost:3000](http://localhost:3000)** | Resumo das rotas disponíveis |
| **Visão Geral das Métricas** | **[http://localhost:3000/metrics/overview](http://localhost:3000/metrics/overview)** | Métricas consolidadas calculadas |

---

## 🔄 6. Sincronizando Dados com o Jira

Após abrir o Dashboard em `http://localhost:4173`, você pode sincronizar os dados de duas formas:

1. **Pela Interface Web**:
   - Vá até a aba **Configurações** ou utilize o botão de sincronização no cabeçalho do Dashboard.
2. **Via Linha de Comando / Requisição HTTP**:
   - **Sincronização imediata (síncrona)**:
     ```powershell
     # PowerShell
     Invoke-RestMethod -Uri http://localhost:3000/jobs/sync/run-now -Method Post
     ```
     ```bash
     # cURL
     curl -X POST http://localhost:3000/jobs/sync/run-now
     ```
   - **Enfileiramento assíncrono (via BullMQ + Redis)**:
     ```powershell
     # PowerShell
     Invoke-RestMethod -Uri http://localhost:3000/jobs/sync -Method Post
     ```
     ```bash
     # cURL
     curl -X POST http://localhost:3000/jobs/sync
     ```

---

## 🛠️ 7. Guia Rápido de Scripts (NPM Scripts)

| Script | Comando Completo | Finalidade |
| :--- | :--- | :--- |
| `npm run dev:all` | `node scripts/dev-all.mjs` | **(Principal)** Roda Backend e Frontend simultaneamente |
| `npm run dev` | `tsx watch src/server.ts` | Roda somente a API Backend com hot-reload |
| `npm run dev:ui` | `node frontend/server.mjs` | Roda somente o servidor do Frontend Dashboard |
| `npm run check` | `tsc --noEmit -p tsconfig.json` | Checa integridade de tipos TypeScript sem gerar build |
| `npm run build` | `tsc -p tsconfig.json` | Compila o código TypeScript para a pasta `dist/` |
| `npm start` | `node dist/server.js` | Executa o build compilado de produção |
| `npm run docker:up` | `docker compose up -d` | Sobe PostgreSQL e Redis em background |
| `npm run docker:down` | `docker compose down` | Desliga e remove os containers locais |
| `npm run docker:logs` | `docker compose logs -f` | Acompanha os logs dos containers |
| `npm run docker:ps` | `docker compose ps` | Lista status dos containers e mapeamento de portas |
| `npm run docker:restart`| `docker compose restart` | Reinicia os containers do Docker |

---

## 🩺 8. Resolução de Problemas Frequentes (Troubleshooting)

### 🔴 Problema 1: `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`
- **Causa**: O Docker Desktop não foi aberto ou o serviço de virtualização (WSL2 / Hyper-V) ainda está iniciando.
- **Solução**:
  1. Abra o menu Iniciar do Windows e digite **Docker Desktop**.
  2. Aguarde até que o ícone na bandeja do sistema fique verde.
  3. Execute novamente `npm run docker:up`.

---

### 🔴 Problema 2: `AggregateError [ECONNREFUSED]: connect ECONNREFUSED ::1:6379` ou `127.0.0.1:6379`
- **Causa**: A aplicação tentou se conectar ao Redis para inicializar a fila do BullMQ, mas o container do Redis não está ativo.
- **Solução**:
  1. Suba os containers com `npm run docker:up`.
  2. Verifique se o Redis está respondendo testando a porta no PowerShell:
     ```powershell
     Test-NetConnection -Port 6379 -ComputerName localhost
     ```

---

### 🔴 Problema 3: Conflito de porta (`Port 5432 or 6379 already in use`)
- **Causa**: Você já possui uma instância local de PostgreSQL ou Redis rodando diretamente na máquina física fora do Docker.
- **Solução**:
  - Para PostgreSQL: Pause o serviço local (`services.msc` no Windows e pare o serviço `postgresql-x64`) ou altere a porta mapeada no [docker-compose.yml](file:///c:/Projetos/Jira%20Flow%20Analytics/docker-compose.yml) (ex.: `"5433:5432"`) e no `.env` (`POSTGRES_URL=postgresql://...:5433/...`).
  - Para Redis: Pare o Redis local ou altere a porta mapeada no `docker-compose.yml` e a variável `REDIS_PORT` no `.env`.

---

### 🔴 Problema 4: `401 Unauthorized` ou falhas na busca de dados do Jira
- **Causa**: Token de API do Jira incorreto, revogado, ou incompatibilidade entre o e-mail informado e a conta detentora do token.
- **Solução**:
  1. Verifique se o valor de `JIRA_HOST` contém o prefixo `https://` completo (ex.: `https://empresa.atlassian.net`).
  2. Gere um novo token em [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens) e cole em `JIRA_API_TOKEN` no `.env`.
  3. Certifique-se de que o usuário tem permissão de leitura no projeto especificado em `JIRA_PROJECT_KEY`.

---

### 🔴 Problema 5: Erro de versão do Node (`error: Node.js version >=22.0.0 required`)
- **Causa**: A versão do Node.js instalada na máquina é inferior à 22.0.0.
- **Solução**:
  - Verifique com `node -v`.
  - Atualize seu Node.js para a versão LTS ou Current recente (`>= 22.0.0`) em [nodejs.org](https://nodejs.org/) ou use o [NVM for Windows](https://github.com/coreybutler/nvm-windows):
    ```powershell
    nvm install 22.14.0
    nvm use 22.14.0
    ```
