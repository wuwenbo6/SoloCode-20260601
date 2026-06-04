const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DATA_DIR = path.join(__dirname, 'data');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'subscriptions.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'pending_notifications.json');
const RESOURCES_FILE = path.join(DATA_DIR, 'resources.json');
const HISTORY_FILE = path.join(DATA_DIR, 'subscription_history.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = {
  Patient: {},
  Observation: {},
  Subscription: {}
};

const subscriptions = new Map();
const wsClients = new Map();
const pendingNotifications = new Map();
const subscriptionHistory = [];
const clientHeartbeats = new Map();

const HEARTBEAT_INTERVAL = 15000;
const HEARTBEAT_TIMEOUT = 10000;

function isInPeriod(period) {
  if (!period) return true;
  const now = new Date();
  if (period.start && new Date(period.start) > now) return false;
  if (period.end && new Date(period.end) < now) return false;
  return true;
}

function getTimeUntilPeriodStart(period) {
  if (!period || !period.start) return null;
  const start = new Date(period.start);
  const now = new Date();
  if (start <= now) return null;
  return start.getTime() - now.getTime();
}

function saveSubscriptions() {
  const subsArray = Array.from(subscriptions.values());
  fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subsArray, null, 2));
}

function loadSubscriptions() {
  if (!fs.existsSync(SUBSCRIPTIONS_FILE)) return;
  try {
    const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8');
    const subsArray = JSON.parse(data);
    subsArray.forEach(sub => {
      subscriptions.set(sub.id, sub);
      db.Subscription[sub.id] = sub;
    });
    console.log(`已恢复 ${subsArray.length} 个订阅`);
  } catch (e) {
    console.error('加载订阅失败:', e.message);
  }
}

function savePendingNotifications() {
  const notifsArray = Array.from(pendingNotifications.entries()).map(([subId, notifs]) => ({
    subscriptionId: subId,
    notifications: notifs
  }));
  fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifsArray, null, 2));
}

function loadPendingNotifications() {
  if (!fs.existsSync(NOTIFICATIONS_FILE)) return;
  try {
    const data = fs.readFileSync(NOTIFICATIONS_FILE, 'utf8');
    const notifsArray = JSON.parse(data);
    notifsArray.forEach(item => {
      pendingNotifications.set(item.subscriptionId, item.notifications);
    });
    const total = notifsArray.reduce((sum, item) => sum + item.notifications.length, 0);
    console.log(`已恢复 ${total} 个待发送通知`);
  } catch (e) {
    console.error('加载待发送通知失败:', e.message);
  }
}

function saveResources() {
  const resources = { Patient: db.Patient, Observation: db.Observation };
  fs.writeFileSync(RESOURCES_FILE, JSON.stringify(resources, null, 2));
}

function loadResources() {
  if (!fs.existsSync(RESOURCES_FILE)) return false;
  try {
    const data = fs.readFileSync(RESOURCES_FILE, 'utf8');
    const resources = JSON.parse(data);
    if (resources.Patient) db.Patient = resources.Patient;
    if (resources.Observation) db.Observation = resources.Observation;
    const total = Object.keys(db.Patient).length + Object.keys(db.Observation).length;
    console.log(`已恢复 ${total} 个资源`);
    return true;
  } catch (e) {
    console.error('加载资源失败:', e.message);
    return false;
  }
}

function addHistoryEvent(event) {
  subscriptionHistory.push({
    id: uuidv4(),
    ...event,
    timestamp: new Date().toISOString()
  });
  saveHistory();
}

function saveHistory() {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(subscriptionHistory, null, 2));
}

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return;
  try {
    const data = fs.readFileSync(HISTORY_FILE, 'utf8');
    const arr = JSON.parse(data);
    arr.forEach(item => subscriptionHistory.push(item));
    console.log(`已恢复 ${arr.length} 条订阅历史`);
  } catch (e) {
    console.error('加载订阅历史失败:', e.message);
  }
}

