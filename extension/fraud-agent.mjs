'use strict';

const FRAUD_PATTERNS = [
  { label: 'account verification request', weight: 18, pattern: /\b(verify|confirm|validate)\b.{0,24}\b(account|identity|login|password)\b/i },
  { label: 'payment or gift card demand', weight: 22, pattern: /\b(gift card|wire transfer|crypto|bitcoin|cashapp|zelle|venmo|payment required)\b/i },
  { label: 'urgent pressure language', weight: 16, pattern: /\b(urgent|immediately|act now|within 24 hours|final notice|last chance)\b/i },
  { label: 'credential harvesting language', weight: 24, pattern: /\b(password|passcode|one[- ]?time code|otp|2fa|security code|pin)\b/i },
  { label: 'delivery or tax impersonation', weight: 14, pattern: /\b(irs|tax refund|customs fee|missed delivery|package held|postal service)\b/i },
  { label: 'prize or refund bait', weight: 13, pattern: /\b(prize|winner|lottery|refund available|rebate|claim reward)\b/i },
  { label: 'remote access request', weight: 28, pattern: /\b(remote access|screen share|install anydesk|install teamviewer|support session)\b/i },
  { label: 'suspicious login warning', weight: 17, pattern: /\b(suspicious login|locked account|unusual activity|account suspended)\b/i },
];

const TRUSTED_BRANDS = [
  'amazon', 'apple', 'bank', 'chase', 'coinbase', 'fedex', 'google',
  'microsoft', 'paypal', 'ups', 'usps', 'venmo', 'wellsfargo',
];

const RISKY_TLDS = ['.bid', '.click', '.country', '.download', '.gq', '.loan', '.men', '.mom', '.review', '.ru', '.tk', '.top', '.work', '.zip'];

function asText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(asText).join(' ');
  if (typeof value === 'object') return Object.values(value).map(asText).join(' ');
  return '';
}

function getHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (_err) {
    return '';
  }
}

function hasBrandImpersonation(hostname) {
  if (!hostname) return null;
  const compactHost = hostname.replace(/[^a-z0-9]/g, '');
  for (const brand of TRUSTED_BRANDS) {
    const compactBrand = brand.replace(/[^a-z0-9]/g, '');
    if (compactHost.includes(compactBrand) && !hostname.includes(`${brand}.`) && !hostname.endsWith(`${brand}.com`)) {
      return brand;
    }
  }
  return null;
}

function riskLevel(score) {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'warning';
  if (score >= 25) return 'watch';
  return 'clear';
}

function normalizeContext(context) {
  const ctx = context || {};
  const text = [
    ctx.url, ctx.title, ctx.h1, ctx.metaDescription, ctx.selectedText,
    ctx.notification, ctx.message, ctx.bodyText, ctx.pageText,
  ].map(asText).join(' ').replace(/\s+/g, ' ').trim();

  return {
    url: asText(ctx.url),
    hostname: getHostname(ctx.url),
    notification: asText(ctx.notification),
    text,
  };
}

export class StickmanFraudAgent {
  scan(context) {
    const normalized = normalizeContext(context);
    const signals = [];
    let score = 0;

    for (const item of FRAUD_PATTERNS) {
      if (item.pattern.test(normalized.text)) {
        score += item.weight;
        signals.push({ label: item.label, weight: item.weight });
      }
    }

    if (normalized.url && !/^https:/i.test(normalized.url) && !/^file:/i.test(normalized.url)) {
      score += 10;
      signals.push({ label: 'page is not using HTTPS', weight: 10 });
    }

    if (normalized.hostname) {
      const riskyTld = RISKY_TLDS.find(tld => normalized.hostname.endsWith(tld));
      if (riskyTld) {
        score += 20;
        signals.push({ label: `risky domain ending (${riskyTld})`, weight: 20 });
      }

      if (/\d{4,}/.test(normalized.hostname) || normalized.hostname.split('-').length > 3) {
        score += 12;
        signals.push({ label: 'domain shape looks machine-generated', weight: 12 });
      }

      const brand = hasBrandImpersonation(normalized.hostname);
      if (brand) {
        score += 26;
        signals.push({ label: `possible ${brand} impersonation`, weight: 26 });
      }
    }

    if (normalized.notification && /https?:\/\/\S+/i.test(normalized.notification)) {
      score += 10;
      signals.push({ label: 'notification contains a link', weight: 10 });
    }

    score = Math.min(100, score);
    const level = riskLevel(score);

    return {
      score,
      level,
      shouldAlert: level === 'warning' || level === 'critical',
      summary: signals.length ? signals.slice(0, 3).map(s => s.label).join(' + ') : 'no fraud signals detected',
      signals,
      checkedAt: new Date().toISOString(),
    };
  }
}

export function formatFraudAlert(report) {
  const label = report.level.toUpperCase();
  if (!report.signals.length) {
    return `Fraud scan ${label}: score ${report.score}/100. No suspicious signals found.`;
  }
  return `Fraud scan ${label}: score ${report.score}/100. Signals: ${report.summary}.`;
}
