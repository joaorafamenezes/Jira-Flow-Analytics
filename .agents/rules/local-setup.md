# 🚀 Guia de Execução Local — Jira Flow Analytics

Este documento define os procedimentos, comandos e diretrizes para execução local do **Jira Flow Analytics**.

---

## 🏗️ 1. Arquitetura Local

1. **Infraestrutura em Containers (Docker)**:
   - **PostgreSQL 16** (porta `5432`): Persistência de métricas e histórico.
   - **Redis 7** (porta `6379`): Fila de tarefas em segundo plano gerenciada pelo **BullMQ**.
2. **Backend API (Node.js + Fastify + TypeScript)** (porta `3000`):
   - Conexão e sincronização com Jira Cloud REST API.
   - Cálculo de métricas de fluxo (Lead Time, Cycle Time, Throughput, WIP, Aging, CFD).
   - Validações com Zod e filas BullMQ.
3. **Frontend Dashboard (HTML/CSS/JS Vanilla)** (porta `4173`):
   - Servidor estático e proxy reverso local (`frontend/server.mjs`).
   - Painel interativo com gráficos e filtros.

---

## 📋 2. Pré-requisitos

- **Node.js**: `>= 22.0.0`
- **npm**: `>= 10.0.0`
- **Docker Desktop**: Em execução no Windows / host
- **Conta Jira Cloud**: API Token gerado em [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)

---

## ⚙️ 3. Passos para Execução

1. **Instalar dependências**:
   ```bash
   npm install
   ```

2. **Configurar variáveis (`.env`)**:
   - `JIRA_HOST`: `https://<org>.atlassian.net`
   - `JIRA_EMAIL`: E-mail Atlassian
   - `JIRA_API_TOKEN`: Token pessoal da Atlassian
   - `JIRA_PROJECT_KEY`: Chave do projeto Jira
   - `POSTGRES_URL`: `postgresql://postgres:postgres@localhost:5432/jira_flow_analytics`
   - `REDIS_HOST`: `localhost`
   - `REDIS_PORT`: `6379`

3. **Subir infraestrutura Docker**:
   ```bash
   npm run docker:up
   ```

4. **Executar a aplicação**:
   - Recomendado (Backend + Frontend juntos):
     ```bash
     npm run dev:all
     ```
   - Ou em terminais separados:
     - Terminal 1: `npm run dev` (API Fastify na porta 3000)
     - Terminal 2: `npm run dev:ui` (Frontend na porta 4173)

---

## 🌐 4. URLs e Endpoints

- **Dashboard UI**: `http://localhost:4173`
- **API Backend**: `http://localhost:3000`
- **Health Check**: `http://localhost:3000/health`
- **Disparar Sync imediato**: `POST http://localhost:3000/jobs/sync/run-now`
- **Enfileirar Sync (BullMQ)**: `POST http://localhost:3000/jobs/sync`

---

## 🩺 5. Troubleshooting Rápido

- **Docker não responde (`npipe...`)**: Abra o aplicativo Docker Desktop e aguarde o status verde.
- **Erro de conexão Redis (`ECONNREFUSED :6379`)**: Execute `npm run docker:up`.
- **Porta 5432 ou 6379 ocupada**: Verifique se há PostgreSQL ou Redis rodando localmente na máquina física.
- **401 Unauthorized**: Verifique as credenciais no `.env` e gere novo token no Jira.
