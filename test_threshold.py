import json
import struct
import math

with open('words.json', 'r') as f:
    words = json.load(f)

with open('vectors.bin', 'rb') as f:
    data = f.read()
    vectors = list(struct.unpack(f"<{len(data)//4}f", data))

# normalize vectors
for i in range(len(words)):
    start = i * 100
    norm_sq = sum(x*x for x in vectors[start:start+100])
    norm = math.sqrt(norm_sq)
    if norm > 0:
        for j in range(100):
            vectors[start+j] /= norm

word_to_idx = {w: i for i, w in enumerate(words)}

def get_vec(word):
    idx = word_to_idx.get(word)
    if idx is None: return None
    return vectors[idx*100 : (idx+1)*100]

def similarity(v1, v2):
    return sum(x*y for x,y in zip(v1, v2))

test_words = ["gross", "opposite", "until", "the", "cat", "dog", "apple", "running"]
for w in test_words:
    vec = get_vec(w)
    if not vec: continue
    best_sim = -1
    best_word = ""
    for i, cw in enumerate(words):
        if cw == w: continue
        if not cw.isalpha() or len(cw) < 2: continue
        c_vec = vectors[i*100 : (i+1)*100]
        sim = similarity(vec, c_vec)
        if sim > best_sim:
            best_sim = sim
            best_word = cw
    print(f"{w} -> {best_word} ({best_sim:.3f})")

