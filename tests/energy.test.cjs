'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Energy = require('../energy.js');
const cloneRules = () => JSON.parse(JSON.stringify(Energy.defaults));
const baseForecast = overrides => ({budgetCents:1000000, raisedCents:0, activeParticipants:20, activityCount:160, totalEnergy:800000, observationDays:28, remainingDays:30, ...overrides});
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-12, `${actual} ≠ ${expected}`);

test('UMD works without browser, storage, Demo or other libraries; defaults and icon are immutable', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'energy.js'), 'utf8'), context);
  assert.equal(context.Energy.calculate({sport:'Course', distanceMeters:5000, durationSeconds:1800}).energy, 5000);
  assert.equal(typeof Energy.icon, 'string');
  assert.match(Energy.icon, /^<svg /);
  assert.ok(Object.isFrozen(Energy));
  assert.ok(Object.isFrozen(Energy.defaults.sports.Course));
  assert.ok(Object.isFrozen(Energy.defaults.bonusTiers[0]));
  assert.throws(() => { Energy.icon = '<svg></svg>'; }, TypeError);
  assert.throws(() => { Energy.defaults.sports.Course.pointsPerMeter = 999; }, TypeError);
  const validated = Energy.validateRules(Energy.defaults);
  validated.sports.Course.pointsPerMeter = 3;
  assert.equal(Energy.defaults.sports.Course.pointsPerMeter, 1);
});

test('exact running examples and every inclusive bonus boundary', () => {
  const run = speed => Energy.calculate({sport:'Course', distanceMeters:5000, durationSeconds:18000 / speed});
  assert.equal(run(10).energy, 5000);
  assert.equal(run(10).bonusPct, 0);
  assert.equal(run(10.01).energy, 5100);
  assert.equal(Energy.calculate({sport:'Course', distanceMeters:5000, durationSeconds:1200}).energy, 5100);
  assert.equal(run(15).bonusPct, 2);
  assert.equal(run(15 + 1e-9).bonusPct, 5);
  assert.equal(run(15.01).bonusPct, 5);
  assert.equal(run(20).bonusPct, 5);
  assert.equal(run(20.01).bonusPct, 10);
  assert.equal(run(100).energy, 5500);
});

test('proposed normalization gives all three sports 5000 points at their 30-minute reference', () => {
  for (const [sport, distanceMeters] of [['Course',5000],['Marche',2500],['Vélo',10000]]) {
    const result = Energy.calculate({sport, distanceMeters, durationSeconds:1800});
    assert.equal(result.energy, 5000);
    assert.equal(result.baseEnergy, 5000);
    assert.equal(result.bonusPct, 0);
    assert.equal(result.distanceMeters, distanceMeters);
    assert.equal(result.durationSeconds, 1800);
  }
  assert.equal(Energy.calculate({sport:'Course', distanceMeters:5000, durationSeconds:3600}).energy, 5000);
});

test('rules changes are explicit and do not mutate inputs or defaults; cap applies to final bonus', () => {
  const rules = cloneRules();
  rules.version = 2;
  rules.sports.Course.pointsPerMeter = 2;
  rules.maxBonusPct = 3;
  const snapshot = JSON.stringify(rules);
  assert.equal(Energy.validateRules(rules).version, 2);
  const result = Energy.calculate({sport:'Course', distanceMeters:5000, durationSeconds:600}, rules);
  assert.equal(result.energy, 10300);
  assert.equal(result.bonusPct, 3);
  assert.equal(JSON.stringify(rules), snapshot);
  assert.equal(Energy.calculate({sport:'Course', distanceMeters:5000, durationSeconds:600}).energy, 5500);
});

test('invalid sports, nonpositive duration/distance and unsafe arithmetic are rejected', () => {
  const activity = {sport:'Course', distanceMeters:5000, durationSeconds:1800};
  for (const key of ['distanceMeters','durationSeconds']) {
    for (const value of [0,-1,NaN,Infinity,'5000',null,undefined,Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => Energy.calculate({...activity,[key]:value}));
    }
  }
  assert.throws(() => Energy.calculate({...activity,sport:'run'}));
  assert.throws(() => Energy.calculate({...activity,durationSeconds:Number.MIN_VALUE}), /précision/);
  assert.throws(() => Energy.calculate({...activity,distanceMeters:Number.MAX_SAFE_INTEGER,durationSeconds:1e12}), /précision/);
  const rules = cloneRules();
  rules.sports.Course.pointsPerMeter = Number.MAX_SAFE_INTEGER;
  assert.throws(() => Energy.calculate(activity,rules), /précision/);
});

test('rule validation rejects missing sports, invalid references, non-monotone tiers and bonus above 10%', () => {
  const mutations = [
    rules => { rules.version = 0; },
    rules => { rules.version = 1.5; },
    rules => { delete rules.sports.Marche; },
    rules => { rules.sports.Course.referenceSpeedKmh = 0; },
    rules => { rules.sports.Course.pointsPerMeter = Infinity; },
    rules => { rules.bonusTiers[1].maxRatio = 0.5; },
    rules => { rules.bonusTiers[2].bonusPct = 1; },
    rules => { rules.bonusTiers[3].maxRatio = 3; },
    rules => { rules.bonusTiers[1].maxRatio = null; },
    rules => { rules.maxBonusPct = 11; },
    rules => { rules.forecast.maxEuroPerEnergy = 0; },
    rules => { rules.forecast.minObservationDays = 29; },
    rules => { rules.forecast.activeWindowDays = 0; }
  ];
  for (const mutate of mutations) {
    const rules = cloneRules(); mutate(rules);
    assert.throws(() => Energy.validateRules(rules));
  }
});

