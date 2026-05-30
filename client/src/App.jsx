import { useState, useCallback, useEffect, useRef } from 'react';
import { useSocket } from './hooks/useSocket';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import GameOverPage from './pages/GameOverPage';

const PHASES = { HOME: 'home', LOBBY: 'lobby', GAME: 'game', GAMEOVER: 'gameover' };

export default function App() {
  const [phase, setPhase]         = useState(PHASES.HOME);
  const [myPlayer, setMyPlayer]   = useState(null);
  const [players, setPlayers]     = useState([]);
  const [roomId, setRoomId]       = useState(null);
  const [isHost, setIsHost]       = useState(false);
  const [roomSettings, setRoomSettings] = useState({});
  const [customWords, setCustomWords]   = useState([]);
  const [publicRooms, setPublicRooms]   = useState([]);
  const [gameOverData, setGameOverData] = useState(null);
  const [messages, setMessages]   = useState([]);

  // Drawing sync — use a ref queue instead of React state so rapid draw_data events
  // are never dropped by React batching. Each event is pushed; GamePage drains with RAF.
  const remoteStrokeQueue = useRef([]);
  const [clearSignal, setClearSignal]   = useState(0);
  const [undoStrokes, setUndoStrokes]   = useState(null);

  const [gameState, setGameState] = useState({
    phase: 'lobby', round: 1, totalRounds: 3,
    drawerId: null, drawerWord: null, currentWord: null,
    wordOptions: [], wordMode: 'normal',
    hiddenWord: '', drawTime: 80, timeLeft: 80,
    lastWord: null, lastRoundStrokes: [],
  });

  const addMessage  = useCallback((msg)  => setMessages(prev => [...prev.slice(-199), msg]), []);
  const addSystem   = useCallback((text) => addMessage({ type: 'system', text }), [addMessage]);

  // Read ?room= from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      window.history.replaceState({}, '', window.location.pathname);
      window._pendingRoomId = roomParam.toUpperCase();
    }
  }, []);

  // ─── Socket event handlers ───────────────────────────────────────────────

  const socketHandlers = {
    room_created: ({ roomId, player, players, settings, isHost }) => {
      setMyPlayer(player); setPlayers(players); setRoomId(roomId);
      setIsHost(isHost); setRoomSettings(settings);
      setCustomWords([]); setMessages([]);
      setPhase(PHASES.LOBBY);
      addSystem(`Room ${roomId} created! Share the code with friends.`);
    },

    room_joined: ({ roomId, player, players, settings, isHost, customWords: cw, gameState: gs }) => {
      setMyPlayer(player); setPlayers(players); setRoomId(roomId);
      setIsHost(isHost); setRoomSettings(settings);
      setCustomWords(cw || []); setMessages([]);
      if (gs) {
        setGameState(prev => ({ ...prev, ...gs, wordMode: settings.wordMode || 'normal' }));
        setPhase(gs.phase !== 'lobby' ? PHASES.GAME : PHASES.LOBBY);
      } else {
        setPhase(PHASES.LOBBY);
      }
      addSystem(`Joined room ${roomId}. Welcome, ${player.name}!`);
    },

    player_joined: ({ player, players }) => {
      setPlayers(players);
      addSystem(`${player.name}${player.isSpectator ? ' (spectator)' : ''} joined!`);
    },

    player_left: ({ playerName, players, newHostId, reason }) => {
      setPlayers(players);
      const why = reason === 'kicked' ? ' (kicked)' : reason === 'banned' ? ' (banned)' : '';
      addSystem(`${playerName} left${why}.`);
      setMyPlayer(prev => {
        if (prev?.id === newHostId) { setIsHost(true); addSystem('You are now the host!'); }
        return prev;
      });
    },

    // Spec-named game_state event
    game_state: (gs) => {
      setGameState(prev => ({ ...prev, ...gs }));
    },

    game_started: ({ players, round, totalRounds }) => {
      setPlayers(players);
      setGameState(prev => ({ ...prev, round, totalRounds, phase: 'choosing' }));
      setMessages([]);
      setPhase(PHASES.GAME);
      addSystem('Game started! Get ready...');
    },

    round_start: ({ round, totalRounds, drawerId, drawTime, wordMode }) => {
      setGameState(prev => ({
        ...prev, round, totalRounds, drawerId, drawTime, wordMode: wordMode || 'normal',
        timeLeft: drawTime, phase: 'choosing',
        drawerWord: null, currentWord: null, hiddenWord: '',
        wordOptions: [], lastWord: null,
      }));
      setClearSignal(s => s + 1);
      const drawerName = players.find(p => p.id === drawerId)?.name || 'Someone';
      addSystem(`Round ${round}! ${drawerName} is choosing a word...`);
    },

    word_options: ({ words }) => {
      setGameState(prev => ({ ...prev, wordOptions: words, phase: 'choosing' }));
    },

    your_word: ({ word, actualWord, wordMode }) => {
      // word = what drawer sees (may be blanked), actualWord = real word for checking
      setGameState(prev => ({ ...prev, drawerWord: word, currentWord: actualWord, wordMode: wordMode || 'normal' }));
    },

    drawing_started: ({ drawerId, hiddenWord, drawTime, wordMode }) => {
      setGameState(prev => ({
        ...prev, drawerId, hiddenWord, drawTime, wordMode: wordMode || 'normal',
        timeLeft: drawTime, phase: 'drawing',
      }));
      const drawerName = players.find(p => p.id === drawerId)?.name || 'Someone';
      addSystem(`${drawerName} is drawing!`);
    },

    timer_tick: ({ timeLeft }) => {
      setGameState(prev => ({ ...prev, timeLeft }));
    },

    hint_revealed: ({ hiddenWord }) => {
      setGameState(prev => ({ ...prev, hiddenWord }));
    },

    draw_data: (stroke) => {
      remoteStrokeQueue.current.push(stroke);
    },

    canvas_cleared: () => setClearSignal(s => s + 1),

    canvas_undo: ({ strokes }) => setUndoStrokes([...strokes]),

    canvas_state: ({ strokes }) => setUndoStrokes([...strokes]),

    guess_result: ({ correct, playerId, playerName, points, text, players: updatedPlayers }) => {
      if (correct) {
        addMessage({ type: 'correct', playerName, points });
        if (updatedPlayers) setPlayers(updatedPlayers);
      } else {
        addMessage({ type: 'guess', playerName, text });
      }
    },

    chat_message: ({ playerName, text, isSystem, isSpectator }) => {
      if (isSystem) { addSystem(text); return; }
      addMessage({ type: 'chat', playerName, text, isSpectator });
    },

    round_end: ({ word, leaderboard, players: updatedPlayers }) => {
      setGameState(prev => ({ ...prev, phase: 'roundEnd', lastWord: word }));
      if (updatedPlayers) setPlayers(updatedPlayers);
      addSystem(`Round over! The word was "${word}"`);
    },

    // Strokes saved for replay come back here (from server)
    replay_strokes: ({ strokes }) => {
      setGameState(prev => ({ ...prev, lastRoundStrokes: strokes }));
    },

    game_over: ({ winner, leaderboard }) => {
      setGameOverData({ winner, leaderboard });
      setPhase(PHASES.GAMEOVER);
    },

    custom_words_set: ({ words, count }) => {
      setCustomWords(words);
    },

    // Kicked or banned
    kicked: ({ reason }) => {
      alert(reason || 'You were removed from the room.');
      setPhase(PHASES.HOME);
      setMyPlayer(null); setPlayers([]); setRoomId(null);
    },

    public_rooms: ({ rooms }) => setPublicRooms(rooms),

    error: ({ message }) => alert(`Error: ${message}`),
  };

  const { emit } = useSocket(socketHandlers);

  // ─── Emit helpers ────────────────────────────────────────────────────────

  const handleCreateRoom    = useCallback((name, settings, isPrivate) => emit('create_room', { playerName: name, settings, isPrivate }), [emit]);
  const handleJoinRoom      = useCallback((roomId, name) => emit('join_room',      { roomId, playerName: name }), [emit]);
  const handleJoinSpectator = useCallback((roomId, name) => emit('join_spectator', { roomId, playerName: name }), [emit]);
  const handleStartGame     = useCallback(() => emit('start_game'), [emit]);
  const handleWordChosen    = useCallback((word) => { emit('word_chosen', { word }); }, [emit]);
  const handleDrawStart     = useCallback((d) => emit('draw_start',   d),  [emit]);
  const handleDrawMove      = useCallback((d) => emit('draw_move',    d),  [emit]);
  const handleDrawEnd       = useCallback(()  => emit('draw_end'),         [emit]);
  const handleCanvasClear   = useCallback(()  => emit('canvas_clear'),     [emit]);
  const handleDrawUndo      = useCallback(()  => emit('draw_undo'),        [emit]);
  const handleGuess         = useCallback((text) => emit('guess',    { text }), [emit]);
  const handleChat          = useCallback((text) => emit('chat',     { text }), [emit]);
  const handleRefreshRooms  = useCallback(()  => emit('get_public_rooms'), [emit]);
  const handleSetCustomWords= useCallback((words) => emit('set_custom_words', { words }), [emit]);
  const handleReplayRequest = useCallback(()  => emit('request_replay'),   [emit]);

  const handleKick = useCallback((playerId) => {
    if (window.confirm('Kick this player?')) emit('kick_player', { playerId });
  }, [emit]);

  const handleBan = useCallback((playerId) => {
    if (window.confirm('Ban this player? They cannot rejoin this room.')) emit('ban_player', { playerId });
  }, [emit]);

  const handlePlayAgain = useCallback(() => {
    setPhase(PHASES.LOBBY);
    setGameState({ phase: 'lobby', round: 1, totalRounds: 3, drawerId: null, drawerWord: null,
      currentWord: null, wordOptions: [], wordMode: 'normal', hiddenWord: '',
      drawTime: 80, timeLeft: 80, lastWord: null, lastRoundStrokes: [] });
    setMessages([]);
    setGameOverData(null);
    setPlayers(prev => prev.map(p => ({ ...p, score: 0, hasGuessedCorrectly: false })));
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="app">
      {phase === PHASES.HOME && (
        <HomePage
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onJoinSpectator={handleJoinSpectator}
          publicRooms={publicRooms}
          onRefreshRooms={handleRefreshRooms}
        />
      )}
      {phase === PHASES.LOBBY && (
        <LobbyPage
          roomId={roomId}
          players={players}
          myPlayer={myPlayer}
          isHost={isHost}
          settings={roomSettings}
          customWords={customWords}
          onStartGame={handleStartGame}
          onSetCustomWords={handleSetCustomWords}
        />
      )}
      {phase === PHASES.GAME && (
        <GamePage
          gameState={gameState}
          players={players}
          myPlayer={myPlayer}
          isHost={isHost}
          messages={messages}
          onDrawStart={handleDrawStart}
          onDrawMove={handleDrawMove}
          onDrawEnd={handleDrawEnd}
          onCanvasClear={handleCanvasClear}
          onDrawUndo={handleDrawUndo}
          onGuess={handleGuess}
          onChat={handleChat}
          onWordChosen={handleWordChosen}
          onKick={handleKick}
          onBan={handleBan}
          onReplayRequest={handleReplayRequest}
          remoteStrokeQueue={remoteStrokeQueue}
          clearSignal={clearSignal}
          undoStrokes={undoStrokes}
        />
      )}
      {phase === PHASES.GAMEOVER && (
        <GameOverPage
          winner={gameOverData?.winner}
          leaderboard={gameOverData?.leaderboard || []}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}
