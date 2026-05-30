const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const MessageHandler = require('./MessageHandler');

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: [CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

app.use(cors({ origin: [CLIENT_URL, 'http://localhost:5173'] }));
app.use(express.json());

// In-memory room store
const rooms = new Map();

const messageHandler = new MessageHandler(io, rooms);

io.on('connection', (socket) => {
  messageHandler.handleConnection(socket);
});

// REST API endpoints
app.get('/health', (req, res) => res.json({ status: 'ok', rooms: rooms.size }));

app.get('/api/rooms', (req, res) => {
  const publicRooms = Array.from(rooms.values())
    .filter(r => !r.isPrivate && r.game.phase === 'lobby' && !r.isFull())
    .map(r => r.toPublicInfo());
  res.json({ rooms: publicRooms });
});

app.get('/api/room/:id', (req, res) => {
  const room = rooms.get(req.params.id.toUpperCase());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room.toPublicInfo());
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎨 Skribbl server running on port ${PORT}`);
});
