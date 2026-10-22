# Jira Flow Analytics

> Plataforma em **Node.js + TypeScript + Fastify** para extração de dados do Jira Cloud e geração de métricas de fluxo de entrega (Lead Time, Cycle Time, Throughput, Aging, etc.).
> 
> 📖 **Guia Passo a Passo Detalhado**: Consulte também o [GUIA_EXECUCAO_LOCAL.md](file:///c:/Projetos/Jira%20Flow%20Analytics/rules/GUIA_EXECUCAO_LOCAL.md) na pasta `rules/` para instruções completas de configuração e resolução de problemas.

---

> [!IMPORTANT]
> ### 🐳 LEMBRETE 1: O DOCKER PRECISA ESTAR RODANDO!
> A aplicação depende de serviços de infraestrutura para funcionar:
> 1. **Redis** (porta `6379`) – Gerenciamento de filas assíncronas com **BullMQ**.
> 2. **PostgreSQL** (porta `5432`) – Persistência relacional de métricas e histórico.
>
> **Antes de rodar a aplicação**, suba os containers com:
> ```bash
> npm run docker:up
> # ou: docker compose up -d
> ```

> [!NOTE]
> ### 🖥️ LEMBRETE 2: VOCÊ PRECISA DO BACKEND E DO FRONTEND RODANDO!
> O projeto é composto por **2 serviços complementares**:
>
> | Serviço | O que é | Porta | Comando Individual |
> | :--- | :--- | :--- | :--- |
> | **Backend API** | Servidor Fastify (regras de negócio, cálculo de métricas e filas) | `http://localhost:3000` | `npm run dev` |
> | **Frontend UI** | Dashboard visual interativo com gráficos e filtros | `http://localhost:4173` | `npm run dev:ui` |
>
> 💡 **Para rodar ambos juntos com apenas 1 comando**, use:
> ```bash
> npm run dev:all
> ```
> *(Ou abra dois terminais: um rodando `npm run dev` e o outro rodando `npm run dev:ui`).*

---

## 📋 Pré-requisitos

- **Node.js**: versão `>= 22.0.0`
- **Docker Desktop**: instalado e em execução
- **Conta Atlassian (Jira Cloud)** com API Token gerado

---

## 🚀 Passo a Passo para Inicialização

### 1. Configurar variáveis de ambiente
Copie o arquivo de exemplo e preencha suas credenciais do Jira:
```bash
cp .env.example .env
```
Campos essenciais no `.env`:
- `JIRA_HOST`: URL da sua organização (ex.: `https://sua-empresa.atlassian.net`)
- `JIRA_EMAIL`: Email da sua conta Atlassian
- `JIRA_API_TOKEN`: Token gerado em [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
- `JIRA_PROJECT_KEY`: Chave do projeto no Jira (ex.: `KAN`)

### 2. Iniciar os containers de infraestrutura (Docker)
```bash
npm run docker:up
```

### 3. Instalar as dependências do Node.js
```bash
npm install
```

### 4. Iniciar a aplicação (Backend + Frontend)

#### Opção A (Recomendada - 1 comando só):
```bash
npm run dev:all
```
*Isso inicia simultaneamente a API na porta 3000 e o Dashboard na porta 4173.*

#### Opção B (Terminais separados):
- **Terminal 1 (Backend API):**
  ```bash
  npm run dev
  ```
- **Terminal 2 (Frontend Dashboard):**
  ```bash
  npm run dev:ui
  ```

### 5. Acessar o Dashboard
Abra seu navegador em:
👉 **[http://localhost:4173](http://localhost:4173)**

*(Se você abrir `http://localhost:3000`, verá as informações técnicas da API REST em formato JSON).*

---

## 🛠️ Comandos Principais (Cheatsheet)

### 🐳 Gerenciamento do Docker
| Comando | O que faz |
| :--- | :--- |
| `npm run docker:up` | Sobe o Redis e PostgreSQL em background (`docker compose up -d`) |
| `npm run docker:down` | Para e remove os containers (`docker compose down`) |
| `npm run docker:logs` | Acompanha os logs em tempo real (`docker compose logs -f`) |
| `npm run docker:ps` | Lista os containers ativos e status das portas (`docker compose ps`) |
| `npm run docker:restart` | Reinicia os containers (`docker compose restart`) |

### 💻 Desenvolvimento & Qualidade
| Comando | O que faz |
| :--- | :--- |
| `npm run dev:all` | **(Recomendado)** Inicia simultaneamente o Backend (:3000) e o Frontend (:4173) |
| `npm run dev` | Inicia somente a API Backend com hot-reload (`tsx watch`) e checagem do Docker |
| `npm run dev:ui` | Inicia somente o servidor do Frontend Dashboard (:4173) |
| `npm run dev:nodemon` | Inicia o backend via `nodemon` alternativo |
| `npm run check` | Valida tipagem TypeScript sem gerar build (`tsc --noEmit`) |
| `npm run build` | Compila o TypeScript para a pasta `dist/` |
| `npm start` | Executa o código compilado de produção |

### 🔍 Testando os Endpoints da API

#### 1. Healthcheck
```bash
# PowerShell:
Invoke-RestMethod -Uri http://localhost:3000/health

# Bash / cURL:
curl http://localhost:3000/health
```

#### 2. Visão Geral das Métricas
```bash
# PowerShell:
Invoke-RestMethod -Uri http://localhost:3000/metrics/overview

# Bash / cURL:
curl http://localhost:3000/metrics/overview
```

#### 3. Enfileirar Sincronização via BullMQ (Redis)
```bash
# PowerShell:
Invoke-RestMethod -Uri http://localhost:3000/jobs/sync -Method Post

# Bash / cURL:
curl -X POST http://localhost:3000/jobs/sync
```

#### 4. Executar Sincronização Imediata (Síncrona)
```bash
# PowerShell:
Invoke-RestMethod -Uri http://localhost:3000/jobs/sync/run-now -Method Post

# Bash / cURL:
curl -X POST http://localhost:3000/jobs/sync/run-now
```

---

## 🔎 Diagnóstico & Inspeção de Serviços

### Conectar ao Redis CLI dentro do container
```bash
docker exec -it jira-flow-analytics-redis redis-cli ping
# Resposta esperada: PONG

# Ver chaves salvas no Redis:
docker exec -it jira-flow-analytics-redis redis-cli keys "*"
```

### Conectar ao PostgreSQL dentro do container
```bash
docker exec -it jira-flow-analytics-postgres psql -U postgres -d jira_flow_analytics
```

### Testar portas de rede (Windows PowerShell)
```powershell
# Testar se o Redis está escutando na 6379:
Test-NetConnection -Port 6379 -ComputerName localhost

# Testar se o Postgres está escutando na 5432:
Test-NetConnection -Port 5432 -ComputerName localhost
```

---

## 🚨 Solução de Problemas Comuns (Troubleshooting)

### 1. `AggregateError [ECONNREFUSED]: connect ECONNREFUSED ::1:6379`
- **Causa**: O Redis não está rodando na porta 6379.
- **Solução**: 
  1. Abra o **Docker Desktop**.
  2. Execute `npm run docker:up`.

### 2. `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`
- **Causa**: O serviço do Docker Desktop está fechado ou ainda não terminou de inicializar no Windows.
- **Solução**: Abra o aplicativo **Docker Desktop** no Windows e aguarde o ícone da baleia ficar estático (verde no canto inferior).

### 3. `401 Unauthorized` ou erro de autenticação com o Jira
- **Causa**: Token de API do Jira inválido, expirado ou email incorreto no `.env`.
- **Solução**: Acesse [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens), gere um novo token e atualize `JIRA_API_TOKEN` no `.env`.

---

## 📚 Links de Documentação Úteis

| Recurso | Descrição | Link Oficial |
| :--- | :--- | :--- |
| **Atlassian Jira Cloud REST API** | Referência completa das rotas e endpoints REST do Jira | [Documentação Jira REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/) |
| **Atlassian API Tokens** | Painel de criação e revogação de tokens de autenticação | [Gerenciador de Tokens Atlassian](https://id.atlassian.com/manage-profile/security/api-tokens) |
| **Fastify Framework** | Documentação do servidor web, ciclo de vida e plugins | [Fastify Docs](https://fastify.dev/) |
| **BullMQ** | Biblioteca de mensageria e processamento de filas com Redis | [BullMQ Guide](https://docs.bullmq.io/) |
| **jira.js** | SDK TypeScript / JavaScript oficial da comunidade para Jira Cloud | [Repositório jira.js](https://github.com/MrRefactoring/jira.js) |
| **Docker Compose CLI** | Referência dos comandos de orquestração local | [Docker Compose Docs](https://docs.docker.com/compose/) |
| **PostgreSQL 16** | Documentação oficial do banco de dados relacional | [PostgreSQL Manual](https://www.postgresql.org/docs/16/) |
| **Redis** | Referência de comandos e estruturas de dados do Redis | [Redis Documentation](https://redis.io/docs/) |