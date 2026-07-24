import json
import struct
import math

with open('words.json', 'r') as f:
    words = json.load(f)

with open('playable_words.json', 'r') as f:
    playable = set(json.load(f))

with open('vectors.bin', 'rb') as f:
    data = f.read()
    vectors = list(struct.unpack(f"<{len(data)//4}f", data))

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

def is_valid_word(word):
    if any(c.isdigit() for c in word): return False
    if not word[0].isalpha(): return False
    if sum(1 for c in word if c.isalpha()) < 2: return False
    return True

def get_similar_words(word, top_k=50):
    vec = get_vec(word)
    if not vec: return []
    scores = []
    w_low = word.strip().lower()
    for i, w in enumerate(words):
        if w.strip().lower() == w_low: continue
        if not is_valid_word(w) or w not in playable: continue
        c_vec = vectors[i*100 : (i+1)*100]
        sim = similarity(vec, c_vec)
        scores.append((sim, w))
    scores.sort(reverse=True, key=lambda x: x[0])
    return scores[:top_k]

def get_computer_path(start_word, target_word):
    current = start_word
    path = [current]
    steps = 0
    target_vec = get_vec(target_word)
    while steps < 15:
        neighbors = get_similar_words(current, 50)
        unvisited = [n for n in neighbors if n[1] not in path]
        available = unvisited if unvisited else neighbors
        
        if any(n[1] == target_word for n in available):
            path.append(target_word)
            return path
            
        best_score = -2
        best_word = None
        for n in available:
            score = similarity(get_vec(n[1]), target_vec)
            if score > best_score:
                best_score = score
                best_word = n[1]
                
        if not best_word: break
        current = best_word
        path.append(current)
        steps += 1
    return path

print("Computer path for violence -> strip:")
cp = get_computer_path("violence", "strip")
print(cp)
print(f"Steps: {len(cp)-1}")
