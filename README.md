# 🎨 Skribble — Draw & Guess Game

A full-featured **skribbl.io clone** built with React, Node.js, and Socket.IO.  
Every requirement from the spec is implemented, including all bonus features.

> **Live Demo:** `https://your-skribbl-clone.onrender.com` ← replace after deployment

---

## ✅ Feature Checklist

### Must Have
- [x] Create room with all configurable settings
- [x] Join room via link or code
- [x] Lobby with player list; host starts game
- [x] Turn-based rounds — one drawer, others guess
- [x] Real-time drawing sync via WebSockets
- [x] Word selection — drawer picks 1 of N words
- [x] Guessing — type word, earn points for correct answer
- [x] Scoring and live leaderboard
- [x] Game end with winner announcement
- [x] Drawing tools — brush, 20 colours, 5 sizes, undo, clear

### Should Have
- [x] Hints — letters revealed over time
- [x] Chat — guesses + general messages
- [x] Draw time countdown with animated bar
- [x] Private rooms with shareable invite link

### Nice to Have
- [x] Word categories — 130 words across 6 categories (animals, objects, food, actions, places, misc)
- [x] Eraser tool
- [x] Kick player (host moderation)
- [x] Ban player (host moderation — cannot rejoin room)
- [x] **Word Modes** — Normal / Hidden / Combination
- [x] **Custom word list** — host sets their own words in lobby
- [x] **Spectator mode** — join any room as a watcher (join page + browse page)
- [x] **Replay** — watch last round's drawing replayed after round end

### Bonus (OOP + Architecture)
- [x] `Player` class — score, state, serialisation
- [x] `Game` class — all round logic, word modes, stroke history, scoring
- [x] `Room` class — player map, host management, broadcast helpers, ban list, custom words
- [x] `MessageHandler` class — all 22 WebSocket event handlers as methods
- [x] `game_state` named event (spec-compliant — client can request at any time)
- [x] Late-joiner canvas sync (full stroke replay on join)
- [x] Drawer disconnect handling (round ends gracefully)
- [x] Auto word selection if drawer doesn't choose within 15 s

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Canvas | HTML5 Canvas API (custom drawing + remote replay engine) |
| Backend | Node.js + Express |
| WebSockets | Socket.IO 4 |
| Storage | In-memory (`Map`) — no database required for MVP |
| Styling | Pure CSS with CSS custom properties |

---

## Project Structure

```
skribbl-clone/
├── server/
│   ├── index.js           # Express + Socket.IO entry point
│   ├── MessageHandler.js  # All 22 WebSocket event handlers (class)
│   ├── Room.js            # Room class — players, ban list, custom words, broadcast
│   ├── Game.js            # Game class — rounds, word modes, scoring, turn logic
│   ├── Player.js          # Player class — score, spectator flag, serialisation
│   └── words.js           # 130 words across 6 categories + custom pool support
│
└── client/src/
    ├── App.jsx                    # Root — all state, all socket event wiring
    ├── hooks/
    │   ├── useSocket.js           # Singleton Socket.IO + stable handler binding
    │   └── useCanvas.js           # Drawing engine — input, remote replay, undo
    ├── pages/
    │   ├── HomePage.jsx           # Create / join / browse + spectator toggle + word mode picker
    │   ├── LobbyPage.jsx          # Waiting room, settings, custom words editor, spectator list
    │   ├── GamePage.jsx           # Canvas, toolbar, chat, scoreboard, word mode badge, replay
    │   └── GameOverPage.jsx       # Winner + final leaderboard
    └── components/
        ├── DrawingToolbar.jsx     # 20 colours, 5 sizes, pen, eraser, undo, clear
        ├── ChatPanel.jsx          # Chat + guess input; spectator-aware
        ├── Scoreboard.jsx         # Live scores; kick/ban buttons for host; spectator section
        ├── WordSelector.jsx       # Word choice overlay for drawer
        └── RoundEndOverlay.jsx    # Word reveal + leaderboard + replay button
```

