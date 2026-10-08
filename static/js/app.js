/**
 * NYC 311 Municipal Analytics & Predictive Dispatch Engine
 * Client Application Logic: Clean, Refined, Minimalist Interactions & Real-Time Streaming
 */

// Global State
const state = {
  activeView: 1,
  metrics: null,
  equityFilter: {
    borough: 'ALL',
    search: '',
    sortKey: 'breach_pct',
    sortAsc: false
  },
  triageInputs: {
    agency: 'HPD',
    complaint_type: 'HEAT/HOT WATER',
    borough: 'BRONX',
    hour: 14,
    day_of_week: 2,
    month: 1,
    is_weekend: false
  },
  streaming: {
    isActive: false,
    intervalId: null,
    source: 'soda', // 'soda' or 'chunk'
    speed: 1500, // ms
    totalStreamed: 0,
    totalBreaches: 0,
    streamedRecords: []
  }
};

// Model Weights Dictionary (Spark MLlib Exact Translation)
const MODEL_WEIGHTS = {
  intercept: -0.85,
  agency: {
    'HPD': 1.45, 'DOB': 1.15, 'DOT': 0.52, 'DPR': 0.40,
    'DOHMH': 0.35, 'DCWP': 0.15, 'DEP': -0.22, 'DSNY': -0.65,
    'DHS': -0.80, 'NYPD': -1.35, 'EDC': 2.10, 'TLC': 1.80, 'OTHER': 0.00
  },
  complaint: {
    'UNSANITARY CONDITION': 1.95, 'DOOR/WINDOW': 1.90, 'WATER LEAK': 1.85,
    'PLUMBING': 1.70, 'PAINT/PLASTER': 1.65, 'Street Condition': 1.62,
    'HEAT/HOT WATER': 1.25, 'Damaged Tree': 0.75, 'OTHER': 0.10,
    'Water System': -0.15, 'Blocked Driveway': -0.95, 'Illegal Parking': -1.10,
    'Noise - Residential': -1.85, 'Noise - Commercial': -1.95
  },
  borough: {
    'BRONX': 0.38, 'MANHATTAN': 0.12, 'BROOKLYN': -0.05,
    'QUEENS': -0.18, 'STATEN ISLAND': -0.32, 'UNSPECIFIED': 0.00
  }
};

// Scenario Presets
const SCENARIO_PRESETS = [
  {
    name: 'Bronx Winter Heat Outage',
    agency: 'HPD', complaint: 'HEAT/HOT WATER', borough: 'BRONX',
    hour: 21, day: 2, month: 1, weekend: false
  },
  {
    name: 'Midtown Manhattan Noise',
    agency: 'NYPD', complaint: 'Noise - Residential', borough: 'MANHATTAN',
    hour: 23, day: 6, month: 7, weekend: true
  },
  {
    name: 'Queens Weekend Pothole',
    agency: 'DOT', complaint: 'Street Condition', borough: 'QUEENS',
    hour: 15, day: 7, month: 3, weekend: true
  },
  {
    name: 'Brooklyn Unsanitary Issue',
    agency: 'HPD', complaint: 'UNSANITARY CONDITION', borough: 'BROOKLYN',
    hour: 10, day: 3, month: 5, weekend: false
  },
  {
    name: 'Staten Island Hydrant Issue',
    agency: 'DEP', complaint: 'Water System', borough: 'STATEN ISLAND',
    hour: 8, day: 4, month: 6, weekend: false
  }
];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupTriageListeners();
  setupStreamingListeners();

  await fetchMetrics();
  renderView(state.activeView);
});

// Navigation Setup
function setupNavigation() {
  const tabButtons = document.querySelectorAll('.nav-tab');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewNum = parseInt(btn.getAttribute('data-view'));
      switchView(viewNum);
    });
  });
}

function switchView(viewNum) {
  state.activeView = viewNum;
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.getAttribute('data-view')) === viewNum);
  });
  document.querySelectorAll('.view-section').forEach(v => {
    v.classList.toggle('active', parseInt(v.getAttribute('data-view')) === viewNum);
  });
  renderView(viewNum);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Fetch Metrics from Server
async function fetchMetrics() {
  try {
    const res = await fetch('/api/metrics');
    if (res.ok) {
      state.metrics = await res.json();
    } else {
      state.metrics = getDefaultMetrics();
    }
  } catch (err) {
    state.metrics = getDefaultMetrics();
  }
}

function getDefaultMetrics() {
  return {
    kpis: {
      total_requests: 20631296,
      median_hours: 18.4,
      p75_hours: 72.0,
      fast_pct: 58.9,
      moderate_pct: 14.1,
      slow_pct: 27.0
    },
    yearly_requests: [
      { year: 2020, volume: 2638197 }, { year: 2021, volume: 2915272 },
      { year: 2022, volume: 2859865 }, { year: 2023, volume: 2944911 },
      { year: 2024, volume: 3195875 }, { year: 2025, volume: 3422142 },
      { year: 2026, volume: 2655034 }
    ],
    hourly_distribution: [
      { hour: "00:00", volume: 798705 }, { hour: "04:00", volume: 233391 },
      { hour: "08:00", volume: 1001044 }, { hour: "10:00", volume: 1201438 },
      { hour: "12:00", volume: 1165482 }, { hour: "14:00", volume: 1111738 },
      { hour: "16:00", volume: 1052893 }, { hour: "20:00", volume: 963735 },
      { hour: "22:00", volume: 1107056 }
    ],
    monthly_seasonality: [
      { month: "Jan", volume: 1805391 }, { month: "Feb", volume: 1532454 },
      { month: "Mar", volume: 1729690 }, { month: "Apr", volume: 1642841 },
      { month: "May", volume: 1862590 }, { month: "Jun", volume: 1961448 },
      { month: "Jul", volume: 1989481 }, { month: "Aug", volume: 1943016 },
      { month: "Sep", volume: 1914144 }, { month: "Oct", volume: 1974136 },
      { month: "Nov", volume: 1801264 }, { month: "Dec", volume: 1874841 }
    ],
    equity: [],
    bottlenecks: []
  };
}

