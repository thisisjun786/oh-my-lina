import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { scopeFor } from './ci-scope.mjs';

function repository(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'lina-scope-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const env = {
    ...process.env, HOME: cwd, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.hooksPath', GIT_CONFIG_VALUE_0: '/dev/null',
    GIT_AUTHOR_NAME: 'CI Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'CI Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  };
  const git = (...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '--initial-branch=dev');
  writeFileSync(join(cwd, 'README.md'), '# Fixture\n');
  git('add', '.');
  git('commit', '-m', 'baseline');
  const base = git('rev-parse', 'HEAD');
  const commit = () => {
    git('add', '-A');
    git('commit', '-m', 'fixture change');
    return git('rev-parse', 'HEAD');
  };
  const classify = (head, options = {}) => scopeFor({ base, head, event: 'pull_request', baseRef: 'dev', cwd, ...options });
  return { cwd, base, git, commit, classify };
}

test('a real document-only Git diff excludes automation on PR and dev push', t => {
  const r = repository(t);
  writeFileSync(join(r.cwd, 'README.md'), '# Changed document\n');
  const head = r.commit();
  for (const event of ['pull_request', 'push']) {
    const scope = r.classify(head, { event });
    assert.equal(scope.mode, 'docs');
    assert.equal(scope.docs, true);
    assert.equal(scope.automation, false);
    assert.deepEqual(scope.changed, ['README.md']);
    assert.deepEqual(scope.unmapped, []);
  }
  assert.equal(r.classify(head, { event: 'workflow_dispatch' }).automation, true);
});

test('a design document added directly under docs/design excludes automation on PR and dev push', t => {
  const r = repository(t);
  mkdirSync(join(r.cwd, 'docs/design'), { recursive: true });
  writeFileSync(join(r.cwd, 'docs/design/example.md'), '# Design\n');
  const head = r.commit();
  for (const event of ['pull_request', 'push']) {
    const scope = r.classify(head, { event });
    assert.equal(scope.mode, 'docs');
    assert.equal(scope.docs, true);
    assert.equal(scope.automation, false);
    assert.deepEqual(scope.unmapped, []);
    assert.deepEqual(scope.changed, ['docs/design/example.md']);
  }
});

test('modifying, renaming, and deleting a design document stay documentation-only', t => {
  const r = repository(t);
  mkdirSync(join(r.cwd, 'docs/design'), { recursive: true });
  writeFileSync(join(r.cwd, 'docs/design/example.md'), '# Design\n');
  const added = r.commit();
  writeFileSync(join(r.cwd, 'docs/design/example.md'), '# Revised design\n');
  const modified = r.commit();
  renameSync(join(r.cwd, 'docs/design/example.md'), join(r.cwd, 'docs/design/renamed.md'));
  const renamed = r.commit();
  rmSync(join(r.cwd, 'docs/design/renamed.md'));
  const deleted = r.commit();
  const steps = [
    [added, modified, ['docs/design/example.md']],
    [modified, renamed, ['docs/design/example.md', 'docs/design/renamed.md']],
    [renamed, deleted, ['docs/design/renamed.md']],
  ];
  for (const [previousHead, head, changed] of steps) {
    for (const event of ['pull_request', 'push']) {
      const scope = r.classify(head, { base: previousHead, event });
      assert.equal(scope.mode, 'docs');
      assert.equal(scope.automation, false);
      assert.deepEqual(scope.unmapped, []);
      assert.deepEqual(scope.changed, changed);
    }
  }
});

for (const path of ['docs/design/example.mjs', 'docs/design/nested/example.md', 'docs/designer/example.md', 'docs/design/example.MD']) {
  test(`${path} is not a registered design document`, t => {
    const r = repository(t);
    mkdirSync(join(r.cwd, path, '..'), { recursive: true });
    writeFileSync(join(r.cwd, path), 'fixture\n');
    const scope = r.classify(r.commit());
    assert.equal(scope.mode, 'full');
    assert.equal(scope.reason, 'unmapped-paths');
    assert.deepEqual(scope.unmapped, [path]);
  });
}

test('a design document with a workflow change selects both checks', t => {
  const r = repository(t);
  mkdirSync(join(r.cwd, 'docs/design'), { recursive: true });
  mkdirSync(join(r.cwd, '.github/workflows'), { recursive: true });
  writeFileSync(join(r.cwd, 'docs/design/example.md'), '# Design\n');
  writeFileSync(join(r.cwd, '.github/workflows/ci.yml'), 'name: fixture\n');
  const scope = r.classify(r.commit());
  assert.equal(scope.docs, true);
  assert.equal(scope.automation, true);
  assert.deepEqual(scope.unmapped, []);
});

test('workflow changes and shared configuration select both checks', t => {
  const r = repository(t);
  mkdirSync(join(r.cwd, '.github/workflows'), { recursive: true });
  writeFileSync(join(r.cwd, '.github/workflows/ci.yml'), 'name: fixture\n');
  writeFileSync(join(r.cwd, '.gitignore'), 'output/\n');
  const scope = r.classify(r.commit());
  assert.equal(scope.mode, 'full');
  assert.equal(scope.docs, true);
  assert.equal(scope.automation, true);
  assert.deepEqual(scope.unmapped, []);
});

test('a renamed document cannot hide an unregistered product file', t => {
  const r = repository(t);
  renameSync(join(r.cwd, 'README.md'), join(r.cwd, 'prompt.md'));
  const scope = r.classify(r.commit());
  assert.deepEqual(scope.changed, ['README.md', 'prompt.md']);
  assert.deepEqual(scope.unmapped, ['prompt.md']);
  assert.equal(scope.automation, true);
});

test('deletions stay in the diff, and an empty diff or missing base selects full', t => {
  const r = repository(t);
  rmSync(join(r.cwd, 'README.md'));
  const head = r.commit();
  assert.deepEqual(r.classify(head).changed, ['README.md']);
  assert.equal(r.classify(head, { base: head }).mode, 'full');
  assert.equal(r.classify(head, { base: '' }).reason, 'base-unavailable');
  assert.equal(r.classify(head, { base: 'does-not-exist' }).mode, 'full');
  assert.throws(() => r.classify('does-not-exist'));
});

test('unmapped tracked code stays uncovered even if this diff only changes a document', t => {
  const r = repository(t);
  writeFileSync(join(r.cwd, 'unverified.mjs'), 'throw new Error("unverified");\n');
  const base = r.commit();
  writeFileSync(join(r.cwd, 'README.md'), '# Document only\n');
  const scope = r.classify(r.commit(), { base });
  assert.deepEqual(scope.unmapped, ['unverified.mjs']);
  assert.equal(scope.automation, true);
});

test('main-target PRs and unsupported events fail before classifying', t => {
  const r = repository(t);
  assert.throws(() => r.classify(r.base, { baseRef: 'main' }));
  assert.throws(() => r.classify(r.base, { event: 'unknown' }));
});
