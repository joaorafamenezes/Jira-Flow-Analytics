function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

const defaultFilters = {
  source: 'mock',
  startDate: '2026-01-01',
  endDate: getTodayInputValue(),
  throughputPeriod: 'week',
  leadTimePeriod: 'month',
  issueType: '',
  squad: '',
  assignee: '',
  priority: '',
  startMode: 'boardColumn',
  boardId: '1',
  startColumnName: 'Pronto para Desenvolvimento',
  endColumnName: 'Em Produção',
  startFieldId: 'customfield_10000'
};
const THEME_STORAGE_KEY = 'jfa-theme';
const SETTINGS_STORAGE_KEY = 'jfa-settings';
const REFRESH_BUTTON_DEFAULT_TEXT = 'Atualizar painel';
const defaultJiraSettings = {
  jiraHost: 'https://sua-empresa.atlassian.net',
  jiraEmail: '',
  jiraApiToken: '',
  jiraProjectKey: '',
  jiraDefaultJql: 'project = KAN ORDER BY updated DESC'
};
const defaultFlowSettings = {
  flowActiveStatuses: 'Em Desenvolvimento\nEm Testes\nEm Deploy para Produção',
  flowInactiveStatuses: 'Pronto para Desenvolvimento\nPronto para Testes'
};
const defaultRefreshSettings = {
  refreshInterval: 'manual'
};
const refreshIntervals = {
  manual: 0,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000
};
const chartFocusConfig = {
  scatter: {
    title: 'Lead Time Scatterplot',
    description: 'Distribuicao do lead time por item concluido.'
  },
  leadTimeTrend: {
    title: 'Lead Time Comparativo',
    description: 'Comparativo do lead time medio de entrega no periodo selecionado.'
  },
  throughput: {
    title: 'Throughput Run Chart',
    description: 'Cadencia de entregas concluidas no periodo selecionado.'
  },
  flowEfficiencyTrend: {
    title: 'Variabilidade da Eficiencia de Fluxo',
    description: 'Eficiencia de fluxo media consolidada por mes no periodo selecionado.'
  },
  blockedRate: {
    title: '% de Itens Bloqueados',
    description: 'Percentual de itens ativos que ficaram bloqueados em cada periodo.'
  },
  blockedTime: {
    title: 'Tempo Bloqueado',
    description: 'Media de dias bloqueados por item ativo em cada periodo.'
  },
  stageTime: {
    title: 'Tempo Medio por Etapa',
    description: 'Tempo medio em que as demandas permaneceram em cada etapa do fluxo.'
  },
  histogram: {
    title: 'Histograma Lead Time',
    description: 'Distribuicao de frequencia do lead time historico.'
  },
  cfd: {
    title: 'Cumulative Flow Diagram',
    description: 'Evolucao dos itens em cada etapa do fluxo ao longo do tempo.'
  }
};
const infoModalContent = {
  'aging-wip': {
    title: 'Faixas do Aging WIP',
    body: `
      <p>As faixas do Aging WIP sao calculadas com base no envelhecimento dos itens em andamento dentro do filtro atual.</p>
      <ul>
        <li><strong>normal</strong>: item com aging menor ou igual ao P85 do conjunto atual.</li>
        <li><strong>warning</strong>: item com aging acima do P85 e ate o P95.</li>
        <li><strong>critical</strong>: item com aging acima do P95.</li>
      </ul>
      <p>Esses limites mudam conforme periodo, fonte e recortes selecionados. Ou seja, a leitura e sempre relativa ao WIP observado naquele contexto.</p>
    `
  }
};
let jiraTokenRevealTimeoutId = null;
let autoRefreshTimeoutId = null;

const elements = {
  chartModal: document.querySelector('#chartModal'),
  chartModalBackdrop: document.querySelector('#chartModalBackdrop'),
  chartModalTitle: document.querySelector('#chartModalTitle'),
  chartModalDescription: document.querySelector('#chartModalDescription'),
  chartModalClose: document.querySelector('#chartModalClose'),
  chartModalControls: document.querySelector('#chartModalControls'),
  chartModalMount: document.querySelector('#chartModalMount'),
  infoModal: document.querySelector('#infoModal'),
  infoModalBackdrop: document.querySelector('#infoModalBackdrop'),
  infoModalTitle: document.querySelector('#infoModalTitle'),
  infoModalBody: document.querySelector('#infoModalBody'),
  infoModalClose: document.querySelector('#infoModalClose'),
  infoTriggers: [...document.querySelectorAll('[data-open-info]')],
  chartCards: [...document.querySelectorAll('[data-chart-card]')],
  maximizeButtons: [...document.querySelectorAll('[data-maximize-chart]')],
  source: document.querySelector('#source'),
  startDate: document.querySelector('#startDate'),
  endDate: document.querySelector('#endDate'),
  issueType: document.querySelector('#issueType'),
  squad: document.querySelector('#squad'),
  assignee: document.querySelector('#assignee'),
  priority: document.querySelector('#priority'),
  startMode: document.querySelector('#startMode'),
  boardId: document.querySelector('#boardId'),
  startColumnName: document.querySelector('#startColumnName'),
  endColumnName: document.querySelector('#endColumnName'),
  startFieldId: document.querySelector('#startFieldId'),
  jiraHost: document.querySelector('#jiraHost'),
  jiraEmail: document.querySelector('#jiraEmail'),
  jiraApiToken: document.querySelector('#jiraApiToken'),
  toggleJiraApiToken: document.querySelector('#toggleJiraApiToken'),
  jiraProjectKey: document.querySelector('#jiraProjectKey'),
  jiraDefaultJql: document.querySelector('#jiraDefaultJql'),
  flowActiveStatuses: document.querySelector('#flowActiveStatuses'),
  flowInactiveStatuses: document.querySelector('#flowInactiveStatuses'),
  themeSelect: document.querySelector('#themeSelect'),
  refreshInterval: document.querySelector('#refreshInterval'),
  viewTabs: [...document.querySelectorAll('[data-view-tab]')],
  viewPanels: [...document.querySelectorAll('[data-view-panel]')],
  refreshButton: document.querySelector('#refreshButton'),
  refreshButtonLabel: document.querySelector('#refreshButtonLabel'),
  resetButton: document.querySelector('#resetButton'),
  exportButton: document.querySelector('#exportButton'),
  connectionStatus: document.querySelector('#connectionStatus'),
  throughputPeriod: document.querySelector('#throughputPeriod'),
  leadTimePeriod: document.querySelector('#leadTimePeriod'),
  completedCount: document.querySelector('#completedCount'),
  wipCount: document.querySelector('#wipCount'),
  totalCount: document.querySelector('#totalCount'),
  summaryPeriodLabel: document.querySelector('#summaryPeriodLabel'),
  leadTimeP50: document.querySelector('#leadTimeP50'),
  leadTimeP85: document.querySelector('#leadTimeP85'),
  averageLeadTimeDays: document.querySelector('#averageLeadTimeDays'),
  flowEfficiency: document.querySelector('#flowEfficiency'),
  flowEfficiencyDetail: document.querySelector('#flowEfficiencyDetail'),
  blockedItemsPercent: document.querySelector('#blockedItemsPercent'),
  blockedItemsDetail: document.querySelector('#blockedItemsDetail'),
  averageBlockedDays: document.querySelector('#averageBlockedDays'),
  averageBlockedDaysDetail: document.querySelector('#averageBlockedDaysDetail'),
  agingWipTable: document.querySelector('#agingWipTable'),
  agingSearchInput: document.querySelector('#agingSearchInput'),
  insightsGrid: document.querySelector('#insightsGrid'),
  scatterChart: document.querySelector('#scatterChart'),
  leadTimeTrendChart: document.querySelector('#leadTimeTrendChart'),
  runChart: document.querySelector('#runChart'),
  flowEfficiencyTrendChart: document.querySelector('#flowEfficiencyTrendChart'),
  blockedRateChart: document.querySelector('#blockedRateChart'),
  blockedTimeChart: document.querySelector('#blockedTimeChart'),
  stageTimeChart: document.querySelector('#stageTimeChart'),
  histogramChart: document.querySelector('#histogramChart'),
  cfdChart: document.querySelector('#cfdChart'),
  scatterFootnote: document.querySelector('#scatterFootnote'),
  leadTimeTrendDescription: document.querySelector('#leadTimeTrendDescription'),
  leadTimeTrendFootnote: document.querySelector('#leadTimeTrendFootnote'),
  runFootnote: document.querySelector('#runFootnote'),
  runChartDescription: document.querySelector('#runChartDescription'),
  flowEfficiencyTrendFootnote: document.querySelector('#flowEfficiencyTrendFootnote'),
  datePickerTriggers: [...document.querySelectorAll('[data-date-target]')],
  blockedRateDescription: document.querySelector('#blockedRateDescription'),
  blockedTimeDescription: document.querySelector('#blockedTimeDescription'),
  blockedRateFootnote: document.querySelector('#blockedRateFootnote'),
  blockedTimeFootnote: document.querySelector('#blockedTimeFootnote'),
  stageTimeFootnote: document.querySelector('#stageTimeFootnote'),
  histogramFootnote: document.querySelector('#histogramFootnote'),
  cfdFootnote: document.querySelector('#cfdFootnote'),
  activeViewTitle: document.querySelector('#activeViewTitle'),
  filterToggleBtn: document.querySelector('#filterToggleBtn'),
  filtersToolbar: document.querySelector('#filtersToolbar'),
  chipSource: document.querySelector('#chipSource'),
  chipPeriod: document.querySelector('#chipPeriod'),
  quickThemeToggle: document.querySelector('#quickThemeToggle'),
  datePresetButtons: [...document.querySelectorAll('[data-date-preset]')],
  toastContainer: document.querySelector('#toastContainer')
};

