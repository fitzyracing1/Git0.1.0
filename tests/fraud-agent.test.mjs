import assert from 'node:assert/strict';
import { StickmanFraudAgent, formatFraudAlert } from '../extension/fraud-agent.mjs';

const agent = new StickmanFraudAgent();

const phishing = agent.scan({
  url: 'http://secure-paypal-login.zip',
  title: 'Urgent account verification',
  notification: 'Verify your password immediately or your account will be suspended.',
});

assert.equal(phishing.shouldAlert, true);
assert.equal(phishing.level, 'critical');
assert.ok(phishing.score >= 75);
assert.match(formatFraudAlert(phishing), /Fraud scan CRITICAL/);

const normal = agent.scan({
  url: 'https://example.com/account',
  title: 'Monthly statement',
  notification: 'Calendar: team sync in 10 min',
});

assert.equal(normal.shouldAlert, false);
assert.equal(normal.level, 'clear');
assert.equal(normal.score, 0);

console.log('fraud-agent tests passed');