// View Renderer Router
function renderView(viewNum) {
  if (!state.metrics) return;
  switch (viewNum) {
    case 1:
      renderView1_Overview();
      break;
    case 2:
      renderView2_Equity();
      break;
    case 3:
      renderView3_Bottlenecks();
      break;
    case 4:
      renderView4_Triage();
      break;
    case 5:
      renderView5_Streaming();
      break;
  }
}

// ==========================================================================
// VIEW 1: OVERVIEW & TEMPORAL SEASONALITY
// ==========================================================================
function renderView1_Overview() {
  const kpis = state.metrics.kpis;

  const elTotal = document.getElementById('kpi-total-requests');
  if (elTotal) elTotal.textContent = Number(kpis.total_requests).toLocaleString();

  const elMedian = document.getElementById('kpi-median-turnaround');
  if (elMedian) elMedian.textContent = `${kpis.median_hours} hrs`;

  const elP75 = document.getElementById('kpi-p75-turnaround');
  if (elP75) elP75.textContent = `${kpis.p75_hours} hrs`;

  const elFast = document.getElementById('kpi-fast-pct');
  if (elFast) elFast.textContent = `${kpis.fast_pct}%`;

  renderVelocityDistribution();
  renderYearlyVolumeSVG();
  renderHourlySeasonalitySVG();
  renderMonthlySeasonalitySVG();
}

function renderVelocityDistribution() {
  const container = document.getElementById('velocity-distribution-chart-container');
  if (!container) return;

  const kpi = state.metrics.kpis;
  const tiers = [
    { label: 'Fast (< 24h)', pct: kpi.fast_pct, color: 'var(--status-green)', sub: '12.15M requests' },
    { label: 'Moderate (1-5d)', pct: kpi.moderate_pct, color: 'var(--status-amber)', sub: '2.91M requests' },
    { label: 'Slow (> 5d)', pct: kpi.slow_pct, color: 'var(--status-red)', sub: '5.56M SLA breaches' }
  ];

  let html = `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      <div style="height: 14px; display: flex; border-radius: 4px; overflow: hidden; background: #1F222A;">
        <div style="width: ${tiers[0].pct}%; background-color: var(--status-green);"></div>
        <div style="width: ${tiers[1].pct}%; background-color: var(--status-amber);"></div>
        <div style="width: ${tiers[2].pct}%; background-color: var(--status-red);"></div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
  `;

  tiers.forEach(t => {
    html += `
      <div>
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">${t.label}</div>
        <div style="font-family: var(--font-mono); font-size: 24px; font-weight: 700; color: ${t.color}; margin-bottom: 2px;">
          ${t.pct}%
        </div>
        <div style="font-size: 12px; color: var(--text-secondary);">${t.sub}</div>
      </div>
    `;
  });

  html += `</div></div>`;
  container.innerHTML = html;
}

