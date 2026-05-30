const avatarColors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF', '#FF9F43', '#00D2D3', '#FF6B9D'];

export default function Scoreboard({ players, drawerId, myPlayerId, isHost, onKick, onBan }) {
  const active = players.filter(p => !p.isSpectator).sort((a, b) => b.score - a.score);
  const spectators = players.filter(p => p.isSpectator);

  return (
    <div className="scoreboard">
      <div className="scoreboard-header">🏆 Players</div>
      <div className="scoreboard-list">
        {active.map((player, i) => (
          <div key={player.id} className={`score-row
            ${player.id === myPlayerId ? 'me' : ''}
            ${player.id === drawerId ? 'drawing' : ''}
            ${player.hasGuessedCorrectly ? 'guessed' : ''}
          `}>
            <div className="score-rank">#{i + 1}</div>
            <div className="score-avatar" style={{ background: avatarColors[i % avatarColors.length] }}>
              {player.name[0].toUpperCase()}
            </div>
            <div className="score-name">
              <span className="score-name-text">{player.name}</span>
              {player.id === myPlayerId && <span className="you-tag">you</span>}
              {player.id === drawerId && <span className="drawing-tag">✏️</span>}
              {player.hasGuessedCorrectly && <span className="guessed-tag">✅</span>}
            </div>
            <div className="score-right">
              <div className="score-points">{player.score}</div>
              {isHost && player.id !== myPlayerId && (
                <div className="mod-buttons">
                  <button className="mod-btn kick-btn" onClick={() => onKick(player.id)} title="Kick">⚡</button>
                  <button className="mod-btn ban-btn"  onClick={() => onBan(player.id)}  title="Ban">🚫</button>
                </div>
              )}
            </div>
          </div>
        ))}

        {spectators.length > 0 && (
          <>
            <div className="spectator-divider">👁️ Spectators</div>
            {spectators.map(player => (
              <div key={player.id} className="score-row spectator-row">
                <div className="score-rank">👁️</div>
                <div className="score-avatar" style={{ background: '#555' }}>
                  {player.name[0].toUpperCase()}
                </div>
                <div className="score-name">
                  <span className="score-name-text">{player.name}</span>
                  {player.id === myPlayerId && <span className="you-tag">you</span>}
                </div>
                <div className="score-right">
                  {isHost && player.id !== myPlayerId && (
                    <div className="mod-buttons">
                      <button className="mod-btn kick-btn" onClick={() => onKick(player.id)} title="Kick">⚡</button>
                      <button className="mod-btn ban-btn"  onClick={() => onBan(player.id)}  title="Ban">🚫</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
