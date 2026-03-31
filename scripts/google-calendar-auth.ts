import http from 'node:http';
import { URL } from 'node:url';
import { google } from 'googleapis';

const DEFAULT_PORT = Number(process.env.GOOGLE_OAUTH_PORT || '43099');
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function waitForAuthCode(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const requestUrl = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      const code = requestUrl.searchParams.get('code');
      const error = requestUrl.searchParams.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

      if (error) {
        res.end('<h1>Authorization failed</h1><p>Return to the terminal for details.</p>');
        server.close(() => reject(new Error(`Google OAuth error: ${error}`)));
        return;
      }

      if (!code) {
        res.end('<h1>Waiting for Google authorization</h1>');
        return;
      }

      res.end('<h1>Authorization received</h1><p>You can close this tab.</p>');
      server.close(() => resolve(code));
    });

    server.on('error', reject);
    server.listen(port, '127.0.0.1');
  });
}

async function main() {
  const clientId = requireEnv('GOOGLE_CALENDAR_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_CALENDAR_CLIENT_SECRET');
  const redirectUri = `http://127.0.0.1:${DEFAULT_PORT}`;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('');
  console.log('Open this URL in your browser and approve access:');
  console.log(authUrl);
  console.log('');
  console.log(`Waiting for Google to redirect back to ${redirectUri} ...`);
  console.log('If this hangs, check whether your OAuth client type is "Desktop app".');

  const code = await waitForAuthCode(DEFAULT_PORT);
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error('No refresh token returned. Try again and make sure Google shows a consent screen.');
  }

  console.log('');
  console.log('Use these env vars:');
  console.log(`GOOGLE_CALENDAR_CLIENT_ID=${clientId}`);
  console.log(`GOOGLE_CALENDAR_CLIENT_SECRET=${clientSecret}`);
  console.log(`GOOGLE_CALENDAR_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log(`GOOGLE_CALENDAR_ID=${process.env.GOOGLE_CALENDAR_ID || 'primary'}`);
}

main().catch((error) => {
  console.error('');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