function queueNotification(subId, notification) {
  if (!pendingNotifications.has(subId)) {
    pendingNotifications.set(subId, []);
  }
  pendingNotifications.get(subId).push({
    ...notification,
    queuedAt: new Date().toISOString()
  });
  savePendingNotifications();
}

function deliverPendingNotifications(subId) {
  const notifs = pendingNotifications.get(subId);
  if (!notifs || notifs.length === 0) return;
  const ws = wsClients.get(subId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const sub = subscriptions.get(subId);
  if (!sub || !isInPeriod(sub.period)) return;
  const toDeliver = [...notifs];
  pendingNotifications.set(subId, []);
  savePendingNotifications();
  toDeliver.forEach(notification => {
    ws.send(JSON.stringify({
      type: 'notification',
      subscriptionId: subId,
      ...notification,
      deliveredAt: new Date().toISOString()
    }));
    addHistoryEvent({
      eventType: 'notification_delivered',
      subscriptionId: subId,
      criteria: sub.criteria,
      action: notification.action,
      resourceType: notification.resourceType,
      resourceId: notification.resource?.id
    });
  });
  console.log(`已推送 ${toDeliver.length} 个暂存通知 (订阅ID: ${subId})`);
}

function checkPeriodAndDeliver() {
  subscriptions.forEach((sub, subId) => {
    if (isInPeriod(sub.period)) {
      deliverPendingNotifications(subId);
    }
  });
}

setInterval(checkPeriodAndDeliver, 1000);

function notifySubscribers(resourceType, action, resource) {
  const notification = {
    timestamp: new Date().toISOString(),
    resourceType,
    action,
    resource
  };

  subscriptions.forEach((sub, subId) => {
    if (sub.criteria === resourceType || sub.criteria === `${resourceType}?`) {
      if (isInPeriod(sub.period)) {
        if (wsClients.has(subId)) {
          const ws = wsClients.get(subId);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'notification',
              subscriptionId: subId,
              ...notification
            }));
            addHistoryEvent({
              eventType: 'notification_sent',
              subscriptionId: subId,
              criteria: sub.criteria,
              action,
              resourceType,
              resourceId: resource.id
            });
          } else {
            queueNotification(subId, notification);
          }
        } else {
          queueNotification(subId, notification);
        }
      } else {
        queueNotification(subId, notification);
      }
    }
  });

  wss.clients.forEach(client => {
    if (client.broadcastAll && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'broadcast',
        ...notification
      }));
    }
  });
}

function startHeartbeat(ws) {
  ws.isAlive = true;
  ws.lastHeartbeat = Date.now();

  const heartbeatTimer = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      clearInterval(heartbeatTimer);
      clientHeartbeats.delete(ws.clientId);
      return;
    }

    if (!ws.isAlive) {
      console.log(`心跳超时，断开客户端: ${ws.clientId}`);
      addHistoryEvent({
        eventType: 'heartbeat_timeout',
        clientId: ws.clientId
      });
      clearInterval(heartbeatTimer);
      clientHeartbeats.delete(ws.clientId);
      ws.terminate();
      return;
    }

    ws.isAlive = false;
    ws.ping();
  }, HEARTBEAT_INTERVAL);

  clientHeartbeats.set(ws.clientId, {
    ws,
    timer: heartbeatTimer,
    lastHeartbeat: Date.now(),
    connectedAt: new Date().toISOString()
  });
}

function handleClientPong(ws) {
  ws.isAlive = true;
  ws.lastHeartbeat = Date.now();

  const hb = clientHeartbeats.get(ws.clientId);
  if (hb) {
    hb.lastHeartbeat = Date.now();
  }
}

