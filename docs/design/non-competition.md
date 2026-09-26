# Sharing a computer with its user

This contract defines how a LINA install proves that it doesn't compete with the person who uses the same machine. It covers input, focus, clipboard, files, CPU and memory, and the session events that change who is in control: lock, unlock, sleep, resume and disconnect. It is normative: an install claims non-competition only through the evidence described here, and any change to the rules goes through a pull request against this file.

The install shapes and product responsibilities come from [product-families.md](product-families.md). Grants, scope enforcement, expiry and reconnect behavior come from [main-authority.md](main-authority.md). This document adds the acceptance matrix and the pass criteria; it doesn't restate those contracts.

## Scope

Non-competition is the responsibility of the device-OS install: LINA OS on a machine that a person also uses. On that machine the person has priority. LINA must never take the person's input, focus, clipboard, files or resources away from them.

A VM install is LINA's own environment. Nobody else works inside the VM, so the non-competition cells of the matrix don't apply to it. The rules that do still apply inside a VM are the ones from [main-authority.md](main-authority.md): authorization before any effect, scope enforcement on files, and the lifecycle rules for grants across lock, sleep and disconnect. What the VM may share with its host is outside this document; see Deferred.

Node is not the owner of non-competition. A Node acts under a grant from the main, and the grant's scope already fences what it may touch.

Mobile devices run LINA APP. LINA APP is an access product, never a permanent Node, so no mobile row exists in the matrix.

## Matrix

Rows are install mode by host OS. Columns are the eight things that must be measured on a shared machine. Each cell holds exactly one of three values:

- `required`: the rule applies to this cell and must be proven by an evidence record before anything is claimed about it.
- `not applicable`: nobody shares the environment, so there is nothing to measure.
- `unverified until evidence`: the rule applies, but no measurement exists yet. This is the starting value of every shared-OS cell.

| Install mode and host OS | Focus | Keyboard and pointer input | Clipboard | File scope | CPU and memory yield | Lock and unlock | Sleep and resume | Disconnect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| device-OS on Linux | unverified until evidence | unverified until evidence | unverified until evidence | unverified until evidence | unverified until evidence | unverified until evidence | unverified until evidence | unverified until evidence |
| device-OS on macOS | unverified until evidence | unverified until evidence | unverified until evidence | unverified until evidence | unverified until evidence | unverified until evidence | unverified until evidence | unverified until evidence |
| device-OS on Windows | unverified until evidence | unverified until evidence | unverified until evidence | unverified until evidence | unverified until evidence | unverified until evidence | unverified until evidence | unverified until evidence |
| VM on Linux host | not applicable | not applicable | not applicable | not applicable | not applicable | not applicable | not applicable | not applicable |
| VM on macOS host | not applicable | not applicable | not applicable | not applicable | not applicable | not applicable | not applicable | not applicable |
| VM on Windows host | not applicable | not applicable | not applicable | not applicable | not applicable | not applicable | not applicable | not applicable |

Rules for reading and changing the matrix:

- No cell ever changes to a success value. A measured cell is reported by its evidence record, which must meet the criteria in the next sections; a policy statement never changes a cell.
- Every shared-OS cell starts as `unverified until evidence`. The Linux row is measured first because LINA OS is Linux. The macOS and Windows GUI rows stay unverified until real evidence exists on those systems.
- A cell must never hold a word that describes a claim without a measurement. Vocabulary outside the three values is a defect in this file.

## Evidence ladder

Evidence is collected in three tiers, in this order:

1. Background CLI. LINA runs as a command-line process with no window, no GUI session in its grant and no clipboard access. The person keeps working in their own session.
2. Dedicated browser profile. LINA drives a browser through a profile that is its own, named in the grant, separate from every profile the person uses.
3. Separated GUI environment. LINA works in a GUI session that is distinct from the person's session, named in the grant, with input and clipboard boundaries measured rather than assumed.

