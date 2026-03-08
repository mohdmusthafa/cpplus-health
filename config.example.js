module.exports = {
  // Camera/NVR Configuration
  camera: {
    host: 'https://your-camera-host-or-ip',
    loginPath: '/RPC2_Login',
    apiPath: '/RPC2',
    username: 'your_username',
    password: 'your_password'
  },

  // Uptime API Configuration (optional, used by app.js for status push)
  uptime: {
    url: 'https://your-uptime-api-push-url'
  },

  // Channels to check for status (both must be "Connected" for status to be "up")
  statusChannels: [0, 1]
};
