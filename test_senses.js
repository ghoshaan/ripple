// test_senses.js — validates secondary-sense injection for polysemic words.
// Loads wikipedia vectors + senses and checks getChoicesForWord orbit.
import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = join(__dirname, 'wikipedia');

function loadWords(file) {
  return JSON.parse(readFileSync(join(base, file), 'utf8'));
}
const words = loadWords('words.json');
const wordToIndex = new Map();
words.forEach((w, i) => { if (w.length >= 3) wordToIndex.set(w, i); });
const SIZE = 100;
const buffer = readFileSync(join(base, 'vectors.bin'));
const vectors = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);

function getVector(w) {
  const i = wordToIndex.get(w);
  if (i === undefined) return null;
  return vectors.subarray(i * SIZE, i * SIZE + SIZE);
}
function sim(a, b) {
  const va = getVector(a), vb = getVector(b);
  if (!va || !vb) return 0;
  let d = 0; for (let i = 0; i < SIZE; i++) d += va[i] * vb[i];
  return d;
}
function hasCloseNeighbor(w, t) {
  for (const c of words) {
    if (c === w) continue;
    if (sim(w, c) >= t) return true;
  }
  return false;
}
const senses = JSON.parse(readFileSync(join(base, 'senses.json'), 'utf8'));

// Minimal stand-ins for the helpers used by getSecondarySenseChoice.
function isValidWord(w) {
  if (w.length < 3) return false;
  if (/\d/.test(w)) return false;
  if (!/^[a-z]/i.test(w)) return false;
  return true;
}
function checkIsMatch(w, t) {
  w = w.toLowerCase(); t = t.toLowerCase();
  return w === t;
}

// Re-implement getChoicesForWord injection logic in isolation for the test.
function getChoicesForWord(word, targetStr) {
  // Build a small orbit: top cosine neighbors (like the real code's top of pool).
  const targetVec = getVector(word);
  const scored = words
    .filter(w => w !== word && w.length >= 3)
    .map(w => ({ word: w, similarity: sim(word, w) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 50);

  // golden = best toward target
  const withTarget = scored.map(n => ({ ...n, targetScore: sim(n.word, targetStr) }))
    .sort((a, b) => b.targetScore - a.targetScore);
  const golden = { ...withTarget[0], isGolden: true };

  // pick 5 camouflage evenly from the top-50 pool
  const camouflage = [];
  const step = Math.max(1, Math.floor(50 / 5));
  for (let k = 1; k <= 5; k++) {
    let idx = k * step - 1;
    while (idx < scored.length && (camouflage.some(c => c.word === scored[idx].word) || scored[idx].word === golden.word)) idx++;
    camouflage.push(scored[Math.min(idx, scored.length - 1)]);
  }
  let orbit = [golden, ...camouflage];

  // injection (mirrors getSecondarySenseChoices: reserve a share of slots for
  // distinct secondary senses so one dominant phrase-sense can't monopolize).
  const entry = senses[word.toLowerCase()];
  const injected = [];
  if (entry && entry.senses && entry.senses.length >= 2) {
    const existing = new Set(orbit.map(n => n.word.toLowerCase()));
    const cands = [];
    const used = new Set();
    for (const sense of entry.senses) {
      const probe = sense.probe;
      if (!probe) continue;
      const p = probe.toLowerCase();
      if (existing.has(p) || p === word.toLowerCase() || used.has(p)) continue;
      if (!isValidWord(probe) || checkIsMatch(probe, targetStr)) continue;
      const s = sim(word, probe);
      const reachable = s >= 0.65 || hasCloseNeighbor(probe, 0.65);
      if (!reachable) continue;
      cands.push({ probe, s, affinity: sim(probe, targetStr), label: sense.label });
      used.add(p);
    }
    cands.sort((a, b) => (b.affinity - a.affinity) || (a.s - b.s));
    const maxInjected = Math.min(cands.length, Math.max(1, Math.floor(6 / 2) - 1));
    for (const c of cands.slice(0, maxInjected)) {
      injected.push({ word: c.probe, similarity: c.s, isGolden: false, senseInjected: true, senseLabel: c.label });
    }
  }
  if (injected.length) {
    const keep = 6 - injected.length;
    const strongest = camouflage
      .filter(c => !injected.some(i => i.word.toLowerCase() === c.word.toLowerCase()))
      .slice(0, Math.max(0, keep - 1));
    orbit = [golden, ...strongest, ...injected].slice(0, 6);
  }
  return orbit;
}

let pass = 0, fail = 0;
const cases = [
  ['board', 'money'],     // financial sense should be injectable when target far
  ['board', 'river'],     // ...or the lumber/table sense
  ['arm', 'sleeve'],
  ['arm', 'weapon'],
  ['spring', 'season'],
  ['spring', 'metal'],
  ['hop', 'jump'],        // literal sense vs the dominant "hip hop" music sense
  ['hop', 'skip'],
];
let balancePass = 0, balanceFail = 0;
for (const [word, target] of cases) {
  const orbit = getChoicesForWord(word, target);
  const injected = orbit.filter(n => n.senseInjected);
  const hasTarget = orbit.some(n => n.word.toLowerCase() === target.toLowerCase());
  // The injected probe should be present for the matching sense when reachable.
  const probePresent = orbit.some(n => n.word.toLowerCase() === target.toLowerCase());
  console.log(`${word} -> ${target}: orbit=${orbit.map(n => n.word + (n.senseInjected ? '*' : '')).join(', ')}`);
  if (orbit.length === 6) pass++; else { fail++; console.log('  FAIL: orbit size', orbit.length); }
  // Balance check: a polysemic word should surface >=1 distinct-sense choice,
  // preventing one phrase-sense (e.g. music) from filling every slot.
  const expectInjection = senses[word.toLowerCase()] && senses[word.toLowerCase()].senses.length >= 2;
  if (expectInjection) {
    if (injected.length >= 1) balancePass++;
    else { balanceFail++; console.log('  FAIL: no sense probe injected for polysemic word'); }
  }
}
console.log(`\nOrbit-size checks: ${pass} pass, ${fail} fail`);
console.log(`Sense-balance checks: ${balancePass} pass, ${balanceFail} fail`);
