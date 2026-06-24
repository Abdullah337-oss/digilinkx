const dgram = require('dgram');
const os = require('os');

const DISCOVERY_PORT = 52345;
const DISCOVERY_MSG = 'DIGILINKS_DISCOVERY';
const RESPONSE_PREFIX = 'DIGILINKS_SERVER:';

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

let socket = null;

function startDiscoveryServer(httpPort) {
  if (socket) return;
  socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  socket.on('message', (msg, rinfo) => {
    if (msg.toString() === DISCOVERY_MSG) {
      const ip = getLocalIp();
      const payload = JSON.stringify({ ip, port: httpPort });
      const response = Buffer.from(RESPONSE_PREFIX + payload);
      socket.send(response, 0, response.length, rinfo.port, rinfo.address);
    }
  });
  socket.bind(DISCOVERY_PORT, () => {
    console.log(`Discovery responder listening on UDP port ${DISCOVERY_PORT}`);
  });
  socket.on('error', (err) => {
    console.error('Discovery responder error:', err.message);
  });
}

function stopDiscoveryServer() {
  if (socket) {
    socket.close();
    socket = null;
  }
}

module.exports = { startDiscoveryServer, stopDiscoveryServer };
