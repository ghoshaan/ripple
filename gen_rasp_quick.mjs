/**
 * gen_rasp_quick.mjs
 *
 * Generates 4 raspberry-mode quick-game pairs (start → target) that satisfy:
 *   1. Raspberry greedy path: 2–4 steps
 *   2. No 1-step win in raspberry (target not in top-200 neighbours of start)
 *   3. No 2-step win in raspberry (target not in top-100 neighbours of any 1-hop choice)
 *   4. Vanilla greedy path: >= 4 steps  (cannot be won quickly in vanilla)
 *
 * Run from the public/ directory:
 *   node gen_rasp_quick.mjs
 *
 * Mode mapping (see src/vectorStore.js): vanilla → wikipedia/, raspberry → poetry/.
 * These are configurable via the VANILLA_DIR / RASPBERRY_DIR constants below, so
 * the same generator can produce quick-games for any two genre modes (e.g. swap
 * RASPBERRY_DIR to 'science/' to make science-vs-wikipedia quick games).
 *
 * Performance note: similarities are precomputed once into a per-word
 * top-K neighbour cache at load time (sorted by sim desc, then index asc so
 * tie-breaking is identical to the original full-scan + stable-sort behaviour).
 * This removes the O(vocab × 100) rescan on every query. Randomness, thresholds
 * and the chosen (start, target) pairs are unchanged from the original algorithm.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// vanilla = the "long" mode, raspberry = the "short/quick" mode
const VANILLA_DIR   = 'wikipedia';
const RASPBERRY_DIR = 'poetry';

// ── Load vanilla data ──────────────────────────────────────────────────────
const vanWords   = JSON.parse(fs.readFileSync(path.join(__dirname, VANILLA_DIR, 'words.json')));
const vanVecBuf  = fs.readFileSync(path.join(__dirname, VANILLA_DIR, 'vectors.bin'));
const vanVectors = new Float32Array(vanVecBuf.buffer);
const vanGameWords = JSON.parse(fs.readFileSync(path.join(__dirname, VANILLA_DIR, 'game_words.json')));

// ── Load raspberry data ────────────────────────────────────────────────────
const rspWords   = JSON.parse(fs.readFileSync(path.join(__dirname, RASPBERRY_DIR, 'words.json')));
const rspVecBuf  = fs.readFileSync(path.join(__dirname, RASPBERRY_DIR, 'vectors.bin'));
const rspVectors = new Float32Array(rspVecBuf.buffer);
const rspGameWords = JSON.parse(fs.readFileSync(path.join(__dirname, RASPBERRY_DIR, 'game_words.json')));

const VECTOR_SIZE = 100;

// Build word→index maps
function buildIndex(words) {
  const m = new Map();
  for (let i = 0; i < words.length; i++) m.set(words[i], i);
  return m;
}
const vanIndex = buildIndex(vanWords);
const rspIndex = buildIndex(rspWords);

// Normalize vectors in-place
function normalizeVectors(vectors, words) {
  for (let i = 0; i < words.length; i++) {
    const start = i * VECTOR_SIZE;
    let normSq = 0;
    for (let j = 0; j < VECTOR_SIZE; j++) normSq += vectors[start + j] ** 2;
    const norm = Math.sqrt(normSq);
    if (norm > 0) for (let j = 0; j < VECTOR_SIZE; j++) vectors[start + j] /= norm;
  }
}
normalizeVectors(vanVectors, vanWords);
normalizeVectors(rspVectors, rspWords);

// ── Precomputed neighbour caches ────────────────────────────────────────────
// getNeighbours[word] = [{ word, sim }] sorted by sim DESC, then index ASC.
// The index-asc tie-break mirrors the original getSimilar's stable sort over
// the vocabulary's natural index ordering, so downstream rng() draws land on
// the same words.
const CACHE_TOPK = 500;

function buildNeighbourCache(words, vectors, index) {
  const cache = new Map();
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const v = vectors.subarray(i * VECTOR_SIZE, (i + 1) * VECTOR_SIZE);
    const scores = [];
    for (let j = 0; j < words.length; j++) {
      if (j === i) continue;
      const cv = vectors.subarray(j * VECTOR_SIZE, (j + 1) * VECTOR_SIZE);
      let sim = 0;
      for (let k = 0; k < VECTOR_SIZE; k++) sim += v[k] * cv[k];
      scores.push({ word: words[j], sim, _idx: j });
    }
    scores.sort((a, b) => (b.sim - a.sim) || (a._idx - b._idx));
    cache.set(word, scores.slice(0, CACHE_TOPK));
  }
  return cache;
}

const vanNeighbours = buildNeighbourCache(vanWords, vanVectors, vanIndex);
const rspNeighbours = buildNeighbourCache(rspWords, rspVectors, rspIndex);

// getSimilar: top-K neighbours for a word (cached; identical ordering to origin).
function getSimilar(word, topK, neighbours) {
  const list = neighbours.get(word);
  if (!list) return [];
  return list.slice(0, topK);
}

// getSim: single pair similarity via direct index lookup.
function getSim(wordA, wordB, words, vectors, index) {
  const ia = index.get(wordA), ib = index.get(wordB);
  if (ia === undefined || ib === undefined) return 0;
  let dot = 0;
  for (let j = 0; j < VECTOR_SIZE; j++)
    dot += vectors[ia * VECTOR_SIZE + j] * vectors[ib * VECTOR_SIZE + j];
  return dot;
}

// Greedy path simulation (mirrors vectorStore.js getComputerPath)
function getGreedyPath(startWord, targetWord, words, vectors, index, neighbours) {
  let current = startWord;
  const path = [current];
  let steps = 0;
  const SIMILARITY_THRESHOLD = 0.50;
  const MIN_CHOICES = 15;

  while (steps < 15) {
    const superWide = getSimilar(current, 500, neighbours);

    let neighbors = superWide.filter(n => n.sim >= SIMILARITY_THRESHOLD);
    if (neighbors.length < MIN_CHOICES) neighbors = superWide.slice(0, MIN_CHOICES);

    const targetNorm = targetWord.toLowerCase();
    const targetInPool = superWide.find(n => n.word.toLowerCase() === targetNorm);
    if (targetInPool && targetInPool.sim >= 0.50 && !neighbors.some(n => n.word.toLowerCase() === targetNorm)) {
      neighbors.push(targetInPool);
    }

    const unvisited = neighbors.filter(n => !path.includes(n.word) && n.word !== current);

    if (unvisited.some(n => n.word.toLowerCase() === targetNorm)) {
      path.push(targetWord);
      return path;
    }

    // Pick the unvisited neighbor most similar to target
    let best = null, bestScore = -2;
    for (const n of unvisited) {
      const s = getSim(n.word, targetWord, words, vectors, index);
      if (s > bestScore) { bestScore = s; best = n.word; }
    }
    if (!best) break;
    current = best;
    path.push(current);
    steps++;
  }
  return path;
}

// Raspberry choices for a word (mirrors getChoicesForWord, baseLimit=20)
function getRaspChoices(word, targetWord) {
  const wide = getSimilar(word, 500, rspNeighbours).slice(0, 20);
  // Check if target is missing and add if in top-500
  const tNorm = targetWord.toLowerCase();
  const tRank = rspIndex.get(tNorm);
  if (tRank !== undefined && tRank < 50) {
    const tInPool = getSimilar(word, 500, rspNeighbours).find(n => n.word === tNorm);
    if (tInPool && !wide.some(n => n.word === tNorm)) wide.push(tInPool);
  }
  return wide;
}

// Vanilla choices for a word (baseLimit=100)
function getVanChoices(word, targetWord) {
  const wide = getSimilar(word, 500, vanNeighbours).slice(0, 100);
  const tNorm = targetWord.toLowerCase();
  const tIdx = getSimilar(word, 500, vanNeighbours).findIndex(n => n.word === tNorm);
  if (tIdx !== -1 && tIdx < 200 && !wide.some(n => n.word === tNorm)) {
    wide.push(getSimilar(word, 500, vanNeighbours)[tIdx]);
  }
  return wide;
}

// RNG
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function getSeededRandom(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (Math.imul(31, h) + seedStr.charCodeAt(i)) | 0;
  return mulberry32(h);
}

// ── Main generation loop ────────────────────────────────────────────────────
const BASE_URL = 'https://ripp13.com/';
const results = [];
let seed = 0;

console.log('Searching for valid raspberry quick games...\n');

while (results.length < 4) {
  seed++;
  const rng = getSeededRandom(`gen-rasp-quick-${seed}`);

  // Pick random target from raspberry game words
  const targetWord = rspGameWords[Math.floor(rng() * rspGameWords.length)];
  if (!vanIndex.has(targetWord)) continue; // must exist in vanilla too

  // Random walk from target to find start (mirrors findValidStartWord with allowQuick=true)
  // minSteps=2, maxSteps=4
  let foundStart = null;

  for (let attempt = 0; attempt < 30; attempt++) {
    const walkLength = 2 + Math.floor(rng() * 3); // 2–4 steps back
    let current = targetWord;
    const visited = new Set([current]);

    for (let step = 0; step < walkLength; step++) {
      const neighbors = getSimilar(current, 50, rspNeighbours)
        .filter(n => !visited.has(n.word));
      if (neighbors.length === 0) break;
      const choiceIdx = Math.floor(rng() * Math.min(20, neighbors.length));
      current = neighbors[choiceIdx].word;
      visited.add(current);
    }

    const startWord = current;
    if (startWord === targetWord) continue;

    // Must exist in vanilla
    if (!vanIndex.has(startWord)) continue;

    // Raspberry similarity must be low (< 0.2)
    const rspSim = getSim(startWord, targetWord, rspWords, rspVectors, rspIndex);
    if (rspSim > 0.2) continue;

    // No 1-step win in raspberry (target not in top-200 of start)
    const rspTop200 = getSimilar(startWord, 200, rspNeighbours);
    if (rspTop200.some(n => n.word === targetWord)) continue;

    // No 2-step win in raspberry
    const rspChoices = getRaspChoices(startWord, targetWord);
    const hasTwoStepWinRasp = rspChoices.some(n => {
      const nextNeighbors = getSimilar(n.word, 100, rspNeighbours);
      return nextNeighbors.some(w => w.word === targetWord);
    });
    if (hasTwoStepWinRasp) continue;

    // Check raspberry greedy path is 2–4 steps
    const rspPath = getGreedyPath(startWord, targetWord, rspWords, rspVectors, rspIndex, rspNeighbours);
    const rspSteps = rspPath.length - 1;
    if (rspPath[rspPath.length - 1] !== targetWord) continue;
    if (rspSteps < 2 || rspSteps > 4) continue;

    // Check vanilla greedy path is >= 4 steps (cannot win quickly in vanilla)
    const vanPath = getGreedyPath(startWord, targetWord, vanWords, vanVectors, vanIndex, vanNeighbours);
    const vanSteps = vanPath.length - 1;
    if (vanPath[vanPath.length - 1] !== targetWord) {
      // Vanilla can't even reach it - still satisfies "can't win in under 4"
      // but let's only accept if vanilla is actually solvable for fairness
      continue;
    }
    if (vanSteps < 4) continue;

    foundStart = { start: startWord, target: targetWord, rspSteps, vanSteps, rspPath, vanPath };
    break;
  }

  if (!foundStart) continue;

  results.push(foundStart);
  const url = `${BASE_URL}?start=${foundStart.start}&target=${foundStart.target}&quick=true`;
  console.log(`Game ${results.length}:`);
  console.log(`  Start:        ${foundStart.start}`);
  console.log(`  Target:       ${foundStart.target}`);
  console.log(`  Raspberry path (${foundStart.rspSteps} steps): ${foundStart.rspPath.join(' → ')}`);
  console.log(`  Vanilla path  (${foundStart.vanSteps} steps): ${foundStart.vanPath.join(' → ')}`);
  console.log(`  URL: ${url}`);
  console.log();
}

console.log('\n=== LINKS ===');
for (let i = 0; i < results.length; i++) {
  const r = results[i];
  const url = `${BASE_URL}?start=${r.start}&target=${r.target}&quick=true`;
  console.log(`${i + 1}. ${url}`);
}
