class MessageHandler {
  constructor(io, rooms) {
    this.io = io;
    this.rooms = rooms;
  }

  handleConnection(socket) {
    console.log(`[+] Socket connected: ${socket.id}`);
    socket.on('create_room',    (d) => this.onCreateRoom(socket, d));
    socket.on('join_room',      (d) => this.onJoinRoom(socket, d));
    socket.on('join_spectator', (d) => this.onJoinSpectator(socket, d));
    socket.on('start_game',     ()  => this.onStartGame(socket));
    socket.on('word_chosen',    (d) => this.onWordChosen(socket, d));
    socket.on('draw_start',     (d) => this.onDrawStart(socket, d));
    socket.on('draw_move',      (d) => this.onDrawMove(socket, d));
    socket.on('draw_end',       ()  => this.onDrawEnd(socket));
    socket.on('canvas_clear',   ()  => this.onCanvasClear(socket));
    socket.on('draw_undo',      ()  => this.onDrawUndo(socket));
    socket.on('guess',          (d) => this.onGuess(socket, d));
    socket.on('chat',           (d) => this.onChat(socket, d));
    socket.on('request_canvas', ()  => this.onRequestCanvas(socket));
    socket.on('kick_player',    (d) => this.onKickPlayer(socket, d));
    socket.on('ban_player',     (d) => this.onBanPlayer(socket, d));
    socket.on('set_custom_words',(d) => this.onSetCustomWords(socket, d));
    socket.on('request_replay', ()  => this.onRequestReplay(socket));
    socket.on('get_public_rooms',()  => this.onGetPublicRooms(socket));
    socket.on('game_state',     ()  => this.onGameState(socket));
    socket.on('disconnect',     ()  => this.onDisconnect(socket));
  }

  // ─── Room lifecycle ───────────────────────────────────────────────────────

  onCreateRoom(socket, data) {
    const { playerName, settings, isPrivate } = data;
    if (!playerName?.trim()) return socket.emit('error', { message: 'Name required' });

    const Room = require('./Room');
    const room = new Room(playerName, settings || {}, isPrivate || false);
    room.setIO(this.io);
    this.rooms.set(room.id, room);

    const player = room.addPlayer(socket.id, playerName.trim(), false);
    socket.join(room.id);
    socket.roomId = room.id;

    socket.emit('room_created', {
      roomId: room.id,
      player: player.toJSON(),
      players: room.getPlayerList(),
      settings: room.game.settings,
      isHost: true,
    });
    console.log(`[Room] Created: ${room.id} by ${playerName}`);
  }

  onJoinRoom(socket, data) {
    const { roomId, playerName } = data;
    if (!playerName?.trim()) return socket.emit('error', { message: 'Name required' });

    const room = this.rooms.get(roomId?.toUpperCase());
    if (!room) return socket.emit('error', { message: 'Room not found' });
    if (room.bannedIds.has(playerName.trim())) return socket.emit('error', { message: 'You have been banned from this room' });
    if (room.isFull()) return socket.emit('error', { message: 'Room is full' });

    this._addAndSendState(socket, room, playerName.trim(), false);
  }

  onJoinSpectator(socket, data) {
    const { roomId, playerName } = data;
    if (!playerName?.trim()) return socket.emit('error', { message: 'Name required' });

    const room = this.rooms.get(roomId?.toUpperCase());
    if (!room) return socket.emit('error', { message: 'Room not found' });
    if (room.bannedIds.has(playerName.trim())) return socket.emit('error', { message: 'You have been banned from this room' });

    this._addAndSendState(socket, room, playerName.trim(), true);
  }

