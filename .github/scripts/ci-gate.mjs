import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function evaluateGate(scope, needs) {
  const failures = [];
  if (needs.selection?.result !== 'success') failures.push('selection did not succeed');
  if (scope.docs !== true || typeof scope.automation !== 'boolean' || !Array.isArray(scope.unmapped)) {
    failures.push('selection output is missing or malformed');
  } else {
    if (scope.unmapped.length) {
      failures.push(`Register verification for unmapped paths: ${scope.unmapped.join(', ')}`);
    }
    for (const name of ['docs', 'automation']) {
      const expected = scope[name] ? 'success' : 'skipped';
      const actual = needs[name]?.result;
      if (actual !== expected) failures.push(`${name}: expected ${expected}, received ${actual ?? 'missing'}`);
    }
  }
  return { result: failures.length ? 'failure' : 'success', mode: scope.mode, head: scope.head, failures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const needs = JSON.parse(process.env.CI_NEEDS);
  const scope = needs.selection?.result === 'success' ? JSON.parse(process.env.CI_SCOPE) : {};
  const result = evaluateGate(scope, needs);
  console.log(JSON.stringify(result));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## Foundation: ${result.result}\n\n`
      + Object.entries(needs).map(([name, job]) => `- ${name}: ${job.result}`).join('\n')
      + `\n\n${result.failures.join('\n')}\n`);
  }
  if (result.result !== 'success') process.exitCode = 1;
}