wss.on('connection', (ws) => {
  const clientId = uuidv4();
  ws.clientId = clientId;
  ws.broadcastAll = true;
  ws.isAlive = true;
  ws.lastHeartbeat = Date.now();

  startHeartbeat(ws);

  ws.on('pong', () => {
    handleClientPong(ws);
  });

  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    heartbeatInterval: HEARTBEAT_INTERVAL
  }));

  addHistoryEvent({
    eventType: 'client_connected',
    clientId
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'ping':
          ws.isAlive = true;
          ws.lastHeartbeat = Date.now();
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString(),
            serverUptime: process.uptime()
          }));
          break;
        case 'subscribe':
          handleSubscribe(ws, data);
          break;
        case 'unsubscribe':
          handleUnsubscribe(data.subscriptionId);
          break;
        case 'bindSubscription':
          handleBindSubscription(ws, data.subscriptionId);
          break;
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: e.message }));
    }
  });

  ws.on('close', () => {
    addHistoryEvent({
      eventType: 'client_disconnected',
      clientId: ws.clientId
    });

    const hb = clientHeartbeats.get(ws.clientId);
    if (hb) {
      clearInterval(hb.timer);
      clientHeartbeats.delete(ws.clientId);
    }

    wsClients.forEach((clientWs, subId) => {
      if (clientWs === ws) {
        wsClients.delete(subId);
      }
    });
  });
});

function handleSubscribe(ws, data) {
  const subscriptionId = data.subscriptionId || uuidv4();
  const criteria = data.criteria || 'Patient';

  const subscription = {
    id: subscriptionId,
    resourceType: 'Subscription',
    status: 'active',
    criteria,
    channel: {
      type: 'websocket',
      endpoint: `ws://localhost:3000/${subscriptionId}`
    },
    reason: data.reason || 'WebSocket subscription',
    period: data.period || null,
    createdAt: new Date().toISOString()
  };

  subscriptions.set(subscriptionId, subscription);
  wsClients.set(subscriptionId, ws);
  db.Subscription[subscriptionId] = subscription;
  saveSubscriptions();

  addHistoryEvent({
    eventType: 'subscription_created',
    subscriptionId,
    criteria,
    reason: subscription.reason,
    period: subscription.period
  });

  ws.send(JSON.stringify({
    type: 'subscription_created',
    subscription
  }));

  if (isInPeriod(subscription.period)) {
    deliverPendingNotifications(subscriptionId);
  }
}

function handleUnsubscribe(subscriptionId) {
  const sub = subscriptions.get(subscriptionId);
  if (sub) {
    addHistoryEvent({
      eventType: 'subscription_deleted',
      subscriptionId,
      criteria: sub.criteria
    });
  }
  subscriptions.delete(subscriptionId);
  wsClients.delete(subscriptionId);
  pendingNotifications.delete(subscriptionId);
  delete db.Subscription[subscriptionId];
  saveSubscriptions();
  savePendingNotifications();
}

function handleBindSubscription(ws, subscriptionId) {
  if (subscriptions.has(subscriptionId)) {
    wsClients.set(subscriptionId, ws);
    const sub = subscriptions.get(subscriptionId);
    if (isInPeriod(sub.period)) {
      deliverPendingNotifications(subscriptionId);
    }
    ws.send(JSON.stringify({
      type: 'subscription_bound',
      subscriptionId,
      inPeriod: isInPeriod(sub.period),
      pendingCount: (pendingNotifications.get(subscriptionId) || []).length
    }));
  }
}

app.get('/fhir/metadata', (req, res) => {
  res.json({
    resourceType: 'CapabilityStatement',
    status: 'active',
    date: new Date().toISOString(),
    fhirVersion: '4.0.1',
    format: ['application/json'],
    rest: [{
      mode: 'server',
      resource: [
        { type: 'Patient', interaction: [{ code: 'read' }, { code: 'create' }, { code: 'update' }, { code: 'delete' }, { code: 'search-type' }] },
        { type: 'Observation', interaction: [{ code: 'read' }, { code: 'create' }, { code: 'update' }, { code: 'delete' }, { code: 'search-type' }] },
        { type: 'Subscription', interaction: [{ code: 'read' }, { code: 'create' }, { code: 'delete' }] }
      ]
    }]
  });
});

