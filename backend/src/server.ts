import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const HOST = '0.0.0.0';
const PORT = parseInt(process.env.PORT || '3000');
const DEV = process.env.NODE_ENV === 'development';

// Add startup logging
console.log('Starting server with environment:', {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT
});

const app = express();
app.use(cors());  // Add cors middleware

app.get('/', (req, res) => {
  res.json({ 
    status: 'Server is running',
    rooms: Object.keys(rooms).length
  });
});

// Create HTTP server first
const httpServer = createServer(app);

// Initialize Socket.IO with the HTTP server
const io = new Server(httpServer, {
  cors: {
    origin: DEV ? '*' : process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  },
});

const rooms: Record<string, string[]> = {}; // Stores players per room

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinRoom", (roomId) => {
    if (!rooms[roomId]) rooms[roomId] = [];
    if (rooms[roomId].length < 2) {
      rooms[roomId].push(socket.id);
      socket.join(roomId);
      console.log(`User ${socket.id} joined room ${roomId}`);
      io.to(roomId).emit("playerJoined", rooms[roomId]);
    } else {
      socket.emit("roomFull");
    }
  });

  socket.on("makeMove", ({ roomId, board }) => {
    socket.to(roomId).emit("updateBoard", board);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter((id) => id !== socket.id);
      io.to(roomId).emit("playerLeft", rooms[roomId]);
    }
  });
});

// Listen with the httpServer, not the Express app
httpServer.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log('Server is ready to accept connections');
});

// Add error handling
httpServer.on('error', (error) => {
  console.error('Server error:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
