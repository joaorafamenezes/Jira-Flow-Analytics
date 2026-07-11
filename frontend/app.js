const elements = {
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
  heroTitle: document.querySelector('#heroTitle'),
  heroCopy: document.querySelector('#heroCopy'),
  refreshButton: document.querySelector('#refreshButton'),
  metricTabs: [...document.querySelectorAll('[data-metric-tab]')],
  metricViews: [...document.querySelectorAll('[data-metric-view]')],
  connectionStatus: document.querySelector('#connectionStatus'),
  throughputTotal: document.querySelector('#throughputTotal'),
  throughputPeriodLabel: document.querySelector('#throughputPeriodLabel'),
  throughputSourceLabel: document.querySelector('#throughputSourceLabel'),
  throughputIssueType: document.querySelector('#throughputIssueType'),
  throughputSquad: document.querySelector('#throughputSquad'),
  leadTimeAverage: document.querySelector('#leadTimeAverage'),
  leadTimeMedian: document.querySelector('#leadTimeMedian'),
  leadTimeCount: document.querySelector('#leadTimeCount'),
  leadTimePercentile50: document.querySelector('#leadTimePercentile50'),
  leadTimePercentile85: document.querySelector('#leadTimePercentile85'),
  leadTimePercentile90: document.querySelector('#leadTimePercentile90'),
  dataSourceLabel: document.querySelector('#dataSourceLabel'),
  throughputChart: document.querySelector('#throughputChart'),
  leadTimeChart: document.querySelector('#leadTimeChart')
};

const metricContent = {
  throughput: {
    title: 'Throughput em uma consulta visual',
    copy: 'Consulte dados reais do Jira ou massa mockada para validar volume entregue por periodo, filtros e tendencias sem depender do board estar cheio.'
  },
  'lead-time': {
    title: 'Lead Time com foco no compromisso real',
    copy: 'Analise o tempo entre a entrada em Pronto para Desenvolvimento e a chegada em Producao, com suporte a board, colunas e filtros operacionais.'
  }
};

let activeMetric = 'throughput';

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

function renderThroughputChart(buckets = {}) {
  elements.throughputChart.innerHTML = '';
  const entries = Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    elements.throughputChart.innerHTML = '<p class="empty-state">Nenhum dado de throughput para o filtro atual.</p>';
    return;
  }

  elements.throughputChart.appendChild(
    buildVerticalMetricChart(entries, {
      chartClassName: 'throughput-horizontal-chart',
      averageLabelPrefix: 'Media',
      valueFormatter: (value) => value,
      axisFormatter: (value) => Math.round(value)
    })
  );
}

function formatBucketLabel(label) {
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

function calculatePercentile(values, percentile) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(rank, sorted.length - 1))];
}

function formatDaysValue(value) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return Number(value).toFixed(1);
}

function renderLeadTimeChart(issues = []) {
  elements.leadTimeChart.innerHTML = '';

  if (issues.length === 0) {
    elements.leadTimeChart.innerHTML = '<p class="empty-state">Nenhuma issue de lead time para o filtro atual.</p>';
    return;
  }

  const monthlyGroups = issues.reduce((acc, issue) => {
    if (!issue.endAt) {
      return acc;
    }

    const monthKey = issue.endAt.slice(0, 7);
    if (!acc[monthKey]) {
      acc[monthKey] = {
        total: 0,
        count: 0
      };
    }

    acc[monthKey].total += issue.leadTimeDays;
    acc[monthKey].count += 1;
    return acc;
  }, {});

  const entries = Object.entries(monthlyGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, summary]) => ({
      month,
      average: Number((summary.total / summary.count).toFixed(2)),
      count: summary.count
    }));

  if (entries.length === 0) {
    elements.leadTimeChart.innerHTML = '<p class="empty-state">Nenhum agrupamento mensal disponivel.</p>';
    return;
  }

  elements.leadTimeChart.appendChild(
    buildVerticalMetricChart(
      entries.map((entry) => [entry.month, entry.average, entry.count]),
      {
        chartClassName: 'leadtime-monthly-chart',
        averageLabelPrefix: 'Media',
        valueFormatter: (value) => Number(value).toFixed(2),
        axisFormatter: (value) => Number(value).toFixed(1),
        tooltipFormatter: ([label, value, count]) => `${formatBucketLabel(label)}: ${Number(value).toFixed(2)} dias (${count} issue(s))`
      }
    )
  );
}

