import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

const PRESETS_DIR = join(__dirname, '..', 'presets');

app.use(cors());
app.use(express.json());

if (!existsSync(PRESETS_DIR)) {
  mkdirSync(PRESETS_DIR, { recursive: true });
}

const PRESETS_FILE = join(PRESETS_DIR, 'presets.json');

function readPresets() {
  if (!existsSync(PRESETS_FILE)) {
    writeFileSync(PRESETS_FILE, JSON.stringify([], null, 2));
    return [];
  }
  const data = readFileSync(PRESETS_FILE, 'utf-8');
  return JSON.parse(data);
}

function writePresets(presets: unknown[]) {
  writeFileSync(PRESETS_FILE, JSON.stringify(presets, null, 2));
}

app.get('/api/presets', (_req, res) => {
  try {
    const presets = readPresets();
    res.json(presets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read presets' });
  }
});

app.get('/api/presets/:id', (req, res) => {
  try {
    const presets = readPresets();
    const preset = presets.find((p: any) => p.id === req.params.id);
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    res.json(preset);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read preset' });
  }
});

app.post('/api/presets', (req, res) => {
  try {
    const presets = readPresets();
    const newPreset = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      name: req.body.name || 'Untitled Preset',
      createdAt: Date.now(),
      params: req.body.params || {},
    };
    presets.push(newPreset);
    writePresets(presets);
    res.json(newPreset);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create preset' });
  }
});

app.put('/api/presets/:id', (req, res) => {
  try {
    const presets = readPresets();
    const index = presets.findIndex((p: any) => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    presets[index] = {
      ...presets[index],
      params: { ...presets[index].params, ...req.body.params },
    };
    writePresets(presets);
    res.json(presets[index]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update preset' });
  }
});

app.delete('/api/presets/:id', (req, res) => {
  try {
    const presets = readPresets();
    const index = presets.findIndex((p: any) => p.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    presets.splice(index, 1);
    writePresets(presets);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete preset' });
  }
});

app.listen(PORT, () => {
  console.log(`Preset server running on http://localhost:${PORT}`);
});
