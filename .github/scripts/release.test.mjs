import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';

const workflow = readFileSync(new URL('../workflows/release.yml', import.meta.url), 'utf8');

// Only accept literal shell run blocks on identified steps; a changed YAML shape must not
// silently make these tests exercise a different command from the workflow.
function job(name) {
  const matches = [...workflow.matchAll(new RegExp(`^  ${name}:\\n`, 'gm'))];
  assert.equal(matches.length, 1, `expected one ${name} job`);
  const start = matches[0].index + matches[0][0].length;
  const end = workflow.slice(start).search(/^  [a-z][\w-]*:\s*$/m);
  return workflow.slice(start, end < 0 ? undefined : start + end);
}

function step(jobText, id) {
  const matches = [...jobText.matchAll(new RegExp(`^      - id: ${id}\\n`, 'gm'))];
  assert.equal(matches.length, 1, `expected one ${id} step`);
  const start = matches[0].index + matches[0][0].length;
  const end = jobText.slice(start).search(/^      - /m);
  const body = jobText.slice(start, end < 0 ? undefined : start + end);
  const run = body.match(/^        run: \|\n((?:(?:          [^\n]*|)\n)+)/m);
  assert.ok(run, `expected a literal shell run block on ${id}`);
  assert.equal(body.slice(body.indexOf('        run: |\n') + run[0].length).trim(), '', `unexpected content after ${id} run block`);
  return { metadata: body.slice(0, body.indexOf('        run: |\n')), script: run[1].replace(/^          /gm, '') };
}

const validate = job('validate');
const publish = job('publish');
const inputs = step(validate, 'release-inputs');
const source = step(validate, 'release-source');
const credentials = step(validate, 'release-credentials');
const publication = step(publish, 'release-publish');

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, { encoding: 'utf8', ...options });
  assert.ifError(result.error);
  return result;
}

