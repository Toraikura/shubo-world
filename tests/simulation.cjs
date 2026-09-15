'use strict';
// Executes the current HTML's actual startBatch/stepGame functions. No browser,
// rendering, network, or mutation of the HTML is involved. DOM effects are stubs.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sourcePath = process.argv[2] || require('node:path').join(__dirname, '../dist/index.html');
const html = fs.readFileSync(sourcePath, 'utf8');
function extractFunction(name) {
  const start = html.indexOf('\nfunction ' + name + '(');
  assert.ok(start >= 0, `missing ${name}`);
  const end = html.indexOf('\nfunction ', start + 1);
  assert.ok(end > start, `missing following function after ${name}`);
  return html.slice(start + 1, end);
}
const startBatch = extractFunction('startBatch');
const stepGame = extractFunction('stepGame');
assert.ok(startBatch.startsWith('function startBatch('));
assert.ok(stepGame.startsWith('function stepGame('));
const defaultsLine = html.split('\n').find(line => line.startsWith('const defaults='));
assert.ok(defaultsLine);
let assertions = 0;
let checkedSteps = 0;
const observedRanges = Object.fromEntries(['sugar','vitality','ferment','risk'].map(k => [k, [Infinity, -Infinity]]));
function buildSimulation() {
  const elements = new Map();
  const context = {
    Math, Set, Number,
    matchMedia: () => ({ matches: false }),
    game: { ingredients: new Set(['water','rice','koji','yeast']) },
    outcome: null,
    messages: [],
    $: id => { if (!elements.has(id)) elements.set(id, {}); return elements.get(id); },
    clamp: (value, low, high) => Math.max(low, Math.min(high, value)),
    panelClose() {}, setMode() {}, settingsLabels() {}, soundCue() {}, updateUI() {}, save() {},
    notify(message) { context.messages.push(message); },
    finishBatch(win, message) {
      context.game.finished = true;
      context.game.active = false;
      context.outcome = { win, message: message || null };
    }
  };
  vm.createContext(context);
  vm.runInContext(defaultsLine + '\nthis.settings={...defaults};\n' + startBatch + '\n' + stepGame, context);
  context.startBatch();
  return context;
}
function checkBounds(context, name) {
  checkedSteps++;
  for (const key of ['sugar','vitality','ferment','risk']) {
    const value = context.game[key];
    assert.ok(Number.isFinite(value), `${name}: ${key} not finite`);
    assert.ok(value >= 0 && value <= 100, `${name}: ${key}=${value} outside [0,100]`);
    assertions += 2;
    observedRanges[key][0] = Math.min(observedRanges[key][0], value);
    observedRanges[key][1] = Math.max(observedRanges[key][1], value);
  }
  assert.ok(Number.isFinite(context.game.time) && context.game.time >= 0, `${name}: invalid time`);
  assert.ok(Number.isFinite(context.game.stirCooldown) && context.game.stirCooldown >= 0, `${name}: invalid cooldown`);
  assert.ok(Number.isInteger(context.game.events) && context.game.events >= 0 && context.game.events <= 3, `${name}: invalid event count`);
  assertions += 3;
}
function run({ name, dt = 1/60, temperature = 16, acidity = 65, repairDelay = null, expectedWin = undefined }) {
  const c = buildSimulation();
  c.settings.temperature = temperature;
  c.settings.acidity = acidity;
  const eventLog = [];
  let pendingRepair = null;
  let repairs = 0;
  for (let ticks = 0; ticks < Math.ceil(481/dt); ticks++) {
    if (pendingRepair !== null && c.game.time >= pendingRepair) {
      c.settings.temperature = 16;
      c.settings.acidity = 65;
      pendingRepair = null;
      repairs++;
    }
    const previousEvent = c.game.events;
    c.stepGame(dt);
    checkBounds(c, name);
    if (c.game.events !== previousEvent) {
      assert.equal(c.game.events, previousEvent + 1, `${name}: skipped/duplicated event`); assertions++;
      eventLog.push({ event:c.game.events, time:+c.game.time.toFixed(3), temperature:c.settings.temperature, acidity:c.settings.acidity });
      if (repairDelay !== null) pendingRepair = c.game.time + repairDelay;
    }
    if (c.outcome) break;
  }
  assert.ok(c.outcome, `${name}: no terminal outcome by 481 seconds`); assertions++;
  if (expectedWin !== undefined) { assert.equal(c.outcome.win, expectedWin, `${name}: wrong outcome`); assertions++; }
  if (c.outcome.win) {
    assert.ok(c.game.time <= 480, `${name}: win after time limit`);
    assert.ok(c.game.ferment >= 100 && c.game.vitality >= 55 && c.game.risk < 45, `${name}: invalid success criteria`);
    assertions += 2;
  }
  if (repairDelay !== null) { assert.equal(repairs, 3, `${name}: did not repair all three events`); assertions++; }
  return {
    name, dt, win:c.outcome.win, time:+c.game.time.toFixed(3),
    sugar:+c.game.sugar.toFixed(3), vitality:+c.game.vitality.toFixed(3),
    ferment:+c.game.ferment.toFixed(3), risk:+c.game.risk.toFixed(3),
    repairs, events:eventLog, reason:c.outcome.message
  };
}
const scenarios = [
  run({ name:'restore 16C/65 after each event, next frame', repairDelay:0, expectedWin:true }),
  run({ name:'restore after 5 simulated seconds', repairDelay:5, expectedWin:true }),
  run({ name:'restore after 15 simulated seconds', repairDelay:15, expectedWin:true }),
  run({ name:'completely unattended', expectedWin:false }),
  ...[[32,0],[32,100],[8,0],[8,100]].map(([temperature,acidity]) => run({ name:`extreme initial environment ${temperature}C/${acidity}`, temperature, acidity, expectedWin:false })),
  ...[1/30,.06,.18].map(dt => run({ name:`restore each event, integration step ${dt}`, dt, repairDelay:0, expectedWin:true }))
];
// Boundary matrix covers all branch thresholds and the largest frame integration
// step (60 ms frame clamp * 3x speed) using the same extracted production function.
let boundaryRuns = 0;
for (const dt of [.06,.18]) for (const temperature of [8,14,17,21,32]) for (const acidity of [0,20,50,65,85,100]) {
  run({ name:`bounds ${temperature}C/${acidity}, dt=${dt}`, temperature, acidity, dt });
  boundaryRuns++;
}
const report = {
  status:'PASS', sourcePath,
  htmlSha256:crypto.createHash('sha256').update(html).digest('hex'),
  extractedSimulationSha256:crypto.createHash('sha256').update(startBatch+'\n'+stepGame).digest('hex'),
  scenarios, boundaryRuns, checkedSteps, assertions, observedRanges,
  scope:'Pure simulation only; rendering, browser controls, and physical devices were not tested.'
};
console.log(JSON.stringify(report,null,2));
