# Product families and release boundaries

This contract fixes what each LINA product owns, where canonical state lives, which installation modes exist, and how the products are built, released and kept compatible. It is normative: implementations must follow it, and any change to it goes through a pull request against this file.

Finishing this document does not mean any platform is implemented or accepted. Runtime proof belongs to the implementation issues that consume this contract.

## Scope

There are three product families: OML, LINA APP and LINA OS. Node is a separately installed execution component of the OML family, not a fourth family and not a feature of LINA APP. LIFE is a feature of LINA APP, not a separate product. The OML context engine is the part of OML that holds identity, memory and work intent.

This contract covers:

- the responsibility of each component, and what it must never take on
- which component writes canonical state and which components only reflect it
- the supported installation modes and the one rule they all share: exactly one canonical OML per LINA
- the monorepo, the independent artifacts and the difference between product version and protocol version
- the compatibility rules for mixed versions, downgrades and failed updates
- what LINA must own itself for delegated work, and what stays with external providers

This contract does not cover host and module ports, plugin or task ports, SDK envelopes, capability manifests or wire formats. Those belong to the OML host contract (see Deferred). It also doesn't set grant lifetimes, non-competition gates or filesystem roots; those have their own contracts, named in Deferred.

## Responsibilities

| Component | Owns | Never owns | Ships as |
| --- | --- | --- | --- |
| OML | The engine and its terminal UI. The canonical identity, conversation, memory, work intent, permissions and results of the single LINA. Coordination of delegated work, approved scope and decisions. | Device execution on other machines. Screens for desktop or mobile. Operating system installation, updates and recovery. | Independent artifact with its own release cadence |
| LINA APP | The desktop and mobile access product: conversation, work threads, questions, results, settings and the LIFE personal feed. Display state for what the main reports. Desktop and mobile behave the same; only layout may differ by screen size. | Canonical identity, memory or work intent. Execution on the device it runs on. A second LINA. | Independent artifact per platform with its own release cadence |
| LINA OS | An integrated product on Omarchy Linux that combines verified OML, Node and LINA APP artifacts with an operating, update and recovery environment. Manifest-based installation, diagnosis and recovery. | Product logic of OML, LINA APP or Node. Copies of their code or ledgers. A second canonical OML. | Composition of pinned artifacts with its own release cadence |
| Node | Device execution under a grant from the main OML, on the machine where Node is installed, as if the main were sitting there. Execution receipts. | Independent planning. Offline execution. Any canonical state. A separate LINA. Screens. | Independent artifact per supported OS with its own release cadence |
| LIFE | A background world engine plus a personal feed inside LINA APP. The engine keeps the world, its time, events and daily activity; the feed in LINA APP shows the result. | A separate app, installer, login or persona. Any multi-person product. | A feature of LINA APP; no separate app or artifact |
| OML context engine | Identity, memory and work intent inside OML, and the judgments made from them. | Anything outside OML. Direct writes from LINA APP or Node. | Part of the OML artifact |

Responsibilities must not overlap. A release of one component must not carry a copy of another component's logic, and integration acceptance checks for duplicated responsibility across products.

## Canonical state and writers

The main OML is the only writer of identity, memory and work intent. There is exactly one main per LINA.

State comes in three kinds, and each has one owner:

| Kind | Owner | Meaning |
| --- | --- | --- |
| Main canon | Main OML | The authoritative identity, memory, work intent, permissions, approved scope, decisions and results |
| Node receipt | Node | Proof of what a Node executed under a grant, reported back to the main |
| Client display | LINA APP | What a client currently shows, derived from the main and never authoritative |

LINA APP and Node never write canon. LINA APP shows and asks; Node executes and reports. When a client display disagrees with the main, the main wins and the client refreshes. When a Node receipt disagrees with the main's expectation, the main reconciles; the Node doesn't rewrite the main's record.

Being the same LINA is not the same as cloning a disk or an account. Provenance and availability of files are linked through artifact and task identifiers, the Node, the observed path, the content revision or hash and the observation time. The same name, path or content alone doesn't make two files on different devices the same file.

## Installation modes

LINA OS is built on Omarchy Linux. The main compute runs LINA OS, and every additional LINA OS device follows the same base. Specific OS versions, devices and hardware acceptance are deferred.

Main LINA OS integrates OML, Node and LINA APP in one install. LINA APP is part of the OS product, not a separate download bolted on.