  _addAndSendState(socket, room, playerName, asSpectator) {
    const player = room.addPlayer(socket.id, playerName, asSpectator);
    socket.join(room.id);
    socket.roomId = room.id;

    socket.emit('room_joined', {
      roomId: room.id,
      player: player.toJSON(),
      players: room.getPlayerList(),
      settings: room.game.settings,
      isHost: room.isHost(socket.id),
      customWords: room.customWords,
      gameState: {
        phase: room.game.phase,
        round: room.game.currentRound,
        totalRounds: room.game.settings.rounds,
        drawerId: room.game.getCurrentDrawerId(),
        hiddenWord: room.game.getHiddenWord(),
        timeLeft: room.game.timeLeft,
        strokes: room.game.strokes,
      },
    });

    room.broadcastExcept(socket.id, 'player_joined', {
      player: player.toJSON(),
      players: room.getPlayerList(),
    });
    console.log(`[Room] ${playerName}${asSpectator ? ' (spectator)' : ''} joined: ${room.id}`);
  }

  // Named game_state event (spec compliance) — sends current state to requester
  onGameState(socket) {
    const room = this.rooms.get(socket.roomId);
    if (!room) return;
    socket.emit('game_state', {
      phase: room.game.phase,
      round: room.game.currentRound,
      totalRounds: room.game.settings.rounds,
      drawerId: room.game.getCurrentDrawerId(),
      hiddenWord: room.game.getHiddenWord(),
      timeLeft: room.game.timeLeft,
      players: room.getPlayerList(),
    });
  }

  // ─── Game flow ────────────────────────────────────────────────────────────

  onStartGame(socket) {
    const room = this.rooms.get(socket.roomId);
    if (!room) return;
    if (!room.isHost(socket.id)) return socket.emit('error', { message: 'Only host can start' });

    const activePlayers = room.getActivePlayers();
    if (activePlayers.length < 2) return socket.emit('error', { message: 'Need at least 2 non-spectator players' });

    activePlayers.forEach(p => { p.score = 0; });
    room.game.start(activePlayers);

    room.broadcast('game_started', {
      players: room.getPlayerList(),
      round: room.game.currentRound,
      totalRounds: room.game.settings.rounds,
    });

    this.startRound(room);
  }

  startRound(room) {
    const drawerId = room.game.getCurrentDrawerId();
    const drawerSocket = room.getCurrentDrawerSocket();
    const wordOptions = room.game.getWordOptions(room.customWords);

    room.correctGuessCount = 0;
    room.players.forEach(p => p.resetRound());

    room.broadcast('round_start', {
      round: room.game.currentRound,
      totalRounds: room.game.settings.rounds,
      drawerId,
      drawTime: room.game.settings.drawTime,
      wordMode: room.game.settings.wordMode,
    });

    if (drawerSocket) {
      this.io.to(drawerSocket).emit('word_options', { words: wordOptions });
    }

    // Auto-choose after 15s if drawer doesn't pick
    room.chooseTimer = setTimeout(() => {
      if (room.game.phase === 'choosing') {
        const autoWord = wordOptions[Math.floor(Math.random() * wordOptions.length)];
        this.startDrawing(room, autoWord);
      }
    }, 15000);
  }

  onWordChosen(socket, data) {
    const room = this.rooms.get(socket.roomId);
    if (!room) return;
    const player = room.getPlayer(socket.id);
    if (!player || player.id !== room.game.getCurrentDrawerId()) return;
    if (room.chooseTimer) clearTimeout(room.chooseTimer);
    this.startDrawing(room, data.word);
  }

  startDrawing(room, word) {
    room.game.setWord(word);
    const drawerId = room.game.getCurrentDrawerId();

    // Everyone sees blanks
    room.broadcast('drawing_started', {
      drawerId,
      hiddenWord: room.game.getHiddenWord(),
      drawTime: room.game.settings.drawTime,
      wordMode: room.game.settings.wordMode,
    });

    // Drawer sees word according to wordMode
    const drawerSocket = room.getCurrentDrawerSocket();
    if (drawerSocket) {
      this.io.to(drawerSocket).emit('your_word', {
        word: room.game.getDrawerWord(),
        actualWord: room.game.currentWord,
        wordMode: room.game.settings.wordMode,
      });
    }

    room.game.timeLeft = room.game.settings.drawTime;
    this.startTimer(room);
    this.scheduleHints(room);
  }

