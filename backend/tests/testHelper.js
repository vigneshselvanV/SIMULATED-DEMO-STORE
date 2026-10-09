import http from 'http';
import app from '../src/app.js';
import { initializeDatabase } from '../src/db/initDb.js';

export async function createTestApp() {
  initializeDatabase();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const close = async () => {
    return new Promise((resolve) => {
      if (server.closeAllConnections) {
        server.closeAllConnections();
      }
      server.close(() => resolve());
    });
  };

  return { server, baseUrl, close };
}

export class SessionClient {
  constructor(serverBaseUrl) {
    this.baseUrl = serverBaseUrl;
    this.cookies = [];
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Connection': 'close',
      ...(options.headers || {})
    };

    if (this.cookies.length > 0) {
      headers['Cookie'] = this.cookies.join('; ');
    }

    const res = await fetch(url, {
      ...options,
      headers
    });

    // Capture set-cookie headers
    const rawSetCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (rawSetCookies && rawSetCookies.length > 0) {
      for (const cookieHeader of rawSetCookies) {
        const cookiePair = cookieHeader.split(';')[0];
        const name = cookiePair.split('=')[0];
        this.cookies = this.cookies.filter((c) => !c.startsWith(`${name}=`));
        this.cookies.push(cookiePair);
      }
    } else {
      const singleSetCookie = res.headers.get('set-cookie');
      if (singleSetCookie) {
        const cookiePair = singleSetCookie.split(';')[0];
        const name = cookiePair.split('=')[0];
        this.cookies = this.cookies.filter((c) => !c.startsWith(`${name}=`));
        this.cookies.push(cookiePair);
      }
    }

    let body = null;
    try {
      body = await res.json();
    } catch (e) {
      body = null;
    }

    return {
      status: res.status,
      headers: res.headers,
      body
    };
  }
}
