import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { logger } from "./logger";

interface GameSession {
  gameSocketId?: string;
  phoneSocketId?: string;
}

const sessions = new Map<string, GameSession>();

export function setupSocketRelay(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: "/api/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on("game:join", ({ sessionId }: { sessionId: string }) => {
      if (!sessionId) return;
      const session = sessions.get(sessionId) ?? {};
      session.gameSocketId = socket.id;
      sessions.set(sessionId, session);
      socket.join(`game:${sessionId}`);
      logger.info({ sessionId, socketId: socket.id }, "Game client joined");

      if (session.phoneSocketId) {
        socket.emit("phone:connected");
      }
    });

    socket.on("phone:join", ({ sessionId }: { sessionId: string }) => {
      if (!sessionId) return;
      const session = sessions.get(sessionId) ?? {};
      session.phoneSocketId = socket.id;
      sessions.set(sessionId, session);
      socket.join(`phone:${sessionId}`);
      logger.info({ sessionId, socketId: socket.id }, "Phone client joined");

      if (session.gameSocketId) {
        io.to(`game:${sessionId}`).emit("phone:connected");
        socket.emit("phone:ready");
      }
    });

    socket.on(
      "phone:action",
      ({
        sessionId,
        action,
        value,
      }: {
        sessionId: string;
        action: string;
        value?: number;
      }) => {
        io.to(`game:${sessionId}`).emit("player:action", { action, value });
      }
    );

    socket.on("game:over", ({ sessionId, score }: { sessionId: string; score: number }) => {
      io.to(`phone:${sessionId}`).emit("game:over", { score });
    });

    // Relay restart signal: game client → phone client
    socket.on("game:restart", ({ sessionId }: { sessionId: string }) => {
      io.to(`phone:${sessionId}`).emit("game:restart");
      logger.info({ sessionId }, "Game restart relayed to phone");
    });

    socket.on("disconnect", () => {
      sessions.forEach((session, sessionId) => {
        if (session.gameSocketId === socket.id) {
          session.gameSocketId = undefined;
          io.to(`phone:${sessionId}`).emit("game:disconnected");
          logger.info({ sessionId }, "Game client disconnected");
        }
        if (session.phoneSocketId === socket.id) {
          session.phoneSocketId = undefined;
          io.to(`game:${sessionId}`).emit("phone:disconnected");
          logger.info({ sessionId }, "Phone client disconnected");
        }
      });
    });
  });

  logger.info("Socket.io relay initialized");
  return io;
}