test('20 versus 200 observed participants: same envelope, ten times energy, one tenth prospective ratio', () => {
  const twenty = Energy.forecast(baseForecast());
  const twoHundred = Energy.forecast(baseForecast({activeParticipants:200,activityCount:1600,totalEnergy:8000000}));
  near(twenty.frequencyPerWeek, 2);
  near(twenty.averageEnergy, 5000);
  near(twenty.expectedEnergy, 20 * 2 * 5000 * 30 / 7);
  near(twoHundred.expectedEnergy / twenty.expectedEnergy, 10);
  near(twenty.ratioEuroPerEnergy / twoHundred.ratioEuroPerEnergy, 10);
  near(twenty.ratioEuroPerEnergy * 5000, 58.33333333333333);
  assert.equal(twenty.provisional, false);
});

test('no history preserves zero displayed participants, uses explicit defaults and caps the ratio', () => {
  const result = Energy.forecast(baseForecast({activeParticipants:0,activityCount:0,totalEnergy:0,observationDays:0}));
  assert.equal(result.activeParticipants, 0);
  assert.equal(result.provisional, true);
  assert.equal(result.frequencyPerWeek, 2);
  assert.equal(result.averageEnergy, 5000);
  near(result.expectedEnergy, 2 * 5000 * 30 / 7);
  assert.equal(result.ratioEuroPerEnergy, 0.025);
  const one = Energy.forecast(baseForecast({activeParticipants:1,activityCount:1,totalEnergy:5000,observationDays:0}));
  assert.equal(one.frequencyPerWeek, 1.5);
  assert.equal(one.provisional, true);
  assert.ok(Number.isFinite(one.ratioEuroPerEnergy));
});

test('remaining budget is used, expired/fully funded campaigns return zero, and forecasts have no historical side effects', () => {
  const input = baseForecast();
  const full = Energy.forecast(input);
  const half = Energy.forecast({...input,raisedCents:500000});
  near(half.ratioEuroPerEnergy, full.ratioEuroPerEnergy / 2);
  assert.deepEqual(input, baseForecast());
  assert.equal(Energy.forecast({...input,raisedCents:1000000}).ratioEuroPerEnergy, 0);
  assert.equal(Energy.forecast({...input,remainingDays:0}).ratioEuroPerEnergy, 0);
  assert.equal(Energy.forecast({...input,remainingDays:0}).expectedEnergy, 0);
  assert.equal(Energy.forecast({...input,budgetCents:0}).ratioEuroPerEnergy, 0);
  assert.equal(Energy.forecast({...input,budgetCents:1,remainingDays:0.000001}).ratioEuroPerEnergy, 0.01 / 5000);
});

test('continuous duration and observation window clamp behave consistently', () => {
  const thirty = Energy.forecast(baseForecast());
  const halfDay = Energy.forecast(baseForecast({remainingDays:0.5}));
  near(halfDay.expectedEnergy, thirty.expectedEnergy / 60);
  assert.deepEqual(Energy.forecast(baseForecast({observationDays:365})), thirty);
});

test('forecast rejects fractional cents, negative balances, over-budget state and unsafe magnitudes', () => {
  for (const patch of [
    {budgetCents:1.1},{raisedCents:-1},{raisedCents:1000001},
    {activeParticipants:0.5},{activityCount:-1},{totalEnergy:Infinity},
    {observationDays:-1},{remainingDays:-1},{remainingDays:NaN},
    {activeParticipants:Number.MAX_SAFE_INTEGER,activityCount:Number.MAX_SAFE_INTEGER},
    {remainingDays:Number.MAX_SAFE_INTEGER}
  ]) assert.throws(() => Energy.forecast(baseForecast(patch)));
});

test('calendar months clamp month-end, preserve leap days where possible, and use UTC without DST drift', () => {
  const iso = (date, period) => new Date(Energy.campaignEnd(date,period)).toISOString();
  assert.equal(iso('2026-01-31','monthly'),'2026-02-28T00:00:00.000Z');
  assert.equal(iso('2024-01-31','monthly'),'2024-02-29T00:00:00.000Z');
  assert.equal(iso('2024-02-29','yearly'),'2025-02-28T00:00:00.000Z');
  assert.equal(iso('2026-11-30','quarterly'),'2027-02-28T00:00:00.000Z');
  assert.equal(iso('2026-03-01','monthly'),'2026-04-01T00:00:00.000Z');
  assert.equal(iso(Date.parse('2026-01-31T12:30:00.000Z'),'monthly'),'2026-02-28T12:30:00.000Z');
  assert.throws(() => Energy.campaignEnd('2026-02-30','monthly'));
  assert.throws(() => Energy.campaignEnd('2026-02-01T00:00:00Z','monthly'));
  assert.throws(() => Energy.campaignEnd('2026-02-01','annual'));
  assert.throws(() => Energy.campaignEnd('2026-02-01','toString'));
  assert.throws(() => Energy.campaignEnd(8640000000000000,'yearly'));
});

test('ending popup is limited to final 15 days of an ongoing campaign, excluding the end instant', () => {
  const start = Date.parse('2026-09-01T00:00:00Z');
  const end = Energy.campaignEnd(start,'monthly');
  const first = end - 15 * 86400000;
  assert.equal(Energy.endingSoon(start,end,first - 1),false);
  assert.equal(Energy.endingSoon(start,end,first),true);
  assert.equal(Energy.endingSoon(start,end,end - 1),true);
  assert.equal(Energy.endingSoon(start,end,end),false);
  assert.equal(Energy.endingSoon(start,end,end + 1),false);
  const shortEnd = start + 10 * 86400000;
  assert.equal(Energy.endingSoon(start,shortEnd,start - 1),false);
  assert.equal(Energy.endingSoon(start,shortEnd,start),true);
  assert.throws(() => Energy.endingSoon(end,start,start));
});
