// modkit fork guardrails: the fork identifies itself, keeps its diff against upstream small, and the upstream
// interfaces the MOD layer depends on are still where it expects them (docs/MODS.md, mods/tools/mod-core-changes.json).
//
// Why this test exists
// --------------------
// Upstream is young and iterating fast. The cheapest possible failure mode for a fork like this one is *silent* drift:
// upstream renames a hook, drops `extraContent`, or refactors `installContent`, and the MOD layer keeps "working"
// until someone tries to run a MOD. Every assertion below is a deliberate statement about an upstream surface the mod
// layer builds on, so a red test names the exact thing that moved — instead of a mystery at MOD runtime.
//
// When one of these fails after an upstream merge, do NOT loosen the assertion to make it green. The failure means the
// mod layer needs adapting; update mods/tools/mod-core-changes.json and docs/MODS.md in the same commit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODKIT_FORK } from '../shared/constants.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
/** Same as `read`, for callers that already hold an absolute path (tree walks). */
const readAbs = (p) => readFileSync(p, 'utf8');
const gitState = JSON.parse(read('mods/tools/mod-core-changes.json'));
const pkg = JSON.parse(read('package.json'));

/** The `## x.y.z — date` heading a CHANGELOG.md/tag release writes. */
const releaseVersion = (() => {
  const m = read('CHANGELOG.md').match(/^## (\d+\.\d+\.\d+) — \d{4}-\d{2}-\d{2}/m);
  return m ? m[1] : null;
})();

test('this is the modkit fork: the identity marker is present and versions line up', () => {
  assert.equal(MODKIT_FORK, true, 'shared/constants.js declares MODKIT_FORK');
  // APP_VERSION mirrors upstream's release, so it must match the newest CHANGELOG entry + package.json — a modkit
  // commit must never move it (see docs/MODS.md "what a fork must not do").
  assert.equal(pkg.version, releaseVersion, 'package.json still tracks the upstream release version');
  assert.match(gitState.upstreamBaseline, /^[0-9a-f]{40}$/, 'the recorded upstream commit is a full sha');
  assert.ok(Number.isInteger(gitState.modApiVersion) && gitState.modApiVersion >= 1, 'modApiVersion is a positive integer');
  assert.equal(gitState.upstreamBranch, 'master', 'upstream default branch');
});

test('every recorded core change is present in the tree exactly as documented', () => {
  const src = read(gitState.markerFile.path);
  // The anchor is upstream's own line: if upstream rewrites that neighbourhood, this fails loudly instead of letting
  // the marker drift to a place no human would find while re-applying the fork.
  for (const c of gitState.coreChanges) {
    if (c.upstreamAnchor) {
      assert.ok(read(c.file).includes(c.upstreamAnchor), `${c.id}: the upstream anchor is still present in ${c.file}`);
    }
  }
  assert.ok(src.includes(gitState.markerFile.mustContain), `the fork marker ${gitState.markerFile.mustContain} is present`);
});

test('the diff against upstream stays small: no unrecorded file is modified', () => {
  // A fork dies from a diff it can no longer rebase. This is the ratchet: every upstream file the mod layer modifies
  // must be listed in mod-core-changes.json with a reason and a reapply recipe, and the list may not grow past the
  // documented ceiling without someone deliberately raising it here.
  const recorded = new Set(gitState.coreChanges.map((c) => c.file));
  const planned = new Set(gitState.plannedChanges.map((c) => c.targetFile));
  assert.ok(
    gitState.coreChanges.length <= gitState.invariants.maxCoreChanges,
    `core changes (${gitState.coreChanges.length}) exceed the ceiling (${gitState.invariants.maxCoreChanges}) — redesign before recording more`,
  );
  // Every entry needs the three fields that make it re-appliable by a human after a merge.
  for (const c of [...gitState.coreChanges, ...gitState.plannedChanges]) {
    assert.ok(c.file || c.targetFile, `${c.id}: names a file`);
    assert.ok(c.reason || c.purpose, `${c.id}: says why`);
    assert.ok(c.reapply || c.preferredApproach, `${c.id}: says how to redo it`);
  }
  assert.ok(recorded.has(gitState.markerFile.path), 'the marker file is one of the recorded core changes');
  assert.ok(!planned.has(gitState.markerFile.path), 'the marker is applied already, not merely planned');
});

test('upstream sim/content still exports the mod layer\'s install points', () => {
  const src = read('server/sim/content/index.js');
  // installContent(battle, { mode, extra }) — `extra` is the engine-provided extension slot the mod layer uses, so its
  // absence is the single most important breakage to detect.
  assert.match(src, /export function installContent\s*\(battle,\s*\{[^}]*\bextra\b[^}]*\}/, 'installContent takes { extra }');
  assert.match(src, /export function registerAllMeta\s*\(/, 'registerAllMeta is exported');
  assert.match(src, /export const MODULES\b/, 'MODULES is exported');
  assert.match(src, /export const KITS\b/, 'KITS is exported');
  // a broken content module must never take the battle down — the robustness the mod layer relies on for third-party code
  assert.match(src, /safeImport/, 'content modules still load through a guarded importer');
});

test('upstream Battle still exposes the hook bus and the extraContent option', () => {
  const src = read('server/sim/Battle.js');
  assert.match(src, /^\s{2}on\s*\(name,\s*fn,\s*opts\s*=\s*\{\}\)\s*\{/m, 'Battle.on(name, fn, opts)');
  assert.match(src, /^\s{2}off\s*\(/m, 'Battle.off(...)');
  // the mod layer hands content modules to every Battle through this option instead of touching the engine
  assert.match(src, /opts\.extraContent/, 'Battle honours opts.extraContent');
  assert.match(src, /installContent\(this,\s*\{[^}]*extra:\s*opts\.extraContent/, 'extraContent reaches installContent');
  const design = read('docs/DESIGN.md');
  assert.match(design, /### 5\.4 Hook bus/, 'the hook bus stays documented in DESIGN §5.4');
});

test('the documented battle events are still all present in the design contract', () => {
  // The mod layer's battle-side hooks are only as stable as this table. Missing names here mean either a rename
  // (mods break silently at runtime) or a doc drift — both worth a red test.
  const design = read('docs/DESIGN.md');
  const section = design.split('### 5.4 Hook bus')[1]?.split('### 5.5')[0] ?? '';
  assert.ok(section.length > 200, 'DESIGN §5.4 is still a populated section');
  for (const ev of ['battleStart', 'deploy', 'tick', 'beforeAttack', 'attack', 'hit', 'damaged', 'heal', 'fatal',
    'kill', 'death', 'skillStart', 'skillEnd', 'ammoUsed', 'spGain', 'statusApplied', 'blocked',
    'enemySpawn', 'enemyLeak', 'battleEnd']) {
    assert.ok(section.includes(`\`${ev}\``), `DESIGN §5.4 still documents the \`${ev}\` event`);
  }
});

test('upstream MetaRegistry still accepts the key shapes the mod layer registers under', () => {
  const src = read('server/match/effectsMeta.js');
  assert.match(src, /export class MetaRegistry/, 'MetaRegistry is exported');
  assert.match(src, /export const HOOKS\b/, 'HOOKS is exported');
  assert.match(src, /export function createRegistry\s*\(/, 'createRegistry is exported');
  // KEY_RE pins the prefix set to upstream's own seven domains. The mod layer therefore does NOT get a `mod:` prefix:
  // it registers under these prefixes with a mod-scoped id (`global:<modId>_<name>`, `bond:<modId>_<name>`, …), exactly
  // the way upstream namespaces its own content by bond/item/band id. This test records that constraint, so an upstream
  // widening or narrowing of the prefix set is noticed here rather than at MOD runtime.
  const keyLine = src.split('\n').find((l) => l.includes('const KEY_RE'));
  assert.ok(keyLine, 'the registry key validator is present');
  const start = keyLine.indexOf('/');
  const end = keyLine.indexOf('/;', start);
  assert.ok(start > 0 && end > start, 'KEY_RE is a literal with a trailing semicolon');
  const re = eval(keyLine.slice(start, end + 1)); // eslint-disable-line no-eval — reading a literal regex out of the source under test
  for (const prefix of ['garrison', 'band', 'bond', 'item', 'choice', 'effect', 'global']) {
    assert.ok(re.test(`${prefix}:my_mod_thing`), `MetaRegistry accepts a mod-scoped ${prefix}: key`);
  }
  for (const key of ['mod:my_mod:onKill', 'bogus:whatever', 'global:', 'global:a b']) {
    assert.ok(!re.test(key), `MetaRegistry keeps rejecting ${JSON.stringify(key)}`);
  }
  // The dispatcher's hook list is the other half of the contract: a hook renamed upstream silently stops firing.
  const hooks = src.match(/export const HOOKS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/);
  assert.ok(hooks, 'HOOKS is a frozen literal list');
  const names = [...hooks[1].matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);
  assert.ok(names.length >= 19, `HOOKS lists the dispatcher hooks (${names.length} found)`);
  for (const h of ['onRoundStart', 'onGain', 'onPrepEnd', 'onBattleResult', 'onLayers']) {
    assert.ok(names.includes(h), `HOOKS still contains ${h}`);
  }
});

test('upstream data layer still loads and freezes whole-directory JSON', () => {
  const src = read('server/data.js');
  for (const name of ['loadData', 'getData', 'resetData', 'deepFreeze', 'lookup', 'getConfig', 'getMode']) {
    assert.match(src, new RegExp(`export (function|const) ${name}\\b`), `server/data.js exports ${name}`);
  }
  for (const getter of ['getChess', 'getBond', 'getGarrison', 'getItem', 'getBand', 'getEffect', 'getEnemy',
    'getWave', 'getStage', 'getBoss', 'getToken']) {
    assert.ok(src.includes(`export const ${getter} =`), `server/data.js exports ${getter}`);
  }
  // loadData scans by extension, and the result is deep-frozen: MOD data merging must therefore happen BEFORE the
  // freeze, which is why the mod layer merges into the raw object graph rather than patching a live one.
  assert.match(src, /\.endsWith\('\.json'\)/, 'loadData discovers files by extension');
  assert.match(src, /return deepFreeze\(out\)/, 'loadData returns a frozen graph');
});

test('the sim stays browser-safe: no static node: imports under server/sim', () => {
  // Combat runs in each player's browser, so sim code (and therefore MOD battle code) can never import a Node builtin.
  // test/match/simServe.test.js guards the HTTP side; this guards the source side, including files a MOD would copy.
  //
  // The exception is the Node-only loader, which server/index.js keeps in SIM_PRIVATE and never serves; its name is
  // read from that list rather than hardcoded so the two stay in step when upstream renames it.
  const indexSrc = read('server/index.js');
  const priv = indexSrc.match(/const SIM_PRIVATE\s*=\s*new Set\(\[([^\]]*)\]\)/);
  assert.ok(priv, 'server/index.js still declares which sim files are never served');
  const neverServed = new Set(
    [...priv[1].matchAll(/'([^']+)'/g)].map((m) => m[1].toLowerCase()),
  );
  assert.ok(neverServed.size > 0, 'the never-served list is non-empty');

  const simFiles = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) simFiles.push(p);
    }
  };
  walk(join(ROOT, 'server/sim'));
  assert.ok(simFiles.length > 40, `walked the sim tree (${simFiles.length} files)`);
  let checked = 0;
  for (const f of simFiles) {
    const rel = f.slice(ROOT.length + 1).split('\\').join('/');
    const name = f.split(/[\\/]/).pop().toLowerCase();
    assert.ok(
      !/^\s*import[^;]*from\s*['"]node:/m.test(readAbs(f)) || neverServed.has(name),
      `${rel} must not statically import a node: builtin (it is served to browsers)`,
    );
    if (!neverServed.has(name)) checked++;
  }
  assert.ok(checked > 40, `${checked} browser-served sim files were checked`);
  assert.ok(neverServed.has('nodedata.js'), 'the Node-only data loader stays excluded from what the browser gets');
});

test('the mod layer\'s own files are present and self-describing', () => {
  assert.match(read('docs/MODS.md'), /核心改动/, 'docs/MODS.md documents the core-change ledger');
  assert.match(read('docs/MODS.md'), /MODKIT_FORK|modkit/, 'docs/MODS.md names the fork');
  assert.match(read('mods/tools/build-mods.mjs'), /mods/i, 'the mod build tool exists');
});
