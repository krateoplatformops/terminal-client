const express = require('express')
const { io } = require('socket.io-client')
const { exec, execSync } = require('child_process')
const logger = require('./helpers/logger.helpers')
const statusRoutes = require('./routes/status.routes')
const jwt = require('jsonwebtoken');

const me = process.env.NODE_ID
const escalationChar = (process.env.ESCALATION_CHAR || '@')[0]
const cwd = []

// Define the port
const port = process.env.PORT || 8080;

const socket = io(process.env.REMOTE_HOST)
// const socket = io(process.env.REMOTE_HOST, {
//   auth: {
//     token: generateJwtToken(process.env.NODE_ID, process.env.REMOTE_HOST)
//   }
// });

logger.info(`node name: ${me}`)
logger.info(`remote host is: ${process.env.REMOTE_HOST}`)
logger.info(`escalation char is: ${escalationChar}`)

const app = express()
app.use('/', statusRoutes.router)

// Function to list all exposed routes
function listEndpoints(app) {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Routes registered directly on the app
      const methods = Object.keys(middleware.route.methods).map((method) => method.toUpperCase());
      routes.push({ path: middleware.route.path, methods });
    } else if (middleware.name === 'router') {
      // Routes added with router.use()
      middleware.handle.stack.forEach((handler) => {
        const methods = Object.keys(handler.route.methods).map((method) => method.toUpperCase());
        routes.push({ path: handler.route.path, methods });
      });
    }
  });
  return routes;
}

// Start listening on the defined port
app.listen(port, () => {
  logger.info(`App is listening on port ${port}`);

  const endpoints = listEndpoints(app);
  logger.info('Exposed APIs:');
  endpoints.forEach((endpoint) => {
    logger.info(`- ${endpoint.methods.join(', ')}: ${endpoint.path}`);
  });
});

socket.on('connect', () => {
  logger.info(`connected to ${process.env.REMOTE_HOST}`)
  socket.emit('warmup', { nodeId: me })
  statusRoutes.setSocketConnectionStatus(true)
})

socket.on('disconnect', () => {
  logger.info(`disconnected from ${process.env.REMOTE_HOST}`);
  statusRoutes.setSocketConnectionStatus(false);
});

socket.on('error', (error) => {
  logger.error(error)
  statusRoutes.setSocketConnectionStatus(false)
})

socket.on('task', (data) => {
  const { source, command } = data
  let cwp = command.trim()

  if (!cwd[source]) {
    cwd[source] = '/'
  }

  logger.debug("cwp 1 - START")
  logger.debug(cwp)
  logger.debug("cwp 1 - END")

  if(process.env.ESCALATION_BY_DEFAULT){
    cwp = `${process.env.COMMAND_PREFIX} "${cwp}"`.trim()

    logger.debug("cwp ESCALATION_BY_DEFAULT=true - START")
    logger.debug(cwp)
    logger.debug("cwp ESCALATION_BY_DEFAULT=true - END")
  }
  else {
    if (cwp[0] === escalationChar && process.env.COMMAND_PREFIX) {

      logger.debug("cwp ESCALATION_BY_DEFAULT=false - START")
      cwp = `${process.env.COMMAND_PREFIX} "${cwp.slice(1)}"`.trim()
      logger.debug("cwp ESCALATION_BY_DEFAULT=false - END")
    }
  }

  logger.debug("cwp 2 - START")
  logger.debug(cwp)
  logger.debug("cwp 2 - END")

  logger.info(`> task from ${source} - ${command}`)
  const payload = {
    command,
    source,
    cwd: execSync('pwd', { cwd: cwd[source] }).toString().trim(),
    time: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  logger.debug("payload - START")
  logger.debug(payload)
  logger.debug("payload - END")

  if (command === '') {
    socket.emit('task_result', {
      ...payload,
      output: ''
    })
    return
  }
  exec(cwp, { cwd: cwd[source] }, (error, stdout, stderr) => {
    if (error) {
      logger.error(`error: ${error.message}`)
      socket.emit('task_result', {
        ...payload,
        output: error.message
      })
      return
    } else if (stderr) {
      logger.error(`stderr: ${stderr}`)
      socket.emit('task_result', {
        ...payload,
        output: stderr
      })
      return
    } else {
      const cmd = command.split(' ')
      if (cmd[0] === 'cd') {
        if (cmd[1][0] === '/') {
          cwd[source] = cmd[1]
        } else {
          cwd[source] += `/${cmd[1]}`
        }
        payload.cwd = execSync('pwd', { cwd: cwd[source] }).toString().trim()
      }
    }
    socket.emit('task_result', {
      ...payload,
      output: stdout
    })
  })
})

// Function to generate a JWT token
// function generateJwtToken(username, password) {
//   const payload = { username, password };
//   const secretKey = process.env.JWT_SECRET_KEY;
//   const options = { expiresIn: '1h' };
//   return jwt.sign(payload, secretKey, options);
// }
