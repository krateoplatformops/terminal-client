const express = require('express')
const router = express.Router()

// Liveness probe
router.get('/healthz', (req, res) => {
  // Check if the application is up and running
  res.status(200).send('OK');
});

// Readiness probe
router.get('/readyz', (req, res) => {
  // Check if the socket is connected and the app is ready to handle requests
  if (socket.connected) {
    res.status(200).send('READY');
  } else {
    res.status(500).send('NOT READY');
  }
});

module.exports = router
