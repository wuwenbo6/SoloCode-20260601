require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

require('./database/db');

const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/configs');
const macroRoutes = require('./routes/macros');
const communityRoutes = require('./routes/community');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/configs', configRoutes);
app.use('/api/macros', macroRoutes);
app.use('/api/community', communityRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Gamepad Controller API is running' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});