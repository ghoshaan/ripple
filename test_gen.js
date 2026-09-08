import fs from 'fs';
// We need to simulate mulberry32 and the random walk to see if it fell back.
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

const words = JSON.parse(fs.readFileSync('words.json'));
const gameWords = JSON.parse(fs.readFileSync('game_words.json'));

const rng = getSeededRandom('2026-7-11-vanilla-v3');

function getRandomWord(r) {
  return gameWords[Math.floor(r() * gameWords.length)];
}

const target = getRandomWord(rng);
console.log("Target:", target);

// The fallback word would be the next random word
const fallback = getRandomWord(rng);
console.log("Fallback start:", fallback);

