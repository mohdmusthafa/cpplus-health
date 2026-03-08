const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');

function makeRequest(urlString, data, cookies = []) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const postData = JSON.stringify(data);

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Content-Length': Buffer.byteLength(postData),
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (cookies.length > 0) {
      headers['Cookie'] = cookies.join('; ');
    }

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: headers
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
        try {
          const json = JSON.parse(body);
          resolve({
            json,
            headers: res.headers,
            cookies: res.headers['set-cookie']
          });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}\nResponse: ${body}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

function hexMd5(input) {
  return crypto.createHash('md5').update(input, 'utf8').digest('hex').toUpperCase();
}

/**
 * Perform two-step login. Returns { sessionId, session, cookies } or throws.
 */
async function login(baseUrl, username, password) {
  const url = `${baseUrl}`;

  const firstLoginRequest = {
    method: 'global.login',
    params: {
      userName: username,
      password: '',
      clientType: 'Web3.0'
    },
    id: 5
  };

  const firstLoginResponse = await makeRequest(url, firstLoginRequest);
  const params = firstLoginResponse.json.params || firstLoginResponse.json.error?.params;

  if (!params) {
    throw new Error('Invalid firstLogin response. Missing params field.');
  }

  const encryption = params.encryption || 'Default';
  const random = params.random;
  const realm = params.realm;
  const session = firstLoginResponse.json.session || params.session;

  if (!encryption) {
    throw new Error('Missing encryption parameter in firstLogin response');
  }

  if (encryption === 'Default' && (!random || !realm)) {
    throw new Error('For Default encryption, both random and realm are required');
  }

  const hash1 = hexMd5(`${username}:${realm}:${password}`);
  const encryptedPassword = hexMd5(`${username}:${random}:${hash1}`);

  const secondLoginRequest = {
    method: 'global.login',
    params: {
      userName: username,
      password: encryptedPassword,
      clientType: 'Web3.0',
      authorityType: encryption,
      passwordType: encryption
    },
    id: 6,
    session: session
  };

  const secondLoginResponse = await makeRequest(url, secondLoginRequest);

  if (secondLoginResponse.json.result !== true) {
    const err = secondLoginResponse.json.error;
    throw new Error(err ? `Login failed: ${err.message} (code ${err.code})` : 'Login failed');
  }

  const sessionId = secondLoginResponse.json.session;
  const allCookies = [];
  const setCookieHeaders = secondLoginResponse.cookies;
  if (setCookieHeaders && setCookieHeaders.length > 0) {
    setCookieHeaders.forEach((cookie) => {
      const cookieMatch = cookie.match(/([^=]+=[^;]+)/);
      if (cookieMatch) allCookies.push(cookieMatch[1]);
    });
  }
  allCookies.push(`WebClientSessionID=${sessionId}`);
  allCookies.push('curLanguage=English');
  allCookies.push(`username=${username}`);

  return { sessionId, session, cookies: allCookies };
}

/**
 * Log out. Best-effort; does not throw.
 */
async function logout(apiUrl, sessionId, cookies) {
  const logoutRequest = {
    method: 'global.logout',
    params: null,
    id: 144,
    session: sessionId
  };
  try {
    await makeRequest(apiUrl, logoutRequest, cookies);
  } catch (_) {
    // ignore
  }
}

module.exports = { makeRequest, login, logout };
