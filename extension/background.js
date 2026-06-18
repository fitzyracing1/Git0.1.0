'use strict';

// Prime utilities (inlined — service workers can't import from webapp/)
function isPrime(n) {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i <= Math.sqrt(n); i += 2) if (n % i === 0) return false;
  return true;
}

function nextPrime(n) {
  let c = Math.max(n + 1, 2);
  while (!isPrime(c)) c++;
  return c;
}

// Shared robot state (held in memory while the service worker is alive)
let state = {
  tick: 0,
  activeProcess: 'idle',
  log: [],
  connectors: {
    phone: { status: 'idle', data: 'No data yet' },
    car:   { status: 'idle', data: null },
    web:   { status: 'active', data: null },
  },
};

const MOCK_NOTIFS = [
  'Maps: Turn in 300m',
  'iMessage: You free later?',
  'Weather: Rain tonight',
  'Calendar: Standup in 10 min',
  'Slack: @mention in #product',
];

const MOCK_CAR = () => ({
  speed:   Math.floor(Math.random() * 85),
  rpm:     Math.floor(900 + Math.random() * 3200),
  battery: Math.floor(38 + Math.random() * 62),
  temp:    Math.floor(82 + Math.random() * 18),
});

function broadcast(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {}); // popup may be closed
}

function addLog(name, interval, tick) {
  const entry = { name, interval, tick, time: Date.now() };
  state.log.unshift(entry);
  if (state.log.length > 40) state.log.pop();
  broadcast({ type: 'process', ...entry });
}

// ── Prime process runners ──────────────────────────────────────────────────────

function runHeartbeat() {
  state.tick++;
  state.activeProcess = 'heartbeat';
  addLog('heartbeat', 2000, state.tick);
  const np = nextPrime(state.tick);
  broadcast({ type: 'log-line', text: `Pulse #${state.tick} → next prime: ${np}` });
}

function runNotifyScan() {
  state.tick++;
  state.activeProcess = 'notify-scan';
  addLog('notify-scan', 3000, state.tick);
  const notif = MOCK_NOTIFS[Math.floor(Math.random() * MOCK_NOTIFS.length)];
  state.connectors.phone = { status: 'scanning', data: notif };
  broadcast({ type: 'connector-update', connector: 'phone', status: 'scanning', data: notif });
  setTimeout(() => {
    state.connectors.phone.status = 'active';
    broadcast({ type: 'connector-update', connector: 'phone', status: 'active', data: notif });
  }, 950);
}

function runWebScan() {
  state.tick++;
  state.activeProcess = 'web-scan';
  addLog('web-scan', 5000, state.tick);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: 'get-context' }, (ctx) => {
      const data = ctx || { url: tabs[0].url, title: tabs[0].title };
      state.connectors.web = { status: 'active', data };
      broadcast({ type: 'connector-update', connector: 'web', status: 'active', data });
    });
  });
}

function runCarCheck() {
  state.tick++;
  state.activeProcess = 'car-check';
  addLog('car-check', 7000, state.tick);
  const car = MOCK_CAR();
  state.connectors.car = { status: 'active', data: car };
  broadcast({ type: 'connector-update', connector: 'car', status: 'active', data: car });
}

function runDecision() {
  state.tick++;
  state.activeProcess = 'decision';
  addLog('decision', 11000, state.tick);
  const prime = isPrime(state.tick);
  broadcast({
    type: 'decision-result',
    tick: state.tick,
    isPrime: prime,
    nextPrime: nextPrime(state.tick),
  });
}

// ── Staggered prime schedulers ────────────────────────────────────────────────

function schedule(fn, interval, stagger) {
  setTimeout(function fire() {
    fn();
    setTimeout(fire, interval);
  }, stagger);
}

schedule(runHeartbeat,   2000,  0);
schedule(runNotifyScan,  3000,  500);
schedule(runWebScan,     5000,  1200);
schedule(runCarCheck,    7000,  2000);
schedule(runDecision,    11000, 3500);

// ── Message handler ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'get-state') {
    sendResponse(state);
    return true;
  }
});

console.log('[Stickman] Background service worker started. Primes: 2s 3s 5s 7s 11s');
