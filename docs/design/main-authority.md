# Main authority, Node grants and recovery

This contract fixes who holds authority in a LINA installation, how a Node receives and loses permission to act, what happens when the main stops or a Node disconnects, and how the effects of interrupted work are reconciled. It is normative: implementations must follow it, and any change to it goes through a pull request against this file.

It builds on the product responsibilities in [product-families.md](product-families.md). Finishing this document does not mean any state machine is implemented or accepted. Runtime proof belongs to the implementation issues that consume this contract.

## Terms

**Server host.** The one machine that runs the main OML and confirms the canonical identity, memory and work intent of a LINA. "Main" in this document and "server host" in user-facing documents name the same thing. There is exactly one per LINA.

**Epoch.** A persistent generation owned by the main. Every start of the main creates a new epoch and stores it durably before anything else happens. Grants, commands and receipts carry the epoch they belong to.

**Grant.** The main's permission for one Node to perform one scope of work. A grant is a record with these fields. Every field is present; a field that does not apply holds an explicit none:

| Field | Meaning |
| --- | --- |
| server id | The main that issued the grant |
| node id | The Node the grant is issued to |
| node boot id | The boot of that Node the grant was issued to; a reboot produces a new one |
| epoch | The main epoch the grant belongs to |
| grant id | Identity of this grant |
| task id | The task the grant serves |
| command id | The command inside the task, when the grant covers a single command |
| host | The machine the work runs on |
| OS user | The operating-system account the work runs as |
| GUI session | The interactive session the work may touch, or none |
| profile | The Node profile (for example a dedicated browser profile) the work runs in |
| file revision | The revision of each file the work may read or change |
| task owner | Who the work is done for |
| scope | What the work may touch: paths, targets, effects and model calls |
| expiry deadline | The moment after which the grant is no longer valid on the Node, even without a message from the main |

**Receipt.** The Node's durable statement of what it did under a grant: which command, which effect, on which target, with what result. A receipt is the only proof the main accepts that an effect happened.

**Provenance.** The record that ties an artifact to where and when it was observed. It carries the artifact id, the task id, the node id, the observed path, the content revision or hash, and the observation time. A file is never assumed to be the same file on two devices because of its name, path or identical content alone.

## Invariants

- There is one canonical writer: the main OML on the server host. Identity, memory and work intent are confirmed there and nowhere else.
- A write to canonical state that arrives from any other device is rejected. LINA APP and Node report and reflect; they never confirm canonical state.
- Two devices must never be the main at the same time. There is no path by which a second device becomes the main automatically.
- There is no automatic replacement main. When the main stops, every dependent LINA function stops with it until the same main comes back. This does not mean the user's computer shuts down.
- A Node never executes offline. Without a live, valid grant from the main there is no planning, no queued work and no execution on the Node.
- A Node is not a separate LINA. It is an execution location for the one LINA.
- User-facing documents say "server host" where this document says "main".

## Server states

| State | Meaning | Leaves the state when |
| --- | --- | --- |
| STOPPED | The main isn't running. Nothing is dispatched. Nodes treat the main as absent. | The main process starts, entering RECOVERING. |
| RECOVERING | The main has started, created a new epoch and stored it durably. It reconciles every task and every Node effect left from earlier epochs before accepting new work. | Reconciliation finishes, entering READY. |
| READY | The main dispatches work, issues grants and accepts receipts for the current epoch. | The main stops or crashes, entering STOPPED. |

A crash from any state goes to STOPPED. There is no partial state in which an old process keeps dispatching.

The main must not dispatch any command before the new epoch is durable. Everything issued under an earlier epoch is stale from the moment the new epoch exists, whether or not the Node has learned about it yet.

Reconciliation in RECOVERING means: read every stored task, collect the receipts already present, ask each reconnecting Node for the outcome of every unconfirmed effect, and assign each effect one of the outcomes in "Task effect outcomes". Work resumes only after that assignment.

## Node states

| State | Meaning | Leaves the state when |
| --- | --- | --- |
| BLOCKED | The Node holds no valid grant. It does not start, queue or continue work. This is the state after install, after reboot, after a revoked grant and after a lost connection. | The Node reconnects to the main with authentication, entering RECONCILING. |
| RECONCILING | The Node is connected and authenticated. It reports its receipts and unconfirmed effects to the main and waits. No new work runs. | The main has reconciled the Node's effects and issued a fresh grant for the current epoch, entering GRANTED. |
| GRANTED | The Node holds a valid grant for the current epoch and is idle. | The main dispatches a command under that grant, entering RUNNING. |
| RUNNING | A command is executing under the grant. | The command completes and its receipt is stored, returning to GRANTED; or a stop condition below applies. |
| CANCEL_REQUESTED | The main or the Node has asked the running command to stop. | The command confirms it stopped, entering STOPPED; or no confirmation can be obtained, entering UNKNOWN. |
| STOPPED | The command ended before completion and the Node has confirmed that no further effect will occur from it. | The Node returns to GRANTED if its grant is still valid, otherwise to BLOCKED. |
| UNKNOWN | The command may or may not have produced its effect, and the Node cannot say which. The effect is reported to the main as unknown. | The Node returns to BLOCKED until the main has reconciled the unknown effect. |