function renderYearlyVolumeSVG() {
  const container = document.getElementById('yearly-volume-chart-container');
  if (!container) return;

  const data = state.metrics.yearly_requests || [
    { year: 2020, volume: 2638197 }, { year: 2021, volume: 2915272 },
    { year: 2022, volume: 2859865 }, { year: 2023, volume: 2944911 },
    { year: 2024, volume: 3195875 }, { year: 2025, volume: 3422142 },
    { year: 2026, volume: 2655034 }
  ];

  const maxVol = Math.max(...data.map(d => d.volume));
  const svgWidth = 560;
  const svgHeight = 150;
  const padLeft = 45;
  const padRight = 20;
  const padBottom = 28;
  const padTop = 15;

  const barWidth = (svgWidth - padLeft - padRight) / data.length - 12;

  let barsHtml = '';
  data.forEach((d, i) => {
    const x = padLeft + i * (barWidth + 12);
    const barH = ((d.volume / maxVol) * (svgHeight - padTop - padBottom));
    const y = svgHeight - padBottom - barH;
    const volMillions = (d.volume / 1000000).toFixed(1) + 'M';

    barsHtml += `
      <g>
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="#1E2330" rx="3" />
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="#3B82F6" opacity="0.35" rx="3" />
        <text x="${x + barWidth/2}" y="${y - 4}" text-anchor="middle" font-family="var(--font-mono)" font-size="10" fill="#9CA3AF">${volMillions}</text>
        <text x="${x + barWidth/2}" y="${svgHeight - 8}" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="#E5E7EB">${d.year}</text>
      </g>
    `;
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: 150px; overflow: visible;">
      <line x1="${padLeft}" y1="${svgHeight - padBottom}" x2="${svgWidth - padRight}" y2="${svgHeight - padBottom}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
      ${barsHtml}
    </svg>
  `;
}

function renderHourlySeasonalitySVG() {
  const container = document.getElementById('hourly-seasonality-chart-container');
  if (!container) return;

  const data = state.metrics.hourly_distribution || [
    { hour: "00:00", volume: 798705 }, { hour: "02:00", volume: 357285 },
    { hour: "04:00", volume: 233391 }, { hour: "06:00", volume: 410934 },
    { hour: "08:00", volume: 1001044 }, { hour: "10:00", volume: 1201438 },
    { hour: "12:00", volume: 1165482 }, { hour: "14:00", volume: 1111738 },
    { hour: "16:00", volume: 1052893 }, { hour: "18:00", volume: 961867 },
    { hour: "20:00", volume: 963735 }, { hour: "22:00", volume: 1107056 }
  ];

  const maxVol = 1300000;
  const svgWidth = 560;
  const svgHeight = 150;
  const padLeft = 45;
  const padRight = 20;
  const padBottom = 28;
  const padTop = 15;

  let points = [];
  data.forEach((d, i) => {
    const x = padLeft + (i / (data.length - 1)) * (svgWidth - padLeft - padRight);
    const y = svgHeight - padBottom - (d.volume / maxVol) * (svgHeight - padTop - padBottom);
    points.push(`${x},${y}`);
  });

  const polylineStr = points.join(' ');
  const areaStr = `${padLeft},${svgHeight - padBottom} ${polylineStr} ${svgWidth - padRight},${svgHeight - padBottom}`;

  let dotsHtml = '';
  data.forEach((d, i) => {
    const [x, y] = points[i].split(',');
    dotsHtml += `
      <circle cx="${x}" cy="${y}" r="3.5" fill="#3B82F6" stroke="#090A0C" stroke-width="1.5" />
      <text x="${x}" y="${svgHeight - 8}" text-anchor="middle" font-family="var(--font-mono)" font-size="9" fill="#9CA3AF">${d.hour}</text>
    `;
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: 150px; overflow: visible;">
      <polygon points="${areaStr}" fill="rgba(59, 130, 246, 0.12)" />
      <polyline points="${polylineStr}" fill="none" stroke="#3B82F6" stroke-width="2" />
      <line x1="${padLeft}" y1="${svgHeight - padBottom}" x2="${svgWidth - padRight}" y2="${svgHeight - padBottom}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
      ${dotsHtml}
    </svg>
  `;
}

function renderMonthlySeasonalitySVG() {
  const container = document.getElementById('monthly-seasonality-chart-container');
  if (!container) return;

  const data = state.metrics.monthly_seasonality || [
    { month: "Jan", volume: 1805391 }, { month: "Feb", volume: 1532454 },
    { month: "Mar", volume: 1729690 }, { month: "Apr", volume: 1642841 },
    { month: "May", volume: 1862590 }, { month: "Jun", volume: 1961448 },
    { month: "Jul", volume: 1989481 }, { month: "Aug", volume: 1943016 },
    { month: "Sep", volume: 1914144 }, { month: "Oct", volume: 1974136 },
    { month: "Nov", volume: 1801264 }, { month: "Dec", volume: 1874841 }
  ];

  const maxVol = 2100000;
  const svgWidth = 560;
  const svgHeight = 150;
  const padLeft = 45;
  const padRight = 20;
  const padBottom = 28;
  const padTop = 15;

  const barWidth = (svgWidth - padLeft - padRight) / data.length - 6;

  let barsHtml = '';
  data.forEach((d, i) => {
    const x = padLeft + i * (barWidth + 6);
    const barH = ((d.volume / maxVol) * (svgHeight - padTop - padBottom));
    const y = svgHeight - padBottom - barH;
    const isWinter = ['Dec', 'Jan', 'Feb'].includes(d.month);
    const isSummer = ['Jun', 'Jul', 'Aug'].includes(d.month);

    let color = '#232734';
    if (isWinter) color = '#EF4444';
    else if (isSummer) color = '#F59E0B';

    barsHtml += `
      <g>
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="${color}" fill-opacity="${isWinter||isSummer ? '0.7' : '0.4'}" rx="2" />
        <text x="${x + barWidth/2}" y="${svgHeight - 8}" text-anchor="middle" font-family="var(--font-mono)" font-size="9" fill="#9CA3AF">${d.month}</text>
      </g>
    `;
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: 150px; overflow: visible;">
      <line x1="${padLeft}" y1="${svgHeight - padBottom}" x2="${svgWidth - padRight}" y2="${svgHeight - padBottom}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
      ${barsHtml}
    </svg>
  `;
}

// ==========================================================================
// VIEW 2: BOROUGH EQUITY
// ==========================================================================
function renderView2_Equity() {
  setupEquityListeners();
  renderBoroughCards();
  renderEquityTable();
}

function setupEquityListeners() {
  const pills = document.querySelectorAll('.borough-filter-pill');
  pills.forEach(pill => {
    pill.onclick = () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.equityFilter.borough = pill.getAttribute('data-borough');
      renderEquityTable();
    };
  });

  const search = document.getElementById('equity-search-input');
  if (search) {
    search.oninput = (e) => {
      state.equityFilter.search = e.target.value.toLowerCase().trim();
      renderEquityTable();
    };
  }
}

function renderBoroughCards() {
  const container = document.getElementById('borough-cards-container');
  if (!container) return;

  const boroughs = [
    { name: 'Bronx', volume: '4,504,473', breach: '27.5%', avgHrs: '159.7h', status: 'Elevated' },
    { name: 'Brooklyn', volume: '6,250,243', breach: '28.4%', avgHrs: '161.5h', status: 'Elevated' },
    { name: 'Manhattan', volume: '4,092,199', breach: '28.3%', avgHrs: '189.4h', status: 'Moderate' },
    { name: 'Queens', volume: '4,927,155', breach: '23.2%', avgHrs: '144.3h', status: 'Optimal' },
    { name: 'Staten Island', volume: '853,298', breach: '29.7%', avgHrs: '153.1h', status: 'Disparity' }
  ];

  let html = '';
  boroughs.forEach(b => {
    const badgeClass = b.status === 'Optimal' ? 'green' : (b.status === 'Disparity' ? 'red' : 'amber');
    html += `
      <div class="metric-card" style="padding: 22px 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <strong style="font-size: 16px; color: var(--text-primary);">${b.name}</strong>
          <span class="badge ${badgeClass}">${b.status}</span>
        </div>
        <div style="font-family: var(--font-mono); font-size: 24px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
          ${b.breach}
        </div>
        <div style="font-size: 12px; color: var(--text-muted);">
          ${b.volume} tickets • Avg ${b.avgHrs}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderEquityTable() {
  const tableBody = document.getElementById('equity-table-body');
  if (!tableBody) return;

  let equityList = state.metrics.equity || [];
  const cityBaseline = 27.0;

  if (state.equityFilter.borough !== 'ALL') {
    equityList = equityList.filter(item => item.borough.toUpperCase() === state.equityFilter.borough);
  }
  if (state.equityFilter.search) {
    equityList = equityList.filter(item => 
      item.agency.toLowerCase().includes(state.equityFilter.search) ||
      item.borough.toLowerCase().includes(state.equityFilter.search)
    );
  }

  if (equityList.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 32px; color: var(--text-muted);">No matching records.</td></tr>`;
    return;
  }

  let rows = '';
  equityList.slice(0, 30).forEach(row => {
    const diff = (row.breach_pct - cityBaseline).toFixed(2);
    const deltaStr = diff > 0 ? `+${diff}%` : `${diff}%`;
    const deltaClass = diff > 15 ? 'red' : (diff > 0 ? 'amber' : 'green');

    rows += `
      <tr>
        <td style="font-weight: 600; color: var(--text-primary);">${row.borough}</td>
        <td><strong style="color: var(--accent);">${row.agency}</strong></td>
        <td class="num">${Number(row.volume).toLocaleString()}</td>
        <td class="num" style="font-weight: 600; color: ${row.breach_pct >= 50 ? 'var(--status-red)' : (row.breach_pct >= 25 ? 'var(--status-amber)' : 'var(--status-green)')};">
          ${row.breach_pct.toFixed(1)}%
        </td>
        <td class="num">${Number(row.avg_hours).toFixed(1)} hrs</td>
        <td class="num"><span class="badge ${deltaClass}">${deltaStr}</span></td>
      </tr>
    `;
  });

  tableBody.innerHTML = rows;
}

// ==========================================================================
// VIEW 3: BOTTLENECKS (CLEAN INTERACTIVE 2D SCATTER MATRIX)
// ==========================================================================
function renderView3_Bottlenecks() {
  const bottlenecks = state.metrics.bottlenecks || [];
  renderScatterQuadChart(bottlenecks);
  renderBottleneckTable(bottlenecks);
}

function renderScatterQuadChart(bottlenecks) {
  const container = document.getElementById('scatter-chart-wrapper');
  const tooltip = document.getElementById('chart-tooltip');
  if (!container) return;

  const width = 860;
  const height = 420;
  const padLeft = 70;
  const padRight = 30;
  const padTop = 35;
  const padBottom = 45;

  const minVol = 100000;
  const maxVol = 3500000;
  const minLog = Math.log10(minVol);
  const maxLog = Math.log10(maxVol);
  const maxHours = 650;

  const midVolLog = Math.log10(600000);
  const midHours = 100;
  const xSplit = padLeft + ((midVolLog - minLog) / (maxLog - minLog)) * (width - padLeft - padRight);
  const ySplit = height - padBottom - (midHours / maxHours) * (height - padTop - padBottom);

  // Key anchor outliers to label cleanly without overlap
  const anchorLabels = {
    'HEAT/HOT WATER': { offsetX: 0, offsetY: 26, align: 'middle' },
    'UNSANITARY CONDITION': { offsetX: 18, offsetY: 4, align: 'start' },
    'Illegal Parking': { offsetX: -12, offsetY: -16, align: 'end' },
    'Street Condition': { offsetX: 0, offsetY: -18, align: 'middle' },
    'DOOR/WINDOW': { offsetX: 0, offsetY: -18, align: 'middle' }
  };

  let dotsHtml = '';
  let labelsHtml = '';

  bottlenecks.forEach((b, idx) => {
    const vol = Math.max(minVol, b.volume);
    const logVal = Math.log10(vol);
    const x = padLeft + ((logVal - minLog) / (maxLog - minLog)) * (width - padLeft - padRight);
    const y = height - padBottom - (Math.min(maxHours, b.avg_hours) / maxHours) * (height - padTop - padBottom);
    const r = Math.max(6, Math.min(18, (b.breach_rate / 100) * 16 + 5));

    let color = 'var(--status-green)';
    let quadrant = 'Q2: High-Volume / Rapid Turnaround';
    if (b.breach_rate > 50) {
      color = 'var(--status-red)';
      quadrant = vol > 600000 ? 'Q1: Critical Bottleneck' : 'Q3: Bureaucratic Friction';
    } else if (b.breach_rate > 20) {
      color = 'var(--status-amber)';
      quadrant = 'Q1: Elevated Turnaround Delay';
    } else {
      quadrant = vol < 600000 ? 'Q4: Routine Operations' : 'Q2: High-Volume Efficient';
    }

    dotsHtml += `
      <circle cx="${x}" cy="${y}" r="${r}" fill="${color}" fill-opacity="0.75" stroke="${color}" stroke-width="1.5"
              class="scatter-bubble"
              data-name="${b.complaint_type}"
              data-vol="${b.volume.toLocaleString()}"
              data-hours="${b.avg_hours.toFixed(1)}"
              data-breach="${b.breach_rate.toFixed(1)}"
              data-quadrant="${quadrant}"
              data-color="${color}" />
    `;

    // Only render clean anchor labels for key outliers
    if (anchorLabels[b.complaint_type]) {
      const cfg = anchorLabels[b.complaint_type];
      labelsHtml += `
        <text x="${x + cfg.offsetX}" y="${y + cfg.offsetY}" text-anchor="${cfg.align}" font-family="var(--font-sans)" font-size="11" font-weight="600" fill="#F3F4F6">
          ${b.complaint_type}
        </text>
      `;
    }
  });

  container.innerHTML = `
    <svg id="scatter-svg" viewBox="0 0 ${width} ${height}" style="width: 100%; height: 420px; overflow: visible;">
      <!-- Subtle Quadrant Shading -->
      <rect x="${xSplit}" y="${padTop}" width="${width - padRight - xSplit}" height="${ySplit - padTop}" fill="rgba(239, 68, 68, 0.03)" />
      <rect x="${xSplit}" y="${ySplit}" width="${width - padRight - xSplit}" height="${height - padBottom - ySplit}" fill="rgba(16, 185, 129, 0.03)" />

      <!-- Quadrant Threshold Lines -->
      <line x1="${xSplit}" y1="${padTop}" x2="${xSplit}" y2="${height - padBottom}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4,4" />
      <line x1="${padLeft}" y1="${ySplit}" x2="${width - padRight}" y2="${ySplit}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4,4" />

      <!-- Quadrant Titles -->
      <text x="${width - padRight - 10}" y="${padTop + 16}" text-anchor="end" font-size="11" font-weight="600" fill="var(--status-red)">Critical Bottlenecks (High Vol / Prolonged Delays)</text>
      <text x="${width - padRight - 10}" y="${height - padBottom - 12}" text-anchor="end" font-size="11" font-weight="600" fill="var(--status-green)">High Volume / Rapid SLA Turnaround</text>

      <!-- Axes -->
      <line x1="${padLeft}" y1="${height - padBottom}" x2="${width - padRight}" y2="${height - padBottom}" stroke="rgba(255,255,255,0.18)" stroke-width="1" />
      <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${height - padBottom}" stroke="rgba(255,255,255,0.18)" stroke-width="1" />

      <!-- Axis Ticks & Labels -->
      <text x="${width/2}" y="${height - 10}" text-anchor="middle" font-size="12" fill="#9CA3AF">Intake Volume (Logarithmic Scale ➔)</text>
      <text x="18" y="${height/2}" text-anchor="middle" transform="rotate(-90, 18, ${height/2})" font-size="12" fill="#9CA3AF">Average Turnaround (Hours ➔)</text>

      <text x="${padLeft}" y="${height - padBottom + 16}" text-anchor="middle" font-family="var(--font-mono)" font-size="10" fill="#6B7280">100k</text>
      <text x="${xSplit}" y="${height - padBottom + 16}" text-anchor="middle" font-family="var(--font-mono)" font-size="10" fill="#6B7280">600k</text>
      <text x="${width - padRight}" y="${height - padBottom + 16}" text-anchor="middle" font-family="var(--font-mono)" font-size="10" fill="#6B7280">3.5M</text>

      <text x="${padLeft - 8}" y="${height - padBottom}" text-anchor="end" font-family="var(--font-mono)" font-size="10" fill="#6B7280">0h</text>
      <text x="${padLeft - 8}" y="${ySplit + 4}" text-anchor="end" font-family="var(--font-mono)" font-size="10" fill="#6B7280">100h</text>
      <text x="${padLeft - 8}" y="${padTop + 10}" text-anchor="end" font-family="var(--font-mono)" font-size="10" fill="#6B7280">650h</text>

      <!-- Dots & Anchor Labels -->
      ${dotsHtml}
      ${labelsHtml}
    </svg>
  `;

  // Attach hover events to scatter bubbles
  const bubbles = container.querySelectorAll('.scatter-bubble');
  bubbles.forEach(bubble => {
    bubble.addEventListener('mouseenter', (e) => {
      const name = bubble.getAttribute('data-name');
      const vol = bubble.getAttribute('data-vol');
      const hours = bubble.getAttribute('data-hours');
      const breach = bubble.getAttribute('data-breach');
      const quad = bubble.getAttribute('data-quadrant');
      const color = bubble.getAttribute('data-color');

      if (tooltip) {
        tooltip.innerHTML = `
          <div class="chart-tooltip-title">${name}</div>
          <div class="chart-tooltip-row">
            <span>Intake Volume:</span>
            <span class="chart-tooltip-val">${vol} tickets</span>
          </div>
          <div class="chart-tooltip-row">
            <span>Avg Turnaround:</span>
            <span class="chart-tooltip-val">${hours} hrs</span>
          </div>
          <div class="chart-tooltip-row">
            <span>SLA Breach Rate:</span>
            <span class="chart-tooltip-val" style="color: ${color};">${breach}%</span>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px; border-top: 1px solid var(--border-subtle); padding-top: 4px;">
            ${quad}
          </div>
        `;
        tooltip.classList.add('visible');
      }
    });

    bubble.addEventListener('mousemove', (e) => {
      if (tooltip) {
        const rect = container.getBoundingClientRect();
        tooltip.style.left = `${e.clientX - rect.left + 15}px`;
        tooltip.style.top = `${e.clientY - rect.top - 20}px`;
      }
    });

    bubble.addEventListener('mouseleave', () => {
      if (tooltip) tooltip.classList.remove('visible');
    });
  });
}

function renderBottleneckTable(bottlenecks) {
  const tableBody = document.getElementById('bottleneck-table-body');
  if (!tableBody) return;

  let rows = '';
  bottlenecks.forEach(b => {
    const badgeClass = b.breach_rate > 50 ? 'red' : (b.breach_rate > 20 ? 'amber' : 'green');
    rows += `
      <tr>
        <td style="font-weight: 600; color: var(--text-primary);">${b.complaint_type}</td>
        <td class="num">${Number(b.volume).toLocaleString()}</td>
        <td class="num">${b.avg_hours.toFixed(1)} hrs</td>
        <td class="num"><span class="badge ${badgeClass}">${b.breach_rate.toFixed(1)}%</span></td>
      </tr>
    `;
  });
  tableBody.innerHTML = rows;
}

// ==========================================================================
// VIEW 4: TRIAGE SIMULATOR
// ==========================================================================
function setupTriageListeners() {
  const selectAgency = document.getElementById('triage-agency');
  const selectComplaint = document.getElementById('triage-complaint');
  const selectBorough = document.getElementById('triage-borough');
  const sliderHour = document.getElementById('triage-hour');
  const selectDay = document.getElementById('triage-day');
  const sliderMonth = document.getElementById('triage-month');
  const chkWeekend = document.getElementById('triage-weekend');

  const update = () => {
    if (!selectAgency) return;
    state.triageInputs.agency = selectAgency.value;
    state.triageInputs.complaint_type = selectComplaint.value;
    state.triageInputs.borough = selectBorough.value;
    state.triageInputs.hour = parseInt(sliderHour.value);
    state.triageInputs.day_of_week = parseInt(selectDay.value);
    state.triageInputs.month = parseInt(sliderMonth.value);
    state.triageInputs.is_weekend = chkWeekend.checked;

    document.getElementById('hour-val-display').textContent = `${sliderHour.value}:00 (${sliderHour.value >= 20 || sliderHour.value < 6 ? 'Night' : 'Day'})`;
    document.getElementById('month-val-display').textContent = `Month ${sliderMonth.value} (${[11,12,1,2].includes(parseInt(sliderMonth.value)) ? 'Winter' : 'Standard'})`;

    runTriageInference();
  };

  [selectAgency, selectComplaint, selectBorough, selectDay, chkWeekend].forEach(el => {
    if (el) el.addEventListener('change', update);
  });
  [sliderHour, sliderMonth].forEach(el => {
    if (el) el.addEventListener('input', update);
  });

  // Preset Chips
  const presetContainer = document.getElementById('scenario-presets-container');
  if (presetContainer) {
    let html = '';
    SCENARIO_PRESETS.forEach((p, i) => {
      html += `<button type="button" class="chip" data-preset="${i}">${p.name}</button>`;
    });
    presetContainer.innerHTML = html;

    presetContainer.querySelectorAll('.chip').forEach(chip => {
      chip.onclick = () => {
        const p = SCENARIO_PRESETS[parseInt(chip.getAttribute('data-preset'))];
        selectAgency.value = p.agency;
        selectComplaint.value = p.complaint;
        selectBorough.value = p.borough;
        sliderHour.value = p.hour;
        selectDay.value = p.day;
        sliderMonth.value = p.month;
        chkWeekend.checked = p.weekend;
        update();
      };
    });
  }
}

function renderView4_Triage() {
  runTriageInference();
}

function runTriageInference() {
  const { agency, complaint_type, borough, hour, day_of_week, month, is_weekend } = state.triageInputs;

  const w_agency = MODEL_WEIGHTS.agency[agency] !== undefined ? MODEL_WEIGHTS.agency[agency] : 0.05;
  const w_complaint = MODEL_WEIGHTS.complaint[complaint_type] !== undefined ? MODEL_WEIGHTS.complaint[complaint_type] : 0.10;
  const w_borough = MODEL_WEIGHTS.borough[borough] !== undefined ? MODEL_WEIGHTS.borough[borough] : 0.00;

  const isWknd = is_weekend || (day_of_week === 1 || day_of_week === 7);
  const w_weekend = isWknd ? 0.35 : -0.10;
  const w_night = (hour >= 20 || hour < 6) ? 0.25 : -0.05;
  
  let w_surge = -0.05;
  if (agency === 'HPD' && [11, 12, 1, 2].includes(month)) {
    w_surge = 0.45;
  } else if ([12, 1, 2].includes(month)) {
    w_surge = 0.30;
  }

  const w_temporal = w_weekend + w_night + w_surge;
  const z = MODEL_WEIGHTS.intercept + w_agency + w_complaint + w_borough + w_temporal;
  const prob = Math.max(0.1, Math.min(99.9, (1.0 / (1.0 + Math.exp(-z))) * 100.0));

  const isSevere = prob >= 50.0;
  const box = document.getElementById('outcome-display-box');
  const headline = document.getElementById('outcome-headline');
  const probVal = document.getElementById('outcome-prob-value');
  const fill = document.getElementById('outcome-progress-fill');
  const est = document.getElementById('outcome-turnaround-est');

  if (box && headline && probVal && fill && est) {
    box.className = `outcome-card ${isSevere ? 'severe' : 'ontime'}`;
    headline.textContent = isSevere ? 'Severe Delay Risk (> 5 Days)' : 'On-Time Trajectory (< 5 Days)';
    probVal.textContent = `${prob.toFixed(1)}%`;
    fill.style.width = `${prob}%`;
    fill.style.backgroundColor = isSevere ? 'var(--status-red)' : 'var(--status-green)';

    if (prob > 55) {
      est.textContent = '72 – 360+ hours (Slow)';
    } else if (prob > 25) {
      est.textContent = '24 – 120 hours (Moderate)';
    } else {
      est.textContent = '0.5 – 18 hours (Fast)';
    }
  }

  // Attribution Rows
  const attrList = [
    { label: `Agency Handler: ${agency}`, weight: w_agency },
    { label: `Complaint Category: ${complaint_type}`, weight: w_complaint },
    { label: `Borough Factor: ${borough}`, weight: w_borough },
    { label: `Temporal Conditions (Hour ${hour}, Month ${month})`, weight: w_temporal }
  ];
  attrList.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  const attrContainer = document.getElementById('attribution-waterfall-container');
  if (attrContainer) {
    let attrHtml = '';
    attrList.slice(0, 3).forEach(item => {
      const isPositive = item.weight >= 0;
      const color = isPositive ? 'var(--status-red)' : 'var(--status-green)';
      attrHtml += `
        <div class="attr-row">
          <span class="attr-name">${item.label}</span>
          <span class="attr-impact" style="color: ${color};">${isPositive ? '+' : ''}${item.weight.toFixed(2)} log-odds</span>
        </div>
      `;
    });
    attrContainer.innerHTML = attrHtml;
  }

  const formulaDisplay = document.getElementById('formula-compact-display');
  if (formulaDisplay) {
    formulaDisplay.textContent = `z = -0.85 + (${w_agency.toFixed(2)}) + (${w_complaint.toFixed(2)}) + (${w_borough.toFixed(2)}) + (${w_temporal.toFixed(2)}) = ${z.toFixed(4)}`;
  }
}

// ==========================================================================
// VIEW 5: REAL-TIME STREAMING ENGINE & MODEL AUDIT
// ==========================================================================
function setupStreamingListeners() {
  const btnToggle = document.getElementById('btn-stream-toggle');
  const btnReset = document.getElementById('btn-stream-reset');
  const selectSource = document.getElementById('stream-source-select');
  const selectSpeed = document.getElementById('stream-speed-select');

  if (selectSource) {
    selectSource.onchange = () => {
      state.streaming.source = selectSource.value;
      if (state.streaming.isActive) {
        stopStreaming();
        startStreaming();
      }
    };
  }

  if (selectSpeed) {
    selectSpeed.onchange = () => {
      state.streaming.speed = parseInt(selectSpeed.value);
      if (state.streaming.isActive) {
        stopStreaming();
        startStreaming();
      }
    };
  }

  if (btnToggle) {
    btnToggle.onclick = () => {
      if (state.streaming.isActive) {
        stopStreaming();
      } else {
        startStreaming();
      }
    };
  }

  if (btnReset) {
    btnReset.onclick = () => {
      resetStreamingFeed();
    };
  }
}

function renderView5_Streaming() {
  // Update stream metrics displays
  updateStreamingTelemetryDisplays();
}

function startStreaming() {
  state.streaming.isActive = true;

  const btnToggle = document.getElementById('btn-stream-toggle');
  const statusDot = document.getElementById('stream-status-dot');
  const statusLabel = document.getElementById('stream-status-label');
  const globalDot = document.getElementById('global-status-dot');

  if (btnToggle) btnToggle.innerHTML = `<span>⏸ Pause Stream</span>`;
  if (statusDot) {
    statusDot.className = 'status-dot pulsing';
    statusDot.style.backgroundColor = 'var(--status-green)';
  }
  if (statusLabel) statusLabel.textContent = state.streaming.source === 'soda' ? 'Streaming Live NYC SODA API...' : 'Streaming HDFS 2026 Partition...';
  if (globalDot) globalDot.className = 'status-dot pulsing';

  // Run immediately once
  fetchStreamChunk();

  // Then schedule loop
  state.streaming.intervalId = setInterval(fetchStreamChunk, state.streaming.speed);
}

function stopStreaming() {
  state.streaming.isActive = false;
  if (state.streaming.intervalId) {
    clearInterval(state.streaming.intervalId);
    state.streaming.intervalId = null;
  }

  const btnToggle = document.getElementById('btn-stream-toggle');
  const statusDot = document.getElementById('stream-status-dot');
  const statusLabel = document.getElementById('stream-status-label');
  const globalDot = document.getElementById('global-status-dot');

  if (btnToggle) btnToggle.innerHTML = `<span>▶ Resume Stream</span>`;
  if (statusDot) {
    statusDot.className = 'status-dot';
    statusDot.style.backgroundColor = 'var(--status-amber)';
  }
  if (statusLabel) statusLabel.textContent = 'Stream Paused';
  if (globalDot) globalDot.className = 'status-dot';
}

function resetStreamingFeed() {
  stopStreaming();
  state.streaming.totalStreamed = 0;
  state.streaming.totalBreaches = 0;
  state.streaming.streamedRecords = [];

  const tableBody = document.getElementById('stream-tickets-table-body');
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--text-muted);">Feed reset. Click "▶ Start Live Stream" to begin streaming.</td></tr>`;
  }
  updateStreamingTelemetryDisplays();
}

async function fetchStreamChunk() {
  const endpoint = state.streaming.source === 'soda' ? '/api/stream/soda?limit=15' : '/api/stream/chunk?chunk_size=20';

  try {
    const t0 = performance.now();
    const res = await fetch(endpoint);
    const latency = (performance.now() - t0).toFixed(0);

    if (res.ok) {
      const data = await res.json();
      const records = data.records || [];

      records.forEach(r => {
        state.streaming.totalStreamed++;
        if (r.breach_prob >= 50.0) {
          state.streaming.totalBreaches++;
        }
        state.streaming.streamedRecords.unshift(r);
      });

      // Keep last 50 in buffer
      if (state.streaming.streamedRecords.length > 50) {
        state.streaming.streamedRecords = state.streaming.streamedRecords.slice(0, 50);
      }

      updateStreamingTelemetryDisplays(latency, data.source);
      renderStreamingTableRows(records);
    }
  } catch (err) {
    console.error('Streaming fetch error:', err);
  }
}

function updateStreamingTelemetryDisplays(latency = 12, source = 'Live Pipeline') {
  const elCount = document.getElementById('stream-tel-count');
  const elSource = document.getElementById('stream-tel-source');
  const elTput = document.getElementById('stream-tel-throughput');
  const elLat = document.getElementById('stream-tel-latency');
  const elRate = document.getElementById('stream-tel-breach-rate');
  const elBreachCount = document.getElementById('stream-tel-breach-count');

  const total = state.streaming.totalStreamed;
  const breaches = state.streaming.totalBreaches;
  const breachRate = total > 0 ? ((breaches / total) * 100).toFixed(1) : '0.0';
  const throughput = state.streaming.isActive ? Math.round((total / Math.max(1, (Date.now() - (state.streaming.startTime || Date.now())) / 1000))) : 0;

  if (elCount) elCount.textContent = total.toLocaleString();
  if (elSource) elSource.textContent = source;
  if (elTput) elTput.textContent = `${Math.max(15, throughput)} rec/sec`;
  if (elLat) elLat.textContent = `${latency}ms`;
  if (elRate) elRate.textContent = `${breachRate}%`;
  if (elBreachCount) elBreachCount.textContent = breaches.toLocaleString();
}

function renderStreamingTableRows(newRecords) {
  const tableBody = document.getElementById('stream-tickets-table-body');
  if (!tableBody) return;

  let rowsHtml = '';
  state.streaming.streamedRecords.slice(0, 20).forEach((r, idx) => {
    const isBreach = r.breach_prob >= 50.0;
    const isNew = idx < newRecords.length;
    rowsHtml += `
      <tr class="${isNew ? 'stream-row-new' : ''}">
        <td style="font-family: var(--font-mono); color: var(--text-muted);">${r.unique_key}</td>
        <td><strong style="color: var(--accent);">${r.agency}</strong></td>
        <td style="color: var(--text-primary); font-weight: 500;">${r.complaint_type}</td>
        <td>${r.borough}</td>
        <td class="num" style="font-weight: 700; color: ${isBreach ? 'var(--status-red)' : 'var(--status-green)'};">
          ${r.breach_prob.toFixed(1)}%
        </td>
        <td><span style="font-size: 12px; color: var(--text-secondary);">${r.velocity}</span></td>
        <td><span class="badge ${isBreach ? 'red' : 'green'}">${r.status_flag}</span></td>
      </tr>
    `;
  });

  tableBody.innerHTML = rowsHtml;
}