app.get('/fhir', (req, res) => {
  res.json({
    resourceType: 'Bundle',
    type: 'searchset',
    entry: Object.entries(db).map(([resourceType, resources]) => ({
      resource: { resourceType, id: resourceType, count: Object.keys(resources).length }
    }))
  });
});

app.get('/fhir/:resourceType', (req, res) => {
  const { resourceType } = req.params;
  if (!db[resourceType]) {
    return res.status(404).json({ error: `Unknown resource type: ${resourceType}` });
  }
  const entries = Object.values(db[resourceType]).map(resource => ({ resource }));
  res.json({ resourceType: 'Bundle', type: 'searchset', total: entries.length, entry: entries });
});

app.get('/fhir/:resourceType/:id', (req, res) => {
  const { resourceType, id } = req.params;
  if (!db[resourceType]) {
    return res.status(404).json({ error: `Unknown resource type: ${resourceType}` });
  }
  if (!db[resourceType][id]) {
    return res.status(404).json({ error: `${resourceType} not found` });
  }
  res.json(db[resourceType][id]);
});

app.post('/fhir/:resourceType', (req, res) => {
  const { resourceType } = req.params;
  if (!db[resourceType]) {
    return res.status(404).json({ error: `Unknown resource type: ${resourceType}` });
  }
  const id = req.body.id || uuidv4();
  const resource = {
    ...req.body, resourceType, id,
    meta: { versionId: '1', lastUpdated: new Date().toISOString() }
  };
  db[resourceType][id] = resource;
  saveResources();
  notifySubscribers(resourceType, 'created', resource);
  res.status(201).header('Location', `/fhir/${resourceType}/${id}`).json(resource);
});

app.put('/fhir/:resourceType/:id', (req, res) => {
  const { resourceType, id } = req.params;
  if (!db[resourceType]) {
    return res.status(404).json({ error: `Unknown resource type: ${resourceType}` });
  }
  const existing = db[resourceType][id];
  const versionId = existing ? (parseInt(existing.meta.versionId) + 1).toString() : '1';
  const resource = {
    ...req.body, resourceType, id,
    meta: { versionId, lastUpdated: new Date().toISOString() }
  };
  db[resourceType][id] = resource;
  saveResources();
  notifySubscribers(resourceType, 'updated', resource);
  res.json(resource);
});

app.delete('/fhir/:resourceType/:id', (req, res) => {
  const { resourceType, id } = req.params;
  if (!db[resourceType]) {
    return res.status(404).json({ error: `Unknown resource type: ${resourceType}` });
  }
  if (!db[resourceType][id]) {
    return res.status(404).json({ error: `${resourceType} not found` });
  }
  const resource = db[resourceType][id];
  delete db[resourceType][id];
  saveResources();
  notifySubscribers(resourceType, 'deleted', { id, resourceType });
  res.status(204).send();
});

app.get('/fhir/Subscription/:id/$status', (req, res) => {
  const { id } = req.params;
  const subscription = subscriptions.get(id);
  if (!subscription) {
    return res.status(404).json({ error: 'Subscription not found' });
  }
  const hb = wsClients.has(id) ? clientHeartbeats.get(wsClients.get(id).clientId) : null;
  res.json({
    subscriptionId: id,
    status: 'active',
    type: 'websocket',
    inPeriod: isInPeriod(subscription.period),
    pendingNotifications: (pendingNotifications.get(id) || []).length,
    lastHeartbeat: hb ? new Date(hb.lastHeartbeat).toISOString() : null,
    connectedAt: hb ? hb.connectedAt : null
  });
});

app.get('/api/subscriptions', (req, res) => {
  const subs = Array.from(subscriptions.values()).map(sub => {
    const ws = wsClients.get(sub.id);
    const hb = ws ? clientHeartbeats.get(ws.clientId) : null;
    return {
      ...sub,
      inPeriod: isInPeriod(sub.period),
      pendingCount: (pendingNotifications.get(sub.id) || []).length,
      wsConnected: ws && ws.readyState === WebSocket.OPEN,
      lastHeartbeat: hb ? new Date(hb.lastHeartbeat).toISOString() : null
    };
  });
  res.json(subs);
});

