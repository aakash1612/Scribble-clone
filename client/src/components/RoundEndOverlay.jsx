export default function RoundEndOverlay({ word, leaderboard, nextRound, totalRounds, lastStrokes, onReplay }) {
  return (
    <div className="round-end-overlay">
      <div className="round-end-modal">
        <h2>Round Over!</h2>

        <div className="word-reveal">
          <span className="reveal-label">The word was</span>
          <span className="revealed-word">"{word}"</span>
        </div>

        <div className="round-leaderboard">
          {leaderboard.slice(0, 5).map((p, i) => (
            <div key={p.id} className={`lb-row rank-${i + 1}`}>
              <span className="lb-rank">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </span>
              <span className="lb-name">{p.name}</span>
              <span className="lb-score">{p.score} pts</span>
            </div>
          ))}
        </div>

        <div className="round-end-actions">
          {lastStrokes && lastStrokes.length > 0 && (
            <button className="replay-btn" onClick={onReplay}>
              ▶️ Replay Drawing
            </button>
          )}
        </div>

        {nextRound <= totalRounds
          ? <p className="next-round-msg">⏳ Round {nextRound} starting soon...</p>
          : <p className="game-ending-msg">🎉 Game ending...</p>
        }
      </div>
    </div>
  );
}
