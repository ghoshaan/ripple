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

const gameWords = JSON.parse(fs.readFileSync('game_words.json'));
function getRandomWord(r) {
  return gameWords[Math.floor(r() * gameWords.length)];
}

const seeds = [
  '2026-7-11-raspberry',
  '2026-7-11-raspberry-v2',
  '2026-7-11-raspberry-v3',
];

for (const s of seeds) {
  const rng = getSeededRandom(s);
  const target = getRandomWord(rng);
  const fallback = getRandomWord(rng);
  console.log(s, "Target:", target, "Fallback:", fallback);
}

