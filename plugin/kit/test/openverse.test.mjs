// Openverse: response parsing, the licence gate, anonymous vs registered calls, fetch + credits.
// Run: node --test plugin/kit/test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

// A private config home, so tests never read or write the founder's real ~/.deno-studio.
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-home-'));
process.env.DENO_STUDIO_HOME = HOME;
const { fetchOpenverse, openverseCommand, openverseHeaders, openverseItem, openverseUrl, searchOpenverse } = await import('../lib/sources.mjs');
const { config, setConfig } = await import('../lib/api.mjs');

const ID = 'eab8a6e2-0ac8-4615-9e0d-ebde30523783';
const IMAGE = {
  id: '4bc43a04-ef46-4544-a0c1-63c63f56e276',
  title: 'Laptop on a desk',
  url: 'https://live.staticflickr.com/1/laptop.jpg',
  thumbnail: 'https://api.openverse.org/v1/images/4bc43a04/thumb/',
  license: 'by',
  license_version: '2.0',
  creator: 'Ann',
  foreign_landing_url: 'https://www.flickr.com/photos/ann/1',
  filetype: 'jpeg',
  width: 1024,
  height: 768,
};
const SOUND = {
  id: ID,
  title: 'Deep Whoosh #1',
  url: 'https://cdn.freesound.org/previews/351/351256_2247456-hq.mp3',
  thumbnail: null,
  license: 'cc0',
  license_version: '1.0',
  creator: 'Kinoton',
  foreign_landing_url: 'https://freesound.org/people/Kinoton/sounds/351256',
  filetype: 'mp3',
  duration: 3155,
};

/** A fake fetch: routes by URL prefix, records every call. */
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const hit = Object.entries(routes).find(([prefix]) => String(url).startsWith(prefix));
    if (!hit) return new Response('not found', { status: 404 });
    const [status, body] = typeof hit[1] === 'function' ? hit[1](url, init) : hit[1];
    return body instanceof Uint8Array ? new Response(body, { status }) : new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  fn.calls = calls;
  return fn;
}

test('openverse: results map to Deno assets with credits', () => {
  const img = openverseItem(IMAGE, 'image');
  assert.deepEqual(
    { id: img.id, kind: img.kind, license: img.license, credit: img.credit, ext: img.ext, source_url: img.source_url, preview: img.preview_url, download: img.download_url },
    {
      id: `openverse:${IMAGE.id}`,
      kind: 'image',
      license: 'cc-by',
      credit: 'Ann via Openverse (by 2.0)',
      ext: 'jpg',
      source_url: 'https://www.flickr.com/photos/ann/1',
      preview: IMAGE.thumbnail,
      download: IMAGE.url,
    },
  );
  const sfx = openverseItem(SOUND, 'sfx');
  assert.equal(sfx.kind, 'sfx');
  assert.equal(sfx.license, 'cc0');
  assert.equal(sfx.duration, 3.2); // ms → s
  assert.equal(sfx.preview_url, SOUND.url); // no thumbnail: the file itself
  assert.equal(openverseItem({ ...SOUND, duration: 95_000 }).kind, 'music'); // kind unknown: by length
  assert.equal(openverseItem({ ...IMAGE, filetype: null }, 'image').ext, 'jpg'); // from the URL
  assert.equal(openverseItem({ ...IMAGE, license: 'by-sa' }, 'image').license, 'cc-by-sa');
  assert.equal(openverseItem({ ...IMAGE, license: 'pdm' }, 'image').license, 'cc0');
});

test('openverse: non-commercial and no-derivatives files are dropped', () => {
  for (const license of ['by-nc', 'by-nd', 'by-nc-sa', 'by-nc-nd', 'sampling+', '', undefined]) {
    assert.equal(openverseItem({ ...IMAGE, license }, 'image'), null, String(license));
  }
  assert.equal(openverseItem({ ...IMAGE, url: '' }, 'image'), null);
});

test('openverse: search URLs ask for commercial + modification and the right length', () => {
  const img = new URL(openverseUrl('image', 'laptop desk', 50));
  assert.equal(img.pathname, '/v1/images/');
  assert.equal(img.searchParams.get('q'), 'laptop desk');
  assert.equal(img.searchParams.get('license_type'), 'commercial,modification');
  assert.equal(img.searchParams.get('page_size'), '20'); // capped
  assert.equal(img.searchParams.get('length'), null);
  const sfx = new URL(openverseUrl('sfx', 'whoosh'));
  assert.equal(sfx.pathname, '/v1/audio/');
  assert.equal(sfx.searchParams.get('length'), 'shortest');
  assert.equal(new URL(openverseUrl('music', 'piano')).searchParams.get('length'), 'short,medium');
});