function git(cwd, env, ...args) {
  const result = command('git', args, { cwd, env });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

function run(block, cwd, env, overrides = {}) {
  return command('bash', ['-c', block.script], { cwd, env: { ...env, ...overrides } });
}

function passes(result, label) {
  assert.equal(result.status, 0, `${label}: ${result.stderr || result.stdout}`);
}

function refuses(result, label) {
  assert.notEqual(result.status, 0, `${label}: unexpectedly succeeded`);
}

test('release workflow guards and local publication', async t => {
  const root = mkdtempSync(join(tmpdir(), 'lina-release-test-'));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
    assert.equal(existsSync(root), false, 'fixture directory removed');
  });
  const remote = join(root, 'remote.git');
  const checkout = join(root, 'checkout');
  const bin = join(root, 'bin');
  const log = join(root, 'gh.log');
  const summary = join(root, 'summary');
  mkdirSync(bin);
  writeFileSync(log, '');
  writeFileSync(summary, '');
  writeFileSync(join(bin, 'gh'), `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == api && "$2" == *actions/workflows/ci.yml/runs* ]]; then
  case "\${CI_CASE:-success}" in
    error) exit 1 ;;
    missing) printf '{"workflow_runs":[]}\\n' ;;
    *)
      sha="$RELEASE_SHA"; event=push; status=completed; conclusion=success; branch=dev
      case "$CI_CASE" in
        failed) conclusion=failure ;;
        running) status=in_progress ;;
        wrong-sha) sha=0000000000000000000000000000000000000000 ;;
        pr-only) event=pull_request ;;
        wrong-branch) branch=main ;;
        latest-failed) printf '{"workflow_runs":[{"head_sha":"%s","head_branch":"dev","event":"push","status":"completed","conclusion":"success","run_number":1},' "$sha" ;;
      esac
      if [[ "$CI_CASE" == latest-failed ]]; then
        printf '{"head_sha":"%s","head_branch":"dev","event":"push","status":"completed","conclusion":"failure","run_number":2}]}\\n' "$sha"
      else
        printf '{"workflow_runs":[{"head_sha":"%s","head_branch":"%s","event":"%s","status":"%s","conclusion":"%s","run_number":2}]}\\n' "$sha" "$branch" "$event" "$status" "$conclusion"
      fi
      ;;
  esac
elif [[ "$1" == api && "$2" == *releases/tags/* ]]; then
  case "\${RELEASE_CASE:-missing}" in
    missing) printf '{"status":"404"}\\n'; exit 1 ;;
    error) printf '{"status":"500"}\\n'; exit 1 ;;
    existing) printf '{"draft":false}\\n' ;;
    draft) printf '{"draft":true}\\n' ;;
    *) exit 90 ;;
  esac
elif [[ "$1" == release && "$2" == create ]]; then
  printf '%s\\n' "$*" >> "$GH_LOG"
else
  printf 'unexpected gh call: %s\\n' "$*" >&2; exit 90
fi
`);
  chmodSync(join(bin, 'gh'), 0o700);
  const env = {
    ...process.env,
    HOME: root,
    XDG_CONFIG_HOME: root,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'core.hooksPath',
    GIT_CONFIG_VALUE_0: '/dev/null',
    GIT_AUTHOR_NAME: 'Release Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Release Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    PATH: `${bin}${delimiter}${process.env.PATH}`,
    GH_LOG: log,
    GITHUB_STEP_SUMMARY: summary,
    GITHUB_REPOSITORY: 'fixture/repository',
    GITHUB_REF: 'refs/heads/dev',
    ACTOR: 'owner',
    TRIGGERING_ACTOR: 'owner',
    OWNER: 'owner',
    RELEASE_SHA: '',
    RELEASE_TAG: 'v0.1.0',
    RELEASE_NOTES: 'Fixture notes',
    RELEASE_TOKEN: 'fixture-only',
    CI_CASE: 'success',
    RELEASE_CASE: 'missing',
  };
  git(root, env, 'init', '--bare', '--initial-branch=main', remote);
  git(root, env, 'clone', remote, checkout);
  git(checkout, env, 'commit', '--allow-empty', '-m', 'base');
  const base = git(checkout, env, 'rev-parse', 'HEAD');
  git(checkout, env, 'push', 'origin', 'main');
  git(checkout, env, 'switch', '-c', 'dev');
  git(checkout, env, 'commit', '--allow-empty', '-m', 'candidate');
  const candidate = git(checkout, env, 'rev-parse', 'HEAD');
  env.RELEASE_SHA = candidate;
  git(checkout, env, 'push', 'origin', 'dev');
  const remoteRef = ref => git(root, env, '--git-dir', remote, 'rev-parse', ref);

  await t.test('owner, rerun actor, branch, SHA, tag and notes are validated', () => {
    passes(run(inputs, checkout, env), 'valid dispatch');
    passes(run(inputs, checkout, env, { RELEASE_TAG: 'v0.1.0-rc.1' }), 'prerelease');
    for (const [name, overrides] of Object.entries({
      caller: { ACTOR: 'intruder' }, rerun: { TRIGGERING_ACTOR: 'intruder' },
      branch: { GITHUB_REF: 'refs/heads/main' }, sha: { RELEASE_SHA: '1234567' },
      tag: { RELEASE_TAG: 'v0.1.0; false' }, notes: { RELEASE_NOTES: '   ' },
    })) refuses(run(inputs, checkout, env, overrides), name);
  });

  await t.test('source requires dev ancestry, main ancestry and successful exact-commit push CI', () => {
    passes(run(source, checkout, env), 'valid source');
    for (const ciCase of ['missing', 'failed', 'running', 'wrong-sha', 'pr-only', 'wrong-branch', 'latest-failed', 'error']) {
      refuses(run(source, checkout, env, { CI_CASE: ciCase }), ciCase);
    }
    git(checkout, env, 'tag', 'v0.2.0', base);
    refuses(run(source, checkout, env, { RELEASE_TAG: 'v0.2.0' }), 'tag collision');
    git(checkout, env, 'tag', 'v0.3.0', candidate);
    passes(run(source, checkout, env, { RELEASE_TAG: 'v0.3.0' }), 'matching tag');
    refuses(run(source, checkout, env, { RELEASE_SHA: base }), 'wrong checkout');
  });

  await t.test('dry_run gates all publication and real publication requires a secret', () => {
    assert.match(publish, /^    needs: validate$/m);
    assert.match(publish, /^    if: inputs\.dry_run == false$/m);
    assert.match(credentials.metadata, /^        if: inputs\.dry_run == false$/m);
    refuses(run(credentials, checkout, env, { RELEASE_TOKEN: '' }), 'missing token');
    passes(run(credentials, checkout, env), 'present token');
    passes(run(inputs, checkout, env), 'dry-run inputs');
    passes(run(source, checkout, env), 'dry-run source');
    assert.equal(remoteRef('main'), base);
    assert.notEqual(command('git', ['--git-dir', remote, 'show-ref', '--verify', '--quiet', 'refs/tags/v0.1.0'], { env }).status, 0);
    assert.equal(readFileSync(log, 'utf8'), '');
  });

  await t.test('API 500 refuses publication; successful publish fast-forwards main and same-tag retry works', () => {
    refuses(run(publication, checkout, env, { RELEASE_CASE: 'error' }), 'release API 500');
    assert.equal(remoteRef('main'), base);
    assert.equal(readFileSync(log, 'utf8'), '');
    passes(run(publication, checkout, env), 'publish');
    assert.equal(remoteRef('main'), candidate);
    assert.equal(remoteRef('refs/tags/v0.1.0'), candidate);
    assert.match(readFileSync(log, 'utf8'), /^release create v0\.1\.0 --verify-tag --target /);
    passes(run(publication, checkout, env, { RELEASE_CASE: 'existing' }), 'same-tag retry');
    refuses(run(publication, checkout, env, { RELEASE_CASE: 'draft' }), 'draft release');
    assert.equal(readFileSync(log, 'utf8').trim().split('\n').length, 1);
  });

  await t.test('old and divergent sources cannot advance main', () => {
    git(checkout, env, 'switch', '--detach', base);
    refuses(run(source, checkout, env, { RELEASE_SHA: base }), 'older than main');
    refuses(run(publication, checkout, env, { RELEASE_SHA: base, RELEASE_TAG: 'v0.4.0' }), 'publish older than main');
    git(checkout, env, 'switch', '-c', 'outside');
    git(checkout, env, 'commit', '--allow-empty', '-m', 'outside dev');
    const outside = git(checkout, env, 'rev-parse', 'HEAD');
    refuses(run(source, checkout, env, { RELEASE_SHA: outside }), 'outside dev');
    refuses(run(publication, checkout, env, { RELEASE_SHA: outside, RELEASE_TAG: 'v0.5.0' }), 'publish outside dev');
    assert.equal(remoteRef('main'), candidate);
    assert.equal(readFileSync(log, 'utf8').trim().split('\n').length, 1);
  });
});
