import fs from 'fs';

const words = JSON.parse(fs.readFileSync('words.json'));
const gameWords = JSON.parse(fs.readFileSync('game_words.json'));
const vectors = new Float32Array(fs.readFileSync('vectors.bin').buffer);

// normalize
for (let i = 0; i < words.length; i++) {
  let start = i * 100;
  let normSq = 0;
  for(let j=0; j<100; j++) normSq += vectors[start+j]*vectors[start+j];
  let norm = Math.sqrt(normSq);
  if (norm > 0) {
    for(let j=0; j<100; j++) vectors[start+j] /= norm;
  }
}

function isPlayable(w) {
  if (/\d/.test(w)) return false;
  return true; // ALLOW ALL WORDS!
}

function getSimilar(word, topK) {
  let wordIdx = words.indexOf(word);
  let v = vectors.subarray(wordIdx*100, (wordIdx+1)*100);
  let scores = [];
  let w_low = word.toLowerCase();
  for (let i=0; i<words.length; i++) {
    let cand = words[i];
    if (cand.toLowerCase() === w_low) continue;
    if (!isPlayable(cand)) continue;
    let cv = vectors.subarray(i*100, (i+1)*100);
    let sim = 0;
    for(let j=0; j<100; j++) sim += v[j]*cv[j];
    scores.push({word: cand, sim});
  }
  scores.sort((a,b) => b.sim - a.sim);
  return scores.slice(0, topK);
}

function getComputerPath(start, target) {
  let current = start;
  let path = [current];
  let steps = 0;
  let targetIdx = words.indexOf(target);
  let targetVec = vectors.subarray(targetIdx*100, (targetIdx+1)*100);
  
  while(steps < 15) {
    let neighbors = getSimilar(current, 50);
    let unvisited = neighbors.filter(n => !path.includes(n.word));
    let available = unvisited.length > 0 ? unvisited : neighbors;
    
    if (available.some(n => n.word === target)) {
      path.push(target);
      return path;
    }
    
    let bestScore = -2;
    let bestWord = null;
    for (let n of available) {
      let nIdx = words.indexOf(n.word);
      let nVec = vectors.subarray(nIdx*100, (nIdx+1)*100);
      let score = 0;
      for(let j=0; j<100; j++) score += nVec[j]*targetVec[j];
      if (score > bestScore) {
        bestScore = score;
        bestWord = n.word;
      }
    }
    
    if (!bestWord) break;
    current = bestWord;
    path.push(current);
    steps++;
  }
  return path;
}

function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
function getSeededRandom(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
  }
  return mulberry32(h);
}

const rng = getSeededRandom('2026-7-11-vanilla-v3');
const targetWord = gameWords[Math.floor(rng() * gameWords.length)];
console.log("Target:", targetWord);

let result = null;
for(let attempt=0; attempt<50; attempt++) {
  let walkLength = 6 + Math.floor(rng() * 6);
  let current = targetWord;
  let visited = new Set([current]);
  
  for(let step=0; step<walkLength; step++) {
    let neighbors = getSimilar(current, 50);
    let choices = neighbors.filter(n => !visited.has(n.word));
    if (choices.length === 0) break;
    let choiceIdx = Math.floor(rng() * Math.min(20, choices.length));
    current = choices[choiceIdx].word;
    visited.add(current);
  }
  
  if (current === targetWord) continue;
  
  let cp = getComputerPath(current, targetWord);
  let greedySteps = cp.length - 1;
  let lastWord = cp[cp.length - 1];
  
  if (lastWord === targetWord && greedySteps >= 6 && greedySteps <= 11) {
    result = { start: current, steps: greedySteps, path: cp };
    break;
  }
}

if (result) {
  console.log("Found valid start:", result.start);
  console.log("Path:", result.path);
} else {
  console.log("Fallback triggered!");
}

