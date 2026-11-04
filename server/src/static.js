'use strict';
const fs = require('fs');
const path = require('path');
const express = require('express');

/**
 * Mounts the static client, if the directory exists.
 * Returns false when there is no client build yet (Phase 1), true otherwise.
 */
function mountClientStatic(app, clientDir) {
  if (!fs.existsSync(clientDir)) return false;

  // Hashed assets can be cached aggressively.
  for (const dir of ['assets', 'css', 'js']) {
    const dirPath = path.join(clientDir, dir);
    if (fs.existsSync(dirPath)) {
      app.use(`/${dir}`, express.static(dirPath, {
        maxAge: '1y',
        etag: true,
        index: false,
      }));
    }
  }

  // HTML must always be revalidated so users get the current build.
  app.use(
    express.static(clientDir, {
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

  // Unknown pages render the client 404 page when it exists.
  app.use((_req, res) => {
    const notFoundPage = path.join(clientDir, '404.html');
    if (fs.existsSync(notFoundPage)) {
      res.status(404).sendFile(notFoundPage);
    } else {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Сторінку не знайдено.' } });
    }
  });

  return true;
}

module.exports = { mountClientStatic };
