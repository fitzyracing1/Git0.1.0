'use strict';

const PROCESS_COLORS = {
  'heartbeat':   '#00ff88',
  'notify-scan': '#00ffcc',
  'web-scan':    '#ffcc00',
  'car-check':   '#88aaff',
  'decision':    '#ff8844',
  'fraud-scan':  '#ff3333',
};

const BAR_MAP = {
  'heartbeat':   'bar-2',
  'notify-scan': 'bar-3',
  'web-scan':    'bar-5',
  'car-check':   'bar-7',
  'decision':    'bar-11',
};

const BAR_INTERVALS = {
  'bar-2': 2000, 'bar-3': 3000, 'bar-5': 5000,
  'bar-7': 7000, 'bar-11': 11000,
};

const barLastFire = { 'bar-2': 0, 'bar-3': 0, 'bar-5': 0, 'bar-7': 0, 'bar-11': 0 };

const MOCK_NOTIFS = [
  'Maps: Turn in 300m',
  'iMessage: Hey, you around?',
  'Weather: Rain at 4PM',
  'Calendar: Team sync in 10 min',
  'Slack: @mention in #general',
  'Reminder: Pick up groceries',
  'News: Markets up 1.2%',
  'Bank Alert: Verify your account password immediately at http://secure-bank-login.zip',
  'Delivery Notice: Package held. Pay customs fee with gift card within 24 hours.',
];

const MOCK_CAR = () => ({
  speed:   Math.floor(Math.random() * 85),
  rpm:     Math.floor(900 + Math.random() * 3200),
  battery: Math.floor(38 + Math.random() * 62),
  temp:    Math.floor(82 + Math.random() * 18),
});

let robot;
let fraudAgent;
let lastFraudReport;
let currentPhoneNotification = '';
let currentWebContext = {};

// ── Logging ──────────────────────────────────────────────────────────────────

function log(processName, message) {
  const container = document.getElementById('log');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const ts = new Date().toTimeString().substring(0, 8);
  entry.innerHTML =
    `<span class="log-time">${ts}</span>` +
    `<span class="log-tag ${processName}">${processName.toUpperCase()}</span>` +
    `<span class="log-msg">${message}</span>`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
  while (container.children.length > 300) container.removeChild(container.firstChild);
}

// ── State badge ───────────────────────────────────────────────────────────────

function setStateBadge(processName) {
  const labels = {
    idle: 'IDLE', heartbeat: 'PULSE', 'notify-scan': 'SCANNING',
    'web-scan': 'THINKING', 'car-check': 'WALKING', decision: 'FRAUD DECISION',
    'fraud-scan': 'FRAUD ALERT',
  };
  const badge = document.getElementById('state-badge');
  badge.textContent = labels[processName] || processName.toUpperCase();
  const color = PROCESS_COLORS[processName] || '#00ff88';
  badge.style.color = color;
  badge.style.borderColor = color + '55';
}

// ── Progress bars ─────────────────────────────────────────────────────────────

function animateBars(now) {
  for (const [barId, last] of Object.entries(barLastFire)) {
    const elapsed = now - last;
    const interval = BAR_INTERVALS[barId];
    const pct = Math.min(100, (elapsed / interval) * 100);
    const el = document.getElementById(barId);
    if (el) el.style.width = pct + '%';
  }
  requestAnimationFrame(animateBars);
}

// ── Connectors ────────────────────────────────────────────────────────────────

function setDot(id, cls) {
  const dot = document.getElementById(id);
  if (dot) dot.className = 'conn-dot ' + cls;
}

