class Player {
  constructor(id, name, socketId) {
    this.id = id;
    this.name = name;
    this.socketId = socketId;
    this.score = 0;
    this.hasGuessedCorrectly = false;
    this.isReady = false;
    this.isSpectator = false;
    this.joinedAt = Date.now();
  }

  addScore(points) { this.score += points; }

  resetRound() { this.hasGuessedCorrectly = false; }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      score: this.score,
      hasGuessedCorrectly: this.hasGuessedCorrectly,
      isReady: this.isReady,
      isSpectator: this.isSpectator,
    };
  }
}

module.exports = Player;
