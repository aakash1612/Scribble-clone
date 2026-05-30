const { getRandomWords } = require('./words');

// Word modes:
//  normal      – drawer sees word, guessers see blanks
//  hidden      – drawer does NOT see word, guessers see blanks (extra hard)
//  combination – drawer sees first + last letter only
class Game {
  constructor(settings) {
    this.settings = {
      maxPlayers: settings.maxPlayers || 8,
      rounds: settings.rounds || 3,
      drawTime: settings.drawTime || 80,
      wordCount: settings.wordCount || 3,
      hints: settings.hints || 2,
      wordMode: settings.wordMode || 'normal', // normal | hidden | combination
    };
    this.currentRound = 0;
    this.currentDrawerIndex = 0;
    this.currentWord = null;
    this.wordOptions = [];
    this.phase = 'lobby'; // lobby, choosing, drawing, roundEnd, gameOver
    this.timeLeft = 0;
    this.revealedIndices = new Set();
    this.strokes = [];
    this.playerOrder = [];
    this.roundScores = {};
  }

  start(players) {
    this.playerOrder = players.map(p => p.id);
    this.currentRound = 1;
    this.currentDrawerIndex = 0;
    this.phase = 'choosing';
    this.strokes = [];
  }

  getCurrentDrawerId() {
    return this.playerOrder[this.currentDrawerIndex];
  }

  getWordOptions(customWords = []) {
    const pool = customWords.length > 0 ? customWords : null;
    this.wordOptions = getRandomWords(this.settings.wordCount, pool);
    return this.wordOptions;
  }

  setWord(word) {
    this.currentWord = word.toLowerCase().trim();
    this.revealedIndices = new Set();
    this.phase = 'drawing';
    this.timeLeft = this.settings.drawTime;
    this.strokes = [];
    this.roundScores = {};
  }

  checkGuess(guess) {
    if (!this.currentWord) return false;
    return guess.toLowerCase().trim() === this.currentWord;
  }

  // What guessers see: underscores + revealed hints
  getHiddenWord() {
    if (!this.currentWord) return '';
    return this.currentWord
      .split('')
      .map((char, i) => {
        if (char === ' ') return ' ';
        if (this.revealedIndices.has(i)) return char;
        return '_';
      })
      .join('');
  }

  // What the drawer sees based on wordMode
  getDrawerWord() {
    if (!this.currentWord) return '';
    switch (this.settings.wordMode) {
      case 'hidden':
        // Drawer sees nothing – just blank dashes
        return this.currentWord.split('').map(c => c === ' ' ? ' ' : '_').join('');
      case 'combination':
        // Drawer sees first and last letter of each word-segment
        return this.currentWord.split(' ').map(segment => {
          if (segment.length <= 2) return segment;
          return segment[0] + '_'.repeat(segment.length - 2) + segment[segment.length - 1];
        }).join(' ');
      default:
        return this.currentWord;
    }
  }

  revealHint() {
    if (!this.currentWord) return;
    const unrevealedIndices = [];
    this.currentWord.split('').forEach((char, i) => {
      if (char !== ' ' && !this.revealedIndices.has(i)) {
        unrevealedIndices.push(i);
      }
    });
    if (unrevealedIndices.length > 0) {
      const randomIndex = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
      this.revealedIndices.add(randomIndex);
    }
  }

  calculatePoints(timeLeft, totalTime, guesserCount) {
    const timeBonus = Math.floor((timeLeft / totalTime) * 400);
    const base = 200;
    return Math.max(50, base + timeBonus - guesserCount * 20);
  }

  calculateDrawerPoints(correctGuesses, totalGuessers) {
    if (correctGuesses === 0) return 0;
    return Math.floor((correctGuesses / Math.max(totalGuessers, 1)) * 100);
  }

  addStroke(stroke) { this.strokes.push(stroke); }

  undoLastStroke() {
    // Find and remove the last complete stroke group (start…end)
    let i = this.strokes.length - 1;
    while (i >= 0 && this.strokes[i].type !== 'start') i--;
    if (i >= 0) this.strokes.splice(i);
    return this.strokes;
  }

  clearStrokes() { this.strokes = []; }

  advanceTurn(playerCount) {
    this.currentDrawerIndex = (this.currentDrawerIndex + 1) % playerCount;
    if (this.currentDrawerIndex === 0) this.currentRound++;
    this.currentWord = null;
    this.strokes = [];
    this.phase = this.currentRound > this.settings.rounds ? 'gameOver' : 'choosing';
  }

  isGameOver() { return this.phase === 'gameOver'; }
}

module.exports = Game;
