#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { URL } = require('url');
const config = require('./config');
const { makeRequest, login, logout } = require('./auth');

function makeGetRequest(urlString) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET'
    };

    if (isHttps) {
      const httpsAgent = new https.Agent({ rejectUnauthorized: false });
      options.agent = httpsAgent;
    }

    const req = client.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        resolve(body);
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

async function main() {
  const startTime = Date.now();
  const args = process.argv.slice(2);

  const username = args[0] || config.camera.username;
  const password = args[1] || config.camera.password;
  const loginUrl = args[2] || `${config.camera.host}${config.camera.loginPath}`;
  const baseUrl = args[2] ? loginUrl.replace(config.camera.loginPath, config.camera.apiPath) : `${config.camera.host}${config.camera.apiPath}`;

  try {
    const { sessionId, cookies } = await login(loginUrl, username, password);

    const cameraStateRequest = {
      method: 'LogicDeviceManager.getCameraState',
      params: { uniqueChannels: [-1] },
      id: 151,
      session: sessionId
    };

    const cameraStateResponse = await makeRequest(baseUrl, cameraStateRequest, cookies);

    console.log(JSON.stringify(cameraStateResponse.json, null, 2));

    const executionTime = Date.now() - startTime;
    const states = cameraStateResponse.json.params?.states || [];
    const allChannelsConnected = config.statusChannels.every((channelNum) => {
      const channel = states.find((s) => s.channel === channelNum);
      return channel?.connectionState === 'Connected';
    });

    const status = allChannelsConnected ? 'up' : 'down';

    try {
      const uptimeUrl = `${config.uptime.url}?status=${status}&msg=OK&ping=${executionTime}`;
      await makeGetRequest(uptimeUrl);
    } catch (error) {
      // Silently ignore uptime API errors
    }

    await logout(baseUrl, sessionId, cookies);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});