function buildVerticalMetricChart(entries, options = {}) {
  const {
    chartClassName = 'throughput-horizontal-chart',
    averageLabelPrefix = 'Media',
    valueFormatter = (value) => value,
    axisFormatter = (value) => value,
    tooltipFormatter
  } = options;

  const normalizedEntries = entries.map((entry) => ({
    label: entry[0],
    value: Number(entry[1]),
    extra: entry.slice(2)
  }));

  const max = Math.max(...normalizedEntries.map((entry) => entry.value), 1);
  const average = normalizedEntries.reduce((sum, entry) => sum + entry.value, 0) / normalizedEntries.length;
  const averagePercent = (average / max) * 100;

  const chart = document.createElement('div');
  chart.className = chartClassName;

  const yAxis = document.createElement('div');
  yAxis.className = 'throughput-y-axis';

  for (let step = 4; step >= 0; step -= 1) {
    const tick = document.createElement('div');
    tick.className = 'throughput-y-tick';
    tick.innerHTML = `<span>${axisFormatter((max / 4) * step)}</span>`;
    yAxis.appendChild(tick);
  }

  const plot = document.createElement('div');
  plot.className = 'throughput-plot';
  plot.innerHTML = `
    <div class="throughput-grid">
      ${Array.from({ length: 5 }).map(() => '<div class="throughput-grid-line"></div>').join('')}
    </div>
    <div class="throughput-average-line" style="bottom:${averagePercent}%">
      <span>${averageLabelPrefix} ${Number(average).toFixed(1)}</span>
    </div>
  `;

  const bars = document.createElement('div');
  bars.className = 'throughput-bars';

  normalizedEntries.forEach((entry) => {
    const barColumn = document.createElement('div');
    barColumn.className = 'throughput-bar-column';
    if (tooltipFormatter) {
      barColumn.title = tooltipFormatter([entry.label, entry.value, ...entry.extra]);
    }
    barColumn.innerHTML = `
      <span class="throughput-bar-value">${valueFormatter(entry.value)}</span>
      <div class="throughput-bar-wrap">
        <div class="throughput-bar-vertical" style="height:${(entry.value / max) * 100}%"></div>
      </div>
      <span class="throughput-bar-label">${formatBucketLabel(entry.label)}</span>
    `;
    bars.appendChild(barColumn);
  });

  plot.appendChild(bars);
  chart.appendChild(yAxis);
  chart.appendChild(plot);

  return chart;
}

function setActiveMetric(metric) {
  activeMetric = metric;
  const content = metricContent[metric];
  elements.heroTitle.textContent = content.title;
  elements.heroCopy.textContent = content.copy;

  elements.metricTabs.forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.metricTab === metric);
  });

  elements.metricViews.forEach((view) => {
    view.classList.toggle('is-active', view.dataset.metricView === metric);
  });
}

function getSharedFilters() {
  return {
    source: elements.source.value,
    startDate: elements.startDate.value,
    endDate: elements.endDate.value,
    issueType: elements.issueType.value.trim(),
    squad: elements.squad.value.trim(),
    assignee: elements.assignee.value.trim(),
    priority: elements.priority.value.trim()
  };
}

async function refreshDashboard() {
  const shared = getSharedFilters();

  elements.connectionStatus.textContent = 'Consultando...';

  try {
    const throughputPromise = getJson('/metrics/throughput', {
      ...shared,
      period: 'month'
    });

    const leadTimePromise = getJson('/metrics/lead-time', {
      ...shared,
      startMode: elements.startMode.value,
      boardId: elements.boardId.value,
      startColumnName: elements.startColumnName.value.trim(),
      endColumnName: elements.endColumnName.value.trim(),
      startFieldId: elements.startFieldId.value.trim()
    });

    const [throughputData, leadTimeData] = await Promise.all([throughputPromise, leadTimePromise]);

    elements.connectionStatus.textContent = `${shared.source.toUpperCase()} carregado`;
    elements.throughputTotal.textContent = throughputData.totalResolved ?? 0;
    elements.throughputPeriodLabel.textContent = `${throughputData.period} | ${throughputData.startDate} - ${throughputData.endDate}`;
    elements.throughputSourceLabel.textContent = throughputData.source ?? '-';
    elements.throughputIssueType.textContent = throughputData.filters?.issueType ?? 'Todos';
    elements.throughputSquad.textContent = throughputData.filters?.squad ?? 'Todas';
    elements.leadTimeAverage.textContent = leadTimeData.averageLeadTimeDays ?? 0;
    elements.leadTimeMedian.textContent = leadTimeData.medianLeadTimeDays ?? 0;
    elements.leadTimeCount.textContent = leadTimeData.issueCount ?? 0;
    const leadTimeValues = (leadTimeData.issues ?? [])
      .map((issue) => Number(issue.leadTimeDays))
      .filter((value) => Number.isFinite(value));
    elements.leadTimePercentile50.textContent = formatDaysValue(calculatePercentile(leadTimeValues, 50));
    elements.leadTimePercentile85.textContent = formatDaysValue(calculatePercentile(leadTimeValues, 85));
    elements.leadTimePercentile90.textContent = formatDaysValue(calculatePercentile(leadTimeValues, 90));
    elements.dataSourceLabel.textContent = `Fonte: ${leadTimeData.source}`;

    renderThroughputChart(throughputData.buckets);
    renderLeadTimeChart(leadTimeData.issues);
  } catch (error) {
    elements.connectionStatus.textContent = 'Falha na consulta';
    elements.throughputChart.innerHTML = `<p class="empty-state">${error.message}</p>`;
    elements.leadTimeChart.innerHTML = `<p class="empty-state">${error.message}</p>`;
    elements.leadTimePercentile50.textContent = '-';
    elements.leadTimePercentile85.textContent = '-';
    elements.leadTimePercentile90.textContent = '-';
  }
}

elements.refreshButton.addEventListener('click', refreshDashboard);
elements.metricTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    setActiveMetric(tab.dataset.metricTab);
  });
});

setActiveMetric(activeMetric);
refreshDashboard();
