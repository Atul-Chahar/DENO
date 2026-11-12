// Heavy dependencies live in ~/.deno-studio/deps (never in the plugin folder, which is replaced on updates).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { HOME, info, run, which } from './util.mjs';

const KIT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PKG = JSON.parse(fs.readFileSync(path.join(KIT, 'package.json'), 'utf8'));
export const DEPS = path.join(HOME, 'deps');

function installed(name, version) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(DEPS, 'node_modules', name, 'package.json'), 'utf8'));
    return pkg.version === version;
  } catch {
    return false;
  }
}

export function missing(group) {
  const want = PKG.studioDeps[group] || {};
  return Object.entries(want).filter(([n, v]) => !installed(n, v));
}

/** Install a dependency group (core | voice | captions) into ~/.deno-studio/deps if any part is missing. */
export async function ensure(group) {
  const todo = missing(group);
  if (!todo.length) return;
  const npm = which('npm') || 'npm';
  fs.mkdirSync(DEPS, { recursive: true });
  // transformers.js depends on `sharp` for images, which we never use; its native build fails on new Node
  // versions. A local stub stands in for it so speech models install anywhere.
  const stub = path.join(DEPS, 'stubs', 'sharp');
  fs.mkdirSync(stub, { recursive: true });
  fs.writeFileSync(path.join(stub, 'package.json'), JSON.stringify({ name: 'sharp', version: '0.34.0-deno-stub', main: 'index.js' }));
  fs.writeFileSync(path.join(stub, 'index.js'), "module.exports = () => { throw new Error('image processing is not available in the Deno Studio kit'); };\n");
  const pkgFile = path.join(DEPS, 'package.json');
  const pkg = fs.existsSync(pkgFile) ? JSON.parse(fs.readFileSync(pkgFile, 'utf8')) : { name: 'deno-studio-deps', private: true, type: 'module' };
  pkg.overrides = { ...(pkg.overrides || {}), sharp: 'file:./stubs/sharp' };
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2));
  const specs = todo.map(([n, v]) => `${n}@${v}`);
  info(`Installing ${specs.join(' ')} into ${DEPS} (one time)…`);
  await run(npm, ['install', '--no-audit', '--no-fund', '--save-exact', ...specs], { cwd: DEPS, quiet: false });
}

export function requireDep(name) {
  return createRequire(path.join(DEPS, 'package.json'))(name);
}

/** Copy a worker script next to the deps so its bare imports resolve there, and return its path. */
export function worker(file) {
  const src = path.join(KIT, 'workers', file);
  const dest = path.join(DEPS, file);
  fs.copyFileSync(src, dest);
  return dest;
}

const SYSTEM_CHROMES = {
  linux: ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/snap/bin/chromium'],
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
  win32: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'],
};

/** A Chromium to drive: $DENO_STUDIO_CHROMIUM, a system Chrome/Chromium, or Playwright's own download. */
export async function chromiumPath({ install = true } = {}) {
  if (process.env.DENO_STUDIO_CHROMIUM) return process.env.DENO_STUDIO_CHROMIUM;
  for (const p of SYSTEM_CHROMES[process.platform] || []) if (fs.existsSync(p)) return p;
  const { chromium } = requireDep('playwright-core');
  let exe = '';
  try {
    exe = chromium.executablePath();
  } catch {
    /* not downloaded */
  }
  if (exe && fs.existsSync(exe)) return exe;
  if (!install) return null;
  info('Downloading Chromium for rendering (one time)…');
  await run(process.execPath, [path.join(DEPS, 'node_modules', 'playwright-core', 'cli.js'), 'install', 'chromium'], { quiet: false });
  return chromium.executablePath();
}
