export default function GameOverPage({ winner, leaderboard, onPlayAgain }) {
  return (
    <div className="game-over-page">
      <div className="confetti-bg" />

      <div className="game-over-content">
        <div className="winner-section">
          <div className="trophy-icon">🏆</div>
          <h1 className="winner-title">Game Over!</h1>
          <div className="winner-name">
            <span className="winner-label">Winner</span>
            <span className="winner-player">{winner?.name}</span>
            <span className="winner-score">{winner?.score} points</span>
          </div>
        </div>

        <div className="final-leaderboard">
          <h2>Final Standings</h2>
          {leaderboard.map((player, i) => (
            <div key={player.id} className={`final-lb-row ${i === 0 ? 'winner-row' : ''}`}>
              <span className="final-rank">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </span>
              <span className="final-name">{player.name}</span>
              <span className="final-score">{player.score} pts</span>
            </div>
          ))}
        </div>

        <div className="game-over-actions">
          <button className="play-again-btn" onClick={onPlayAgain}>
            🎮 Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
