import app from './app.js';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const PORT = process.env.PORT || 3001;

const server = createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });

interface PositionMessage {
  type: 'position';
  userId: string;
  x: number;
  y: number;
  floor: number;
  name?: string;
  color?: string;
}

interface ClientState {
  userId: string;
  name: string;
  color: string;
  x: number;
  y: number;
  floor: number;
}

const connectedClients = new Map<string, ClientState>();

const colors = ['#FF6B35', '#9B59B6', '#3498DB', '#2ECC71', '#F39C12', '#E74C3C', '#1ABC9C', '#E91E63'];
let colorIndex = 0;

function broadcast(message: string, excludeUserId?: string) {
  wss.clients.forEach((client: any) => {
    if (client.readyState === 1 && client.userId !== excludeUserId) {
      client.send(message);
    }
  });
}

function getOtherUsersList(currentUserId?: string) {
  const users: Array<Omit<ClientState, 'userId'> & { userId: string }> = [];
  connectedClients.forEach((state, userId) => {
    if (userId !== currentUserId) {
      users.push({ ...state, userId });
    }
  });
  return users;
}

wss.on('connection', (ws: any) => {
  const userId = Math.random().toString(36).substring(2, 10);
  const userColor = colors[colorIndex % colors.length];
  colorIndex++;

  ws.userId = userId;
  ws.userName = `用户${userId.slice(0, 4).toUpperCase()}`;
  ws.userColor = userColor;

  connectedClients.set(userId, {
    userId,
    name: ws.userName,
    color: userColor,
    x: 0,
    y: 0,
    floor: 1,
  });

  ws.send(JSON.stringify({
    type: 'init',
    userId,
    name: ws.userName,
    color: userColor,
    users: getOtherUsersList(userId),
  }));

  broadcast(JSON.stringify({
    type: 'user_join',
    userId,
    name: ws.userName,
    color: userColor,
  }), userId);

  ws.on('message', (rawData: Buffer) => {
    try {
      const data = JSON.parse(rawData.toString()) as PositionMessage;
      if (data.type === 'position') {
        const state = connectedClients.get(userId);
        if (state) {
          state.x = data.x;
          state.y = data.y;
          state.floor = data.floor;
        }
        broadcast(JSON.stringify({
          type: 'position',
          userId,
          x: data.x,
          y: data.y,
          floor: data.floor,
          name: ws.userName,
          color: ws.userColor,
        }), userId);
      }
    } catch (err) {
      console.error('Failed to parse WS message:', err);
    }
  });

  ws.on('close', () => {
    connectedClients.delete(userId);
    broadcast(JSON.stringify({
      type: 'user_leave',
      userId,
    }));
  });
});

server.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}, WebSocket on /ws`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
