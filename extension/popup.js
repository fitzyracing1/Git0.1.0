'use strict';

const INTERVAL_MAP = {
  'heartbeat':   '2',
  'notify-scan': '3',
  'web-scan':    '5',
  'car-check':   '7',
  'decision':    '11',
};

const STATE_LABELS = {
  'idle':        'IDLE',
  'heartbeat':   'PULSE',
  'notify-scan': 'SCANNING',
  'web-scan':    'THINKING',
  'car-check':   'WALKING',
  'decision':    'FRAUD DECISION',
};

// ── Mini stickman animation ───────────────────────────────────────────────────

function buildMiniRobot() {
  const svg = document.getElementById('mini-svg');
  const NS  = 'http://www.w3.org/2000/svg';
  const e   = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };

  const g = e('g', { stroke: '#00ff88', 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' });

  g.appendChild(e('line',   { x1: 100, y1: 18, x2: 100, y2: 5 }));
  g.appendChild(e('circle', { cx: 100, cy: 4, r: 4, fill: '#00ff88', stroke: 'none', id: 'mini-ant' }));
  g.appendChild(e('circle', { cx: 100, cy: 38, r: 20 }));
  g.appendChild(e('rect',   { x: 87, y: 31, width: 8, height: 8, rx: 1, fill: '#00ff88', stroke: 'none', id: 'mini-eyeL' }));
  g.appendChild(e('rect',   { x: 105, y: 31, width: 8, height: 8, rx: 1, fill: '#00ff88', stroke: 'none', id: 'mini-eyeR' }));
  g.appendChild(e('rect',   { x: 87, y: 44, width: 26, height: 6, rx: 2, 'stroke-width': 1.5 }));
  g.appendChild(e('line',   { x1: 100, y1: 58, x2: 100, y2: 130 }));
  g.appendChild(e('line',   { x1: 100, y1: 76, x2: 58,  y2: 105, id: 'mini-armL' }));
  g.appendChild(e('line',   { x1: 100, y1: 76, x2: 142, y2: 105, id: 'mini-armR' }));
  g.appendChild(e('line',   { x1: 100, y1: 130, x2: 72,  y2: 182, id: 'mini-legL' }));
  g.appendChild(e('line',   { x1: 100, y1: 130, x2: 128, y2: 182, id: 'mini-legR' }));

  svg.appendChild(g);

  let t = 0;
  (function frame() {
    t += 0.018;
    const sway = Math.sin(t) * 4;
    g.setAttribute('transform', `translate(${sway * 0.4}, 0)`);
    document.getElementById('mini-ant').setAttribute('opacity',
      0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 3)));
    requestAnimationFrame(frame);
  })();
}

// ── Log helper ────────────────────────────────────────────────────────────────

function addLog(name, text) {
  const log  = document.getElementById('log-mini');
  const item = document.createElement('div');
  item.className = 'log-item';
  item.innerHTML = `<span class="tag">[${name.toUpperCase()}]</span>${text}`;
  log.appendChild(item);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 30) log.removeChild(log.firstChild);
}

function updateFraudPanel(report) {
  if (!report) return;
  const level = document.getElementById('fraud-level');
  const data = document.getElementById('fraud-data');
  const isAlert = report.level === 'warning' || report.level === 'critical';

  level.textContent = report.level.toUpperCase();
  level.style.color = isAlert ? '#ff3333' : (report.level === 'watch' ? '#ffcc00' : '#00ffcc');
  data.className = `fraud-data${isAlert ? ' alert' : ''}`;
  data.textContent =
    `Score:  ${report.score}/100\n` +
    `Source: ${report.source || 'prime process'}\n` +
    `Signal: ${report.summary}`;
}

// ── Process event handler ─────────────────────────────────────────────────────

function onProcess(msg) {
  const intKey = INTERVAL_MAP[msg.name];
  if (!intKey) return;

  // Flash dot
  const dot = document.getElementById(`pd-${intKey}`);
  if (dot) {
    dot.style.background = '#ffffff';
    dot.style.boxShadow = '0 0 8px #fff';
    setTimeout(() => {
      dot.style.background = '#00ff88';
      dot.style.boxShadow  = '';
    }, 320);
  }

  // Update time
  const timeEl = document.getElementById(`pt-${intKey}`);
  if (timeEl) timeEl.textContent = new Date().toTimeString().substring(0, 8);

  // Update header
  document.getElementById('tick-label').textContent = `TICK: ${msg.tick}`;
  const sv = document.getElementById('state-val');
  if (sv) sv.textContent = STATE_LABELS[msg.name] || msg.name.toUpperCase();

  addLog(msg.name, `interval ${msg.interval}ms · tick #${msg.tick}`);
}

// ── Init ──────────────────────────────────────────────────────────────────────

buildMiniRobot();

// Pull current state from background
chrome.runtime.sendMessage({ type: 'get-state' }, (state) => {
  if (!state) return;
  document.getElementById('tick-label').textContent = `TICK: ${state.tick}`;
  updateFraudPanel(state.fraudReport);
  for (const entry of (state.log || []).slice(0, 8).reverse()) {
    addLog(entry.name, `interval ${entry.interval}ms · tick #${entry.tick}`);
  }
});

// Listen for live updates
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'process') onProcess(msg);
  if (msg.type === 'connector-update' && msg.connector === 'fraud') updateFraudPanel(msg.data);
  if (msg.type === 'decision-result' && msg.fraud) updateFraudPanel(msg.fraud);
  if (msg.type === 'fraud-alert') {
    updateFraudPanel(msg.report);
    addLog('fraud', `ALERT ${msg.report.level.toUpperCase()} · score ${msg.report.score}/100`);
  }
});

// Open popup in a full tab for more screen space
document.getElementById('open-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
});