Stop conditions:

- An observed disconnect from the main, a revoke from the main, or reaching the grant's expiry deadline blocks all new and queued work at once and requests cancellation of running work. RUNNING goes to CANCEL_REQUESTED; GRANTED goes to BLOCKED.
- A Node reboot always lands in BLOCKED. A reboot never extends, restores or reuses an earlier grant; the node boot id no longer matches.
- A silent partition, where messages stop without an observed disconnect, ends the Node's authorization at the expiry deadline of its local grant. Until that moment the Node may finish the command it is running; after it, the Node behaves as if revoked.
- Reconnecting always passes through RECONCILING. A Node must never go from BLOCKED straight to RUNNING, and a grant from an earlier epoch is never honored after reconnect.

How the expiry deadline is clocked across sleep, resume and clock changes on the Node is set during Node implementation acceptance.

## Task effect outcomes

Every command is in exactly one of these states at any time, recorded by the main:

| Outcome | Meaning |
| --- | --- |
| queued | The main has recorded the command but has not sent it to a Node. |
| dispatched | The command was sent under a valid grant; no receipt has arrived. |
| receipted | A receipt for the command arrived and matches the grant, epoch and command id. |
| reconciled | The main compared the receipt, or its absence, with the task record after a restart or reconnect and settled the effect. |
| cancelled | The Node confirmed that the command stopped before its effect occurred. |
| unknown | The effect may or may not have occurred, and no receipt can settle it. |

Rules:

- A command that carries an earlier epoch than the main's current epoch is rejected by the main and by the Node, whichever sees it first.
- A response that arrives for a command the main no longer expects (an earlier epoch, a revoked grant, or a command id already settled) is rejected and never applied.
- A lost receipt yields unknown. The main must never re-run a command automatically because its receipt is missing.
- Any effect that cannot be undone requires an explicit disposition from the task owner before any replay. Disposition is a recorded decision: confirm it happened, confirm it did not, or abandon the command.
- A disconnect cannot be distinguished from a hardware failure of the Node. Both are treated as unknown for every effect that was in flight.
- The main does not guarantee cancellation of an irreversible effect once it has started, and does not guarantee immediate detection of physical failure. Contracts that need either must say how they obtain it.
- Provenance is recorded with every receipted effect that produced or changed an artifact, so that a later reader can tell which Node observed which revision, where, and when.

## Authorization

Authenticating a device and permitting an operation are different things. A Node that has proven its identity has no permission to do anything until the main issues a grant, and a grant covers only the scope written in it.

Every effect and every model call on a Node checks all of the following together, and fails closed if any check fails:

- the grant from the main: valid grant id, matching node id and node boot id, current epoch, not revoked, expiry deadline not reached
- the host operating system's own permission for the OS user and the target
- a live session: the GUI session named in the grant is the one the effect touches, or the grant names none and the effect touches none
- the current epoch of the main

Scope is enforced before the effect or model call, not after. A wrong owner, a wrong scope, a wrong target or a revoked grant must be rejected at that point and must never be routed around by another path, another Node or another model call. After a reconnect, the Node rechecks scope against the fresh grant before doing anything.

A stale or superseded grant must never act on input or work targets that the user has since taken hold of.

The user always has three controls:

- show target: what the Node is acting on, under which grant and for which task
- immediate stop: cancel running work and block queued work now
- revoke: withdraw a grant so the Node returns to BLOCKED

Ordinary pre-approved work is separated from secret and private areas, administrator changes, external effects and destructive actions in the execution layer. The separation is enforced there, not by prompt wording and not by the default posture of a native runtime.

Text found in logs, web pages or on screen is never an approval. Only the task owner's recorded decision counts.

Approval policy:

- The default inside a device LINA uses is no approval. Reading, writing and executing there proceed without asking.
- Approval is required only for effects outside the user's reach that are hard to reverse: sending mail or messages, payments and purchases, public posting or publication, and unrecoverable deletion.
- Deletion first goes to a recoverable form (a trash, a retained copy or a snapshot). Only deletion that cannot be recovered needs approval.
- An approval request shows in one view what will happen, where, and whether it can be undone. Repeated approvals of the same kind are grouped by scope instead of asked one by one.

## Deferred

The following items are recognized but not settled here. Each names the place where it is decided.

- Grant expiry values, the heartbeat interval and the maximum stop latency: set by measurement during Node implementation acceptance.
- Clocking of the expiry deadline across Node sleep, resume and clock changes: set during Node implementation acceptance.
- The wire format of grants, commands, receipts and reconciliation messages: OML host contract, set during implementation acceptance.
- Supervision of several tasks on one Node, and parent and child tasks: set during implementation acceptance of delegated work.
- Registration, enrollment and withdrawal of a Node on each supported OS: set during Node implementation acceptance.