  startTimer(room) {
    if (room.roundTimer) clearInterval(room.roundTimer);
    room.roundTimer = setInterval(() => {
      room.game.timeLeft--;
      room.broadcast('timer_tick', { timeLeft: room.game.timeLeft });
      if (room.game.timeLeft <= 0) {
        clearInterval(room.roundTimer);
        if (room.hintTimer) clearInterval(room.hintTimer);
        this.endRound(room);
      }
    }, 1000);
  }

  scheduleHints(room) {
    if (room.hintTimer) clearInterval(room.hintTimer);
    const { hints, drawTime } = room.game.settings;
    if (hints <= 0) return;
    const hintInterval = Math.floor(drawTime / (hints + 1)) * 1000;
    let hintsGiven = 0;
    room.hintTimer = setInterval(() => {
      if (hintsGiven >= hints || room.game.phase !== 'drawing') {
        clearInterval(room.hintTimer);
        return;
      }
      room.game.revealHint();
      hintsGiven++;
      room.broadcast('hint_revealed', { hiddenWord: room.game.getHiddenWord() });
    }, hintInterval);
  }

  // ─── Drawing ─────────────────────────────────────────────────────────────

  onDrawStart(socket, data) {
    const room = this.rooms.get(socket.roomId);
    if (!room || room.game.phase !== 'drawing') return;
    const player = room.getPlayer(socket.id);
    if (!player || player.id !== room.game.getCurrentDrawerId()) return;
    const stroke = { type: 'start', ...data };
    room.game.addStroke(stroke);
    socket.to(room.id).emit('draw_data', stroke);
  }

  onDrawMove(socket, data) {
    const room = this.rooms.get(socket.roomId);
    if (!room || room.game.phase !== 'drawing') return;
    const player = room.getPlayer(socket.id);
    if (!player || player.id !== room.game.getCurrentDrawerId()) return;
    const stroke = { type: 'move', ...data };
    room.game.addStroke(stroke);
    socket.to(room.id).emit('draw_data', stroke);
  }

  onDrawEnd(socket) {
    const room = this.rooms.get(socket.roomId);
    if (!room || room.game.phase !== 'drawing') return;
    const player = room.getPlayer(socket.id);
    if (!player || player.id !== room.game.getCurrentDrawerId()) return;
    const stroke = { type: 'end' };
    room.game.addStroke(stroke);
    socket.to(room.id).emit('draw_data', stroke);
  }

  onCanvasClear(socket) {
    const room = this.rooms.get(socket.roomId);
    if (!room) return;
    const player = room.getPlayer(socket.id);
    if (!player || player.id !== room.game.getCurrentDrawerId()) return;
    room.game.clearStrokes();
    room.broadcast('canvas_cleared', {});
  }

  onDrawUndo(socket) {
    const room = this.rooms.get(socket.roomId);
    if (!room) return;
    const player = room.getPlayer(socket.id);
    if (!player || player.id !== room.game.getCurrentDrawerId()) return;
    const strokes = room.game.undoLastStroke();
    room.broadcast('canvas_undo', { strokes });
  }

  // ─── Chat & Guessing ─────────────────────────────────────────────────────

