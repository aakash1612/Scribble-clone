const { v4: uuidv4 } = require('uuid');
const Game = require('./Game');
const Player = require('./Player');

class Room {
  constructor(hostName, settings = {}, isPrivate = false) {
    this.id = uuidv4().substring(0, 8).toUpperCase();
    this.players = new Map(); // socketId -> Player
    this.hostId = null;
    this.game = new Game(settings);
    this.isPrivate = isPrivate;
    this.createdAt = Date.now();
    this.roundTimer = null;
    this.hintTimer = null;
    this.chooseTimer = null;
    this.correctGuessCount = 0;
    this.customWords = []; // host-provided custom word list
    this.bannedIds = new Set(); // player IDs that have been banned
    this.io = null;
  }

  setIO(io) { this.io = io; }

  addPlayer(socketId, playerName, asSpectator = false) {
    const player = new Player(uuidv4(), playerName, socketId);
    player.isSpectator = asSpectator;
    if (this.players.size === 0) this.hostId = player.id;
    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player) return null;
    this.players.delete(socketId);

    // Transfer host if needed
    if (player.id === this.hostId && this.players.size > 0) {
      const newHost = this.players.values().next().value;
      this.hostId = newHost.id;
    }

    // Remove from turn order
    const idx = this.game.playerOrder.indexOf(player.id);
    if (idx !== -1) {
      this.game.playerOrder.splice(idx, 1);
      if (this.game.currentDrawerIndex >= this.game.playerOrder.length && this.game.playerOrder.length > 0) {
        this.game.currentDrawerIndex = 0;
      }
    }
    return player;
  }

  getPlayer(socketId) { return this.players.get(socketId); }

  getPlayerById(playerId) {
    for (const player of this.players.values()) {
      if (player.id === playerId) return player;
    }
    return null;
  }

  getSocketByPlayerId(playerId) {
    for (const [socketId, player] of this.players) {
      if (player.id === playerId) return socketId;
    }
    return null;
  }

  getActivePlayers() {
    return Array.from(this.players.values()).filter(p => !p.isSpectator);
  }

  getSpectators() {
    return Array.from(this.players.values()).filter(p => p.isSpectator);
  }

  getPlayerList() {
    return Array.from(this.players.values()).map(p => p.toJSON());
  }

  getPlayerCount() { return this.players.size; }

  isEmpty() { return this.players.size === 0; }

  isHost(socketId) {
    const player = this.players.get(socketId);
    return player && player.id === this.hostId;
  }

  getCurrentDrawerSocket() {
    const drawerId = this.game.getCurrentDrawerId();
    for (const [socketId, player] of this.players) {
      if (player.id === drawerId) return socketId;
    }
    return null;
  }

  broadcast(event, data) {
    if (this.io) this.io.to(this.id).emit(event, data);
  }

  broadcastExcept(excludeSocketId, event, data) {
    if (this.io) this.io.to(this.id).except(excludeSocketId).emit(event, data);
  }

  getLeaderboard() {
    return Array.from(this.players.values())
      .filter(p => !p.isSpectator)
      .map(p => ({ id: p.id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);
  }

  isFull() {
    return this.players.size >= this.game.settings.maxPlayers;
  }

  setCustomWords(words) {
    this.customWords = words
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0 && w.length <= 50)
      .slice(0, 200); // cap at 200 custom words
  }

  toPublicInfo() {
    return {
      id: this.id,
      playerCount: this.players.size,
      maxPlayers: this.game.settings.maxPlayers,
      phase: this.game.phase,
      round: this.game.currentRound,
      totalRounds: this.game.settings.rounds,
    };
  }
}

module.exports = Room;
