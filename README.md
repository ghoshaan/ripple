# 🍇 Ripple

> A daily semantic word navigation game — find the path between two words by surfing through the meaning of language.

👉 **[Play Now → ghoshaan.github.io/ripple-game](https://ghoshaan.github.io/ripple-game/)**

![Ripple Gameplay Demo](./demo.gif)

---

## 🕹️ How to Play

You are given a **Start Word** and a **Target Word**. By clicking semantic neighbours, navigate through vocabulary space to reach the target in as few steps as possible.

### The Orbit
The current word sits at the centre, surrounded by orbital rings of clickable words:

- **The Golden Path word** — exactly one word per orbit is guaranteed to move you closer to the target. Find it.
- **Camouflage words** — natural synonyms of the current word, chosen to blend in without leading you closer.
- **Shuffle** — stuck? Swap out the camouflage words for fresh synonyms from the neighbour pool.

### Rules & Scoring
- The game simulates the optimal (greedy) path on load. Only puzzles solvable in **6–11 steps** are presented.
- Beat the computer's step count and earn a `✦ YOU BEAT THE COMPUTER! ✦` badge.
- A new puzzle drops **every day**.

---

## 🎮 Game Modes

Ripple features multiple themed vocabulary categories (including Wikipedia, Poetry, Biography, Bestsellers, History, Children, Mystery, Romance, Sci-Fi, and Mythology), each offering unique semantic word paths.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔊 **Hover Dictionary** | Hover (desktop) or long-press (mobile) any word for its definition & pronunciation |
| ↩️ **Jump-Back Navigation** | Click any word in your breadcrumb trail to backtrack and try a different route |
| 📊 **Path Comparison** | On victory, compare your path vs. the computer's using LCS alignment |
| 🔗 **Custom Games** | Set your own start/target via `?start=apple&target=galaxy` or the in-game creator |
| 📅 **Daily Puzzle** | Seeded by date — everyone plays the same puzzle each day |

---

## ⚙️ Technology

Ripple runs **entirely in your browser**. No server-side computation:

- Word relationships are computed using **100-dimensional GloVe embeddings** trained on literary text (Project Gutenberg corpus).
- Similarity is calculated via real-time **dot product / cosine similarity** on pre-normalised `Float32` arrays.
- Scores and streaks are stored via **Firebase**.

---

## ©️ Copyright & License

Copyright © 2025 Shaan Ghosh. All Rights Reserved.

This repository contains the **compiled, production build** of Ripple. The source code, assets, data pipelines, and all intellectual property are proprietary and confidential.

**You may not:**
- Copy, modify, or distribute any part of this code
- Use this code as the basis for another project
- Reverse-engineer or decompile the compiled output
- Host or republish this game under any other domain or platform

See [`LICENSE`](./LICENSE) for full terms. Unauthorised use may result in a DMCA takedown notice.

---

*Built with React, Vite, and a love for language.*
