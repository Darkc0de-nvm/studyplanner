'use strict';
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const { mountClientStatic } = require('./static');

// Routes
const authRoutes        = require('./routes/auth');
const tasksRoutes       = require('./routes/tasks');
const disciplinesRoutes = require('./routes/disciplines');
const accountRoutes     = require('./routes/account');
const healthRoutes      = require('./routes/health');

// Middleware
const errorHandler = require('./middleware/errorHandler');
const originCheck  = require('./middleware/originCheck');
const { apiLimiter } = require('./middleware/rateLimiters');

const app = express();

// Trust proxy (Render sets this in production)
if (config.TRUST_PROXY) {
  app.set('trust proxy', config.TRUST_PROXY);
}

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'"],
        styleSrc:    ["'self'"],
        imgSrc:      ["'self'", 'data:'],
        fontSrc:     ["'self'"],
        connectSrc:  ["'self'"],
        frameSrc:    ["'none'"],
        frameAncestors: ["'none'"],
        objectSrc:   ["'none'"],
        baseUri:     ["'self'"],
        formAction:  ["'self'"],
      },
    },
    // Needed for fonts served from same origin
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'deny' },
  })
);

// Compression (gzip / brotli)
app.use(compression());

// Structured request logging (no body, no passwords)
if (config.NODE_ENV !== 'test') {
  app.use(morgan('[:date[iso]] :method :url :status :res[content-length] - :response-time ms'));
}

// Cookie parsing
app.use(cookieParser());

// JSON body (16 KB limit)
app.use(express.json({ limit: '16kb' }));

// API routes. Credential endpoints apply their own stricter limiter inside
// routes/auth.js; /me and /logout use the general API budget.
app.use('/api/health',      healthRoutes);
app.use('/api/auth',        authRoutes);
app.use('/api/tasks',       apiLimiter,  tasksRoutes);
app.use('/api/disciplines', apiLimiter,  disciplinesRoutes);
app.use('/api/account',     apiLimiter,  originCheck, accountRoutes);

// 404 for unknown /api/* routes
app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint не знайдено.' } });
});

// Static client served by the same origin as the API
const CLIENT_DIR = path.resolve(__dirname, '../../client');
mountClientStatic(app, CLIENT_DIR);

// Central error handler (must be last)
app.use(errorHandler);

module.exports = app;
