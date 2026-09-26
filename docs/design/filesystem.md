# Common filesystem

This contract fixes the one Linux filesystem layout that every LINA install uses, who writes each part of it, how a file keeps its identity when it moves or changes, where derived data lives, what a backup generation contains, and how material enters or leaves the library. It is normative: implementations must follow it, and any change to it goes through a pull request against this file.

Finishing this document does not mean any path is implemented or accepted. Runtime proof belongs to the implementation issues that consume this contract, and the product boundaries it builds on are defined in [product-families.md](product-families.md).

## Scope

Every LINA install runs on a Linux filesystem, whether LINA is installed as the device operating system or inside a VM. All installs use the same layout and the same path rules. The installation mode changes where the layout is mounted, never its shape.

OML's material management, LINA APP's file and media space and LINA OS's storage placement all sit on this one layout. It's the reference the system uses to find material, not a tree for a person to browse.

This contract covers:

- the state root and the relative layout beneath it, with a writer and a backup unit for each area
- asset identity: how an id, a content hash and an observed path relate
- the split between original bytes and derived data
- backup generations, their manifest and the restore rules
- import and export through approved staging
- how LINA APP presents the library

This contract does not fix the absolute location of the state root, service names, ports, sockets or the sandbox boundaries of a VM install. Those are named in Deferred with their owners.

## State root and layout

There is one state root per install, written here as `<state-root>`. Its absolute location isn't fixed by this contract. The OML install owns it for a general Linux install; the install-mode design owns it for device-OS and VM installs. Every path below is relative to `<state-root>`, and the relative layout is identical in every mode.

| Logical area | v0 relative path | Writer | Backup unit | First consumer |
| --- | --- | --- | --- | --- |
| User materials (approved imported copies) | `identities/<identity-id>/materials/user/<asset-id>/<revision>/` | OML | Personal canon generation | Materials |
| LINA materials (LINA-managed outputs) | `identities/<identity-id>/materials/lina/<asset-id>/<revision>/` | OML | Personal canon generation | Conversation, delegation |
| Derived artifacts (regenerable) | `identities/<identity-id>/derived/<asset-id>/<revision>/` | OML | Personal canon generation, recorded by source revision | Materials |
| Canon (SQLite: metadata and derived indexes) | `identities/<identity-id>/canon/` | OML | Personal canon generation | Conversation |
| Import staging | `identities/<identity-id>/staging/import/` | OML, on an approved import | Not backed up | Materials |
| Export staging | `identities/<identity-id>/staging/export/` | OML, on an approved export | Not backed up | Materials |
| Installation state | `system/` | The install (OML install or LINA OS) | OS root snapshot | Delegation |
| Backup generations | `backups/<identity-id>/<generation-id>/` | The backup procedure | Is the unit | Conversation |

Rules for the layout:

- Only OML writes canon and materials. LINA APP, Node and any generic file tool never write there.
- Backups live at `backups/<identity-id>/<generation-id>/`, beside the identity tree, never inside it. A generation must not be captured by the tree it backs up.
- Configuration and secrets have their own writers. They never live under `materials/` or `canon/`, and their locations are owned by the OML install.
- Human originals outside the state root stay human-owned. They enter the library only through an approved import, and LINA never edits them in place.
- Renaming any directory in this table is a contract change. It's made by a pull request against this file, not by an implementation.

## Asset identity

Every piece of material carries an asset id. The asset id, the content hash and the observed path are three distinct values, and the system must never derive one from another.

- A rename or move changes only the observed path. The asset id and the content hash stay the same.
- An edit keeps the asset id. The content hash changes and the revision advances.
- Two files with identical content get two asset ids. A matching hash never merges them, and a matching name or path never merges them either.
- After a move or a rename the material is still found by its asset id, so collections and relations in LINA APP don't break.

A reference to a file on a Node device carries the node id, the asset id, the observed path, the revision, the content hash and the observation time. Such a reference is only valid under a current grant from the main OML; a stale grant makes the reference unusable until it's observed again. Name, path or identical content alone never prove that two files on different devices are the same file.

## Originals and derived data

Original bytes live on the filesystem, under the materials areas above. Metadata and derived indexes live in SQLite, under `canon/`.

Derived data (descriptions, transcripts, structure and indexes produced from images, audio, video and documents) never lives inside an original's directory. It lives under `derived/`, linked to its source by asset id and source revision, so the link survives when the original moves.

Derived data is regenerable. It's rebuilt from its source when the source revision changes, and it must never become the only copy of anything.

## Backup generations

A backup generation captures the original files and the SQLite canon of one identity at one point in time, so that a restore never leaves the two out of step.

A generation manifest records:

- schema version of the manifest itself
- generation id and identity id
- created-at time
- artifact versions and schema versions in use when the generation was taken
- the SQLite snapshot: relative path, hash and revision
- every asset: asset id, revision, relative path, hash and size
- the source revisions of the derived data included
- the revocation watermark at capture time

The backup procedure must:

1. Quiesce writers.
2. Take a consistent SQLite snapshot.
3. Copy the asset bytes and verify every hash against the manifest.
4. Publish the manifest last. A generation without a published manifest doesn't exist.

Restore and sync operate on whole generations. Restoring the SQLite snapshot without its assets, or the assets without the snapshot, is forbidden. After a restore the system reconciles the latest revocations against the restored generation before serving any read, and revoked items are exposed zero times in search or answers.

OS root snapshots are separate from personal canon backups. The install state under `system/` follows the OS snapshot; the identity tree follows the personal generation. Neither replaces the other.

## Import and export

Shared folders are never mapped into the library automatically. A folder that is visible to the machine isn't part of the library until a person approves an import.

Imports go through `staging/import/`. An imported item receives an asset id, is copied to its place under `materials/user/`, and is recorded in canon. The human original stays where it was and stays human-owned.

Exports go through `staging/export/` only. There is no other write path from the library to the outside.

Because the library changes only through these paths, the personal canon backup has a clear boundary and changes in a shared folder never disturb the asset id mapping.

## Presentation

LINA APP shows the library as collections and relations, not as a folder tree. Views by type, project, task, source device or recency address the same asset id and never copy the material.

The file list in LINA APP is not a writer. Ownership is kept distinct for human originals on a device, LINA-managed outputs, memory projections, configuration and secrets. Generic file editing never bypasses the canon, configuration or secret writers, and LINA APP never presents a preparing, partial, unsupported, unauthorized, disconnected or failed state as an empty or complete library.

## Deferred

- The absolute state root, service names, ports and sockets are owned by the OML install paths contract.
- The roots for device-OS and VM installs, and VM sandbox boundaries such as shared folders, are owned by the install-mode design.
- Sync between installs, beyond the rule that it moves whole generations, is set during implementation acceptance.
- The multimodal processing policy and the derived-data rebuild policy are set during implementation acceptance.
- Fault-injection during SQLite writes and file backup, and the restore measurements that prove hash and reference integrity of one generation, are set during implementation acceptance.
- Backup cadence, retention and size limits are set during implementation acceptance.
