import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5001;

app.use(cors());
app.use(bodyParser.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const EXHIBITS_FILE = path.join(DATA_DIR, 'exhibits.json');
const HOTSPOTS_FILE = path.join(DATA_DIR, 'hotspots.json');
const NAVMESH_FILE = path.join(DATA_DIR, 'navmesh.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const initDataFile = (file, defaultData) => {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
  }
};

initDataFile(EXHIBITS_FILE, []);
initDataFile(HOTSPOTS_FILE, []);
initDataFile(NAVMESH_FILE, { nodes: [], edges: [] });
initDataFile(CONFIG_FILE, {
  modelUrl: '/models/exhibition.glb',
  playerStart: { x: 0, y: 1.6, z: 0 },
  bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }
});

const readJsonFile = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
};

const writeJsonFile = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

app.get('/api/config', (req, res) => {
  res.json(readJsonFile(CONFIG_FILE));
});

app.put('/api/config', (req, res) => {
  writeJsonFile(CONFIG_FILE, req.body);
  res.json({ success: true });
});

app.get('/api/exhibits', (req, res) => {
  res.json(readJsonFile(EXHIBITS_FILE));
});

app.post('/api/exhibits', (req, res) => {
  const exhibits = readJsonFile(EXHIBITS_FILE);
  const newExhibit = { id: Date.now(), ...req.body };
  exhibits.push(newExhibit);
  writeJsonFile(EXHIBITS_FILE, exhibits);
  res.json(newExhibit);
});

app.put('/api/exhibits/:id', (req, res) => {
  const exhibits = readJsonFile(EXHIBITS_FILE);
  const index = exhibits.findIndex(e => e.id === parseInt(req.params.id));
  if (index !== -1) {
    exhibits[index] = { ...exhibits[index], ...req.body };
    writeJsonFile(EXHIBITS_FILE, exhibits);
    res.json(exhibits[index]);
  } else {
    res.status(404).json({ error: 'Exhibit not found' });
  }
});

app.delete('/api/exhibits/:id', (req, res) => {
  let exhibits = readJsonFile(EXHIBITS_FILE);
  exhibits = exhibits.filter(e => e.id !== parseInt(req.params.id));
  writeJsonFile(EXHIBITS_FILE, exhibits);
  res.json({ success: true });
});

app.get('/api/hotspots', (req, res) => {
  res.json(readJsonFile(HOTSPOTS_FILE));
});

app.post('/api/hotspots', (req, res) => {
  const hotspots = readJsonFile(HOTSPOTS_FILE);
  const newHotspot = { id: Date.now(), ...req.body };
  hotspots.push(newHotspot);
  writeJsonFile(HOTSPOTS_FILE, hotspots);
  res.json(newHotspot);
});

app.delete('/api/hotspots/:id', (req, res) => {
  let hotspots = readJsonFile(HOTSPOTS_FILE);
  hotspots = hotspots.filter(h => h.id !== parseInt(req.params.id));
  writeJsonFile(HOTSPOTS_FILE, hotspots);
  res.json({ success: true });
});

app.get('/api/navmesh', (req, res) => {
  res.json(readJsonFile(NAVMESH_FILE));
});

app.put('/api/navmesh', (req, res) => {
  writeJsonFile(NAVMESH_FILE, req.body);
  res.json({ success: true });
});

const players = new Map();
const playerColors = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
  '#ffeaa7', '#dfe6e9', '#fd79a8', '#a29bfe'
];

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  const colorIndex = players.size % playerColors.length;
  const playerData = {
    id: socket.id,
    position: { x: 0, y: 1.6, z: 0 },
    rotation: { x: 0, y: 0 },
    color: playerColors[colorIndex],
    name: `玩家${players.size + 1}`,
    muted: false
  };

  players.set(socket.id, playerData);

  socket.emit('init', {
    yourId: socket.id,
    players: Array.from(players.values())
  });

  socket.broadcast.emit('playerJoined', playerData);

  socket.on('updatePosition', (data) => {
    const player = players.get(socket.id);
    if (player) {
      player.position = data.position;
      player.rotation = data.rotation;
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        position: data.position,
        rotation: data.rotation
      });
    }
  });

  socket.on('voiceState', ({ muted }) => {
    const player = players.get(socket.id);
    if (player) {
      player.muted = muted;
      io.emit('playerVoiceState', { id: socket.id, muted });
    }
  });

  socket.on('chatMessage', (message) => {
    io.emit('chatMessage', {
      id: socket.id,
      name: players.get(socket.id)?.name || '匿名',
      message,
      timestamp: Date.now()
    });
  });

  socket.on('offer', ({ targetId, offer }) => {
    socket.to(targetId).emit('offer', {
      callerId: socket.id,
      offer
    });
  });

  socket.on('answer', ({ targetId, answer }) => {
    socket.to(targetId).emit('answer', {
      answererId: socket.id,
      answer
    });
  });

  socket.on('iceCandidate', ({ targetId, candidate }) => {
    socket.to(targetId).emit('iceCandidate', {
      senderId: socket.id,
      candidate
    });
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    players.delete(socket.id);
    io.emit('playerLeft', { id: socket.id });
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Socket.io ready for multiplayer`);
});
