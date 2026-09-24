# Pull Requests

Use a short-lived branch from `dev` and target `dev` with one coherent change. Keep unrelated refactoring and behavior changes separate. Reviewability and safe rollback matter more than line count.

`main` identifies the released source and does not accept development or promotion PRs. The [release workflow](releases.md) advances it to a verified release commit.

Follow the [language policy](../../CONTRIBUTING.md#language) for PR titles and bodies.

## Describe the change

The [PR template](../../.github/pull_request_template.md) asks for:

- The problem, the approach, and relevant issue links.
- Tests or manual checks performed, with results and any gaps.
- Compatibility, migration, and recovery implications when applicable.

For runnable changes, show evidence from the affected usage path, not only unit tests. For documentation, reading and link/format checks are appropriate; do not write tests that pin prose. Include screenshots when they help a reviewer understand a visual change.

## Review and merge

A PR can merge when:

1. The required `foundation` check passes against the latest base.
2. Review threads are resolved, either by a fix or a recorded decision with a reason.
3. The repository owner explicitly authorizes the merge.

This is a single-owner repository. Another person's GitHub approval is not required, including on the owner's own PRs. Agent reviews are supporting evidence for the owner; they do not grant merge authority or count as another human approval. Record what a review checked and what it could not establish.

## History

Use English [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) titles for commits and PRs, for example `docs: clarify contribution steps` or `fix: handle empty input`.

Merge PRs with a merge commit, never squash or rebase. `dev` requires a PR and passing checks. Do not push development changes directly to `dev` or `main`; only release automation advances `main`. Both branches prohibit force pushes and deletion. Passing CI does not authorize merging, and merging does not publish a [release](releases.md) or deploy the product.

## Branch ownership

Check the owner and linked worktrees before deleting a merged branch. Preserve unmerged work from closed PRs until its disposition is agreed.

Policy changes use this same PR process. Repository rules and the [workflow](../../.github/workflows/ci.yml) define enforcement; update the documentation alongside any authorized configuration change. Required-check behavior is documented in the [CI policy](ci.md).