  onGuess(socket, data) {
    const room = this.rooms.get(socket.roomId);
    if (!room || room.game.phase !== 'drawing') return;
    const player = room.getPlayer(socket.id);
    if (!player || player.isSpectator) return;
    if (player.id === room.game.getCurrentDrawerId()) return;
    if (player.hasGuessedCorrectly) return;

    const guess = data.text?.trim();
    if (!guess) return;

    if (room.game.checkGuess(guess)) {
      player.hasGuessedCorrectly = true;
      room.correctGuessCount++;

      const points = room.game.calculatePoints(
        room.game.timeLeft,
        room.game.settings.drawTime,
        room.correctGuessCount - 1
      );
      player.addScore(points);

      room.broadcast('guess_result', {
        correct: true,
        playerId: player.id,
        playerName: player.name,
        points,
        players: room.getPlayerList(),
      });

      // Drawer earns points proportional to how many guessed
      const activePlayers = room.getActivePlayers();
      const nonDrawers = activePlayers.filter(p => p.id !== room.game.getCurrentDrawerId());
      const drawerPlayer = room.getPlayerById(room.game.getCurrentDrawerId());
      if (drawerPlayer) {
        drawerPlayer.addScore(room.game.calculateDrawerPoints(room.correctGuessCount, nonDrawers.length));
      }

      const allGuessed = nonDrawers.every(p => p.hasGuessedCorrectly);
      if (allGuessed) {
        if (room.roundTimer) clearInterval(room.roundTimer);
        if (room.hintTimer) clearInterval(room.hintTimer);
        this.endRound(room);
      }
    } else {
      room.broadcast('guess_result', {
        correct: false,
        playerId: player.id,
        playerName: player.name,
        text: guess,
      });
    }
  }

  onChat(socket, data) {
    const room = this.rooms.get(socket.roomId);
    if (!room) return;
    const player = room.getPlayer(socket.id);
    if (!player) return;
    if (room.game.phase === 'drawing' && player.id === room.game.getCurrentDrawerId()) return;

    room.broadcast('chat_message', {
      playerId: player.id,
      playerName: player.name,
      isSpectator: player.isSpectator,
      text: data.text?.trim()?.substring(0, 200),
    });
  }

  onRequestCanvas(socket) {
    const room = this.rooms.get(socket.roomId);
    if (!room) return;
    socket.emit('canvas_state', { strokes: room.game.strokes });
  }

  // ─── Replay ──────────────────────────────────────────────────────────────

  onRequestReplay(socket) {
    const room = this.rooms.get(socket.roomId);
    if (!room) return;
    // Only allowed when a round just ended
    if (room.game.phase !== 'roundEnd') return;
    socket.emit('replay_strokes', { strokes: room.lastRoundStrokes || [] });
  }

  // ─── Moderation ──────────────────────────────────────────────────────────

  onKickPlayer(socket, data) {
    const room = this.rooms.get(socket.roomId);
    if (!room || !room.isHost(socket.id)) return socket.emit('error', { message: 'Only host can kick' });

    const { playerId } = data;
    const targetSocket = room.getSocketByPlayerId(playerId);
    const targetPlayer = room.getPlayerById(playerId);
    if (!targetSocket || !targetPlayer) return;
    if (targetPlayer.id === room.hostId) return; // can't kick yourself

    // Notify the kicked player
    this.io.to(targetSocket).emit('kicked', { reason: 'You were kicked by the host' });

    // Remove them
    const wasDrawer = targetPlayer.id === room.game.getCurrentDrawerId();
    room.removePlayer(targetSocket);
    this.io.sockets.sockets.get(targetSocket)?.leave(room.id);

    room.broadcast('player_left', {
      playerId: targetPlayer.id,
      playerName: targetPlayer.name,
      players: room.getPlayerList(),
      newHostId: room.hostId,
      reason: 'kicked',
    });

    room.broadcast('chat_message', {
      playerName: 'System',
      text: `${targetPlayer.name} was kicked by the host.`,
      isSystem: true,
    });

    if (wasDrawer && room.game.phase === 'drawing') {
      if (room.roundTimer) clearInterval(room.roundTimer);
      if (room.hintTimer) clearInterval(room.hintTimer);
      this.endRound(room);
    }
  }

