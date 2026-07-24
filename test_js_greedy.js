import fs from 'fs';

const words = JSON.parse(fs.readFileSync('words.json'));
const playable = new Set(JSON.parse(fs.readFileSync('playable_words.json')));
const vectors = new Float32Array(fs.readFileSync('vectors.bin').buffer);

// pre-normalize
for (let i = 0; i < words.length; i++) {
  let start = i * 100;
  let normSq = 0;
  for(let j=0; j<100; j++) normSq += vectors[start+j]*vectors[start+j];
  let norm = Math.sqrt(normSq);
  if (norm > 0) {
    for(let j=0; j<100; j++) vectors[start+j] /= norm;
  }
}

function isValidWord(word) {
  if (/\d/.test(word)) return false;                        // no digits
  if (!/^[a-z]/i.test(word)) return false;                  // must start with a letter
  if ((word.match(/[a-z]/gi) || []).length < 2) return false; // at least 2 letters
  return true;
}

function getVector(w) {
  let idx = words.indexOf(w);
  if (idx === -1) return null;
  return vectors.subarray(idx*100, (idx+1)*100);
}

function getSimilarityScore(w1, w2) {
  let v1 = getVector(w1);
  let v2 = getVector(w2);
  if (!v1 || !v2) return -1;
  let d = 0;
  for(let i=0; i<100; i++) d += v1[i]*v2[i];
  return d;
}

function getSimilarWords(word, topK=50) {
  let targetVec = getVector(word);
  if (!targetVec) return [];
  let scores = [];
  let normWord = word.trim().toLowerCase();
  for (let i=0; i<words.length; i++) {
    let cand = words[i];
    if (cand.trim().toLowerCase() === normWord) continue;
    if (!isValidWord(cand) || !playable.has(cand)) continue;
    let cv = vectors.subarray(i*100, (i+1)*100);
    let d = 0;
    for(let j=0; j<100; j++) d += targetVec[j]*cv[j];
    scores.push({word: cand, similarity: d});
  }
  scores.sort((a,b) => b.similarity - a.similarity);
  return scores.slice(0, topK);
}

function getComputerPath(startWord, targetWordStr) {
  let current = startWord;
  let path = [current];
  let steps = 0;

  while (steps < 15) {
    const neighbors = getSimilarWords(current, 50);
    const unvisitedNeighbors = neighbors.filter(n => !path.includes(n.word));
    const availableNeighbors = unvisitedNeighbors.length > 0 ? unvisitedNeighbors : neighbors;

    if (availableNeighbors.some(n => n.word === targetWordStr)) {
      path.push(targetWordStr);
      return path;
    }

    const candidates = availableNeighbors.map(n => ({
      word: n.word,
      targetScore: getSimilarityScore(n.word, targetWordStr),
      leap: n.similarity
    }));

    const MIN_LEAP = 0.55;
    const acceptableLeaps = candidates.filter(c => c.leap >= MIN_LEAP);
    const candidatesToUse = acceptableLeaps.length > 0 ? acceptableLeaps : candidates;

    let golden = candidatesToUse.sort((a, b) => b.targetScore - a.targetScore)[0];

    if (!golden) break;
    current = golden.word;
    path.push(current);
    steps++;
  }
  return path;
}

console.log("Path violence -> strip:", getComputerPath("violence", "strip"));