---

## Local Development

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### 1. Install

```bash
git clone https://github.com/yourname/skribbl-clone.git
cd skribbl-clone
npm install                # root (concurrently)
npm run install:all        # server + client
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
cp client/.env.example  client/.env.local
```

### 3. Run

```bash
npm run dev
# Frontend → http://localhost:5173
# Backend  → http://localhost:3001
# Health   → http://localhost:3001/health
```

Open two browser tabs, create a room in one, join with the code in the other.

---

## Deployment

### Option A — Render (recommended, full WebSocket support)

1. Push to GitHub
2. Render Dashboard → **New → Blueprint** → connect repo
3. Render reads `render.yaml` and creates both services automatically
4. After deploy, copy the backend URL into the frontend's `VITE_SERVER_URL` env var, redeploy frontend
5. Paste live URL into README

### Option B — Railway

```bash
npm i -g @railway/cli && railway login
railway init && railway up
```

Set env vars in Railway dashboard:
- `PORT=3001`
- `CLIENT_URL=https://your-frontend-url`
- `VITE_SERVER_URL=https://your-railway-backend-url`

### Option C — Vercel (frontend) + Render (backend)

> ⚠️ Vercel serverless does not support persistent WebSocket connections.  
> Always deploy the Socket.IO server separately (Render/Railway).

**Backend on Render:** New Web Service → root dir `server` → start: `node index.js`  
**Frontend on Vercel:** New Project → root dir `client` → add `VITE_SERVER_URL` env var

---

## WebSocket Architecture

### Full Event Table

| Event | Direction | Description |
|---|---|---|
| `create_room` | C→S | Host creates room with settings |
| `join_room` | C→S | Player joins as active participant |
| `join_spectator` | C→S | Player joins as spectator (watches only) |
| `room_created` | S→C | Room ID + initial state sent to host |
| `room_joined` | S→C | Full state sent to joining player |
| `player_joined` | S→all | Broadcast when anyone joins |
| `player_left` | S→all | Broadcast on disconnect/kick/ban |
| `start_game` | C→S | Host starts the game |
| `game_started` | S→all | Game begins; reset scores |
| `game_state` | C→S / S→C | Request or receive current game state |
| `round_start` | S→all | New round; who is drawer; draw time |
| `word_options` | S→drawer | Word choices — sent to drawer socket only |
| `word_chosen` | C→S | Drawer picks a word |
| `your_word` | S→drawer | Actual word (respects wordMode) |
| `drawing_started` | S→all | Hidden word + drawTime broadcast |
| `timer_tick` | S→all | Every second countdown |
| `hint_revealed` | S→all | Updated hidden word with a new letter |
| `draw_start` | C→S | Drawer begins a stroke |
| `draw_move` | C→S | Drawer continues stroke |
| `draw_end` | C→S | Drawer lifts pen |
| `draw_data` | S→others | Broadcast stroke to all non-sender clients |
| `canvas_clear` | C→S | Drawer clears canvas |
| `canvas_cleared` | S→all | Broadcast clear to all |
| `draw_undo` | C→S | Drawer undoes last stroke group |
| `canvas_undo` | S→all | Full strokes array for replay-based undo |
| `canvas_state` | S→C | Full stroke history for late joiners |
| `guess` | C→S | Player submits a guess |
| `guess_result` | S→all | Correct/incorrect + points |
| `chat` | C→S | General chat message |
| `chat_message` | S→all | Broadcast chat (incl. system messages) |
| `round_end` | S→all | Word reveal + updated scores |
| `request_replay` | C→S | Player requests last round's strokes |
| `replay_strokes` | S→C | Last round stroke history for replay |
| `game_over` | S→all | Final winner + leaderboard |
| `kick_player` | C→S | Host kicks a player |
| `ban_player` | C→S | Host bans a player (blocks rejoin by name) |
| `kicked` | S→C | Notification sent to kicked/banned player |
| `set_custom_words` | C→S | Host sets custom word list |
| `custom_words_set` | S→host | Confirmation + sanitised word list |
| `get_public_rooms` | C→S | Request list of open public rooms |
| `public_rooms` | S→C | List of joinable rooms |

