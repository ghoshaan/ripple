import fs from 'fs';
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
const fallbackWords = words.slice(0, 2000);

function getRandomWord(r) {
  return fallbackWords[Math.floor(r() * fallbackWords.length)];
}

console.log("vanilla:", getRandomWord(getSeededRandom('2026-7-11-vanilla')));
console.log("v2:", getRandomWord(getSeededRandom('2026-7-11-vanilla-v2')));
console.log("v3:", getRandomWord(getSeededRandom('2026-7-11-vanilla-v3')));