function setConnData(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function buildFraudContext(extra) {
  return {
    url: window.location.href,
    title: document.title,
    notification: currentPhoneNotification,
    h1: document.querySelector('h1')?.textContent?.trim() || '',
    metaDescription: document.querySelector('meta[name="description"]')?.content || '',
    selectedText: window.getSelection().toString().substring(0, 300),
    ...currentWebContext,
    ...(extra || {}),
  };
}

function setFraudPanel(report, source) {
  const dotClass = report.shouldAlert ? 'alert' : (report.level === 'watch' ? 'scanning' : 'active');
  setDot('dot-fraud', dotClass);
  setConnData('data-fraud',
    `Level:  ${report.level.toUpperCase()}\n` +
    `Score:  ${report.score}/100\n` +
    `Source: ${source}\n` +
    `Signal: ${report.summary}`);
}

function runFraudScan(source, extra, options) {
  if (!fraudAgent) return null;
  const report = fraudAgent.scan(buildFraudContext(extra));
  lastFraudReport = report;
  setFraudPanel(report, source);
  if (report.shouldAlert && !(options && options.quiet)) {
    log('fraud-scan', formatStickmanFraudAlert(report));
  }
  return report;
}

function updateConnectors(processName) {
  switch (processName) {
    case 'notify-scan': {
      setDot('dot-phone', 'scanning');
      const n = MOCK_NOTIFS[Math.floor(Math.random() * MOCK_NOTIFS.length)];
      currentPhoneNotification = n;
      setConnData('data-phone', n);
      runFraudScan('phone notification', { notification: n });
      setTimeout(() => setDot('dot-phone', 'active'), 950);
      break;
    }
    case 'car-check': {
      setDot('dot-car', 'scanning');
      const c = MOCK_CAR();
      setConnData('data-car',
        `Speed:   ${c.speed} mph\nRPM:     ${c.rpm}\nBattery: ${c.battery}%\nTemp:    ${c.temp}°F`);
      setTimeout(() => setDot('dot-car', 'active'), 1700);
      break;
    }
    case 'web-scan': {
      currentWebContext = { url: window.location.href, title: document.title };
      setConnData('data-web', `URL:   ${window.location.href}\nTitle: ${document.title}`);
      runFraudScan('web page', currentWebContext);
      break;
    }
    case 'decision': {
      setDot('dot-phone', 'alert');
      setDot('dot-car', 'alert');
      setDot('dot-fraud', lastFraudReport?.shouldAlert ? 'alert' : 'active');
      setTimeout(() => {
        setDot('dot-phone', 'active');
        setDot('dot-car', 'active');
        setDot('dot-fraud', lastFraudReport?.shouldAlert ? 'alert' : 'active');
      }, 2400);
      break;
    }
  }
}

// ── Log messages ──────────────────────────────────────────────────────────────

function buildLogMsg(processName, tick) {
  const np = nextPrime(tick || 1);
  switch (processName) {
    case 'heartbeat':
      return `Pulse #${tick} → next prime: ${np} · processes: 5 active`;
    case 'notify-scan': {
      const n = MOCK_NOTIFS[tick % MOCK_NOTIFS.length];
      return `Phone scan complete · "${n}"`;
    }
    case 'web-scan': {
      const factors = primeFactors(tick || 2);
      const factStr = factors.length ? factors.join(' × ') : 'prime';
      return `Web context captured · tick ${tick} factors: [${factStr}]`;
    }
    case 'car-check': {
      const c = MOCK_CAR();
      return `Car OBD-II: ${c.speed}mph · ${c.battery}% battery · tick ${tick} is ${isPrime(tick) ? 'PRIME ✓' : 'composite'}`;
    }
    case 'decision':
      const report = runFraudScan('prime decision', {}, { quiet: true });
      if (report?.shouldAlert) {
        return `Decision cycle · FRAUD ${report.level.toUpperCase()} · score ${report.score}/100 · ${report.summary}`;
      }
      return `Decision cycle · fraud clear · score ${report?.score || 0}/100 · next prime: ${np}`;
    default:
      return `Process fired: ${processName}`;
  }
}

// ── Chat ──────────────────────────────────────────────────────────────────────

function stickmanReply(text) {
  const t = text.trim();
  const n = parseInt(t);

  if (!isNaN(n) && n.toString() === t) {
    if (n < 2) return `${n} is neither prime nor composite. First prime is 2.`;
    if (isPrime(n)) return `YES — ${n} is prime. Next prime: ${nextPrime(n)}.`;
    const f = primeFactors(n);
    return `${n} is NOT prime. Factors: ${f.join(' × ')}. Next prime: ${nextPrime(n)}.`;
  }

  const lower = t.toLowerCase();
  if (lower === 'help' || lower === '?') {
    return 'I run 5 prime-timed processes: 2s=heartbeat · 3s=phone scan · 5s=web context · 7s=car data · 11s=fraud decision. Send a number, type status, or ask for a fraud scan.';
  }
  if (lower.includes('fraud') || lower.includes('scam') || lower.includes('phish')) {
    robot.triggerProcess('decision');
    const report = runFraudScan('chat request', { message: t });
    return formatStickmanFraudAlert(report);
  }
  if (lower.includes('status')) {
    const fraud = lastFraudReport ? `${lastFraudReport.level.toUpperCase()} ${lastFraudReport.score}/100` : 'not scanned yet';
    return `Tick ${robot.tickCount}. State: ${robot.activeState || 'IDLE'}. Fraud guard: ${fraud}. All ${robot.processes.length} prime processes running.`;
  }
  if (lower.includes('scan')) {
    robot.triggerProcess('notify-scan');
    return 'Manual scan queued at prime interval 3s.';
  }
  if (lower.includes('prime')) {
    const rnd = Math.floor(Math.random() * 90) + 10;
    return `Quick prime: next prime after ${rnd} is ${nextPrime(rnd)}.`;
  }
  const pool = [
    `Tick ${robot.tickCount} — ${isPrime(robot.tickCount) ? 'that\'s a prime tick!' : `next prime tick: ${nextPrime(robot.tickCount)}`}.`,
    'Prime intervals 2, 3, 5, 7, 11 all nominal. Fraud guard is watching page and notification signals.',
    'Connectors online. Monitoring for fraud events.',
    `Prime factors of ${robot.tickCount}: [${primeFactors(robot.tickCount || 2).join(', ') || 'prime'}].`,
  ];
  return pool[robot.tickCount % pool.length];
}

function addChatMsg(text, type) {
  const log = document.getElementById('chat-log');
  const el = document.createElement('div');
  el.className = `chat-msg ${type}`;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

function initChat() {
  const input = document.getElementById('chat-input');
  const btn   = document.getElementById('chat-send');

  function submit() {
    const text = input.value.trim();
    if (!text) return;
    addChatMsg(text, 'user');
    input.value = '';
    setTimeout(() => addChatMsg(stickmanReply(text), 'bot'), 280);
  }

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const svg = document.getElementById('stickman-svg');
  fraudAgent = new StickmanFraudAgent();

  robot = new StickmanRobot(svg, (processName, interval, tick) => {
    document.getElementById('tick-display').textContent = `TICK: ${tick}`;
    setStateBadge(processName);
    log(processName, buildLogMsg(processName, tick));
    const barId = BAR_MAP[processName];
    if (barId) barLastFire[barId] = performance.now();
    updateConnectors(processName);
  });

  // Web connector initial state
  currentWebContext = { url: window.location.href, title: document.title };
  setConnData('data-web', `URL:   ${window.location.href}\nTitle: ${document.title}`);
  setDot('dot-web', 'active');
  runFraudScan('startup', currentWebContext, { quiet: true });

  requestAnimationFrame(animateBars);

  log('heartbeat', 'STICKMAN online · fraud-alert agent armed · prime processes initializing at intervals 2, 3, 5, 7, 11…');

  initChat();
  setTimeout(() => addChatMsg(
    'Online. Prime processes active at 2s · 3s · 5s · 7s · 11s intervals. ' +
    'Fraud guard is watching notifications and page context. Send a number or type "help".', 'bot'), 600);
});