### Key Design Decisions

**Drawing sync:** `draw_start` carries full style metadata (`color`, `size`, `isEraser`) so late joiners can replay the full canvas from `game.strokes[]` without needing any shared state.

**Word security:** The actual word never leaves the server to non-drawer clients. `getHiddenWord()` returns only underscores + revealed letters. Even in Hidden mode, the drawer's socket receives only blanks via `your_word`.

**Word modes:**
- `normal` — drawer sees full word
- `hidden` — drawer sees only underscores (extra hard; rely on server-side guess checking)
- `combination` — drawer sees first + last letter of each word segment (e.g. `p___r b__r`)

**Spectators:** `isSpectator` flag on `Player`. Spectators are excluded from `game.playerOrder` (never draw), excluded from leaderboard, can send chat but not guesses, and appear in a separate scoreboard section.

**Replay:** `room.lastRoundStrokes` saves a copy of `game.strokes[]` at `endRound()`. The round-end overlay's replay button triggers `replayStrokes()` client-side, animating each stroke with an 8 ms delay.

**Kick/Ban:** `kick_player` forcibly disconnects the target and emits `kicked` to their socket. `ban_player` additionally adds their name to `room.bannedIds` — subsequent `join_room` and `join_spectator` calls reject anyone matching that name.

**Undo:** Rather than a partial-undo delta, the server removes the last stroke group (everything from the last `type:'start'` forward) and broadcasts the full remaining `strokes[]` array. All clients replay from scratch — eliminates any desync risk.

---

## OOP Class Summary

### `Player`
Properties: `id`, `name`, `socketId`, `score`, `hasGuessedCorrectly`, `isReady`, `isSpectator`.  
Methods: `addScore(pts)`, `resetRound()`, `toJSON()`.

### `Game`
Properties: `settings` (incl. `wordMode`), `currentWord`, `strokes[]`, `playerOrder`, `revealedIndices`, `phase`.  
Methods: `start()`, `setWord()`, `checkGuess()`, `getHiddenWord()`, `getDrawerWord()`, `revealHint()`, `calculatePoints()`, `calculateDrawerPoints()`, `addStroke()`, `undoLastStroke()`, `clearStrokes()`, `advanceTurn()`.

### `Room`
Properties: `players` (Map), `game`, `hostId`, `bannedIds` (Set), `customWords[]`, `lastRoundStrokes[]`.  
Methods: `addPlayer()`, `removePlayer()`, `getActivePlayers()`, `getSpectators()`, `getLeaderboard()`, `broadcast()`, `broadcastExcept()`, `setCustomWords()`, `getSocketByPlayerId()`.

### `MessageHandler`
22 event handler methods. Owns the `rooms` Map and `io` instance. Orchestrates full game flow:  
`startRound()` → `startDrawing()` → `startTimer()` + `scheduleHints()` → `endRound()` → loop or `game_over`.

---

## REST API

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Server status + active room count |
| GET | `/api/rooms` | List open public rooms |
| GET | `/api/room/:id` | Get room info by ID |

---

## Extending

**Votekick:** Add a `votes` Map to `Room`. On `vote_kick`, store votes; when majority reached, call `onKickPlayer`.

**Database persistence:** Replace the in-memory `rooms` Map with PostgreSQL + Prisma. Persist word lists, scores, and room history.

**Custom avatars:** Add an `avatar` field to `Player` (emoji or URL). Send with `toJSON()`, render in scoreboard.

**Multiple languages:** Add locale files alongside `words.js`. Accept a `language` setting at room creation and pass the corresponding word list to `getRandomWords()`.
