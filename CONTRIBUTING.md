# Contributing

Start with the [manifesto](MANIFESTO.md). Bug reports, proposals, and documentation fixes are welcome.

## Language

Write issue and pull request titles and bodies in English. Keep quoted source text, logs, and code unchanged.

## Before you start

Search existing issues and PRs. For a feature or architectural change, open a [proposal](https://github.com/thisisjun786/lina/issues/new?template=proposal.yml) and agree on scope with the owner before implementation. A blank issue is fine if the form does not fit. Small fixes and documentation improvements can go straight to a PR.

Report reproducible problems with the [bug form](https://github.com/thisisjun786/lina/issues/new?template=bug.yml). For sensitive findings, follow [Security](SECURITY.md).

## Make a change

1. Create a focused branch from the latest `dev`. Use your fork if you do not have write access.
2. Keep the change small enough to review as one unit. Coordinate edits that overlap someone else's work.
3. Check the result and record what you ran. For documentation, read the rendered content, check links, and run `git diff --check`; also use `git diff --cached --check` for staged changes. For code, include relevant tests and evidence from the affected usage path.
4. Open a PR targeting `dev`, explaining the problem, the change, and the verification. Link an existing issue when relevant; creating another issue just for the PR is unnecessary.
5. Address review feedback. The owner handles merging under the [PR policy](docs/policy/pull-requests.md).

See the [CI policy](docs/policy/ci.md) for automated and local checks.

## Licensing

By submitting original contributions for inclusion, you agree to offer them under
the [Sustainable Use License 1.0](LICENSE), unless separately agreed with the owner.
Submit only material you have the right to contribute. Identify third-party
material and its license in your PR, and preserve its original terms and notices.

## Project policies

- [Issues](docs/policy/issues.md): reports, proposals, and questions.
- [Pull requests](docs/policy/pull-requests.md): scope, review, and merging.
- [Releases](docs/policy/releases.md): verification and publication.
