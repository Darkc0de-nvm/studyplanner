'use strict';
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// Routes
const authRoutes        = require('./routes/auth');
const tasksRoutes       = require('./routes/tasks');
const disciplinesRoutes = require('./routes/disciplines');
const accountRoutes     = require('./routes/account');
const healthRoutes      = require('./routes/health');

// Middleware
const errorHandler = require('./middleware/errorHandler');
const originCheck  = require('./middleware/originCheck');

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
        objectSrc:   ["'none'"],
        baseUri:     ["'self'"],
        formAction:  ["'self'"],
      },
    },
    // Needed for fonts served from same origin
    crossOriginEmbedderPolicy: false,
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

// Rate limiters
function makeLimiter(max, message) {
  return rateLimit({
    windowMs: 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message } },
    skip: () => config.NODE_ENV === 'test',
  });
}

const authLimiter = makeLimiter(10, 'Забагато спроб. Спробуйте пізніше.');
const apiLimiter  = makeLimiter(100, 'Забагато запитів. Спробуйте пізніше.');

// API routes
app.use('/api/health',      healthRoutes);
app.use('/api/auth',        authLimiter, authRoutes);
app.use('/api/tasks',       apiLimiter,  tasksRoutes);
app.use('/api/disciplines', apiLimiter,  disciplinesRoutes);
app.use('/api/account',     apiLimiter,  originCheck, accountRoutes);

// 404 for unknown /api/* routes
app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint не знайдено.' } });
});

// Static client (client/ will exist after Phase 2 git mv)
const CLIENT_DIR = path.resolve(__dirname, '../../client');

if (fs.existsSync(CLIENT_DIR)) {
  // Assets with long cache
  for (const dir of ['assets', 'css', 'js']) {
    const dirPath = path.join(CLIENT_DIR, dir);
    if (fs.existsSync(dirPath)) {
      app.use(`/${dir}`, express.static(dirPath, {
        maxAge: '1y',
        etag: true,
        index: false,
      }));
    }
  }

  // HTML with no-cache
  app.use(
    express.static(CLIENT_DIR, {
      maxAge: 0,
      etag: true,
      index: 'index.html',
      extensions: ['html'],
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      },
    })
  );

  // Fallback: return 404.html for unknown pages
  app.use((_req, res) => {
    const notFoundPage = path.join(CLIENT_DIR, '404.html');
    if (fs.existsSync(notFoundPage)) {
      res.status(404).sendFile(notFoundPage);
    } else {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Сторінку не знайдено.' } });
    }
  });
}

// Central error handler (must be last)
app.use(errorHandler);

module.exports = app;
