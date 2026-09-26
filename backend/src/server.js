require('dotenv').config();
const mongoose = require('mongoose');
const { loadConfig } = require('./config/env');
const { createApp } = require('./app');

async function start() {
  const config = loadConfig();
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, { autoIndex: config.nodeEnv !== 'production' });
  const server = createApp(config).listen(config.port, () => console.log(`Feedants API listening on port ${config.port}`));
  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => { console.error('Unable to start API:', error.message); process.exit(1); });
