import { useState, useEffect, useRef } from 'react';

export default function ChatPanel({ messages, onSend, isDrawer, isSpectator, phase }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  };

  const getMessageClass = (msg) => {
    if (msg.type === 'correct') return 'msg-correct';
    if (msg.type === 'system' || msg.isSystem) return 'msg-system';
    if (msg.type === 'guess') return 'msg-guess';
    return 'msg-chat';
  };

  // Spectators can always type (chat only, not guessing)
  // Drawer cannot type during drawing phase
  const canType = isSpectator || !(isDrawer && phase === 'drawing');

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span>💬 {isSpectator ? 'Spectator Chat' : 'Chat & Guesses'}</span>
      </div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg ${getMessageClass(msg)}`}>
            {msg.type === 'correct' && (
              <div className="correct-guess-msg">
                <span className="correct-icon">✅</span>
                <span><strong>{msg.playerName}</strong> guessed it! <span className="points">+{msg.points}</span></span>
              </div>
            )}
            {(msg.type === 'system' || msg.isSystem) && (
              <div className="system-msg">{msg.text || msg.playerName}</div>
            )}
            {(msg.type === 'chat' || msg.type === 'guess') && !msg.isSystem && (
              <div className="chat-line">
                <span className="chat-sender" style={msg.isSpectator ? { color: '#888' } : {}}>
                  {msg.isSpectator ? '👁️ ' : ''}{msg.playerName}:
                </span>
                <span className="chat-text">{msg.text}</span>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        {canType ? (
          <>
            <input
              className="chat-input"
              placeholder={
                isSpectator ? 'Chat as spectator...' :
                phase === 'drawing' ? 'Type your guess...' : 'Say something...'
              }
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              maxLength={100}
            />
            <button className="send-btn" onClick={handleSend}>➤</button>
          </>
        ) : (
          <div className="drawer-muted">You're drawing! 🎨</div>
        )}
      </div>
    </div>
  );
}
