import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const documents = new Set([
  'README.md', 'MANIFESTO.md', 'LICENSE', 'THIRD-PARTY-NOTICES.md',
  'CONTRIBUTING.md', 'SECURITY.md', 'AGENTS.md', '.github/pull_request_template.md',
]);
const configuration = new Set(['.editorconfig', '.gitattributes', '.gitignore']);

function kind(path) {
  if (documents.has(path) || /^docs\/(?:policy|design)\/[^/]+\.md$/.test(path)) return 'docs';
  if (configuration.has(path)
    || /^\.github\/(workflows|ISSUE_TEMPLATE)\/[^/]+\.ya?ml$/.test(path)
    || /^\.github\/scripts\/[^/]+\.(mjs|sh)$/.test(path)) return 'automation';
  return 'unmapped';
}

export function scopeFor({ base = '', head, event, baseRef = '', cwd = process.cwd() }) {
  if (!['pull_request', 'push', 'workflow_dispatch'].includes(event)) {
    throw new Error(`Unsupported CI event: ${event}`);
  }
  if (event === 'pull_request' && baseRef !== 'dev') {
    throw new Error('PRs must target dev; main is a release mirror.');
  }
  const git = (...args) => execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024,
  });
  const resolvedHead = git('rev-parse', '--verify', '--end-of-options', `${head}^{commit}`).trim();
  const inventory = git('ls-tree', '-r', '--name-only', '-z', resolvedHead).split('\0').filter(Boolean);
  let resolvedBase = null;
  let changed = [];
  try {
    if (base) {
      resolvedBase = git('rev-parse', '--verify', '--end-of-options', `${base}^{commit}`).trim();
      changed = git('diff', '--name-only', '--no-renames', '-z', resolvedBase, resolvedHead, '--')
        .split('\0').filter(Boolean);
    }
  } catch (error) {
    if (!Number.isInteger(error.status)) throw error;
    resolvedBase = null;
  }
  const unmapped = [...new Set([...inventory, ...changed].filter(path => kind(path) === 'unmapped'))].sort();
  const docsOnly = event !== 'workflow_dispatch' && resolvedBase !== null
    && changed.length > 0 && changed.every(path => kind(path) === 'docs') && unmapped.length === 0;
  const reason = unmapped.length ? 'unmapped-paths'
    : event === 'workflow_dispatch' ? 'manual-full'
    : resolvedBase === null ? 'base-unavailable'
    : changed.length === 0 ? 'empty-diff'
    : docsOnly ? 'documents-only' : 'automation-change';
  return {
    mode: docsOnly ? 'docs' : 'full', reason,
    base: resolvedBase, head: resolvedHead,
    docs: true, automation: !docsOnly, changed, unmapped,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({ options: {
    base: { type: 'string', default: '' }, head: { type: 'string', default: 'HEAD' },
    event: { type: 'string' }, 'base-ref': { type: 'string', default: '' },
  } });
  const scope = scopeFor({ ...values, baseRef: values['base-ref'] });
  const json = JSON.stringify(scope);
  console.log(json);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT,
      `scope=${json}\ndocs=${scope.docs}\nautomation=${scope.automation}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## CI selection\n\n- Mode: ${scope.mode}\n- Reason: ${scope.reason}\n`
      + `- Base: ${scope.base ?? 'unavailable'}\n- Candidate: ${scope.head}\n`
      + `- Documents: selected\n- Automation: ${scope.automation ? 'selected' : 'not needed'}\n`
      + `- Unmapped paths: ${scope.unmapped.length}\n`);
  }
}
