#!/usr/bin/env node

const config = require('./config');
const { makeRequest, login, logout } = require('./auth');

const loginUrl = `${config.camera.host}${config.camera.loginPath}`;
const apiUrl = `${config.camera.host}${config.camera.apiPath}`;

async function runChannels() {
  const { sessionId, cookies } = await login(
    loginUrl,
    config.camera.username,
    config.camera.password
  );

  try {
    const cameraStateRequest = {
      method: 'LogicDeviceManager.getCameraState',
      params: { uniqueChannels: [-1] },
      id: 151,
      session: sessionId
    };

    const res = await makeRequest(apiUrl, cameraStateRequest, cookies);
    const states = res.json.params?.states || [];

    const channels = states.map((s) => ({
      channel: s.channel,
      connectionState: s.connectionState,
      ...(s.name != null && { name: s.name }),
      ...(s.deviceName != null && { deviceName: s.deviceName })
    }));

    return { channels };
  } finally {
    await logout(apiUrl, sessionId, cookies);
  }
}

async function runReboot() {
  const { sessionId, cookies } = await login(
    loginUrl,
    config.camera.username,
    config.camera.password
  );

  try {
    const rebootRequest = {
      method: 'magicBox.reboot',
      params: null,
      id: 127,
      session: sessionId
    };

    const res = await makeRequest(apiUrl, rebootRequest, cookies);
    const success = res.json.result === true;

    return {
      success,
      ...(res.json.error && {
        error: { code: res.json.error.code, message: res.json.error.message }
      })
    };
  } finally {
    await logout(apiUrl, sessionId, cookies);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = (args[0] || '').toLowerCase();

  if (!command) {
    process.stderr.write('Usage: node cpplus-health.js <command>\n');
    process.stderr.write('Commands: channels, reboot\n');
    process.exit(1);
  }

  try {
    let result;
    if (command === 'channels') {
      result = await runChannels();
    } else if (command === 'reboot') {
      result = await runReboot();
    } else {
      process.stderr.write(`Unknown command: ${command}\n`);
      process.exit(1);
    }

    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(0);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }
}

main();
