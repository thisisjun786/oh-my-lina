# Releases

Development changes integrate into `dev`. The owner authorizes a release of one exact, verified commit; the release workflow publishes it and fast-forwards `main` to that commit. There is no `dev`-to-`main` promotion PR.

## Publish

Run the [Release workflow](../../.github/workflows/release.yml) from `dev` with:

- The full commit SHA on `dev`, with successful push CI for that exact commit.
- A version tag such as `v0.1.0` or `v0.1.0-rc.1`.
- User-facing release notes.

Keep `dry_run` enabled to validate without changing tags, releases, or branches. Disable it only when the owner has authorized publication. Dispatch and reruns are restricted to the repository owner.

The workflow creates a GitHub source release. It does not publish an npm package or deploy a service. The release retains the repository's [license](../../LICENSE) and third-party notices.

## Credentials

Publication requires the repository secret `RELEASE_TOKEN`: an owner-owned token restricted to this repository, with **Contents: read and write**, **Workflows: read and write**, and **Actions: read**. Workflow permission is needed when advancing `main` carries changes under `.github/workflows`. Never commit the token. Read-only dry-runs use `GITHUB_TOKEN` and need no publication credential.

## Recovery

Tags are immutable. A rerun may reuse an existing tag only when it identifies the same commit. The workflow never rewrites a tag or an existing published release.

If publication succeeds but advancing `main` fails, the release still exists. Inspect the failure and rerun with the same tag and commit after correcting it. An older or divergent commit cannot replace `main`; moving it backwards is not a recovery mechanism.
