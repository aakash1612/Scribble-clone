import { useState } from 'react';

const COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF'];

export default function HomePage({ onCreateRoom, onJoinRoom, onJoinSpectator, publicRooms, onRefreshRooms }) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [tab, setTab] = useState('play');
  const [settings, setSettings] = useState({
    maxPlayers: 8, rounds: 3, drawTime: 80,
    wordCount: 3, hints: 2, wordMode: 'normal',
  });
  const [isPrivate, setIsPrivate] = useState(false);
  const [joinAsSpectator, setJoinAsSpectator] = useState(false);

  const requireName = () => { if (!name.trim()) { alert('Enter your name!'); return false; } return true; };

  const handleCreate = () => { if (!requireName()) return; onCreateRoom(name.trim(), settings, isPrivate); };

  const handleJoin = () => {
    if (!requireName()) return;
    if (!roomCode.trim()) return alert('Enter a room code!');
    const fn = joinAsSpectator ? onJoinSpectator : onJoinRoom;
    fn(roomCode.trim().toUpperCase(), name.trim());
  };

  const handleJoinPublic = (roomId) => {
    if (!requireName()) return;
    const fn = joinAsSpectator ? onJoinSpectator : onJoinRoom;
    fn(roomId, name.trim());
  };

  const WORD_MODE_INFO = {
    normal: 'Drawer sees the full word',
    hidden: 'Drawer does NOT see the word — extra hard!',
    combination: 'Drawer sees first & last letter only',
  };

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="logo">
          <span className="logo-text">skribble</span>
          <div className="logo-dots">
            {COLORS.map((c, i) => (
              <span key={i} className="logo-dot" style={{ background: c, animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
        <p className="tagline">Draw. Guess. Laugh. Repeat.</p>
      </header>

      <main className="home-main">
        <div className="name-input-group">
          <label>Your Name</label>
          <input
            className="name-input"
            placeholder="Enter your name..."
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={20}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
        </div>

        <div className="tab-bar">
          {['play', 'join', 'browse'].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`}
              onClick={() => { setTab(t); if (t === 'browse') onRefreshRooms(); }}>
              {t === 'play' ? '🎮 Create Room' : t === 'join' ? '🔑 Join Room' : '🌍 Browse Rooms'}
            </button>
          ))}
        </div>

        {tab === 'play' && (
          <div className="tab-content">
            <div className="settings-grid">
              {[
                { label: 'Max Players', key: 'maxPlayers', options: [2,4,6,8,10,12,16,20] },
                { label: 'Rounds',      key: 'rounds',     options: [2,3,4,5,6,8,10] },
                { label: 'Draw Time (s)',key:'drawTime',    options: [30,45,60,80,100,120,150,180,240] },
                { label: 'Word Choices', key: 'wordCount',  options: [1,2,3,4,5] },
                { label: 'Hints',        key: 'hints',      options: [0,1,2,3,4,5] },
              ].map(({ label, key, options }) => (
                <div key={key} className="setting-item">
                  <label>{label}</label>
                  <select value={settings[key]} onChange={e => setSettings(s => ({ ...s, [key]: +e.target.value }))}>
                    {options.map(n => <option key={n} value={n}>{key === 'hints' && n === 0 ? 'None' : n}</option>)}
                  </select>
                </div>
              ))}

              <div className="setting-item">
                <label>Word Mode</label>
                <select value={settings.wordMode} onChange={e => setSettings(s => ({ ...s, wordMode: e.target.value }))}>
                  <option value="normal">Normal</option>
                  <option value="hidden">Hidden</option>
                  <option value="combination">Combination</option>
                </select>
              </div>

              <div className="setting-item">
                <label>Room Type</label>
                <button className={`toggle-btn ${isPrivate ? 'on' : 'off'}`} onClick={() => setIsPrivate(p => !p)}>
                  {isPrivate ? '🔒 Private' : '🌐 Public'}
                </button>
              </div>
            </div>

            {settings.wordMode !== 'normal' && (
              <div className="word-mode-info">
                💡 {WORD_MODE_INFO[settings.wordMode]}
              </div>
            )}

            <button className="big-btn create-btn" onClick={handleCreate}>✏️ Create Room</button>
          </div>
        )}

        {tab === 'join' && (
          <div className="tab-content center">
            <input
              className="room-code-input"
              placeholder="ROOM CODE"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              maxLength={8}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            <div className="spectator-toggle">
              <label className="spectator-label">
                <input type="checkbox" checked={joinAsSpectator} onChange={e => setJoinAsSpectator(e.target.checked)} />
                <span>👁️ Join as Spectator</span>
              </label>
            </div>
            <button className="big-btn join-btn" onClick={handleJoin}>
              {joinAsSpectator ? '👁️ Watch Game' : '🚪 Join Room'}
            </button>
          </div>
        )}

        {tab === 'browse' && (
          <div className="tab-content">
            <div className="spectator-toggle" style={{ marginBottom: 12 }}>
              <label className="spectator-label">
                <input type="checkbox" checked={joinAsSpectator} onChange={e => setJoinAsSpectator(e.target.checked)} />
                <span>👁️ Join as Spectator</span>
              </label>
            </div>
            <div className="public-rooms">
              {publicRooms.length === 0 ? (
                <div className="no-rooms"><span>🎨</span><p>No open rooms. Create one!</p></div>
              ) : (
                publicRooms.map(room => (
                  <div key={room.id} className="room-card">
                    <div className="room-info">
                      <span className="room-code">#{room.id}</span>
                      <span className="room-players">{room.playerCount}/{room.maxPlayers} players</span>
                      <span className="room-round">Round {room.round}/{room.totalRounds}</span>
                    </div>
                    <button className="join-room-btn" onClick={() => handleJoinPublic(room.id)}>
                      {joinAsSpectator ? '👁️ Watch' : 'Join'}
                    </button>
                  </div>
                ))
              )}
            </div>
            <button className="refresh-btn" onClick={onRefreshRooms}>🔄 Refresh</button>
          </div>
        )}
      </main>
    </div>
  );
}
