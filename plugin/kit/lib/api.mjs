// The kit talks to Deno's API as the founder. Sign-in is the same OAuth 2.1 flow Claude uses with Deno's MCP:
// discovery → dynamic client registration ("Deno Studio kit") → PKCE authorization in the browser → a loopback
// redirect on 127.0.0.1 → tokens stored in ~/.deno-studio/auth.json (owner-only) and refreshed as needed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { HOME, info, readJSON, warn } from './util.mjs';

export const DEFAULT_API = 'https://deno-api-swart.vercel.app';
const CONFIG = path.join(HOME, 'config.json');
const AUTH = path.join(HOME, 'auth.json');
const PORTS = [53682, 53683, 53684];

export const config = () => readJSON(CONFIG, {});
export function setConfig(key, value) {
  const c = config();
  if (value === undefined || value === '') delete c[key];
  else c[key] = value;
  fs.mkdirSync(HOME, { recursive: true });
  fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2), { mode: 0o600 });
}
export const apiUrl = () => (process.env.DENO_API_URL || config().api_url || DEFAULT_API).replace(/\/+$/, '');

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function saveAuth(a) {
  fs.mkdirSync(HOME, { recursive: true });
  fs.writeFileSync(AUTH, JSON.stringify(a, null, 2), { mode: 0o600 });
}

async function getJSON(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg = body?.error?.message || body?.error_description || body?.msg || body?.message || text.slice(0, 300);
    const err = new Error(`${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

async function discover() {
  const api = apiUrl();
  const prm = await getJSON(`${api}/.well-known/oauth-protected-resource/mcp`);
  const issuer = String(prm.authorization_servers?.[0] || '').replace(/\/+$/, '');
  if (!issuer) throw new Error('Deno did not name an authorization server');
  const u = new URL(issuer);
  const candidates = [`${u.origin}/.well-known/oauth-authorization-server${u.pathname}`, `${issuer}/.well-known/oauth-authorization-server`, `${u.origin}/.well-known/openid-configuration${u.pathname}`];
  for (const url of candidates) {
    try {
      const meta = await getJSON(url);
      if (meta.authorization_endpoint && meta.token_endpoint) return { ...meta, resource: prm.resource || `${api}/mcp` };
    } catch {
      /* try the next well-known path */
    }
  }
  throw new Error(`could not read the authorization server metadata for ${issuer}`);
}

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* printed below anyway */
  }
}

function listen(port, state) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, `http://127.0.0.1:${port}`);
      if (u.pathname !== '/callback') {
        res.writeHead(404);
        return res.end();
      }
      const ok = u.searchParams.get('state') === state && u.searchParams.get('code');
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<body style="font:16px system-ui;padding:40px;background:#FAF8F3;color:#101613"><h2>${ok ? 'Deno Studio kit is signed in.' : 'Sign-in failed.'}</h2><p>You can close this tab and go back to your terminal.</p></body>`);
      server.close();
      if (ok) resolve(u.searchParams.get('code'));
      else reject(new Error(u.searchParams.get('error_description') || u.searchParams.get('error') || 'state mismatch'));
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1');
    setTimeout(() => {
      server.close();
      reject(new Error('timed out waiting for the browser (5 minutes)'));
    }, 300_000).unref();
  });
}

export async function login() {
  const meta = await discover();
  const saved = readJSON(AUTH, {});
  let port = null;
  for (const p of PORTS) {
    const free = await new Promise((r) => {
      const s = http.createServer().once('error', () => r(false)).once('listening', () => s.close(() => r(true))).listen(p, '127.0.0.1');
    });
    if (free) {
      port = p;
      break;
    }
  }
  if (!port) throw new Error(`ports ${PORTS.join(', ')} are busy; close whatever uses them and retry`);
  const redirect = `http://127.0.0.1:${port}/callback`;
  let client = saved.client && saved.client.issuer === meta.issuer && saved.client.redirect_uris?.includes(redirect) ? saved.client : null;
  if (!client) {
    if (!meta.registration_endpoint) throw new Error('the authorization server does not allow app registration');
    const reg = await getJSON(meta.registration_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Deno Studio kit', redirect_uris: PORTS.map((p) => `http://127.0.0.1:${p}/callback`), grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }),
    });
    client = { client_id: reg.client_id, redirect_uris: reg.redirect_uris || PORTS.map((p) => `http://127.0.0.1:${p}/callback`), issuer: meta.issuer };
  }
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  const auth = new URL(meta.authorization_endpoint);
  const params = { response_type: 'code', client_id: client.client_id, redirect_uri: redirect, code_challenge: challenge, code_challenge_method: 'S256', state, resource: meta.resource };
  if ((meta.scopes_supported || []).includes('openid')) params.scope = 'openid email';
  auth.search = new URLSearchParams(params).toString();
  const waiting = listen(port, state);
  info(`Opening your browser to sign in to Deno…\nIf it doesn't open, visit:\n${auth}`);
  if (!process.env.DENO_STUDIO_NO_BROWSER) openBrowser(String(auth));
  const code = await waiting;
  const tokens = await getJSON(meta.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirect, client_id: client.client_id, code_verifier: verifier }),
  });
  saveAuth({ client, token_endpoint: meta.token_endpoint, api: apiUrl(), access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: Date.now() + (tokens.expires_in || 3600) * 1000 });
  info('Signed in. The kit acts as you on your Deno account.');
}

export function logout() {
  const a = readJSON(AUTH, {});
  saveAuth({ client: a.client });
  info('Signed out (this machine).');
}

async function token() {
  if (process.env.DENO_TOKEN) return process.env.DENO_TOKEN;
  const a = readJSON(AUTH, {});
  if (!a.access_token) throw new Error('not signed in: run `studio login`');
  if (Date.now() < (a.expires_at || 0) - 60_000) return a.access_token;
  if (!a.refresh_token) throw new Error('session expired: run `studio login`');
  try {
    const t = await getJSON(a.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: a.refresh_token, client_id: a.client.client_id }),
    });
    saveAuth({ ...a, access_token: t.access_token, refresh_token: t.refresh_token || a.refresh_token, expires_at: Date.now() + (t.expires_in || 3600) * 1000 });
    return t.access_token;
  } catch (err) {
    throw new Error(`session expired (${err.message}): run \`studio login\``);
  }
}

export async function call(method, route, body) {
  const t = await token();
  try {
    return await getJSON(`${apiUrl()}/api/v1${route}`, {
      method,
      headers: { Authorization: `Bearer ${t}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (err.status === 401) warn('Deno says the session is not valid: run `studio login`.');
    throw err;
  }
}

export async function putFile(url, file, contentType) {
  const data = fs.readFileSync(file);
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType, 'x-upsert': 'false' }, body: data });
  if (!res.ok) throw new Error(`upload of ${path.basename(file)} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
}
