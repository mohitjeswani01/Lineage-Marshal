/**
 * Self-check for the two bits of real logic in `lib/`: URN parsing and
 * duration/relative-time formatting. Everything else is markup.
 *
 * Run: `npm test` (Node's built-in runner + native TS type stripping — no
 * test framework, no config).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isValidUrn, parseUrn, urnDisplayName } from './urn.ts';
import { formatDuration, relativeTime } from './format.ts';

const DATASET_URN =
  'urn:li:dataset:(urn:li:dataPlatform:hive,daily_revenue_report,PROD)';

test('parses a real seeded dataset URN', () => {
  assert.deepEqual(parseUrn(DATASET_URN), {
    entityType: 'dataset',
    platform: 'hive',
    name: 'daily_revenue_report',
    env: 'PROD',
  });
});

test('tolerates surrounding whitespace', () => {
  assert.equal(parseUrn(`  ${DATASET_URN}  `)?.name, 'daily_revenue_report');
});

test('rejects malformed URNs', () => {
  for (const bad of ['', 'nope', 'urn:li:dataset:no-parens', 'urn:li:(x,y,z)']) {
    assert.equal(isValidUrn(bad), false, `expected ${bad!} to be invalid`);
    assert.equal(parseUrn(bad!), null);
  }
});

test('accepts the phantom upstream URN (valid shape, absent from catalog)', () => {
  const phantom =
    'urn:li:dataset:(urn:li:dataPlatform:hive,orders_source_legacy,PROD)';
  assert.equal(isValidUrn(phantom), true);
  assert.equal(urnDisplayName(phantom), 'orders_source_legacy');
});

test('display name falls back to the raw string when unparseable', () => {
  assert.equal(urnDisplayName('garbage'), 'garbage');
});

test('relativeTime reports the 30-day-stale demo asset in days, not months', () => {
  const now = Date.UTC(2026, 7, 7);
  const day = 86_400_000;
  assert.match(relativeTime(now - 30 * day, now), /30 days ago/);
  // …but genuinely old assets still roll up to a coarser unit.
  assert.match(relativeTime(now - 90 * day, now), /3 months ago/);
});

test('relativeTime handles bad input without throwing', () => {
  assert.equal(relativeTime('not-a-date'), '—');
});

test('formatDuration switches units at one second', () => {
  assert.equal(formatDuration(820), '820ms');
  assert.equal(formatDuration(1_400), '1.4s');
  assert.equal(formatDuration(-1), '—');
});
