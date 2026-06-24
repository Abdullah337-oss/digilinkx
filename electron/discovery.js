const dgram = require('dgram');

const DISCOVERY_PORT = 52345;
const DISCOVERY_MSG = Buffer.from('DIGILINKS_DISCOVERY');
const RESPONSE_PREFIX = 'DIGILINKS_SERVER:';

function discoverServer(timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const results = [];
    let timer = null;

    socket.on('message', (msg, rinfo) => {
      const text = msg.toString();
      if (text.startsWith(RESPONSE_PREFIX)) {
        try {
          const data = JSON.parse(text.slice(RESPONSE_PREFIX.length));
          results.push(data);
        } catch (_) {}
      }
    });

    socket.on('error', () => {});

    socket.bind(DISCOVERY_PORT, () => {
      socket.setBroadcast(true);
      socket.send(DISCOVERY_MSG, 0, DISCOVERY_MSG.length, DISCOVERY_PORT, '255.255.255.255');

      timer = setTimeout(() => {
        socket.close();
        resolve(results.length > 0 ? results[0] : null);
      }, timeoutMs);
    });
  });
}

module.exports = { discoverServer };
