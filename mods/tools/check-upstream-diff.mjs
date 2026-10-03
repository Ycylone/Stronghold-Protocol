// mods/tools/check-upstream-diff.mjs — the REAL "is our diff against upstream still small?" check.
//
//   node mods/tools/check-upstream-diff.mjs            # report and exit non-zero on anything unrecorded
//   node mods/tools/check-upstream-diff.mjs --quiet    # exit code only
//
// Why this is a tool and not a unit test
// --------------------------------------
// test/modkit-compat.test.js is deliberately git-free: it must run in release bundles and CI checkouts that have no
// history and no `upstream` remote. But the fork's central promise — "we add files, we barely touch upstream's" — can
// only be verified against the actual diff. So the git-dependent half lives here, where it can fail loudly without
// making the test suite environment-sensitive.
//
// Run this:
//   * before merging an upstream update (to see what the merge would have to preserve),
//   * after adding any feature (to catch an accidental edit to an upstream file),
//   * whenever `交接/PROGRESS.md` §7 tells you to.
//
// What "unrecorded" means: a file that exists in upstream's baseline AND differs in our branch, but is not listed in
// mod-core-changes.json. That is exactly the situation that silently turns a fork into an unmergeable fork.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LEDGER = join(ROOT, 'mods', 'tools', 'mod-core-changes.json');

/** Run git and return stdout lines; null when the command fails (no git, no such ref, not a repo). */
function git(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {
    return null;
  }
}

const quiet = process.argv.includes('--quiet');
const say = (...a) => { if (!quiet) console.log(...a); };
const problems = [];

// ---- preconditions -----------------------------------------------------------------------------------------------
if (!existsSync(join(ROOT, '.git'))) {
  say('not a git working tree — nothing to compare (this is normal for a release bundle).');
  process.exit(0);
}
const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
const baseline = ledger.upstreamBaseline;

if (!git('rev-parse', '--verify', `${baseline}^{commit}`)) {
  problems.push(`the recorded upstream baseline ${baseline.slice(0, 7)} is not in this repository — run \`git fetch upstream\``);
}
const branch = git('rev-parse', '--abbrev-ref', 'HEAD')?.[0] ?? '(unknown)';

// ---- the actual comparison ---------------------------------------------------------------------------------------
let changed = [];
let filesInBaseline = new Set();
if (!problems.length) {
  const names = git('diff', '--name-only', baseline, 'HEAD');
  if (names === null) problems.push('`git diff` failed');
  else changed = names;
  const tree = git('ls-tree', '-r', '--name-only', baseline);
  if (tree) filesInBaseline = new Set(tree);
}

// Split the changed files into the three categories that matter.
const recorded = new Set(ledger.coreChanges.map((c) => c.file));
const modifiedUpstream = changed.filter((f) => filesInBaseline.has(f));   // we edited something upstream wrote
const added = changed.filter((f) => !filesInBaseline.has(f));             // our own new files
const unrecorded = modifiedUpstream.filter((f) => !recorded.has(f));
const phantom = [...recorded].filter((f) => !modifiedUpstream.includes(f)); // ledger claims a change that is not there

say(`branch            ${branch}`);
say(`upstream baseline ${baseline.slice(0, 7)}`);
say(`core-change ceiling ${ledger.invariants.maxCoreChanges}`);
say('');
say(`upstream files modified : ${modifiedUpstream.length}`);
for (const f of modifiedUpstream) say(`   ${recorded.has(f) ? '✔' : '✘'} ${f}`);
say(`our own new files       : ${added.length}`);
say('');

if (unrecorded.length) {
  problems.push(
    `${unrecorded.length} upstream file(s) modified but NOT in the ledger: ${unrecorded.join(', ')}\n` +
    '     Either revert the edit, or add an entry to mods/tools/mod-core-changes.json with a reason and a reapply recipe.',
  );
}
if (phantom.length) {
  problems.push(`the ledger lists ${phantom.join(', ')} as changed, but it is identical to upstream — drop the entry or explain it`);
}
if (ledger.coreChanges.length > ledger.invariants.maxCoreChanges) {
  problems.push(`core changes (${ledger.coreChanges.length}) exceed the ceiling (${ledger.invariants.maxCoreChanges}) — redesign instead of raising it`);
}
for (const c of ledger.coreChanges) {
  if (!filesInBaseline.has(c.file)) problems.push(`ledger entry ${c.id}: ${c.file} is not a file upstream has`);
}

if (problems.length) {
  say('PROBLEMS');
  for (const p of problems) say(`  ✘ ${p}`);
  say('');
  say('The whole point of this fork is a diff small enough to keep merging. Fix these before continuing.');
  process.exitCode = 1;
} else {
  say(`✅ ledger and diff agree — ${modifiedUpstream.length} upstream file(s) modified, all recorded, ceiling ${ledger.invariants.maxCoreChanges}.`);
}
