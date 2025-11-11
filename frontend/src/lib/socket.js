import { io } from "socket.io-client";

/**
 * Singleton Socket.IO client for real-time code collaboration
 * 
 * This module provides a single Socket.IO connection that can be reused
 * across the application to prevent multiple connections.
 */

let socket = null;

/**
 * Initialize and get the Socket.IO client instance
 * @param {string} serverUrl - The backend server URL
 * @returns {Socket} Socket.IO client instance
 */
export const getSocket = (serverUrl) => {
  if (!socket) {
    // Use VITE_SOCKET_URL for Socket.IO (not VITE_API_URL which includes /api)
    const url = serverUrl || import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";
    
    socket = io(url, {
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    // Connection event listeners
    socket.on("connect", () => {
      console.log("Socket.IO connected");
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket.IO disconnected:", reason);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket.IO connection error:", error.message);
    });

    socket.on("reconnect", (attemptNumber) => {
      console.log("Socket.IO reconnected after", attemptNumber, "attempts");
    });
  }

  return socket;
};

/**
 * Disconnect the socket and clean up
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Check if socket is connected
 * @returns {boolean}
 */
export const isSocketConnected = () => {
  return socket?.connected || false;
};

/**
 * Join a coding room
 * @param {string} roomId - The room/session ID
 * @param {string} userId - The user's ID
 * @param {string} userName - The user's display name
 */
export const joinRoom = (roomId, userId, userName) => {
  const socketInstance = getSocket();
  socketInstance.emit("join-room", { roomId, userId, userName });
};

/**
 * Leave a coding room
 * @param {string} roomId - The room/session ID
 */
export const leaveRoom = (roomId) => {
  if (socket) {
    socket.emit("leave-room", { roomId });
  }
};

/**
 * Emit code changes to other users in the room
 * @param {string} roomId - The room/session ID
 * @param {string} code - The current code content
 * @param {string} language - The programming language
 * @param {string} userId - The user's ID
 */
export const emitCodeChange = (roomId, code, language, userId) => {
  if (socket?.connected) {
    socket.emit("code-change", { roomId, code, language, userId });
  }
};

/**
 * Emit cursor position changes (optional feature)
 * @param {string} roomId - The room/session ID
 * @param {object} position - Cursor position { lineNumber, column }
 * @param {string} userId - The user's ID
 * @param {string} userName - The user's display name
 */
export const emitCursorChange = (roomId, position, userId, userName) => {
  if (socket?.connected) {
    socket.emit("cursor-change", { roomId, position, userId, userName });
  }
};

/**
 * Emit language change to sync with other users
 * @param {string} roomId - The room/session ID
 * @param {string} language - The new programming language
 * @param {string} userId - The user's ID
 */
export const emitLanguageChange = (roomId, language, userId) => {
  if (socket?.connected) {
    socket.emit("language-change", { roomId, language, userId });
  }
};

export default {
  getSocket,
  disconnectSocket,
  isSocketConnected,
  joinRoom,
  leaveRoom,
  emitCodeChange,
  emitCursorChange,
  emitLanguageChange,
};