  onBanPlayer(socket, data) {
    const room = this.rooms.get(socket.roomId);
    if (!room || !room.isHost(socket.id)) return socket.emit('error', { message: 'Only host can ban' });

    const { playerId } = data;
    const targetPlayer = room.getPlayerById(playerId);
    if (!targetPlayer || targetPlayer.id === room.hostId) return;

    // Add name to ban list (simple name-based ban for now)
    room.bannedIds.add(targetPlayer.name);

    this.io.to(room.getSocketByPlayerId(playerId)).emit('kicked', { reason: 'You were banned from this room' });

    const wasDrawer = targetPlayer.id === room.game.getCurrentDrawerId();
    const targetSocket = room.getSocketByPlayerId(playerId);
    room.removePlayer(targetSocket);
    this.io.sockets.sockets.get(targetSocket)?.leave(room.id);

    room.broadcast('player_left', {
      playerId: targetPlayer.id,
      playerName: targetPlayer.name,
      players: room.getPlayerList(),
      newHostId: room.hostId,
      reason: 'banned',
    });

    room.broadcast('chat_message', {
      playerName: 'System',
      text: `${targetPlayer.name} was banned by the host.`,
      isSystem: true,
    });

    if (wasDrawer && room.game.phase === 'drawing') {
      if (room.roundTimer) clearInterval(room.roundTimer);
      if (room.hintTimer) clearInterval(room.hintTimer);
      this.endRound(room);
    }
  }

  // ─── Custom words ─────────────────────────────────────────────────────────

  onSetCustomWords(socket, data) {
    const room = this.rooms.get(socket.roomId);
    if (!room || !room.isHost(socket.id)) return socket.emit('error', { message: 'Only host can set custom words' });
    if (room.game.phase !== 'lobby') return socket.emit('error', { message: 'Cannot change words after game starts' });

    const words = Array.isArray(data.words) ? data.words : [];
    room.setCustomWords(words);

    socket.emit('custom_words_set', { words: room.customWords, count: room.customWords.length });
    room.broadcastExcept(socket.id, 'chat_message', {
      playerName: 'System',
      text: `Host set ${room.customWords.length} custom word${room.customWords.length !== 1 ? 's' : ''}.`,
      isSystem: true,
    });
  }

  // ─── Round / game end ─────────────────────────────────────────────────────

  endRound(room) {
    if (room.game.phase === 'roundEnd' || room.game.phase === 'gameOver') return;
    room.game.phase = 'roundEnd';

    // Save strokes for replay
    room.lastRoundStrokes = [...room.game.strokes];

    const word = room.game.currentWord;
    const leaderboard = room.getLeaderboard();

    room.broadcast('round_end', {
      word,
      leaderboard,
      players: room.getPlayerList(),
    });

    setTimeout(() => {
      const playerCount = room.game.playerOrder.length;
      if (playerCount === 0) return;

      room.game.advanceTurn(playerCount);

      if (room.game.isGameOver()) {
        const winner = leaderboard[0];
        room.broadcast('game_over', { winner, leaderboard });
      } else {
        room.game.strokes = [];
        room.broadcast('canvas_cleared', {});
        this.startRound(room);
      }
    }, 5000);
  }

  // ─── Disconnect ───────────────────────────────────────────────────────────

  onDisconnect(socket) {
    const room = this.rooms.get(socket.roomId);
    if (!room) return;

    const wasDrawer = room.getPlayer(socket.id)?.id === room.game.getCurrentDrawerId();
    const player = room.removePlayer(socket.id);
    if (!player) return;
    console.log(`[-] ${player.name} left room ${room.id}`);

    if (room.isEmpty()) {
      this.rooms.delete(room.id);
      return;
    }

    room.broadcast('player_left', {
      playerId: player.id,
      playerName: player.name,
      players: room.getPlayerList(),
      newHostId: room.hostId,
    });

    if (wasDrawer && room.game.phase === 'drawing') {
      if (room.roundTimer) clearInterval(room.roundTimer);
      if (room.hintTimer) clearInterval(room.hintTimer);
      this.endRound(room);
    }
  }

  // ─── Public rooms ─────────────────────────────────────────────────────────

  onGetPublicRooms(socket) {
    const publicRooms = Array.from(this.rooms.values())
      .filter(r => !r.isPrivate && r.game.phase === 'lobby' && !r.isFull())
      .map(r => r.toPublicInfo());
    socket.emit('public_rooms', { rooms: publicRooms });
  }
}

module.exports = MessageHandler;
