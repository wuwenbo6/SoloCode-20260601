import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "../shared/types.js";
import {
  createRoom,
  joinRoom,
  leaveRoom,
  getRoom,
  addOperation,
  removeOperationByUser,
  clearOperations,
  clearLayerOperations,
  addLayer,
  removeLayerByUser,
  updateLayer,
  reorderLayers,
} from "./roomManager.js";
import { USER_COLORS } from "../shared/types.js";

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function setupSocket(io: TypedServer): void {
  io.on("connection", (socket) => {
    const userId = socket.id;
    const userColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
    const userName = `用户${userId.substring(0, 4)}`;
    let currentRoom: string | null = null;

    socket.on("room:create", () => {
      const roomId = createRoom(userId, { id: userId, name: userName, color: userColor });
      currentRoom = roomId;
      socket.join(roomId);
      socket.emit("room:created", roomId);
    });

    socket.on("room:join", (roomId) => {
      const user = { id: userId, name: userName, color: userColor };
      const room = joinRoom(roomId, userId, user);
      if (!room) {
        socket.emit("error", `房间 ${roomId} 不存在`);
        return;
      }
      currentRoom = roomId;
      socket.join(roomId);
      const users = Array.from(room.users.values());
      socket.emit("room:joined", roomId, users, room.operations, room.layers);
      socket.to(roomId).emit("room:userJoined", user);
    });

    socket.on("room:leave", (roomId) => {
      const room = leaveRoom(roomId, userId);
      if (room) {
        socket.to(roomId).emit("room:userLeft", userId);
      }
      socket.leave(roomId);
      currentRoom = null;
    });

    socket.on("draw:operation", (op) => {
      if (!currentRoom) return;
      addOperation(currentRoom, op);
      socket.to(currentRoom).emit("draw:broadcast", op);
    });

    socket.on("cursor:move", (data) => {
      if (!currentRoom) return;
      socket.to(currentRoom).emit("cursor:broadcast", data);
    });

    socket.on("canvas:clear", (roomId) => {
      const room = getRoom(roomId);
      if (!room || room.creatorId !== userId) return;
      clearOperations(roomId);
      io.to(roomId).emit("canvas:cleared");
    });

    socket.on("undo:operation", (roomId, opId) => {
      if (!currentRoom) return;
      const ok = removeOperationByUser(roomId, opId, userId);
      if (!ok) return;
      socket.to(currentRoom).emit("undo:broadcast", opId);
    });

    socket.on("redo:operation", (roomId, op) => {
      if (!currentRoom) return;
      if (op.userId !== userId) return;
      addOperation(currentRoom, op);
      socket.to(currentRoom).emit("draw:broadcast", op);
    });

    socket.on("layer:create", (roomId, layer) => {
      if (!currentRoom || currentRoom !== roomId) return;
      if (layer.userId !== userId) return;
      addLayer(roomId, layer);
      io.to(roomId).emit("layer:created", layer);
    });

    socket.on("layer:delete", (roomId, layerId) => {
      if (!currentRoom || currentRoom !== roomId) return;
      const ok = removeLayerByUser(roomId, layerId, userId);
      if (ok) {
        io.to(roomId).emit("layer:deleted", layerId);
      }
    });

    socket.on("layer:update", (roomId, layer) => {
      if (!currentRoom || currentRoom !== roomId) return;
      const ok = updateLayer(roomId, layer, userId);
      if (ok) {
        io.to(roomId).emit("layer:updated", layer);
      }
    });

    socket.on("layer:reorder", (roomId, layers) => {
      if (!currentRoom || currentRoom !== roomId) return;
      reorderLayers(roomId, layers, userId);
      const room = getRoom(roomId);
      if (room) {
        io.to(roomId).emit("layer:reordered", room.layers);
      }
    });

    socket.on("layer:clear", (roomId, layerId) => {
      if (!currentRoom || currentRoom !== roomId) return;
      clearLayerOperations(roomId, layerId);
      io.to(roomId).emit("layer:cleared", layerId);
    });

    socket.on("disconnect", () => {
      if (currentRoom) {
        const room = leaveRoom(currentRoom, userId);
        if (room) {
          io.to(currentRoom).emit("room:userLeft", userId);
        }
        currentRoom = null;
      }
    });
  });
}
