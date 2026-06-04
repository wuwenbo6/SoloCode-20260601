import app from "./app.js";
import { createServer } from "http";
import { Server } from "socket.io";
import { setupSocket } from "./socket.js";

const PORT = process.env.PORT || 3001;

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});

setupSocket(io);

httpServer.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM signal received");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

export default app;