let activeView = 'summary';
let activeModalReportId = null;
let activeModalCard = null;
let activeModalCardParent = null;
let activeModalCardNextSibling = null;
let activeInfoModalId = null;
let latestDashboard = null;
let cfdVisibleStatuses = [];
let hasInitializedCfdVisibleStatuses = false;

function buildQuery(baseParams) {
  const params = new URLSearchParams();
  Object.entries(baseParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });
  return params.toString();
}

async function getJson(path, params) {
  const query = buildQuery(params);
  const response = await fetch(`/api${path}?${query}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? 'Erro ao consultar API');
  }

  return data;
}

async function getJiraDefaults() {
  const response = await fetch('/api/settings/jira-defaults');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? 'Erro ao carregar configuracoes padrao do Jira');
  }

  return data;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDays(value) {
  const number = Number(value ?? 0);
  return `${Number.isInteger(number) ? number : number.toFixed(1)}d`;
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatBucketLabel(label) {
  if (/^\d{4}-W\d{2}$/.test(label)) {
    return label.replace('-W', '-W');
  }

  if (/^\d{4}-\d{2}$/.test(label)) {
    const [year, month] = label.split('-');
    return `${month}/${year}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    const [year, month, day] = label.split('-');
    return `${day}/${month}`;
  }

  return label;
}

function openNativeDatePicker(input) {
  if (!input) {
    return;
  }

  input.focus();
  if (typeof input.showPicker === 'function') {
    input.showPicker();
  }
}

function applyDefaultFilters() {
  Object.entries(defaultFilters).forEach(([key, value]) => {
    if (elements[key]) {
      elements[key].value = value;
    }
  });
}