A tier must pass before the next one is attempted. Passing a tier means every applicable matrix column for that row was measured at that tier and met the pass criteria. A failure at a lower tier stops the ladder; the higher tiers stay `unverified until evidence` for that row.

Tiers are per row. Evidence collected on Linux says nothing about macOS or Windows.

## Pass criteria

A measured cell passes only when all of the following are observed during a concurrent session where the person is working and LINA is working at the same time:

- Focus: zero focus steals. The person's active window never loses focus because of LINA.
- Keyboard and pointer input: zero unauthorized input injection. No keystroke, click or pointer movement reaches the person's session unless the person handed over the screen explicitly, exclusively and revocably.
- Clipboard: zero clipboard reads and zero clipboard writes on the person's clipboard.
- File scope: zero out-of-scope file access, and zero lost human edits. Every file LINA touches is in the scope of its grant. When a file changed under the person's hands, LINA's write against the stale revision is rejected; the person's version wins.
- CPU and memory yield: under concurrent load from the person and from LINA, including LIFE world activity running in the background, the person's input latency and LINA's resource use stay within the bounds declared before the test. LINA yields when the person needs the machine and recovers its own work afterwards. The person's processes are never killed by LINA.
- Lock and unlock: the outcome is measured per cell. Locking the person's session must never let LINA act on that session, and unlocking must never let a stale grant resume as if nothing happened.
- Sleep and resume: the outcome is measured per cell. Resuming from sleep never revives a grant that expired while the machine was asleep, and never lets a stale grant act on the person's session.
- Disconnect: an observed disconnect from the main blocks new work and requests cancellation of running work at once. A silent disconnect ends authorization at the grant's expiry deadline, as defined in [main-authority.md](main-authority.md). In both cases the person's session stays untouched.

Bounds for latency, resource use, yield time and recovery time are declared per test before the test runs and recorded with the evidence. A test without declared bounds is not a measurement.

Zero means zero. One injected key, one stolen focus, one clipboard read or one lost edit fails the cell.

## Non-claims

The following are never accepted as evidence of non-competition on their own:

- A virtual desktop. Being on another desktop doesn't stop input injection, clipboard access or resource pressure.
- A separate profile, session or OS user. Separation is a setup choice, not a measurement.
- A VM. The VM rows are `not applicable`, not passed; a VM proves nothing about a shared machine.
- The word background. A process that calls itself background still has to be measured.
- Policy text. A sentence that says LINA yields is not a yield. Only a record from a concurrent session counts.
- Research conclusions. Work done during research isn't acceptance on the person's device.

Platform GUI support is unverified until real evidence exists on that platform. This document doesn't claim that any cell has been measured.

## Evidence record

Each measured cell has one record, and it holds:

- the host OS and version, and the install mode
- the session: OS user, GUI session, profile, and the grant the work ran under
- the hardware: CPU, memory, and any relevant device
- the versions of every LINA artifact involved: OML, Node, LINA APP and LINA OS
- the workload: what the person did, what LINA did, and what LIFE world activity ran in the background
- the traces: input, focus, clipboard and file access traces for the whole session, tied to the task and grant ids
- the declared bounds and the measured deltas against them
- the result per column: which pass criteria were met and which were not, against the declared bounds

Records are kept with the acceptance evidence of the implementation that produced them. A record that lacks any of these fields is not evidence.

## Deferred

- Numeric bounds for input latency, resource caps, yield time and recovery time: declared per test and set during implementation acceptance of LINA OS.
- The measurements themselves, for every row and tier: set during implementation acceptance.
- The concrete tooling for input, focus and clipboard traces on each host OS: set during implementation acceptance.
- VM sandbox boundaries such as shared folders, clipboard sharing and USB passthrough: owned by the install-mode design, not by this document.
- How Node grants are clocked across sleep, resume and clock changes: set during Node implementation acceptance, per `main-authority.md`.
- macOS and Windows GUI rows: unverified until evidence; the order in which they are attempted is set during implementation acceptance.
