import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { evaluateGate } from './ci-gate.mjs';

const scope = { mode: 'full', head: '1'.repeat(40), docs: true, automation: true, unmapped: [] };
const passed = { selection: { result: 'success' }, docs: { result: 'success' }, automation: { result: 'success' } };

test('selected checks all succeed and intentional docs-only skipping is accepted', () => {
  assert.equal(evaluateGate(scope, passed).result, 'success');
  assert.equal(evaluateGate({ ...scope, mode: 'docs', automation: false }, {
    ...passed, automation: { result: 'skipped' },
  }).result, 'success');
});

test('every selected failed, cancelled, skipped, missing or pending job blocks foundation', () => {
  for (const name of ['selection', 'docs', 'automation']) {
    for (const status of ['failure', 'cancelled', 'skipped', 'pending', undefined]) {
      const needs = { ...passed, [name]: status ? { result: status } : undefined };
      assert.equal(evaluateGate(scope, needs).result, 'failure', `${name}: ${status}`);
    }
  }
});

test('uncovered files, invalid selection and unexpected unselected jobs cannot pass', () => {
  assert.equal(evaluateGate({ ...scope, unmapped: ['new-product.mjs'] }, passed).result, 'failure');
  assert.equal(evaluateGate({ ...scope, docs: false }, passed).result, 'failure');
  assert.equal(evaluateGate({ ...scope, automation: 'false' }, passed).result, 'failure');
  assert.equal(evaluateGate({ ...scope, automation: false }, passed).result, 'failure');
  assert.equal(evaluateGate({}, passed).result, 'failure');
});

test('the actual gate process fails closed and emits a machine-readable successful result', () => {
  const executable = fileURLToPath(new URL('./ci-gate.mjs', import.meta.url));
  const invoke = (selection, results) => spawnSync(process.execPath, [executable], {
    encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: '', CI_SCOPE: selection, CI_NEEDS: results },
  });
  const success = invoke(JSON.stringify(scope), JSON.stringify(passed));
  assert.equal(success.status, 0, success.stderr);
  assert.equal(JSON.parse(success.stdout).result, 'success');
  const missing = invoke(JSON.stringify(scope), JSON.stringify({ selection: passed.selection }));
  assert.equal(missing.status, 1);
  assert.equal(JSON.parse(missing.stdout).result, 'failure');
  assert.notEqual(invoke('{malformed', JSON.stringify(passed)).status, 0);
  const noSelection = invoke('', JSON.stringify({ selection: { result: 'failure' } }));
  assert.equal(noSelection.status, 1);
  assert.equal(JSON.parse(noSelection.stdout).result, 'failure');
});
