export type MockResolvedIssue = {
  key: string;
  summary: string;
  issueType: 'Story' | 'Task' | 'Bug' | 'Spike';
  status: 'Done';
  resolvedAt: string;
  assignee: string;
  squad: 'Core' | 'Growth' | 'Platform';
  priority: 'Low' | 'Medium' | 'High';
  labels: string[];
};

export const mockResolvedIssues: MockResolvedIssue[] = [
  { key: 'KAN-101', summary: 'Estruturar backlog inicial do produto', issueType: 'Story', status: 'Done', resolvedAt: '2026-01-05T10:00:00.000Z', assignee: 'Joao', squad: 'Core', priority: 'High', labels: ['discovery', 'backlog'] },
  { key: 'KAN-102', summary: 'Criar pipeline inicial de CI', issueType: 'Task', status: 'Done', resolvedAt: '2026-01-09T10:00:00.000Z', assignee: 'Ana', squad: 'Platform', priority: 'Medium', labels: ['devops'] },
  { key: 'KAN-103', summary: 'Corrigir erro de autenticação no Jira', issueType: 'Bug', status: 'Done', resolvedAt: '2026-01-14T10:00:00.000Z', assignee: 'Carlos', squad: 'Core', priority: 'High', labels: ['jira', 'auth'] },
  { key: 'KAN-104', summary: 'Prototipar tela de overview', issueType: 'Spike', status: 'Done', resolvedAt: '2026-01-22T10:00:00.000Z', assignee: 'Marina', squad: 'Growth', priority: 'Low', labels: ['ux', 'prototype'] },
  { key: 'KAN-105', summary: 'Implementar rota health', issueType: 'Task', status: 'Done', resolvedAt: '2026-01-28T10:00:00.000Z', assignee: 'Joao', squad: 'Platform', priority: 'Low', labels: ['api'] },
  { key: 'KAN-106', summary: 'Criar contrato inicial da API', issueType: 'Story', status: 'Done', resolvedAt: '2026-01-30T10:00:00.000Z', assignee: 'Ana', squad: 'Core', priority: 'Medium', labels: ['api', 'contract'] },

  { key: 'KAN-107', summary: 'Criar endpoint de métricas iniciais', issueType: 'Story', status: 'Done', resolvedAt: '2026-02-03T10:00:00.000Z', assignee: 'Joao', squad: 'Core', priority: 'High', labels: ['metrics'] },
  { key: 'KAN-108', summary: 'Ajustar paginação de busca no Jira', issueType: 'Task', status: 'Done', resolvedAt: '2026-02-07T10:00:00.000Z', assignee: 'Ana', squad: 'Platform', priority: 'Medium', labels: ['jira', 'pagination'] },
  { key: 'KAN-109', summary: 'Corrigir parse de datas UTC', issueType: 'Bug', status: 'Done', resolvedAt: '2026-02-12T10:00:00.000Z', assignee: 'Carlos', squad: 'Core', priority: 'High', labels: ['timezone'] },
  { key: 'KAN-110', summary: 'Documentar configuração local', issueType: 'Task', status: 'Done', resolvedAt: '2026-02-18T10:00:00.000Z', assignee: 'Marina', squad: 'Growth', priority: 'Low', labels: ['docs'] },
  { key: 'KAN-111', summary: 'Refinar modelo de throughput', issueType: 'Spike', status: 'Done', resolvedAt: '2026-02-25T10:00:00.000Z', assignee: 'Joao', squad: 'Core', priority: 'Medium', labels: ['throughput', 'analytics'] },
  { key: 'KAN-112', summary: 'Adicionar métricas por squad', issueType: 'Story', status: 'Done', resolvedAt: '2026-02-27T10:00:00.000Z', assignee: 'Marina', squad: 'Growth', priority: 'Medium', labels: ['squad', 'metrics'] },

  { key: 'KAN-113', summary: 'Adicionar suporte a filtros por squad', issueType: 'Story', status: 'Done', resolvedAt: '2026-03-02T10:00:00.000Z', assignee: 'Ana', squad: 'Growth', priority: 'Medium', labels: ['filters'] },
  { key: 'KAN-114', summary: 'Configurar logs estruturados', issueType: 'Task', status: 'Done', resolvedAt: '2026-03-06T10:00:00.000Z', assignee: 'Carlos', squad: 'Platform', priority: 'Low', labels: ['observability'] },
  { key: 'KAN-115', summary: 'Corrigir bug no bucket semanal', issueType: 'Bug', status: 'Done', resolvedAt: '2026-03-11T10:00:00.000Z', assignee: 'Joao', squad: 'Core', priority: 'High', labels: ['weekly', 'throughput'] },
  { key: 'KAN-116', summary: 'Explorar indicadores de aging', issueType: 'Spike', status: 'Done', resolvedAt: '2026-03-17T10:00:00.000Z', assignee: 'Marina', squad: 'Growth', priority: 'Medium', labels: ['aging'] },
  { key: 'KAN-117', summary: 'Criar rota de sync manual', issueType: 'Task', status: 'Done', resolvedAt: '2026-03-24T10:00:00.000Z', assignee: 'Ana', squad: 'Platform', priority: 'Medium', labels: ['sync'] },
  { key: 'KAN-118', summary: 'Estabilizar endpoint overview', issueType: 'Story', status: 'Done', resolvedAt: '2026-03-29T10:00:00.000Z', assignee: 'Joao', squad: 'Core', priority: 'High', labels: ['overview'] },
  { key: 'KAN-119', summary: 'Ajustar ranking de prioridades', issueType: 'Task', status: 'Done', resolvedAt: '2026-03-31T10:00:00.000Z', assignee: 'Carlos', squad: 'Platform', priority: 'Low', labels: ['priority'] },

  { key: 'KAN-120', summary: 'Criar consulta de issues resolvidas', issueType: 'Task', status: 'Done', resolvedAt: '2026-04-03T10:00:00.000Z', assignee: 'Carlos', squad: 'Core', priority: 'Medium', labels: ['jira', 'search'] },
  { key: 'KAN-121', summary: 'Ajustar retorno para frontend', issueType: 'Story', status: 'Done', resolvedAt: '2026-04-08T10:00:00.000Z', assignee: 'Marina', squad: 'Growth', priority: 'Medium', labels: ['frontend', 'api'] },
  { key: 'KAN-122', summary: 'Corrigir erro em query parameter', issueType: 'Bug', status: 'Done', resolvedAt: '2026-04-12T10:00:00.000Z', assignee: 'Joao', squad: 'Core', priority: 'High', labels: ['querystring'] },
  { key: 'KAN-123', summary: 'Avaliar modelo hexagonal', issueType: 'Spike', status: 'Done', resolvedAt: '2026-04-20T10:00:00.000Z', assignee: 'Ana', squad: 'Platform', priority: 'Low', labels: ['architecture'] },
  { key: 'KAN-124', summary: 'Criar mock de throughput', issueType: 'Story', status: 'Done', resolvedAt: '2026-04-28T10:00:00.000Z', assignee: 'Joao', squad: 'Core', priority: 'High', labels: ['mock', 'throughput'] },
  { key: 'KAN-125', summary: 'Montar série semanal de abril', issueType: 'Task', status: 'Done', resolvedAt: '2026-04-30T10:00:00.000Z', assignee: 'Marina', squad: 'Growth', priority: 'Low', labels: ['weekly'] },

  { key: 'KAN-126', summary: 'Ajustar série mensal do gráfico', issueType: 'Task', status: 'Done', resolvedAt: '2026-05-03T10:00:00.000Z', assignee: 'Marina', squad: 'Growth', priority: 'Low', labels: ['chart'] },
  { key: 'KAN-127', summary: 'Criar teste do endpoint throughput', issueType: 'Task', status: 'Done', resolvedAt: '2026-05-05T10:00:00.000Z', assignee: 'Ana', squad: 'Platform', priority: 'Medium', labels: ['test'] },
  { key: 'KAN-128', summary: 'Corrigir duplicidade de itens resolvidos', issueType: 'Bug', status: 'Done', resolvedAt: '2026-05-08T10:00:00.000Z', assignee: 'Carlos', squad: 'Core', priority: 'High', labels: ['dedupe'] },
  { key: 'KAN-129', summary: 'Implementar agregação mensal', issueType: 'Story', status: 'Done', resolvedAt: '2026-05-11T10:00:00.000Z', assignee: 'Joao', squad: 'Core', priority: 'High', labels: ['aggregation'] },
  { key: 'KAN-130', summary: 'Organizar labels de produto', issueType: 'Task', status: 'Done', resolvedAt: '2026-05-14T10:00:00.000Z', assignee: 'Marina', squad: 'Growth', priority: 'Low', labels: ['labels'] },
  { key: 'KAN-131', summary: 'Corrigir data de corte do período', issueType: 'Bug', status: 'Done', resolvedAt: '2026-05-17T10:00:00.000Z', assignee: 'Ana', squad: 'Platform', priority: 'High', labels: ['date-range'] },
  { key: 'KAN-132', summary: 'Adicionar endpoint para drill-down', issueType: 'Story', status: 'Done', resolvedAt: '2026-05-20T10:00:00.000Z', assignee: 'Joao', squad: 'Core', priority: 'Medium', labels: ['drilldown'] },
  { key: 'KAN-133', summary: 'Revisar payload de resposta', issueType: 'Task', status: 'Done', resolvedAt: '2026-05-22T10:00:00.000Z', assignee: 'Carlos', squad: 'Core', priority: 'Low', labels: ['payload'] },
  { key: 'KAN-134', summary: 'Investigar benchmark de throughput', issueType: 'Spike', status: 'Done', resolvedAt: '2026-05-26T10:00:00.000Z', assignee: 'Marina', squad: 'Growth', priority: 'Medium', labels: ['benchmark'] },
  { key: 'KAN-135', summary: 'Padronizar nomenclatura de métricas', issueType: 'Task', status: 'Done', resolvedAt: '2026-05-29T10:00:00.000Z', assignee: 'Joao', squad: 'Core', priority: 'Low', labels: ['metrics'] },
  { key: 'KAN-136', summary: 'Ajustar mock para relatório executivo', issueType: 'Story', status: 'Done', resolvedAt: '2026-05-31T10:00:00.000Z', assignee: 'Ana', squad: 'Growth', priority: 'Medium', labels: ['executive'] },

  { key: 'KAN-137', summary: 'Criar comparação mensal', issueType: 'Story', status: 'Done', resolvedAt: '2026-06-02T10:00:00.000Z', assignee: 'Ana', squad: 'Growth', priority: 'Medium', labels: ['comparison'] },
  { key: 'KAN-138', summary: 'Ajustar rota para month', issueType: 'Task', status: 'Done', resolvedAt: '2026-06-07T10:00:00.000Z', assignee: 'Joao', squad: 'Core', priority: 'Medium', labels: ['month'] },
  { key: 'KAN-139', summary: 'Corrigir serialização do response', issueType: 'Bug', status: 'Done', resolvedAt: '2026-06-11T10:00:00.000Z', assignee: 'Carlos', squad: 'Platform', priority: 'High', labels: ['serialization'] },
  { key: 'KAN-140', summary: 'Documentar métricas de entrega', issueType: 'Task', status: 'Done', resolvedAt: '2026-06-16T10:00:00.000Z', assignee: 'Marina', squad: 'Growth', priority: 'Low', labels: ['docs', 'delivery'] },
  { key: 'KAN-141', summary: 'Refinar consultas para dashboard', issueType: 'Story', status: 'Done', resolvedAt: '2026-06-21T10:00:00.000Z', assignee: 'Joao', squad: 'Core', priority: 'High', labels: ['dashboard'] },
  { key: 'KAN-142', summary: 'Checar consistência dos totais', issueType: 'Task', status: 'Done', resolvedAt: '2026-06-27T10:00:00.000Z', assignee: 'Ana', squad: 'Platform', priority: 'Medium', labels: ['consistency'] },
  { key: 'KAN-143', summary: 'Criar visão mensal por prioridade', issueType: 'Story', status: 'Done', resolvedAt: '2026-06-29T10:00:00.000Z', assignee: 'Carlos', squad: 'Core', priority: 'Medium', labels: ['priority', 'month'] },

  { key: 'KAN-144', summary: 'Criar endpoint mock enriquecido', issueType: 'Story', status: 'Done', resolvedAt: '2026-07-03T10:00:00.000Z', assignee: 'Joao', squad: 'Core', priority: 'High', labels: ['mock'] },
  { key: 'KAN-145', summary: 'Ajustar resposta para série temporal', issueType: 'Task', status: 'Done', resolvedAt: '2026-07-08T10:00:00.000Z', assignee: 'Marina', squad: 'Growth', priority: 'Medium', labels: ['timeseries'] },
  { key: 'KAN-146', summary: 'Corrigir filtro por projeto no mock', issueType: 'Bug', status: 'Done', resolvedAt: '2026-07-13T10:00:00.000Z', assignee: 'Carlos', squad: 'Core', priority: 'High', labels: ['mock', 'project'] },
  { key: 'KAN-147', summary: 'Criar visão semanal para operações', issueType: 'Story', status: 'Done', resolvedAt: '2026-07-19T10:00:00.000Z', assignee: 'Ana', squad: 'Growth', priority: 'Medium', labels: ['weekly', 'ops'] },
  { key: 'KAN-148', summary: 'Organizar massa de teste de julho', issueType: 'Task', status: 'Done', resolvedAt: '2026-07-25T10:00:00.000Z', assignee: 'Joao', squad: 'Platform', priority: 'Low', labels: ['test-data'] },
  { key: 'KAN-149', summary: 'Consolidar relatório mensal de julho', issueType: 'Story', status: 'Done', resolvedAt: '2026-07-29T10:00:00.000Z', assignee: 'Marina', squad: 'Growth', priority: 'High', labels: ['report'] },

  { key: 'KAN-150', summary: 'Preparar visão de agosto', issueType: 'Story', status: 'Done', resolvedAt: '2026-08-02T10:00:00.000Z', assignee: 'Marina', squad: 'Growth', priority: 'Medium', labels: ['forecast'] },
  { key: 'KAN-151', summary: 'Ajustar dados de tendência', issueType: 'Task', status: 'Done', resolvedAt: '2026-08-09T10:00:00.000Z', assignee: 'Joao', squad: 'Core', priority: 'Low', labels: ['trend'] },
  { key: 'KAN-152', summary: 'Corrigir desvio de timezone em agosto', issueType: 'Bug', status: 'Done', resolvedAt: '2026-08-16T10:00:00.000Z', assignee: 'Carlos', squad: 'Platform', priority: 'High', labels: ['timezone', 'august'] },
  { key: 'KAN-153', summary: 'Refatorar fonte mock compartilhada', issueType: 'Story', status: 'Done', resolvedAt: '2026-08-24T10:00:00.000Z', assignee: 'Ana', squad: 'Core', priority: 'Medium', labels: ['refactor'] },
  { key: 'KAN-154', summary: 'Fechar pacote de agosto', issueType: 'Task', status: 'Done', resolvedAt: '2026-08-28T10:00:00.000Z', assignee: 'Joao', squad: 'Platform', priority: 'Medium', labels: ['august', 'release'] }
];