test('openverse: anonymous search sends no auth header and filters licences', async () => {
  const f = fakeFetch({ 'https://api.openverse.org/v1/images/': [200, { results: [IMAGE, { ...IMAGE, id: 'x', license: 'by-nd' }] }] });
  const got = await searchOpenverse('image', 'laptop', { fetchImpl: f });
  assert.deepEqual(got.map((r) => r.id), [`openverse:${IMAGE.id}`]);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].init.headers.Authorization, undefined);
  const limited = fakeFetch({ 'https://api.openverse.org/v1/audio/': [429, {}] });
  await assert.rejects(searchOpenverse('sfx', 'pop', { fetchImpl: limited }), /rate limit/);
  await assert.rejects(searchOpenverse('video', 'x', { fetchImpl: f }), /images, sfx and music/);
});

test('openverse: registered founders get a cached bearer token', async () => {
  setConfig('openverse_client_id', 'cid');
  setConfig('openverse_client_secret', 'secret');
  try {
    const f = fakeFetch({
      'https://api.openverse.org/v1/auth_tokens/token/': (url, init) => {
        const form = new URLSearchParams(init.body);
        assert.equal(form.get('grant_type'), 'client_credentials');
        assert.equal(form.get('client_id'), 'cid');
        return [200, { access_token: 'tok', expires_in: 36000 }];
      },
      'https://api.openverse.org/v1/images/': [200, { results: [IMAGE] }],
    });
    await searchOpenverse('image', 'laptop', { fetchImpl: f });
    assert.equal(f.calls.at(-1).init.headers.Authorization, 'Bearer tok');
    assert.deepEqual(await openverseHeaders(f), { Authorization: 'Bearer tok' }); // cached: no second token call
    assert.equal(f.calls.filter((c) => c.url.includes('auth_tokens/token')).length, 1);
    // Not verified yet → the token call fails → anonymous, not an error.
    setConfig('openverse_token', undefined);
    const failing = fakeFetch({ 'https://api.openverse.org/v1/auth_tokens/token/': [401, { error: 'unverified' }] });
    assert.deepEqual(await openverseHeaders(failing), {});
  } finally {
    for (const k of ['openverse_client_id', 'openverse_client_secret', 'openverse_token', 'openverse_token_expires']) setConfig(k, undefined);
  }
});

test('openverse: fetch downloads into assets/ and records the credit', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-ov-'));
  try {
    fs.writeFileSync(path.join(dir, 'film.json'), JSON.stringify({ kind: 'video', assets: [] }));
    const bytes = new Uint8Array([73, 68, 51, 4]);
    const f = fakeFetch({
      [`https://api.openverse.org/v1/images/${ID}/`]: [404, {}],
      [`https://api.openverse.org/v1/audio/${ID}/`]: [200, SOUND],
      'https://cdn.freesound.org/': [200, bytes],
    });
    const item = await fetchOpenverse(dir, { _: ['fetch', `openverse:${ID}`], as: 'whoosh' }, f);
    const file = path.join('assets', 'sfx', `openverse-${ID}.mp3`);
    assert.equal(item.kind, 'sfx');
    assert.deepEqual([...fs.readFileSync(path.join(dir, file))], [...bytes]);
    const film = JSON.parse(fs.readFileSync(path.join(dir, 'film.json'), 'utf8'));
    assert.equal(film.sfx.whoosh, file);
    assert.deepEqual(film.assets[0], { id: `openverse:${ID}`, kind: 'sfx', file, source: 'openverse', license: 'cc0', credit: 'Kinoton via Openverse (cc0 1.0)', source_url: SOUND.foreign_landing_url });
    const credits = JSON.parse(fs.readFileSync(path.join(dir, 'CREDITS.json'), 'utf8'));
    assert.deepEqual(credits, [{ id: `openverse:${ID}`, file, license: 'cc0', credit: 'Kinoton via Openverse (cc0 1.0)', source_url: SOUND.foreign_landing_url }]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('openverse: register saves credentials and asks for the email link', async () => {
  try {
    const f = fakeFetch({
      'https://api.openverse.org/v1/auth_tokens/register/': (url, init) => {
        const body = JSON.parse(init.body);
        assert.equal(body.email, 'founder@example.com');
        assert.match(body.name, /^deno-studio-[0-9a-f]{8}$/);
        return [201, { name: body.name, client_id: 'new-id', client_secret: 'new-secret' }];
      },
    });
    await openverseCommand({ _: ['openverse', 'register', 'founder@example.com'] }, f);
    assert.equal(config().openverse_client_id, 'new-id');
    assert.equal(config().openverse_client_secret, 'new-secret');
    assert.equal((fs.statSync(path.join(HOME, 'config.json')).mode & 0o777).toString(8), '600');
  } finally {
    for (const k of ['openverse_client_id', 'openverse_client_secret']) setConfig(k, undefined);
  }
});

test.after(() => fs.rmSync(HOME, { recursive: true, force: true }));
