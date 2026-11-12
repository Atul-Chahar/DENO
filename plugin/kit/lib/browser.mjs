// Serve the project folder and drive its page in headless Chromium: open, wait for window.ready, seek(t), screenshot.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromiumPath, ensure, requireDep } from './deps.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.gif': 'image/gif', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.txt': 'text/plain',
};

export async function serve(root) {
  const base = path.resolve(root);
  const server = http.createServer((req, res) => {
    let file;
    try {
      file = path.join(base, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    } catch {
      res.writeHead(400);
      return res.end();
    }
    if (file.endsWith(path.sep)) file = path.join(file, 'index.html');
    if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}

// Belt and braces for the render contract: in render mode, wall-clock APIs are frozen so a film that reads them
// at least renders the same frame every time (and `studio verify` reports that it did).
const FREEZE = `(() => {
  if (!location.search.includes('render=1')) return;
  window.__studioClockReads = 0;
  const t0 = 1700000000000;
  Date.now = () => { window.__studioClockReads++; return t0; };
  const perf = performance.now.bind(performance);
  performance.now = () => { window.__studioClockReads++; return 0; };
  let seed = 42;
  Math.random = () => { window.__studioClockReads++; seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  window.requestAnimationFrame = () => 0;
  window.__studioPerf = perf;
})();`;

export class Film {
  static async open(dir, fmt, { scale = 1, gpu = true } = {}) {
    await ensure('core');
    const { chromium } = requireDep('playwright-core');
    const executablePath = await chromiumPath();
    const args = ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none', '--hide-scrollbars', '--mute-audio'];
    if (gpu && process.platform === 'linux') args.push('--use-angle=gl-egl', '--enable-gpu-rasterization');
    if (gpu && process.platform === 'darwin') args.push('--use-angle=metal');
    const browser = await chromium.launch({ executablePath, args });
    const site = await serve(dir);
    const f = new Film(browser, site, fmt, scale);
    return f;
  }

  constructor(browser, site, fmt, scale) {
    this.browser = browser;
    this.site = site;
    this.fmt = fmt;
    this.scale = scale;
    this.errors = [];
  }

  async page() {
    const w = Math.round(this.fmt.w * this.scale);
    const h = Math.round(this.fmt.h * this.scale);
    const page = await this.browser.newPage({ viewport: { width: this.fmt.w, height: this.fmt.h }, deviceScaleFactor: this.scale });
    page.on('pageerror', (e) => this.errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && this.errors.push(`console: ${m.text()}`));
    page.on('requestfailed', (r) => this.errors.push(`request failed: ${r.url()}`));
    page.on('response', (r) => r.status() >= 400 && !r.url().endsWith('/favicon.ico') && this.errors.push(`${r.status()} for ${r.url().replace(this.site.url, '')}`));
    await page.addInitScript(FREEZE);
    const q = new URLSearchParams({ render: '1', ratio: this.fmt.ratio, w: String(this.fmt.w), h: String(this.fmt.h) });
    await page.goto(`${this.site.url}/index.html?${q}`, { waitUntil: 'load', timeout: 60_000 });
    await page.evaluate(() => (window.ready ? Promise.resolve(window.ready) : null));
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const ok = await page.evaluate(() => typeof window.seek === 'function');
    if (!ok) throw new Error('index.html must define window.seek(t)');
    page.__size = { w, h };
    return page;
  }

  async meta(page) {
    return page.evaluate(() => ({
      duration: Number(window.DURATION || 0),
      pages: Number(window.PAGES || 0),
      cues: Array.isArray(window.CUES) ? window.CUES : [],
      chapters: Array.isArray(window.CHAPTERS) ? window.CHAPTERS : [],
      clockReads: window.__studioClockReads || 0,
    }));
  }

  async grab(page, t, type = 'png') {
    await page.evaluate((x) => window.seek(x), t);
    return page.screenshot({ type, quality: type === 'jpeg' ? 92 : undefined, clip: { x: 0, y: 0, width: this.fmt.w, height: this.fmt.h }, animations: 'disabled', caret: 'hide' });
  }

  async close() {
    await this.browser.close().catch(() => undefined);
    await this.site.close();
  }
}