app.get('/api/resources', (req, res) => {
  res.json({
    Patient: Object.values(db.Patient),
    Observation: Object.values(db.Observation)
  });
});

app.get('/api/stats', (req, res) => {
  res.json({
    subscriptions: {
      total: subscriptions.size,
      active: Array.from(subscriptions.values()).filter(s => isInPeriod(s.period)).length
    },
    resources: {
      patients: Object.keys(db.Patient).length,
      observations: Object.keys(db.Observation).length
    },
    pendingNotifications: {
      total: Array.from(pendingNotifications.values()).reduce((sum, arr) => sum + arr.length, 0)
    },
    connections: {
      total: wss.clients.size,
      alive: Array.from(wss.clients).filter(c => c.isAlive).length
    },
    history: {
      total: subscriptionHistory.length
    }
  });
});

app.get('/api/history', (req, res) => {
  const { eventType, subscriptionId, from, to, limit } = req.query;
  let filtered = [...subscriptionHistory];

  if (eventType) {
    filtered = filtered.filter(h => h.eventType === eventType);
  }
  if (subscriptionId) {
    filtered = filtered.filter(h => h.subscriptionId === subscriptionId);
  }
  if (from) {
    filtered = filtered.filter(h => new Date(h.timestamp) >= new Date(from));
  }
  if (to) {
    filtered = filtered.filter(h => new Date(h.timestamp) <= new Date(to));
  }

  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (limit) {
    filtered = filtered.slice(0, parseInt(limit));
  }

  res.json(filtered);
});

app.get('/api/history/export', (req, res) => {
  const { format } = req.query;
  const data = subscriptionHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (format === 'csv') {
    const headers = ['timestamp', 'eventType', 'subscriptionId', 'criteria', 'action', 'resourceType', 'resourceId', 'clientId', 'reason'];
    const rows = data.map(d => headers.map(h => {
      const val = d[h] || '';
      return typeof val === 'object' ? JSON.stringify(val) : String(val).replace(/"/g, '""');
    }).map(v => `"${v}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=subscription_history_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send('\uFEFF' + csv);
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=subscription_history_${new Date().toISOString().slice(0, 10)}.json`);
    res.json(data);
  }
});

app.delete('/api/history', (req, res) => {
  subscriptionHistory.length = 0;
  saveHistory();
  res.json({ message: '历史已清空' });
});

const PORT = 3000;

function init() {
  loadSubscriptions();
  loadPendingNotifications();
  loadHistory();
  const hasResources = loadResources();

  if (!hasResources) {
    const samplePatient = {
      resourceType: 'Patient',
      id: 'example-1',
      name: [{ family: '张三', given: ['小明'] }],
      gender: 'male',
      birthDate: '1990-01-15',
      meta: { versionId: '1', lastUpdated: new Date().toISOString() }
    };
    db.Patient['example-1'] = samplePatient;

    const sampleObservation = {
      resourceType: 'Observation',
      id: 'obs-1',
      status: 'final',
      code: { text: '体重' },
      subject: { reference: 'Patient/example-1' },
      valueQuantity: { value: 70, unit: 'kg' },
      meta: { versionId: '1', lastUpdated: new Date().toISOString() }
    };
    db.Observation['obs-1'] = sampleObservation;
    saveResources();
  }

  server.listen(PORT, () => {
    console.log(`FHIR Server running on http://localhost:${PORT}`);
    console.log(`WebSocket server on ws://localhost:${PORT}`);
    console.log(`数据目录: ${DATA_DIR}`);
    console.log(`心跳间隔: ${HEARTBEAT_INTERVAL}ms, 超时: ${HEARTBEAT_TIMEOUT}ms`);
  });
}

init();
