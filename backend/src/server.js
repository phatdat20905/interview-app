import express from "express";
import path from "path";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { serve } from "inngest/express";
import { clerkMiddleware } from "@clerk/express";

import { ENV } from "./lib/env.js";
import { connectDB } from "./lib/db.js";
import { inngest, functions } from "./lib/inngest.js";

import chatRoutes from "./routes/chatRoutes.js";
import sessionRoutes from "./routes/sessionRoute.js";

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO with CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: ENV.CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const __dirname = path.resolve();

// middleware
app.use(express.json());
// credentials:true meaning?? => server allows a browser to include cookies on request
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));
app.use(clerkMiddleware()); // this adds auth field to request object: req.auth()

app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/chat", chatRoutes);
app.use("/api/sessions", sessionRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ msg: "api is up and running" });
});

// ===== SOCKET.IO REAL-TIME CODE COLLABORATION =====
// Store active rooms and their users
const rooms = new Map(); // roomId -> Set of socketIds

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Join a coding room
  socket.on("join-room", ({ roomId, userId, userName }) => {
    socket.join(roomId);
    
    // Track room membership
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    rooms.get(roomId).set(socket.id, { userId, userName });

    console.log(`${userName} joined room ${roomId}`);

    // Notify others in the room about the new user
    socket.to(roomId).emit("user-joined", {
      userId,
      userName,
      socketId: socket.id,
    });

    // Send current room users to the new joiner
    const roomUsers = Array.from(rooms.get(roomId).values());
    socket.emit("room-users", roomUsers);
  });

  // Handle code changes from a user
  socket.on("code-change", ({ roomId, code, language, userId }) => {
    // Broadcast to all other users in the room (not to sender)
    socket.to(roomId).emit("code-update", {
      code,
      language,
      userId,
      timestamp: Date.now(),
    });
  });

  // Handle cursor position changes (optional feature)
  socket.on("cursor-change", ({ roomId, position, userId, userName }) => {
    socket.to(roomId).emit("cursor-update", {
      position,
      userId,
      userName,
      socketId: socket.id,
    });
  });

  // Handle language change
  socket.on("language-change", ({ roomId, language, userId }) => {
    socket.to(roomId).emit("language-update", {
      language,
      userId,
    });
  });

  // Handle run-code event: broadcast run request to other clients in the room
  socket.on("run-code", ({ roomId, code, language, userId }) => {
    // Broadcast to others so they can execute locally and display same output
    socket.to(roomId).emit("run-code", {
      code,
      language,
      userId,
      timestamp: Date.now(),
    });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);

    // Find and remove user from all rooms
    for (const [roomId, users] of rooms.entries()) {
      if (users.has(socket.id)) {
        const user = users.get(socket.id);
        users.delete(socket.id);

        // Notify others in the room
        socket.to(roomId).emit("user-left", {
          userId: user.userId,
          userName: user.userName,
          socketId: socket.id,
        });

        // Clean up empty rooms
        if (users.size === 0) {
          rooms.delete(roomId);
        }
      }
    }
  });

  // Manual leave room
  socket.on("leave-room", ({ roomId }) => {
    socket.leave(roomId);
    
    if (rooms.has(roomId)) {
      const users = rooms.get(roomId);
      if (users.has(socket.id)) {
        const user = users.get(socket.id);
        users.delete(socket.id);

        socket.to(roomId).emit("user-left", {
          userId: user.userId,
          userName: user.userName,
          socketId: socket.id,
        });

        if (users.size === 0) {
          rooms.delete(roomId);
        }
      }
    }
  });
});

// ===== END SOCKET.IO =====

// make our app ready for deployment
if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("/{*any}", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

const startServer = async () => {
  try {
    await connectDB();
    httpServer.listen(ENV.PORT, () => {
      console.log("Server is running on port:", ENV.PORT);
      console.log("Socket.IO is ready for real-time collaboration");
    });
  } catch (error) {
    console.error("Error starting the server", error);
  }
};

startServer();