function showToast(message, type = 'info') {
  if (!elements.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const iconClass = type === 'success' ? 'check-circle-fill' : type === 'warning' ? 'exclamation-triangle-fill' : type === 'danger' ? 'x-circle-fill' : 'info-circle-fill';
  toast.innerHTML = `
    <i class="bi bi-${iconClass}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  elements.toastContainer.appendChild(toast);
  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    toast.style.transition = 'all 0.25s ease';
    window.setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function setActiveView(viewName) {
  activeView = viewName;
  elements.viewTabs.forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.viewTab === viewName);
  });
  elements.viewPanels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.viewPanel === viewName);
  });

  const titles = {
    summary: 'Resumo Executivo',
    analytics: 'Painel Analítico',
    settings: 'Configurações'
  };
  if (elements.activeViewTitle) {
    elements.activeViewTitle.textContent = titles[viewName] ?? 'Painel';
  }
}

function openChartModal(reportId) {
  const config = chartFocusConfig[reportId];
  const targetCard = document.querySelector(`[data-chart-card="${reportId}"]`);

  if (!config || !targetCard) {
    return;
  }

  if (activeModalReportId) {
    closeChartModal();
  }

  activeModalReportId = reportId;
  activeModalCard = targetCard;
  activeModalCardParent = targetCard.parentElement;
  activeModalCardNextSibling = targetCard.nextElementSibling;

  document.body.classList.add('chart-modal-open');
  elements.chartModal.hidden = false;
  elements.chartModalTitle.textContent = config.title;
  elements.chartModalDescription.textContent = config.description;
  renderChartModalControls(reportId);
  elements.chartModalMount.appendChild(targetCard);
}

function closeChartModal() {
  if (!activeModalCard || !activeModalCardParent) {
    elements.chartModal.hidden = true;
    document.body.classList.remove('chart-modal-open');
    return;
  }

  if (activeModalCardNextSibling && activeModalCardNextSibling.parentElement === activeModalCardParent) {
    activeModalCardParent.insertBefore(activeModalCard, activeModalCardNextSibling);
  } else {
    activeModalCardParent.appendChild(activeModalCard);
  }

  activeModalReportId = null;
  activeModalCard = null;
  activeModalCardParent = null;
  activeModalCardNextSibling = null;
  elements.chartModalControls.hidden = true;
  elements.chartModalControls.innerHTML = '';
  elements.chartModal.hidden = true;
  document.body.classList.remove('chart-modal-open');
}

function openInfoModal(infoId) {
  const config = infoModalContent[infoId];
  if (!config) {
    return;
  }

  if (activeModalReportId) {
    closeChartModal();
  }

  activeInfoModalId = infoId;
  elements.infoModalTitle.textContent = config.title;
  elements.infoModalBody.innerHTML = config.body;
  elements.infoModal.hidden = false;
  document.body.classList.add('chart-modal-open');
}

function closeInfoModal() {
  activeInfoModalId = null;
  elements.infoModal.hidden = true;
  elements.infoModalBody.innerHTML = '';
  if (!activeModalReportId) {
    document.body.classList.remove('chart-modal-open');
  }
}

function syncCfdVisibleStatuses(cfdData) {
  const statuses = cfdData?.statuses ?? [];
  if (statuses.length === 0) {
    cfdVisibleStatuses = [];
    hasInitializedCfdVisibleStatuses = false;
    return;
  }

  if (!hasInitializedCfdVisibleStatuses) {
    cfdVisibleStatuses = [...statuses];
    hasInitializedCfdVisibleStatuses = true;
    return;
  }

  const allowed = new Set(statuses);
  cfdVisibleStatuses = cfdVisibleStatuses.filter((status) => allowed.has(status));
}

function renderChartModalControls(reportId) {
  if (reportId !== 'cfd' || !latestDashboard?.charts?.cumulativeFlow?.statuses?.length) {
    elements.chartModalControls.hidden = true;
    elements.chartModalControls.innerHTML = '';
    return;
  }

  const statuses = latestDashboard.charts.cumulativeFlow.statuses;
  syncCfdVisibleStatuses(latestDashboard.charts.cumulativeFlow);
  elements.chartModalControls.hidden = false;
  elements.chartModalControls.innerHTML = `
    <h3>Colunas visiveis no CFD</h3>
    <div class="chart-modal-checklist">
      ${statuses.map((status, index) => `
        <label>
          <input type="checkbox" data-cfd-status="${escapeHtml(status)}" ${cfdVisibleStatuses.includes(status) ? 'checked' : ''}>
          <span>${escapeHtml(status)}</span>
        </label>
      `).join('')}
    </div>
  `;

  [...elements.chartModalControls.querySelectorAll('[data-cfd-status]')].forEach((input) => {
    input.addEventListener('change', () => {
      const selected = [...elements.chartModalControls.querySelectorAll('[data-cfd-status]:checked')]
        .map((checkbox) => checkbox.dataset.cfdStatus)
        .filter(Boolean);
      cfdVisibleStatuses = selected;
      renderDynamicCfdChart(latestDashboard.charts.cumulativeFlow);
    });
  });
}

function applyTheme(theme) {
  document.body.classList.toggle('theme-dark', theme === 'dark');
  elements.themeSelect.value = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function loadSavedTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) ?? 'current';
  applyTheme(savedTheme);
}

function getJiraSettingsFormValues() {
  return {
    jiraHost: elements.jiraHost.value.trim(),
    jiraEmail: elements.jiraEmail.value.trim(),
    jiraApiToken: elements.jiraApiToken.value.trim(),
    jiraProjectKey: elements.jiraProjectKey.value.trim(),
    jiraDefaultJql: elements.jiraDefaultJql.value.trim(),
    flowActiveStatuses: elements.flowActiveStatuses.value.trim(),
    flowInactiveStatuses: elements.flowInactiveStatuses.value.trim(),
    refreshInterval: elements.refreshInterval.value
  };
}

function applyJiraSettingsFormValues(settings) {
  Object.entries({ ...defaultJiraSettings, ...defaultFlowSettings, ...defaultRefreshSettings, ...settings }).forEach(([key, value]) => {
    if (elements[key]) {
      elements[key].value = value;
    }
  });
}

function saveJiraSettings() {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(getJiraSettingsFormValues()));
}

function clearAutoRefreshSchedule() {
  if (autoRefreshTimeoutId) {
    clearTimeout(autoRefreshTimeoutId);
    autoRefreshTimeoutId = null;
  }
}

function getRefreshIntervalMs() {
  return refreshIntervals[elements.refreshInterval.value] ?? 0;
}

function isManualRefreshMode() {
  return getRefreshIntervalMs() === 0;
}

function scheduleNextRefresh() {
  clearAutoRefreshSchedule();

  const intervalMs = getRefreshIntervalMs();
  if (intervalMs === 0) {
    return;
  }

  autoRefreshTimeoutId = window.setTimeout(() => {
    void refreshDashboard();
  }, intervalMs);
}

function hideJiraApiToken() {
  if (jiraTokenRevealTimeoutId) {
    clearTimeout(jiraTokenRevealTimeoutId);
    jiraTokenRevealTimeoutId = null;
  }

  elements.jiraApiToken.type = 'password';
  elements.toggleJiraApiToken.disabled = false;
  elements.toggleJiraApiToken.classList.remove('is-revealed');
  elements.toggleJiraApiToken.innerHTML = '<span aria-hidden="true">&#128065;</span>';
}

function revealJiraApiTokenForFiveSeconds() {
  hideJiraApiToken();
  elements.jiraApiToken.type = 'text';
  elements.toggleJiraApiToken.disabled = true;
  elements.toggleJiraApiToken.classList.add('is-revealed');
  elements.toggleJiraApiToken.textContent = '5s';

  jiraTokenRevealTimeoutId = window.setTimeout(() => {
    hideJiraApiToken();
  }, 5000);
}

async function loadSavedJiraSettings() {
  const serverDefaults = await getJiraDefaults();

  try {
    const rawSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!rawSettings) {
      applyJiraSettingsFormValues({ ...defaultJiraSettings, ...serverDefaults });
      return;
    }

    applyJiraSettingsFormValues({ ...defaultJiraSettings, ...serverDefaults, ...JSON.parse(rawSettings) });
  } catch {
    applyJiraSettingsFormValues({ ...defaultJiraSettings, ...serverDefaults });
  }
}

function handlePotentialAutoRefresh(options = {}) {
  if (isManualRefreshMode()) {
    elements.connectionStatus.textContent = 'Filtros alterados. Clique em Atualizar painel para consultar.';
    return;
  }

  void refreshDashboard(options);
}

function buildSelectOptions(selectElement, values, selectedValue = '') {
  const previous = selectedValue || selectElement.value;
  selectElement.innerHTML = '<option value="">Todos</option>';

  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    if (value === previous) {
      option.selected = true;
    }
    selectElement.appendChild(option);
  });

  if (previous && !values.includes(previous)) {
    selectElement.value = '';
  }
}

function buildStrictSelectOptions(selectElement, values, selectedValue = '', labelFormatter = (value) => value) {
  const previous = selectedValue || selectElement.value;
  selectElement.innerHTML = '';

  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = labelFormatter(value);
    if (value === previous) {
      option.selected = true;
    }
    selectElement.appendChild(option);
  });

  if (selectElement.options.length > 0 && !values.includes(previous)) {
    selectElement.selectedIndex = 0;
  }
}

function getFilters() {
  return {
    source: elements.source.value,
    startDate: elements.startDate.value,
    endDate: elements.endDate.value,
    throughputPeriod: elements.throughputPeriod.value,
    leadTimePeriod: elements.leadTimePeriod.value,
    issueType: elements.issueType.value,
    squad: elements.squad.value,
    assignee: elements.assignee.value,
    priority: elements.priority.value,
    startMode: elements.startMode.value,
    boardId: elements.boardId.value,
    startColumnName: elements.startColumnName.value.trim(),
    endColumnName: elements.endColumnName.value.trim(),
    startFieldId: elements.startFieldId.value.trim(),
    jiraHost: elements.jiraHost.value.trim(),
    jiraEmail: elements.jiraEmail.value.trim(),
    jiraApiToken: elements.jiraApiToken.value.trim(),
    jiraProjectKey: elements.jiraProjectKey.value.trim(),
    jiraDefaultJql: elements.jiraDefaultJql.value.trim(),
    flowActiveStatuses: elements.flowActiveStatuses.value.trim(),
    flowInactiveStatuses: elements.flowInactiveStatuses.value.trim()
  };
}

async function loadFilterOptions() {
  const filters = getFilters();
  const options = await getJson('/metrics/filter-options', {
    source: filters.source,
    startDate: filters.startDate,
    endDate: filters.endDate,
    startMode: filters.startMode,
    boardId: filters.boardId,
    startColumnName: filters.startColumnName,
    endColumnName: filters.endColumnName,
    startFieldId: filters.startFieldId
  });

  buildSelectOptions(elements.issueType, options.issueTypes ?? [], filters.issueType);
  buildSelectOptions(elements.squad, options.squads ?? [], filters.squad);
  buildSelectOptions(elements.assignee, options.assignees ?? [], filters.assignee);
  buildSelectOptions(elements.priority, options.priorities ?? [], filters.priority);
  buildStrictSelectOptions(
    elements.startMode,
    options.leadTime?.startModes ?? ['boardColumn', 'created', 'fieldDate'],
    filters.startMode,
    (value) => ({
      boardColumn: 'Coluna do board',
      created: 'Criacao da issue',
      fieldDate: 'Campo de data'
    })[value] ?? value
  );
  buildStrictSelectOptions(elements.boardId, options.leadTime?.boardIds ?? ['1'], filters.boardId);
  buildStrictSelectOptions(elements.startColumnName, options.leadTime?.startColumns ?? ['Pronto para Desenvolvimento'], filters.startColumnName);
  buildStrictSelectOptions(elements.endColumnName, options.leadTime?.endColumns ?? ['Em Produção'], filters.endColumnName);
  buildStrictSelectOptions(elements.startFieldId, options.leadTime?.startFieldIds ?? ['customfield_10000'], filters.startFieldId);
}

function renderInsights(insights = []) {
  if (insights.length === 0) {
    elements.insightsGrid.innerHTML = '<p class="empty-state">Nenhum insight disponivel para o filtro atual.</p>';
    return;
  }

  elements.insightsGrid.innerHTML = insights
    .map((insight) => `
      <article class="insight-card insight-${escapeHtml(insight.tone)}">
        <h4>${escapeHtml(insight.title)}</h4>
        <p>${escapeHtml(insight.body)}</p>
      </article>
    `)
    .join('');
}

let currentAgingChart = null;
let currentAgingSearchTerm = '';

function renderAgingWipTable(agingChart, filterTerm = '') {
  if (agingChart !== null && agingChart !== undefined) {
    currentAgingChart = agingChart;
  }
  if (filterTerm !== undefined && filterTerm !== null) {
    currentAgingSearchTerm = filterTerm;
  }

  const chart = currentAgingChart;
  const allItems = chart?.items ?? [];
  const p85 = chart?.percentiles?.p85 ?? 0;
  const p95 = chart?.percentiles?.p95 ?? 0;

  const term = (currentAgingSearchTerm || '').trim().toLowerCase();
  const items = term
    ? allItems.filter((item) =>
        (item.key ?? '').toLowerCase().includes(term) ||
        (item.summary ?? '').toLowerCase().includes(term) ||
        (item.status ?? '').toLowerCase().includes(term) ||
        (item.issueType ?? '').toLowerCase().includes(term)
      )
    : allItems;

  if (allItems.length === 0) {
    elements.agingWipTable.innerHTML = '<p class="empty-state">Nenhum item em andamento com aging disponivel para o filtro atual.</p>';
    return;
  }

  if (items.length === 0) {
    elements.agingWipTable.innerHTML = `<p class="empty-state">Nenhum item encontrado para o termo "${escapeHtml(currentAgingSearchTerm)}".</p>`;
    return;
  }

  elements.agingWipTable.innerHTML = `
    <div class="mini-table">
      <div class="aging-table-summary">
        <span>Exibindo <strong>${items.length}</strong> de <strong>${allItems.length}</strong> demandas em andamento</span>
        <span class="aging-table-thresholds">Referência: P85 = ${formatDays(p85)} | P95 = ${formatDays(p95)}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Demanda & Detalhes</th>
            <th>Aging WIP</th>
            <th>Faixa de Envelhecimento</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => {
            const days = Number(item.agingDays ?? 0);
            const zone = item.zone ?? 'normal';
            return `
              <tr>
                <td><span class="aging-issue-type">${escapeHtml(item.issueType ?? 'Demanda')}</span></td>
                <td>
                  <div class="aging-activity-cell">
                    <strong>${escapeHtml(item.key)}</strong>
                    <span class="aging-activity-summary">${escapeHtml(item.summary ?? '-')}</span>
                    <small class="aging-activity-status">${escapeHtml(item.status ?? '-')}</small>
                  </div>
                </td>
                <td><strong>${formatDays(days)}</strong></td>
                <td>
                  <span class="zone-pill zone-${escapeHtml(zone)}">
                    ${escapeHtml(zone === 'normal' ? 'Normal (≤ P85)' : zone === 'warning' ? 'Alerta (P85 - P95)' : 'Crítico (> P95)')}
                  </span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderScatterChart(data) {
  const items = [...(data.items ?? [])].sort((a, b) => a.resolvedAt.localeCompare(b.resolvedAt));
  if (items.length === 0) {
    elements.scatterChart.innerHTML = '<p class="empty-state">Sem itens concluidos para o scatterplot.</p>';
    return;
  }

  const width = 760;
  const height = 320;
  const padding = { top: 20, right: 30, bottom: 44, left: 50 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxY = Math.max(...items.map((item) => item.leadTimeDays), data.percentiles.p95, 1);

  const xAt = (index) => padding.left + ((plotWidth / Math.max(items.length - 1, 1)) * index);
  const yAt = (value) => padding.top + plotHeight - ((value / maxY) * plotHeight);
  const percentileLines = [
    ['P50', data.percentiles.p50, 'var(--primary)'],
    ['P85', data.percentiles.p85, 'var(--warning)'],
    ['P95', data.percentiles.p95, 'var(--danger)']
  ];

  elements.scatterChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="Scatterplot de lead time">
      ${Array.from({ length: 5 }).map((_, index) => {
        const value = (maxY / 4) * index;
        const y = yAt(value);
        return `
          <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="grid-line"></line>
          <text x="${padding.left - 10}" y="${y + 4}" class="axis-text axis-left">${Math.round(value)}d</text>
        `;
      }).join('')}
      ${percentileLines.map(([label, value, color]) => `
        <line x1="${padding.left}" y1="${yAt(value)}" x2="${width - padding.right}" y2="${yAt(value)}" stroke="${color}" stroke-dasharray="6 4" stroke-width="2"></line>
        <text x="${width - padding.right + 8}" y="${yAt(value) + 4}" class="axis-text" style="fill: ${color}; font-weight: 600;">${label} ${formatDays(value)}</text>
      `).join('')}
      ${items.map((item, index) => `
        <circle cx="${xAt(index)}" cy="${yAt(item.leadTimeDays)}" r="5" class="scatter-point">
          <title>${escapeHtml(item.key)} - ${formatDays(item.leadTimeDays)}</title>
        </circle>
      `).join('')}
      ${items.filter((_, index) => index % Math.ceil(items.length / 5) === 0 || index === items.length - 1).map((item) => {
        const absoluteIndex = items.indexOf(item);
        return `<text x="${xAt(absoluteIndex)}" y="${height - 12}" class="axis-text axis-bottom">${formatBucketLabel(item.resolvedAt.slice(0, 7))}</text>`;
      }).join('')}
  `;
}

function renderLeadTimeTrendChart(data) {
  const entries = Object.entries(data.buckets ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    elements.leadTimeTrendChart.innerHTML = '<p class="empty-state">Sem dados suficientes para comparar lead time no periodo selecionado.</p>';
    return;
  }

  const period = data.period === 'week' ? 'week' : 'month';
  elements.leadTimeTrendDescription.textContent = period === 'week'
    ? 'Comparativo do lead time medio de entrega semana a semana.'
    : 'Comparativo do lead time medio de entrega mes a mes.';
  const max = Math.max(...entries.map(([, value]) => Number(value.averageDays ?? 0)), 1);
  const average = entries.reduce((sum, [, value]) => sum + Number(value.averageDays ?? 0), 0) / entries.length;
  elements.leadTimeTrendChart.innerHTML = buildBarChart(
    entries.map(([label, value]) => [label, Number(value.averageDays ?? 0)]),
    {
      max,
      average,
      averageLabel: `Media ${average.toFixed(1)}d`,
      valueSuffix: 'd',
      labelFormatter: formatBucketLabel
    }
  );
}

function renderRunChart(runChart) {
  const period = runChart.period === 'month' ? 'month' : 'week';
  elements.runChartDescription.textContent = period === 'month'
    ? 'Itens concluidos por mes.'
    : 'Itens concluidos por semana.';
  const entries = Object.entries(runChart.buckets ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    elements.runChart.innerHTML = '<p class="empty-state">Sem dados de throughput para o periodo selecionado.</p>';
    return;
  }

  const max = Math.max(...entries.map(([, value]) => value), 1);
  const average = entries.reduce((sum, [, value]) => sum + value, 0) / entries.length;
  elements.runChart.innerHTML = buildBarChart(entries, {
    max,
    average,
    averageLabel: `Media ${average.toFixed(1)}`,
    valueSuffix: '',
    labelFormatter: formatBucketLabel
  });
}

function renderFlowEfficiencyTrendChart(chart) {
  const entries = Object.entries(chart.buckets ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    elements.flowEfficiencyTrendChart.innerHTML = '<p class="empty-state">Sem dados suficientes para consolidar a eficiencia de fluxo por mes.</p>';
    return;
  }

  const width = 760;
  const height = 320;
  const padding = { top: 24, right: 24, bottom: 48, left: 52 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxY = Math.max(...entries.map(([, value]) => Number(value)), 100);
  const xAt = (index) => padding.left + ((plotWidth / Math.max(entries.length - 1, 1)) * index);
  const yAt = (value) => padding.top + plotHeight - ((value / maxY) * plotHeight);
  const path = entries.map(([, value], index) => `${index === 0 ? 'M' : 'L'} ${xAt(index)} ${yAt(Number(value))}`).join(' ');
  const average = entries.reduce((sum, [, value]) => sum + Number(value), 0) / entries.length;

  elements.flowEfficiencyTrendChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="Variabilidade da eficiencia de fluxo por mes">
      ${Array.from({ length: 5 }).map((_, index) => {
        const value = Math.round((maxY / 4) * index);
        const y = yAt(value);
        return `
          <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="grid-line"></line>
          <text x="${padding.left - 10}" y="${y + 4}" class="axis-text axis-left">${value}%</text>
        `;
      }).join('')}
      <line x1="${padding.left}" y1="${yAt(average)}" x2="${width - padding.right}" y2="${yAt(average)}" stroke="rgba(211, 90, 49, 0.56)" stroke-dasharray="6 4" stroke-width="2"></line>
      <text x="${width - padding.right}" y="${yAt(average) - 8}" class="axis-text axis-bottom">Media ${average.toFixed(1)}%</text>
      <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
      ${entries.map(([label, value], index) => `
        <text x="${xAt(index)}" y="${yAt(Number(value)) - 14}" class="axis-text axis-bottom">${Number(value).toFixed(1)}%</text>
        <circle cx="${xAt(index)}" cy="${yAt(Number(value))}" r="5" class="scatter-point">
          <title>${escapeHtml(`${formatBucketLabel(label)}: ${Number(value).toFixed(1)}%`)}</title>
        </circle>
        <text x="${xAt(index)}" y="${height - 12}" class="axis-text axis-bottom">${escapeHtml(formatBucketLabel(label))}</text>
      `).join('')}
    </svg>
  `;
}

function renderBlockedRateChart(chart) {
  const period = chart.period === 'month' ? 'month' : 'week';
  elements.blockedRateDescription.textContent = period === 'month'
    ? 'Percentual de itens ativos que ficaram bloqueados por mes.'
    : 'Percentual de itens ativos que ficaram bloqueados por semana.';
  const entries = Object.entries(chart.buckets ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    elements.blockedRateChart.innerHTML = '<p class="empty-state">Sem dados de bloqueio para o periodo selecionado.</p>';
    return;
  }

  const width = 760;
  const height = 320;
  const padding = { top: 24, right: 24, bottom: 48, left: 52 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxY = Math.max(...entries.map(([, value]) => Number(value)), 100);
  const xAt = (index) => padding.left + ((plotWidth / Math.max(entries.length - 1, 1)) * index);
  const yAt = (value) => padding.top + plotHeight - ((value / maxY) * plotHeight);
  const path = entries.map(([, value], index) => `${index === 0 ? 'M' : 'L'} ${xAt(index)} ${yAt(Number(value))}`).join(' ');
  const average = entries.reduce((sum, [, value]) => sum + Number(value), 0) / entries.length;

  elements.blockedRateChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="Percentual de itens bloqueados por periodo">
      ${Array.from({ length: 5 }).map((_, index) => {
        const value = Math.round((maxY / 4) * index);
        const y = yAt(value);
        return `
          <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="grid-line"></line>
          <text x="${padding.left - 10}" y="${y + 4}" class="axis-text axis-left">${value}%</text>
        `;
      }).join('')}
      <line x1="${padding.left}" y1="${yAt(average)}" x2="${width - padding.right}" y2="${yAt(average)}" stroke="rgba(211, 90, 49, 0.56)" stroke-dasharray="6 4" stroke-width="2"></line>
      <text x="${width - padding.right}" y="${yAt(average) - 8}" class="axis-text axis-bottom">Media ${average.toFixed(1)}%</text>
      <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
      ${entries.map(([label, value], index) => `
        <text x="${xAt(index)}" y="${yAt(Number(value)) - 14}" class="axis-text axis-bottom">${Number(value).toFixed(1)}%</text>
        <circle cx="${xAt(index)}" cy="${yAt(Number(value))}" r="5" class="scatter-point">
          <title>${escapeHtml(`${formatBucketLabel(label)}: ${Number(value).toFixed(1)}%`)}</title>
        </circle>
        <text x="${xAt(index)}" y="${height - 12}" class="axis-text axis-bottom">${escapeHtml(formatBucketLabel(label))}</text>
      `).join('')}
    </svg>
  `;
}

function renderBlockedTimeChart(chart) {
  const period = chart.period === 'month' ? 'month' : 'week';
  elements.blockedTimeDescription.textContent = period === 'month'
    ? 'Media de dias bloqueados por item ativo em cada mes.'
    : 'Media de dias bloqueados por item ativo em cada semana.';
  const entries = Object.entries(chart.buckets ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    elements.blockedTimeChart.innerHTML = '<p class="empty-state">Sem dados suficientes para calcular tempo bloqueado.</p>';
    return;
  }

  const max = Math.max(...entries.map(([, value]) => Number(value)), 1);
  const average = entries.reduce((sum, [, value]) => sum + Number(value), 0) / entries.length;
  elements.blockedTimeChart.innerHTML = buildBarChart(
    entries.map(([label, value]) => [label, Number(value)]),
    {
      max,
      average,
      averageLabel: `Media ${average.toFixed(1)}d`,
      valueSuffix: 'd',
      labelFormatter: formatBucketLabel
    }
  );
}

function renderHistogramChart(bins, percentiles = {}) {
  if (!bins || bins.length === 0) {
    elements.histogramChart.innerHTML = '<p class="empty-state">Sem distribuicao disponivel para o histograma.</p>';
    return;
  }

  const chartBins = bins.map((bin) => {
    const [range] = bin.label.split('d');
    const [start, end] = range.split('-').map(Number);
    return {
      label: bin.label,
      count: bin.count,
      start,
      end
    };
  });
  const maxCount = Math.max(...chartBins.map((bin) => bin.count), 1);
  const minDay = Math.min(...chartBins.map((bin) => bin.start));
  const maxDay = Math.max(...chartBins.map((bin) => bin.end));
  const width = 760;
  const height = 320;
  const padding = { top: 26, right: 24, bottom: 56, left: 56 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const binWidth = plotWidth / chartBins.length;
  const xAt = (index) => padding.left + (index * binWidth);
  const yAt = (value) => padding.top + plotHeight - ((value / maxCount) * plotHeight);
  const percentileLines = [
    { label: '50%', value: percentiles.p50, tone: 'p50' },
    { label: '85%', value: percentiles.p85, tone: 'p85' },
    { label: '95%', value: percentiles.p95, tone: 'p95' }
  ].filter((line) => typeof line.value === 'number' && line.value > 0);
  const percentileX = (value) => {
    const clamped = Math.max(minDay, Math.min(value, maxDay));
    return padding.left + (((clamped - minDay) / Math.max(maxDay - minDay, 1)) * plotWidth);
  };

  elements.histogramChart.innerHTML = `
    <div class="histogram-chart-shell">
      <div class="histogram-summary">
        ${percentileLines.map((line) => `
          <div class="histogram-summary-pill">
            <span>${line.label}</span>
            <strong>${formatDays(line.value)}</strong>
          </div>
        `).join('')}
      </div>
      <div class="histogram-visual">
        <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="Histograma de lead time">
          ${Array.from({ length: 5 }).map((_, index) => {
            const value = Math.round((maxCount / 4) * index);
            const y = yAt(value);
            return `
              <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="grid-line"></line>
              <text x="${padding.left - 10}" y="${y + 4}" class="axis-text axis-left">${value}</text>
            `;
          }).join('')}
          ${percentileLines.map((line) => `
            <line
              x1="${percentileX(line.value)}"
              y1="${padding.top}"
              x2="${percentileX(line.value)}"
              y2="${padding.top + plotHeight}"
              class="histogram-percentile-line histogram-percentile-${line.tone}"
            ></line>
            <text x="${percentileX(line.value)}" y="${padding.top - 8}" class="axis-text histogram-percentile-label">${line.label}</text>
          `).join('')}
          ${chartBins.map((bin, index) => {
            const barHeight = (bin.count / maxCount) * plotHeight;
            const x = xAt(index) + 1;
            const y = padding.top + plotHeight - barHeight;
            return `
              <rect
                x="${x}"
                y="${y}"
                width="${Math.max(binWidth - 2, 8)}"
                height="${Math.max(barHeight, 4)}"
                rx="2"
                class="histogram-bar"
              >
                <title>${escapeHtml(`${bin.label}: ${bin.count} item(ns)`)}</title>
              </rect>
              <text x="${x + ((Math.max(binWidth - 2, 8)) / 2)}" y="${y - 8}" class="axis-text axis-bottom">${bin.count}</text>
              <text x="${x + ((Math.max(binWidth - 2, 8)) / 2)}" y="${height - 18}" class="axis-text axis-bottom">${escapeHtml(bin.label.replace('d', ''))}</text>
            `;
          }).join('')}
          <text x="${padding.left + (plotWidth / 2)}" y="${height - 2}" class="axis-text histogram-axis-title">Lead Time (dias)</text>
        </svg>
      </div>
    </div>
  `;
}

function buildBarChart(entries, options) {
  const { max, average, averageLabel, valueSuffix, labelFormatter } = options;
  const averagePercent = average ? (average / max) * 100 : 0;
  const chartWidth = Math.max(entries.length * 46, 520);

  return `
    <div class="throughput-horizontal-chart" style="--chart-scroll-width:${chartWidth}px">
      <div class="throughput-y-axis">
        ${Array.from({ length: 5 }).map((_, index) => {
          const step = 4 - index;
          return `<div class="throughput-y-tick"><span>${Math.round((max / 4) * step)}</span></div>`;
        }).join('')}
      </div>
      <div class="throughput-plot">
        <div class="throughput-scroll">
          <div class="throughput-canvas">
            <div class="throughput-grid">
              ${Array.from({ length: 5 }).map(() => '<div class="throughput-grid-line"></div>').join('')}
            </div>
            ${average !== null ? `<div class="throughput-average-line" style="bottom:${averagePercent}%"><span>${escapeHtml(averageLabel)}</span></div>` : ''}
            <div class="throughput-bars">
              ${entries.map(([label, value]) => `
                <div class="throughput-bar-column" title="${escapeHtml(`${label}: ${value}${valueSuffix}`)}">
                  <div class="throughput-bar-wrap">
                    <span class="throughput-bar-value" style="bottom:calc(${(value / max) * 100}% + 10px)">${value}${valueSuffix}</span>
                    <div class="throughput-bar-vertical" style="height:${(value / max) * 100}%"></div>
                  </div>
                  <span class="throughput-bar-label">${escapeHtml(labelFormatter(label))}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderStageTimeChart(data = {}) {
  const entries = Object.entries(data).sort(([, a], [, b]) => Number(b) - Number(a));
  if (entries.length === 0) {
    elements.stageTimeChart.innerHTML = '<p class="empty-state">Sem dados suficientes para calcular tempo por etapa.</p>';
    return;
  }

  const max = Math.max(...entries.map(([, value]) => Number(value)), 1);
  elements.stageTimeChart.innerHTML = `
    <div class="horizontal-bars stage-time-bars">
      ${entries.map(([label, value]) => `
        <div class="horizontal-bar-row">
          <span class="horizontal-bar-label">${escapeHtml(label)}</span>
          <div class="horizontal-bar-track">
            <div class="horizontal-bar-fill" style="width:${(Number(value) / max) * 100}%"></div>
          </div>
          <strong class="horizontal-bar-value">${formatDays(Number(value))}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCfdChart(data = {}) {
  const series = data.series ?? [];
  if (series.length === 0) {
    elements.cfdChart.innerHTML = '<p class="empty-state">Sem dados suficientes para o CFD.</p>';
    return;
  }

  const statuses = ['Done', 'Em Deploy para Produção', 'Em Testes', 'Pronto para Testes', 'Em Desenvolvimento', 'Pronto para Desenvolvimento'];
  const colors = {
    Done: 'rgba(16, 185, 129, 0.78)',
    'Em Deploy para Produção': 'rgba(6, 182, 212, 0.78)',
    'Em Testes': 'rgba(139, 92, 246, 0.78)',
    'Pronto para Testes': 'rgba(99, 102, 241, 0.75)',
    'Em Desenvolvimento': 'rgba(59, 130, 246, 0.75)',
    'Pronto para Desenvolvimento': 'rgba(245, 158, 11, 0.75)'
  };
  const width = 760;
  const height = 320;
  const padding = { top: 16, right: 20, bottom: 44, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const cumulative = series.map((point) => {
    let running = 0;
    const counts = {};
    statuses.forEach((status) => {
      running += point.counts[status] ?? 0;
      counts[status] = running;
    });
    return {
      bucket: point.bucket,
      counts
    };
  });

  const max = Math.max(...cumulative.map((point) => Math.max(...statuses.map((status) => point.counts[status] ?? 0))), 1);
  const xAt = (index) => padding.left + ((plotWidth / Math.max(cumulative.length - 1, 1)) * index);
  const yAt = (value) => padding.top + plotHeight - ((value / max) * plotHeight);

  const layers = statuses.map((status, statusIndex) => {
    const lowerStatus = statuses[statusIndex - 1];
    const topPoints = cumulative.map((point, index) => `${xAt(index)},${yAt(point.counts[status] ?? 0)}`).join(' ');
    const bottomPoints = [...cumulative].reverse().map((point, reverseIndex) => {
      const originalIndex = cumulative.length - 1 - reverseIndex;
      const value = lowerStatus ? (point.counts[lowerStatus] ?? 0) : 0;
      return `${xAt(originalIndex)},${yAt(value)}`;
    }).join(' ');
    return `<polygon points="${topPoints} ${bottomPoints}" fill="${colors[status]}" stroke="none"></polygon>`;
  }).reverse().join('');

  elements.cfdChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="Cumulative flow diagram">
      ${Array.from({ length: 5 }).map((_, index) => {
        const value = (max / 4) * index;
        const y = yAt(value);
        return `
          <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="grid-line"></line>
          <text x="${padding.left - 10}" y="${y + 4}" class="axis-text axis-left">${Math.round(value)}</text>
        `;
      }).join('')}
      ${layers}
      ${cumulative.filter((_, index) => index % Math.ceil(cumulative.length / 6) === 0 || index === cumulative.length - 1).map((point) => {
        const index = cumulative.indexOf(point);
        return `<text x="${xAt(index)}" y="${height - 12}" class="axis-text axis-bottom">${escapeHtml(formatBucketLabel(point.bucket))}</text>`;
      }).join('')}
    </svg>
    <div class="cfd-legend">
      ${statuses.map((status) => `<span><i style="background:${colors[status]}"></i>${escapeHtml(status)}</span>`).join('')}
    </div>
  `;

  if (activeModalReportId === 'cfd') {
    renderChartModalControls('cfd');
  }
}

function renderDynamicCfdChart(data = {}) {
  const series = data.series ?? (Array.isArray(data) ? data : []);
  if (series.length === 0) {
    elements.cfdChart.innerHTML = '<p class="empty-state">Sem dados suficientes para o CFD.</p>';
    return;
  }

  const fallbackStatuses = ['Done', 'Em Deploy para ProduÃ§Ã£o', 'Em Testes', 'Pronto para Testes', 'Em Desenvolvimento', 'Pronto para Desenvolvimento'];
  const availableStatuses = data.statuses?.length ? data.statuses : fallbackStatuses;
  syncCfdVisibleStatuses({ statuses: availableStatuses });
  const statuses = availableStatuses.filter((status) => cfdVisibleStatuses.includes(status));
  if (statuses.length === 0) {
    elements.cfdChart.innerHTML = '<p class="empty-state">Selecione ao menos uma coluna para visualizar o CFD.</p>';
    return;
  }
  const palette = [
    'rgba(16, 185, 129, 0.78)',
    'rgba(6, 182, 212, 0.78)',
    'rgba(139, 92, 246, 0.78)',
    'rgba(99, 102, 241, 0.75)',
    'rgba(59, 130, 246, 0.75)',
    'rgba(245, 158, 11, 0.75)',
    'rgba(148, 163, 184, 0.75)',
    'rgba(239, 68, 68, 0.75)'
  ];
  const colors = Object.fromEntries(statuses.map((status, index) => [status, palette[index % palette.length]]));
  const width = 760;
  const height = 320;
  const padding = { top: 16, right: 20, bottom: 44, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const cumulative = series.map((point) => {
    let running = 0;
    const counts = {};
    statuses.forEach((status) => {
      running += point.counts[status] ?? 0;
      counts[status] = running;
    });
    return {
      bucket: point.bucket,
      counts
    };
  });

  const max = Math.max(...cumulative.map((point) => Math.max(...statuses.map((status) => point.counts[status] ?? 0))), 1);
  const xAt = (index) => padding.left + ((plotWidth / Math.max(cumulative.length - 1, 1)) * index);
  const yAt = (value) => padding.top + plotHeight - ((value / max) * plotHeight);

  const layers = statuses.map((status, statusIndex) => {
    const lowerStatus = statuses[statusIndex - 1];
    const topPoints = cumulative.map((point, index) => `${xAt(index)},${yAt(point.counts[status] ?? 0)}`).join(' ');
    const bottomPoints = [...cumulative].reverse().map((point, reverseIndex) => {
      const originalIndex = cumulative.length - 1 - reverseIndex;
      const value = lowerStatus ? (point.counts[lowerStatus] ?? 0) : 0;
      return `${xAt(originalIndex)},${yAt(value)}`;
    }).join(' ');
    return `<polygon points="${topPoints} ${bottomPoints}" fill="${colors[status]}" stroke="none"></polygon>`;
  }).reverse().join('');

  elements.cfdChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" aria-label="Cumulative flow diagram">
      ${Array.from({ length: 5 }).map((_, index) => {
        const value = (max / 4) * index;
        const y = yAt(value);
        return `
          <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="grid-line"></line>
          <text x="${padding.left - 10}" y="${y + 4}" class="axis-text axis-left">${Math.round(value)}</text>
        `;
      }).join('')}
      ${layers}
      ${cumulative.filter((_, index) => index % Math.ceil(cumulative.length / 6) === 0 || index === cumulative.length - 1).map((point) => {
        const index = cumulative.indexOf(point);
        return `<text x="${xAt(index)}" y="${height - 12}" class="axis-text axis-bottom">${escapeHtml(formatBucketLabel(point.bucket))}</text>`;
      }).join('')}
    </svg>
    <div class="cfd-legend">
      ${statuses.map((status) => `<span><i style="background:${colors[status]}"></i>${escapeHtml(status)}</span>`).join('')}
    </div>
  `;
}

function renderFootnotes(dashboard) {
  const summary = dashboard.summary;
  const isMonthlyThroughput = dashboard.charts?.throughputRunChart?.period === 'month';
  const isMonthlyLeadTime = dashboard.charts?.leadTimeTrend?.period !== 'week';
  elements.scatterFootnote.textContent = `Use o P85 (${formatDays(summary.leadTimeP85)}) como prazo de compromisso com mais seguranca.`;
  elements.leadTimeTrendFootnote.textContent = isMonthlyLeadTime
    ? 'Compare a media mensal para identificar tendencia de melhoria ou aumento do tempo de entrega.'
    : 'Compare a media semanal para perceber oscilacoes de fluxo e estabilidade de entrega.';
  elements.runFootnote.textContent = isMonthlyThroughput
    ? 'O objetivo nao e maximizar um mes isolado, mas sustentar uma cadencia previsivel.'
    : 'O objetivo nao e maximizar uma semana isolada, mas sustentar uma cadencia previsivel.';
  elements.flowEfficiencyTrendFootnote.textContent = 'Observe a oscilacao mensal para entender se o fluxo esta ganhando ou perdendo fluidez ao longo do periodo.';
  elements.blockedRateFootnote.textContent = 'Quanto menor esse percentual, menor a friccao externa ou interna sofrida pelo fluxo entregue.';
  elements.blockedTimeFootnote.textContent = 'Esse indicador ajuda a separar atraso por execucao de atraso causado por impedimentos.';
  elements.stageTimeFootnote.textContent = 'Etapas com maior tempo medio tendem a indicar espera, gargalo ou politicas pouco explicitas no fluxo.';
  elements.histogramFootnote.textContent = 'Uma distribuicao estreita indica fluxo mais previsivel e menos dependente de excecoes.';
  elements.cfdFootnote.textContent = 'Faixas que alargam revelam acumulacao de WIP. Faixas que estreitam sinalizam escoamento.';
}

function updateFilterChips(filters) {
  if (elements.chipSource) {
    elements.chipSource.textContent = (filters.source || 'mock').toUpperCase();
  }
  if (elements.chipPeriod) {
    elements.chipPeriod.textContent = `${filters.startDate || ''} → ${filters.endDate || ''}`;
  }
}

function applyDatePreset(preset) {
  const today = getTodayInputValue();
  let start = '2026-01-01';
  if (preset === '30d') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    start = d.toISOString().slice(0, 10);
  } else if (preset === '90d') {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    start = d.toISOString().slice(0, 10);
  } else if (preset === 'year') {
    start = '2026-01-01';
  } else if (preset === 'all') {
    start = '2025-01-01';
  }
  elements.startDate.value = start;
  elements.endDate.value = today;

  elements.datePresetButtons.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.datePreset === preset);
  });

  showToast(`Período ajustado (${preset.toUpperCase()})`, 'info');
  handlePotentialAutoRefresh();
}

async function refreshDashboard(options = {}) {
  const { reloadFilterOptions = true } = options;
  const filters = getFilters();
  clearAutoRefreshSchedule();
  elements.connectionStatus.textContent = 'Consultando...';
  elements.refreshButton.disabled = true;
  elements.refreshButton.classList.add('is-loading');
  if (elements.refreshButtonLabel) {
    elements.refreshButtonLabel.textContent = 'Atualizando...';
  } else {
    elements.refreshButton.textContent = 'Atualizando...';
  }

  try {
    if (reloadFilterOptions) {
      await loadFilterOptions();
    }
    const refreshedFilters = getFilters();
    const dashboard = await getJson('/metrics/flow-dashboard', refreshedFilters);
    latestDashboard = dashboard;
    syncCfdVisibleStatuses(dashboard.charts.cumulativeFlow);

    elements.connectionStatus.textContent = `${refreshedFilters.source.toUpperCase()} carregado em ${formatDateTime(dashboard.generatedAt)}`;
    elements.completedCount.textContent = dashboard.summary.completedCount ?? 0;
    elements.wipCount.textContent = dashboard.summary.wipCount ?? 0;
    elements.totalCount.textContent = dashboard.summary.totalCount ?? 0;
    elements.summaryPeriodLabel.textContent = `${dashboard.startDate} até ${dashboard.endDate}`;
    elements.leadTimeP50.textContent = formatDays(dashboard.summary.leadTimeP50 ?? 0);
    elements.leadTimeP85.textContent = formatDays(dashboard.summary.leadTimeP85 ?? 0);
    elements.averageLeadTimeDays.textContent = formatDays(dashboard.summary.averageLeadTimeDays ?? 0);
    elements.flowEfficiency.textContent = `${Number(dashboard.summary.flowEfficiencyPercent ?? 0).toFixed(0)}%`;
    elements.flowEfficiencyDetail.textContent = `${formatDays(dashboard.summary.activeTimeAverageDays ?? 0)} ativo / ${formatDays(dashboard.summary.waitTimeAverageDays ?? 0)} espera`;
    elements.blockedItemsPercent.textContent = `${Number(dashboard.summary.blockedItemsPercent ?? 0).toFixed(0)}%`;
    elements.blockedItemsDetail.textContent = `${dashboard.summary.blockedItemsCount ?? 0} itens bloqueados agora`;
    elements.averageBlockedDays.textContent = formatDays(dashboard.summary.averageBlockedDays ?? 0);
    elements.averageBlockedDaysDetail.textContent = 'média dos itens bloqueados agora';

    renderAgingWipTable(dashboard.charts.agingChart);
    renderInsights(dashboard.insights);
    renderScatterChart(dashboard.charts.leadTimeScatterplot);
    renderLeadTimeTrendChart(dashboard.charts.leadTimeTrend);
    renderRunChart(dashboard.charts.throughputRunChart);
    renderFlowEfficiencyTrendChart(dashboard.charts.flowEfficiencyTrend);
    renderBlockedRateChart(dashboard.charts.blockedRateChart);
    renderBlockedTimeChart(dashboard.charts.blockedTimeChart);
    renderStageTimeChart(dashboard.charts.stageTimeAverage);
    renderHistogramChart(dashboard.charts.cycleTimeHistogram, {
      p50: dashboard.summary.leadTimeP50,
      p85: dashboard.summary.leadTimeP85,
      p95: dashboard.summary.leadTimeP95
    });
    renderDynamicCfdChart(dashboard.charts.cumulativeFlow);
    renderFootnotes(dashboard);
    updateFilterChips(refreshedFilters);
    showToast('Painel atualizado com sucesso!', 'success');
  } catch (error) {
    elements.connectionStatus.textContent = 'Falha na consulta';
    const message = error.message ?? 'Falha inesperada';
    [
      elements.insightsGrid,
      elements.scatterChart,
      elements.leadTimeTrendChart,
      elements.runChart,
      elements.flowEfficiencyTrendChart,
      elements.blockedRateChart,
      elements.blockedTimeChart,
      elements.stageTimeChart,
      elements.histogramChart,
      elements.cfdChart,
      elements.agingWipTable
    ].forEach((element) => {
      element.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
    });
    showToast(`Erro: ${message}`, 'danger');
  } finally {
    elements.refreshButton.disabled = false;
    elements.refreshButton.classList.remove('is-loading');
    if (elements.refreshButtonLabel) {
      elements.refreshButtonLabel.textContent = REFRESH_BUTTON_DEFAULT_TEXT;
    } else {
      elements.refreshButton.textContent = REFRESH_BUTTON_DEFAULT_TEXT;
    }
    scheduleNextRefresh();
  }
}

elements.refreshButton.addEventListener('click', refreshDashboard);
elements.resetButton.addEventListener('click', () => {
  applyDefaultFilters();
  handlePotentialAutoRefresh();
  showToast('Filtros restaurados para o padrão', 'info');
});
elements.exportButton.addEventListener('click', () => {
  window.print();
});
elements.source.addEventListener('change', () => handlePotentialAutoRefresh());
elements.startDate.addEventListener('change', () => handlePotentialAutoRefresh());
elements.endDate.addEventListener('change', () => handlePotentialAutoRefresh());
elements.throughputPeriod.addEventListener('change', () => handlePotentialAutoRefresh({ reloadFilterOptions: false }));
elements.leadTimePeriod.addEventListener('change', () => handlePotentialAutoRefresh({ reloadFilterOptions: false }));
elements.startMode.addEventListener('change', () => handlePotentialAutoRefresh());
elements.themeSelect.addEventListener('change', () => {
  applyTheme(elements.themeSelect.value);
});
elements.refreshInterval.addEventListener('change', () => {
  saveJiraSettings();
  if (isManualRefreshMode()) {
    clearAutoRefreshSchedule();
    elements.connectionStatus.textContent = 'Atualização manual configurada.';
    showToast('Atualização manual ativada', 'info');
    return;
  }

  scheduleNextRefresh();
  elements.connectionStatus.textContent = 'Atualização automática configurada.';
  showToast(`Auto-atualização a cada ${elements.refreshInterval.value}`, 'info');
});

// INTERAÇÕES TOPBAR & BARRA DE FILTROS
if (elements.filterToggleBtn && elements.filtersToolbar) {
  elements.filterToggleBtn.addEventListener('click', () => {
    const isExpanded = elements.filtersToolbar.classList.toggle('is-expanded');
    elements.filtersToolbar.classList.toggle('is-collapsed', !isExpanded);
    elements.filterToggleBtn.classList.toggle('is-open', isExpanded);
  });
}

if (elements.quickThemeToggle) {
  elements.quickThemeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.contains('theme-dark');
    const newTheme = isDark ? 'current' : 'dark';
    applyTheme(newTheme);
    showToast(`Tema ${newTheme === 'dark' ? 'Escuro' : 'Claro'} ativado`, 'info');
  });
}

elements.datePresetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyDatePreset(button.dataset.datePreset);
  });
});

