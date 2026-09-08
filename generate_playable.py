import json
import nltk
import os

print("Loading data...")
with open('words.json', 'r') as f:
    words = json.load(f)

print("Processing POS tags...")
playable_words = []
stop_words = set(nltk.corpus.stopwords.words('english'))

for word in words:
    # Always include the 2000 game words just in case
    # But wait, we can just check POS
    if word in stop_words:
        continue
    
    # Check if word is valid
    if len(word) < 2: continue
    
    tag = nltk.pos_tag([word])[0][1]
    if tag.startswith('NN') or tag.startswith('VB') or tag.startswith('JJ'):
        playable_words.append(word)

print(f"Total playable words: {len(playable_words)}")
with open('playable_words.json', 'w') as f:
    json.dump(playable_words, f)