A headless main is the same product with the LINA APP UI autostart turned off. Users reach it through a remote LINA APP. Headless does not make LINA APP a second brain and does not split LINA OS into another product.

An additional LINA OS connects to the same main. It runs Node and LINA APP and never starts a second canonical OML.

APP-only installs are supported: LINA APP on a desktop or mobile device with no Node. Node-only installs are supported: Node on a machine with no LINA APP. Installing LINA APP never requires installing Node, and installing Node never requires LINA APP. Both connect to the one main.

OML-only installation works, but it isn't the intended way to use the product. Development and minimal-install checks of OML on a general Linux system are separate from LINA OS product acceptance.

Two intended installation shapes exist, and both use a Linux filesystem:

- Device-OS install: LINA OS on a machine the user also uses. LINA works inside the user's environment, so the non-competition rules for input, files and resources apply to this shape.
- VM install: LINA OS as a virtual machine on an existing Mac, Windows or Linux host. This is LINA's own environment; its permissions stay inside the VM sandbox and never reach the host. To act on the host or on any other user device, a Node is installed on that device.

Non-competition with the user is the responsibility of the device-OS install, not of Node.

## Repository and artifacts

One monorepo holds every product. Work branches from `dev` and targets `dev` with pull requests. Code, databases and fixtures from earlier LINA codebases aren't ported in.

One source repository does not mean one release unit. OML, LINA APP, Node and LINA OS each have independent artifacts and independent release cadences. Being in the monorepo is never a reason to merge release units.

Product version and protocol version are different things. Each component has a product version. The APP-OML connection and the Node-OML connection each have a protocol and capability version. Compatibility between installed components is decided by protocol and capability, not by product version alone.

LINA OS consumes pinned artifacts: a specific verified OML, Node and LINA APP fixed by manifest with version and digest. LINA OS duplicates no code and no ledgers from the components it composes. Replacing the OS is separate from migrating or rolling back state schemas.

An integration candidate that includes LINA APP is complete only when the real desktop package and the verified OML and Node are pinned together. Server-side readiness alone doesn't complete it.

## Compatibility

Supported combinations are recorded in a table of released component versions and the protocol versions they speak. The table starts with no released rows. A row is added only when the combination has been tested and accepted; nothing is listed as supported by assumption.

Mixed versions are expected because the artifacts release independently. Every combination that is claimed as supported must have a passing test; every combination that isn't listed must be refused cleanly, with the refusal reported to the user.

Binary-only downgrade is forbidden. A component must never be rolled back to an older binary while its data stays at the newer schema.

When an update or install fails, the product must either restore the previous compatible pair of application and data, or hold: stop, keep the current state intact and report. It must never leave a half-updated component running against data it can't read.

Failure injections that must be tested before a combination is accepted:

- truncated download
- start failure after install
- disk full during install or update
- path change of the installation or data location
- mismatched backup, where the backup and the installed version don't form a compatible pair

## Delegated work

Planning, documents, approved scope, execution permission, identity and receipts are owned by the main OML's own store. There is no external canonical copy.

Installation, management, delegation and recovery must work without any external issue tracker account, API, webhook, external ID or URL, or cache. A required path must never depend on an external planning service being reachable.

The functions of earlier operator tooling are absorbed into the existing products: coordination, scope, permissions, reporting and recovery into OML; work, question and operating screens into LINA APP; per-device runtime execution into Node; manifest-based installation, diagnosis and recovery into LINA OS. A command-line wrapper alone doesn't count as absorption.

Model-provider accounts and model enablement are owned by the model proxy, not by LINA. User-managed provider policy stays external.

That the development of LINA itself is tracked in an external tool is a fact about the development process, not a product runtime dependency.

## Deferred

The following items are recognized but not settled here. Each names the place where it is decided.

- OS version, devices and hardware: set during LINA OS install profile acceptance.
- Host and module ports: OML host contract. This includes plugin and task ports, SDK envelopes, capability manifests and wire formats.
- Grants and epochs, including grant expiry and reconnection: `main-authority.md`.
- Non-competition gates for input, files and resources: `non-competition.md`.
- Filesystem roots, data and install paths: `filesystem.md`.
- Combination tests, the concrete version rows of the supported-combination table and the injection procedures: set during implementation acceptance.
- Mobile framework and Linux GUI backend: set during implementation acceptance of the products that need them.
- Multi-device Node fabric and remote reach: set during Node implementation acceptance.
- Packaging of the LIFE world engine and its connection to OML: set during implementation acceptance.