if (elements.agingSearchInput) {
  elements.agingSearchInput.addEventListener('input', (event) => {
    renderAgingWipTable(null, event.target.value);
  });
}

elements.datePickerTriggers.forEach((trigger) => {
  trigger.addEventListener('click', () => {
    const input = document.querySelector(`#${trigger.dataset.dateTarget}`);
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    openNativeDatePicker(input);
  });
});
[
  elements.startDate,
  elements.endDate
].forEach((input) => {
  input.addEventListener('focus', () => openNativeDatePicker(input));
});
elements.toggleJiraApiToken.addEventListener('click', revealJiraApiTokenForFiveSeconds);
[
  elements.jiraHost,
  elements.jiraEmail,
  elements.jiraApiToken,
  elements.jiraProjectKey,
  elements.jiraDefaultJql,
  elements.flowActiveStatuses,
  elements.flowInactiveStatuses
].forEach((element) => {
  element.addEventListener('input', saveJiraSettings);
});
elements.viewTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    setActiveView(tab.dataset.viewTab);
  });
});
elements.maximizeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const reportId = button.dataset.maximizeChart;
    if (!reportId) {
      return;
    }

    openChartModal(reportId);
  });
});
elements.infoTriggers.forEach((button) => {
  button.addEventListener('click', () => {
    const infoId = button.dataset.openInfo;
    if (!infoId) {
      return;
    }

    openInfoModal(infoId);
  });
});
elements.chartModalClose.addEventListener('click', closeChartModal);
elements.chartModalBackdrop.addEventListener('click', closeChartModal);
elements.infoModalClose.addEventListener('click', closeInfoModal);
elements.infoModalBackdrop.addEventListener('click', closeInfoModal);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !elements.chartModal.hidden) {
    closeChartModal();
  }
  if (event.key === 'Escape' && !elements.infoModal.hidden) {
    closeInfoModal();
  }
});

applyDefaultFilters();
loadSavedTheme();
async function initializeApp() {
  await loadSavedJiraSettings();
  setActiveView(activeView);
  await refreshDashboard();
}

void initializeApp();
