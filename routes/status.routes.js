const express = require('express')
const router = express.Router()

// Global variable to track socket connection status
let isSocketConnected = false

// Function to update socket connection status
function setSocketConnectionStatus(status) {
  isSocketConnected = status
}

// Liveness probe
router.get('/healthz', (req, res) => {
  res.status(200).send('OK')
})

// Readiness probe
router.get('/readyz', (req, res) => {
  if (isSocketConnected) {
    res.status(200).send('READY')
  } else {
    res.status(500).send('NOT READY')
  }
})

module.exports = {
  router,
  setSocketConnectionStatus,
}
