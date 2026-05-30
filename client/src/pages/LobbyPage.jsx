import { useState } from 'react';

const avatarColors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF', '#FF9F43', '#00D2D3', '#FF6B9D'];

const WORD_MODE_LABELS = { normal: '📝 Normal', hidden: '🙈 Hidden', combination: '🔀 Combination' };

export default function LobbyPage({ roomId, players, myPlayer, isHost, settings, customWords, onStartGame, onSetCustomWords }) {
  const [customWordInput, setCustomWordInput] = useState(customWords.join(', '));
  const [showCustomWords, setShowCustomWords] = useState(false);

  const shareUrl = `${window.location.origin}?room=${roomId}`;
  const copyLink = () => navigator.clipboard.writeText(shareUrl).then(() => alert('Link copied!'));
  const copyCode = () => navigator.clipboard.writeText(roomId).then(() => alert('Code copied!'));

  const handleSaveCustomWords = () => {
    const words = customWordInput.split(',').map(w => w.trim()).filter(Boolean);
    onSetCustomWords(words);
    alert(`${words.length} custom word${words.length !== 1 ? 's' : ''} saved!`);
  };

  const activePlayers = players.filter(p => !p.isSpectator);
  const spectators = players.filter(p => p.isSpectator);

  return (
    <div className="lobby-page">
      <div className="lobby-header">
        <h1 className="lobby-title">🎨 Game Lobby</h1>
        <div className="room-code-display">
          <span className="label">Room Code</span>
          <span className="code">{roomId}</span>
          <button className="copy-btn" onClick={copyCode} title="Copy code">📋</button>
          <button className="copy-btn" onClick={copyLink} title="Copy invite link">🔗</button>
        </div>
      </div>

      <div className="lobby-body">
        <div className="lobby-left">
          <div className="players-section">
            <h2>Players ({activePlayers.length}/{settings.maxPlayers})</h2>
            <div className="players-grid">
              {activePlayers.map((player, i) => (
                <div key={player.id} className={`player-card ${player.id === myPlayer?.id ? 'me' : ''}`}>
                  <div className="avatar" style={{ background: avatarColors[i % avatarColors.length] }}>
                    {player.name[0].toUpperCase()}
                  </div>
                  <div className="player-name">
                    {player.name}
                    {player.id === myPlayer?.id && <span className="you-badge">You</span>}
                  </div>
                </div>
              ))}
              {Array.from({ length: Math.max(0, settings.maxPlayers - activePlayers.length) }).slice(0, 4).map((_, i) => (
                <div key={`empty-${i}`} className="player-card empty">
                  <div className="avatar empty-avatar">?</div>
                  <div className="player-name">Waiting...</div>
                </div>
              ))}
            </div>

            {spectators.length > 0 && (
              <div className="spectator-list">
                <h3>👁️ Spectators ({spectators.length})</h3>
                <div className="spectator-names">
                  {spectators.map(p => <span key={p.id} className="spectator-chip">{p.name}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lobby-right">
          <div className="settings-display">
            <h2>Game Settings</h2>
            <div className="settings-list">
              {[
                ['👥', 'Max Players', settings.maxPlayers],
                ['🔄', 'Rounds', settings.rounds],
                ['⏱️', 'Draw Time', `${settings.drawTime}s`],
                ['📝', 'Word Choices', settings.wordCount],
                ['💡', 'Hints', settings.hints === 0 ? 'None' : settings.hints],
                ['🎯', 'Word Mode', WORD_MODE_LABELS[settings.wordMode] || settings.wordMode],
              ].map(([icon, label, value]) => (
                <div className="setting-row" key={label}>
                  <span className="setting-icon">{icon}</span>
                  <span className="setting-label">{label}</span>
                  <span className="setting-value">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Custom word list — host only */}
          {isHost && (
            <div className="custom-words-section">
              <button className="toggle-custom-btn" onClick={() => setShowCustomWords(s => !s)}>
                {showCustomWords ? '▲' : '▼'} Custom Word List {customWords.length > 0 ? `(${customWords.length} words)` : '(optional)'}
              </button>
              {showCustomWords && (
                <div className="custom-words-editor">
                  <p className="custom-words-hint">Enter words separated by commas. Leave empty to use the built-in word list.</p>
                  <textarea
                    className="custom-words-input"
                    rows={4}
                    placeholder="cat, astronaut, volcano, sandwich..."
                    value={customWordInput}
                    onChange={e => setCustomWordInput(e.target.value)}
                  />
                  <button className="save-words-btn" onClick={handleSaveCustomWords}>💾 Save Words</button>
                </div>
              )}
            </div>
          )}
          {!isHost && customWords.length > 0 && (
            <div className="custom-words-notice">
              📝 Host is using {customWords.length} custom word{customWords.length !== 1 ? 's' : ''}
            </div>
          )}

          <div className="lobby-actions">
            {isHost ? (
              <>
                <p className="host-note">You are the host</p>
                {activePlayers.length < 2
                  ? <p className="waiting-note">⏳ Need at least 2 players to start...</p>
                  : <button className="start-btn" onClick={onStartGame}>🚀 Start Game!</button>
                }
              </>
            ) : (
              <div className="waiting-host">
                <div className="pulse-dot" />
                <p>Waiting for host to start...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
