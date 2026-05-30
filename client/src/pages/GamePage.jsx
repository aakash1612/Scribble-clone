import { useEffect, useRef, useCallback, useState } from 'react';
import { useCanvas } from '../hooks/useCanvas';
import DrawingToolbar from '../components/DrawingToolbar';
import ChatPanel from '../components/ChatPanel';
import Scoreboard from '../components/Scoreboard';
import WordSelector from '../components/WordSelector';
import RoundEndOverlay from '../components/RoundEndOverlay';

const WORD_MODE_BADGE = {
  hidden:      { label: '🙈 Hidden Mode', color: '#FF6B6B' },
  combination: { label: '🔀 Combo Mode',  color: '#C77DFF' },
};

export default function GamePage({
  gameState, players, myPlayer, messages, isHost,
  onDrawStart, onDrawMove, onDrawEnd, onCanvasClear, onDrawUndo,
  onGuess, onChat, onWordChosen,
  onKick, onBan, onReplayRequest,
  remoteStrokeQueue, clearSignal, undoStrokes,
}) {
  const isDrawer    = myPlayer?.id === gameState.drawerId;
  const isSpectator = myPlayer?.isSpectator;
  const [replayStrokes, setReplayStrokes] = useState(null);
  const [isReplaying, setIsReplaying]     = useState(false);

  const {
    canvasRef,
    color, setColor,
    brushSize, setBrushSize,
    tool, setTool,
    clearCanvas,
    replayStrokes: replayFn,
    applyRemoteStroke,
  } = useCanvas(isDrawer && !isSpectator, onDrawStart, onDrawMove, onDrawEnd);

  // Drain remoteStrokeQueue via RAF — bypasses React batching so every stroke is applied.
  // This fixes the desync that occurred when multiple draw_data events arrived between renders.
  useEffect(() => {
    let rafId;
    const drain = () => {
      const queue = remoteStrokeQueue.current;
      if (queue.length > 0) {
        const strokes = queue.splice(0, queue.length);
        for (const stroke of strokes) applyRemoteStroke(stroke);
      }
      rafId = requestAnimationFrame(drain);
    };
    rafId = requestAnimationFrame(drain);
    return () => cancelAnimationFrame(rafId);
  }, [remoteStrokeQueue, applyRemoteStroke]);

  // Clear canvas signal
  useEffect(() => { if (clearSignal > 0) clearCanvas(); }, [clearSignal, clearCanvas]);

  // Undo via full replay
  useEffect(() => { if (undoStrokes !== null) replayFn(undoStrokes); }, [undoStrokes, replayFn]);

  // Replay last round's drawing
  useEffect(() => {
    if (replayStrokes && !isReplaying) {
      setIsReplaying(true);
      clearCanvas();
      let i = 0;
      const step = () => {
        if (i >= replayStrokes.length) { setIsReplaying(false); setReplayStrokes(null); return; }
        applyRemoteStroke(replayStrokes[i++]);
        setTimeout(step, 8);
      };
      step();
    }
  }, [replayStrokes, isReplaying, clearCanvas, applyRemoteStroke]);

  const handleReplay = useCallback(() => {
    if (gameState.lastRoundStrokes?.length) {
      setReplayStrokes([...gameState.lastRoundStrokes]);
    } else {
      onReplayRequest();
    }
  }, [gameState.lastRoundStrokes, onReplayRequest]);

  const handleClear   = useCallback(() => { clearCanvas(); onCanvasClear(); }, [clearCanvas, onCanvasClear]);
  const handleUndo    = useCallback(() => onDrawUndo(), [onDrawUndo]);
  const handleMessage = useCallback((text) => {
    gameState.phase === 'drawing' ? onGuess(text) : onChat(text);
  }, [gameState.phase, onGuess, onChat]);

  const timeLeft  = gameState.timeLeft  || 0;
  const timerPct  = gameState.drawTime > 0 ? (timeLeft / gameState.drawTime) * 100 : 0;
  const timerColor = timerPct > 50 ? '#6BCB77' : timerPct > 25 ? '#FFD93D' : '#FF6B6B';
  const wordModeBadge = WORD_MODE_BADGE[gameState.wordMode];

  return (
    <div className="game-page">
      {/* Word selector for drawer */}
      {gameState.phase === 'choosing' && isDrawer && gameState.wordOptions?.length > 0 && (
        <WordSelector words={gameState.wordOptions} onChoose={onWordChosen} />
      )}

      {/* Round end overlay */}
      {gameState.phase === 'roundEnd' && (
        <RoundEndOverlay
          word={gameState.lastWord}
          leaderboard={[...players].filter(p => !p.isSpectator).sort((a, b) => b.score - a.score)}
          nextRound={gameState.round + 1}
          totalRounds={gameState.totalRounds}
          lastStrokes={gameState.lastRoundStrokes}
          onReplay={handleReplay}
        />
      )}

      {/* Top bar */}
      <div className="game-topbar">
        <div className="round-info">
          Round <strong>{gameState.round}</strong> / {gameState.totalRounds}
          {wordModeBadge && (
            <span className="word-mode-badge" style={{ background: wordModeBadge.color }}>
              {wordModeBadge.label}
            </span>
          )}
        </div>

        <div className="word-display">
          {isDrawer ? (
            <span className="your-word">
              {gameState.drawerWord
                ? <>Drawing: <strong>{gameState.drawerWord}</strong>{gameState.wordMode === 'hidden' ? ' 🙈' : ''}</>
                : gameState.phase === 'choosing' ? '⏳ Choose a word...' : ''}
            </span>
          ) : (
            <div className="hidden-word">
              {(gameState.hiddenWord || '').split('').map((ch, i) => (
                <span key={i} className={ch !== '_' ? 'revealed-letter' : 'blank-letter'}>
                  {ch === ' ' ? '\u00A0\u00A0' : ch}
                </span>
              ))}
            </div>
          )}
          {isSpectator && <span className="spectator-badge">👁️ Spectating</span>}
        </div>

        <div className="timer-display">
          <div className="timer-number" style={{ color: timerColor }}>{timeLeft}</div>
          <div className="timer-bar-bg">
            <div className="timer-bar-fill" style={{ width: `${timerPct}%`, background: timerColor }} />
          </div>
        </div>
      </div>

      {/* Main body */}
      <div className="game-body">
        <Scoreboard
          players={players}
          drawerId={gameState.drawerId}
          myPlayerId={myPlayer?.id}
          isHost={isHost}
          onKick={onKick}
          onBan={onBan}
        />

        <div className="canvas-container">
          {isReplaying && <div className="replay-banner">▶️ Replaying last round...</div>}
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className={`game-canvas ${isDrawer && !isSpectator ? 'can-draw' : 'view-only'}`}
          />
          {isDrawer && !isSpectator && (
            <DrawingToolbar
              color={color} setColor={setColor}
              brushSize={brushSize} setBrushSize={setBrushSize}
              tool={tool} setTool={setTool}
              onUndo={handleUndo}
              onClear={handleClear}
            />
          )}
          {gameState.phase === 'choosing' && !isDrawer && (
            <div className="waiting-overlay">
              <div className="waiting-spinner">🎨</div>
              <p>{players.find(p => p.id === gameState.drawerId)?.name || 'Drawer'} is choosing a word...</p>
            </div>
          )}
        </div>

        <ChatPanel
          messages={messages}
          onSend={handleMessage}
          isDrawer={isDrawer}
          isSpectator={isSpectator}
          phase={gameState.phase}
        />
      </div>
    </div>
  );
}
