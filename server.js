const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Serve static frontend files if hosted together
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = {};

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Join or create room
  socket.on('joinRoom', ({ username, roomCode, entryFee }) => {
    socket.join(roomCode);

    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        id: roomCode,
        entryFee: entryFee || 100,
        players: [],
        gameStarted: false,
        pot: 0
      };
    }

    const room = rooms[roomCode];

    // Add player to room
    const existingPlayer = room.players.find(p => p.id === socket.id);
    if (!existingPlayer && room.players.length < 4) {
      room.players.push({
        id: socket.id,
        username: username || `Player ${room.players.length + 1}`,
        cards: []
      });
      room.pot += room.entryFee;
    }

    // Broadcast room update to all players in the room
    io.to(roomCode).emit('roomUpdate', room);
  });

  // Handle playing a card
  socket.on('playCard', ({ roomCode, cardIndex, colorChoice }) => {
    // Broadcast play event to room
    io.to(roomCode).emit('cardPlayed', {
      playerId: socket.id,
      cardIndex,
      colorChoice
    });
  });

  // Handle drawing a card
  socket.on('drawCard', ({ roomCode }) => {
    io.to(roomCode).emit('cardDrawn', { playerId: socket.id });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[roomCode];
      } else {
        io.to(roomCode).emit('roomUpdate', room);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`UNO Server running on port ${PORT}`);
});
