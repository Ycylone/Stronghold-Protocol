// mods/tools/build-mods.mjs — scan, validate and index the community MODs under mods/ (docs/MODS.md §3).
//
//   node mods/tools/build-mods.mjs --list          human-readable summary of every MOD found
//   node mods/tools/build-mods.mjs --check         validate and exit non-zero on any problem (CI / pre-commit)
//   node mods/tools/build-mods.mjs --json          print the generated index as JSON (what the server will load)
//   node mods/tools/build-mods.mjs --write         write mods/.mods-index.json (the generated index)
//
// Why a separate tool rather than logic inside the server: the scan/validate rules are the contract MOD authors are
// held to, so they must be runnable — and testable — without booting a game server. The runtime loader (P1) will import
// `scanMods()` from here so the rules live in exactly one place.
//
// A MOD is a directory directly under mods/ containing a `mod.json` manifest:
//
//   {
//     "id": "endless_night",              // required, ^[A-Za-z0-9_-]{1,64}$, must equal the directory name
//     "name": "无尽长夜",                  // required, shown in game
//     "version": "1.0.0",                 // required, semver-ish
//     "apiVersion": 1,                    // required, the mod API generation it is written against
//     "author": "someone",                // optional
//     "description": "把回合数改成 20",      // optional
//     "dependencies": ["other_mod"]       // optional, other MOD ids that must load first
//   }
//
// Any other *.json file in the MOD directory is data the MOD wants to merge over the game's data/ (P1). Extra keys in
// the manifest are preserved, not rejected — a newer MOD may carry fields an older loader ignores.
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root (…/开发目录). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The directory MODs live in. */
export const MODS_DIR = join(ROOT, 'mods');

/** The generated index the runtime loader reads. */
export const INDEX_FILE = join(MODS_DIR, '.mods-index.json');

/** The MOD API generation this loader implements (docs/MODS.md §4). */
export const MOD_API_VERSION = 1;

/** Directory names under mods/ that are ours, never a MOD. */
const RESERVED = new Set(['tools', 'node_modules', '.git']);

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const VERSION_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

/**
 * Validate a parsed manifest. Never throws.
 * @param {any} m parsed mod.json
 * @param {string} dirName the MOD's directory name (must equal the id)
 * @param {string} file path shown in messages
 * @returns {string[]} problems (empty = valid)
 */
export function validateManifest(m, dirName, file = 'mod.json') {
  const bad = [];
  if (!m || typeof m !== 'object' || Array.isArray(m)) return [`${file}: not a JSON object`];
  const str = (k) => (typeof m[k] === 'string' && m[k].trim() ? m[k].trim() : null);
  const id = str('id');
  if (!id) bad.push(`${file}: "id" is required and must be a non-empty string`);
  else if (!ID_RE.test(id)) bad.push(`${file}: "id" must match ${ID_RE} (letters, digits, _ and -, max 64)`);
  else if (id !== dirName) bad.push(`${file}: "id" is "${id}" but the directory is "${dirName}" — they must match`);
  if (!str('name')) bad.push(`${file}: "name" is required (the display name players see)`);
  const v = str('version');
  if (!v) bad.push(`${file}: "version" is required`);
  else if (!VERSION_RE.test(v)) bad.push(`${file}: "version" must look like 1.0.0 (got "${v}")`);
  if (!Number.isInteger(m.apiVersion) || m.apiVersion < 1) {
    bad.push(`${file}: "apiVersion" is required and must be a positive integer (this loader implements ${MOD_API_VERSION})`);
  } else if (m.apiVersion > MOD_API_VERSION) {
    bad.push(`${file}: "apiVersion" ${m.apiVersion} is newer than this loader's ${MOD_API_VERSION} — update the modkit fork`);
  }
  if (m.dependencies !== undefined) {
    if (!Array.isArray(m.dependencies) || m.dependencies.some((d) => typeof d !== 'string' || !ID_RE.test(d))) {
      bad.push(`${file}: "dependencies" must be an array of MOD ids`);
    }
  }
  return bad;
}

/**
 * Scan mods/ for MOD directories. Never throws: an unreadable directory or a broken manifest becomes a `problem`
 * entry so `--check` can report every issue at once instead of stopping at the first.
 * @returns {{ mods: object[], problems: string[] }}
 */
