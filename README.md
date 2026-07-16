# 🎮 GameHub

GameHub is a modern, responsive, web-based gaming lobby designed for playing both **local turn-based party games** and **real-time online multiplayer games**. Powered by a shared client-side framework and a lightweight Firebase database layer, GameHub allows players to host lobbies, join friends with 4-letter room codes, customize settings, and play games instantly in their browser with zero install.

---

## ✨ Features

*   **Unified Lobby Shell**: An interactive dashboard showing active lobbies, global online status, and game filters (by search query, player count range, game mode, or categories).
*   **Modular Game Framework (`GameFramework`)**: A robust JavaScript SDK that handles all turn-based logic, network synchronization, seating/team management, rematching, and spectator tracking automatically.
*   **Real-time Synchronization**: Online multiplayer powered by Firebase, synchronizing moves, votes, and game states asynchronously across clients.
*   **"Pass the Phone" Support**: Built-in helper overlay for local pass-and-play games, guiding players when to hand over the device.
*   **Modern Aesthetics**: Premium dark-mode interface styled with vibrant gradients, glassmorphism, responsive grid views, and micro-animations.

---

## 🎲 Available Games

### Active Games
*   **❌⭕ Tic-Tac-Toe** (Local & Online, 2 Players) – The classic 3x3 battle of wits.
*   **🔴🟡 Connect Four** (Local & Online, 2 Players) – Drop discs and connect four in a row to win.
*   **🕵️ Codenames Duet** (Local & Online, Co-op, 2 Players) – Work together to identify all secret agents using word association clues.
*   **🔳 Dots & Boxes** (Local & Online, 2 Players) – Connect dot-grids to claim and capture boxes.
*   **📝 MadLib** (Local Solo or Pass-and-Play) – Input custom words to compile hilarious stories together.
*   **🔢 Sudoku** (Local Solo) – A logic-based number grid puzzle

### Coming Soon ⏳
*   **🚢 Battle Ship** (Local & Online, 2 Players) – Position your fleet and sink the enemy.
*   **⬛⬜ Cards Against Humanity** (Local & Online, 3-10 Players) – A party game for horrible people.
*   **🧩 Logic Grid** (Local Solo) – Deduct correct relationships using clues and a cross-referencing grid.

---

## 🛠️ Architecture

GameHub separates interface structure, user presence, and game state into distinct modules:

*   **`js/catalog.js`**: Defines the source-of-truth metadata for all games in the platform, including min/max player counts, difficulty tags, and descriptions.
*   **`js/lobby-shell.js`**: Injects the global application footer, checks Github commit dates to display the "Last updated" date, and tracks online latency pings.
*   **`js/game-shell.js`**: Centrally injects uniform headers, victory/defeat overlays, player action menus, and bottom sheets into all running games.
*   **`js/game-framework.js`**: The central controller. Individual games instantiate this framework and pass in their custom game configurations and custom UI logic.
*   **Game Engines (`games/*/engine.js`)**: Pure JavaScript engines matching the state pattern:
    *   `getInitialState(config)`: Returns default state.
    *   `applyMove(state, action, slotIndex)`: Processes a player's move action and returns the modified state.
    *   `checkGameOver(state)`: Checks if win/loss/draw conditions are met.
