require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const competitions = require('./routes/competitions');
const registrations = require('./routes/registrations');
const { errorHandler, HttpError } = require('./middleware/errors');

function createApp(config) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin === '*' ? true : config.clientOrigin.split(',').map((value) => value.trim()) }));
  app.use(compression());
  app.use(express.json({ limit: '32kb' }));
  app.use('/api/v1', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
  app.use('/api/v1/competitions', competitions);
  app.use('/api/v1/competitions', registrations);
  app.use((req, res, next) => next(new HttpError(404, 'Route not found.', 'NOT_FOUND')));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