export function scanMods(dir = MODS_DIR) {
  /** @type {object[]} */
  const mods = [];
  const problems = [];
  if (!existsSync(dir)) return { mods, problems }; // no MODs installed is not an error
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return { mods, problems: [`cannot read ${dir}: ${e.message}`] };
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (RESERVED.has(e.name) || e.name.startsWith('.')) continue;
    const modDir = join(dir, e.name);
    const manifestPath = join(modDir, 'mod.json');
    if (!existsSync(manifestPath)) {
      problems.push(`${e.name}/: no mod.json — a MOD directory must contain a manifest (delete the folder if it is not a MOD)`);
      continue;
    }
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (err) {
      problems.push(`${e.name}/mod.json: invalid JSON — ${err.message}`);
      continue;
    }
    const bad = validateManifest(manifest, e.name, `${e.name}/mod.json`);
    if (bad.length) {
      problems.push(...bad);
      continue;
    }
    // data files = every *.json except the manifest itself; code entry = index.js when present (P2+)
    let dataFiles = [];
    let hasCode = false;
    let bytes = 0;
    const stack = [modDir];
    while (stack.length) {
      const d = stack.pop();
      let kids = [];
      try { kids = readdirSync(d, { withFileTypes: true }); } catch { continue; }
      for (const k of kids) {
        const p = join(d, k.name);
        if (k.isDirectory()) { stack.push(p); continue; }
        try { bytes += statSync(p).size; } catch { /* ignore */ }
        if (k.name === 'index.js') hasCode = true;
        else if (k.name.endsWith('.json') && p !== manifestPath) dataFiles.push(relative(modDir, p).split('\\').join('/'));
      }
    }
    dataFiles.sort();
    mods.push({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      apiVersion: manifest.apiVersion,
      author: typeof manifest.author === 'string' ? manifest.author : null,
      description: typeof manifest.description === 'string' ? manifest.description : null,
      dependencies: Array.isArray(manifest.dependencies) ? [...manifest.dependencies] : [],
      dir: e.name,
      dataFiles,
      hasCode,
      bytes,
      manifest,
    });
  }
  mods.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // duplicate ids cannot happen while id must equal the directory name (directory names are unique), but keep the
  // check: it is the invariant the runtime loader keys on, and it costs nothing.
  const seen = new Set();
  for (const m of mods) {
    if (seen.has(m.id)) problems.push(`duplicate MOD id "${m.id}"`);
    seen.add(m.id);
  }
  // dependency sanity: must exist, and must not be self-referential
  for (const m of mods) {
    for (const d of m.dependencies) {
      if (d === m.id) problems.push(`${m.id}/mod.json: depends on itself`);
      else if (!seen.has(d)) problems.push(`${m.id}/mod.json: dependency "${d}" is not installed`);
    }
  }
  return { mods, problems };
}

/**
 * Topologically sort MODs so dependencies load first (stable for independent MODs: id order).
 * `scanMods` already reported missing dependencies; a cycle is reported here and broken by id order.
 * @param {object[]} mods
 * @returns {{ order: object[], problems: string[] }}
 */
export function loadOrder(mods) {
  const byId = new Map(mods.map((m) => [m.id, m]));
  const problems = [];
  const out = [];
  const state = new Map(); // id → 'visiting' | 'done'
  const visit = (m, chain) => {
    const s = state.get(m.id);
    if (s === 'done') return;
    if (s === 'visiting') {
      problems.push(`dependency cycle: ${[...chain, m.id].join(' → ')} (broken by id order)`);
      return;
    }
    state.set(m.id, 'visiting');
    for (const d of m.dependencies) {
      const dep = byId.get(d);
      if (dep) visit(dep, [...chain, m.id]);
    }
    state.set(m.id, 'done');
    out.push(m);
  };
  for (const m of mods) visit(m, []);
  return { order: out, problems };
}

/**
 * The index the runtime loader consumes: metadata plus load order, with no absolute paths (the server joins them).
 * @param {object[]} mods
 */
export function buildIndex(mods, { order } = {}) {
  const ordered = (order ?? loadOrder(mods).order).map((m) => m.id);
  return {
    modApiVersion: MOD_API_VERSION,
    generatedBy: 'mods/tools/build-mods.mjs',
    count: mods.length,
    order: ordered,
    mods: mods.map((m) => ({
      id: m.id,
      name: m.name,
      version: m.version,
      apiVersion: m.apiVersion,
      author: m.author,
      description: m.description,
      dependencies: m.dependencies,
      dir: m.dir,
      dataFiles: m.dataFiles,
      hasCode: m.hasCode,
    })),
  };
}

// ---- CLI ---------------------------------------------------------------------------------------------------------
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const args = process.argv.slice(2);
  const has = (f) => args.includes(f);
  const { mods, problems } = scanMods();
  const { order, problems: orderProblems } = loadOrder(mods);
  const allProblems = [...problems, ...orderProblems];

  if (has('--json')) {
    process.stdout.write(JSON.stringify(buildIndex(mods, { order }), null, 2) + '\n');
  } else if (has('--write')) {
    writeFileSync(INDEX_FILE, JSON.stringify(buildIndex(mods, { order }), null, 2) + '\n');
    console.log(`wrote ${relative(ROOT, INDEX_FILE)} (${mods.length} MOD${mods.length === 1 ? '' : 's'})`);
  } else {
    console.log(`mods/ 扫描结果 —— MOD API v${MOD_API_VERSION}`);
    console.log(`目录: ${MODS_DIR}`);
    console.log('');
    if (!mods.length) {
      console.log('  （还没有安装任何 MOD）');
      console.log('');
      console.log('  想做一个的话：在 mods/ 下新建一个文件夹，里面放 mod.json，然后跑 --check 校验。');
      console.log('  字段说明见 docs/MODS.md，或跑 --help。');
    } else {
      for (const m of order) {
        const kb = (m.bytes / 1024).toFixed(1);
        console.log(`  ${m.id}  v${m.version}  「${m.name}」`);
        if (m.author) console.log(`      作者: ${m.author}`);
        if (m.description) console.log(`      说明: ${m.description}`);
        if (m.dependencies.length) console.log(`      依赖: ${m.dependencies.join(', ')}`);
        console.log(`      内容: ${m.dataFiles.length} 个数据文件${m.hasCode ? ' + 代码' : ''} (${kb} KB)`);
      }
    }
    console.log('');
    if (allProblems.length) {
      console.log(`发现 ${allProblems.length} 个问题:`);
      for (const p of allProblems) console.log(`  ✗ ${p}`);
    } else {
      console.log('✅ 没有问题');
    }
  }
  if (has('--check') && allProblems.length) process.exitCode = 1;
  if (has('--check') && !allProblems.length) console.log('✅ --check 通过');
}
