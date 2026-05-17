# ShadowVote — Project Context

## Overview
Private identity verification dApp using Midnight Network ZK proving. Users connect their 1AM wallet and generate zero-knowledge proofs to verify identity without revealing private data.

## Tech Stack
- **Framework**: Next.js 16 (webpack mode, NOT Turbopack)
- **Styling**: Tailwind v4 + framer-motion
- **Wallet**: 1AM wallet extension (`window.midnight['1am']`)
- **ZK**: Midnight Network — Compact smart contract language + midnight-js SDK
- **Network**: Preview (hardcoded) — sponsored fees via 1AM ProofStation, no DUST/faucet needed

## Key Files

| File | Purpose |
|------|---------|
| `contracts/identity.compact` | Compact smart contract: `register` + `proveIdentity` circuits using MerkleTree<16, Bytes<32>> |
| `contracts/managed/identity/` | Compiled ZK assets (prover/verifier keys, ZKIR) + TypeScript bindings |
| `src/lib/midnight.ts` | SDK integration: `createConnectedSession`, `detectWallet`, `generateProof`, `getErrorMessage`, `getContractFingerprint` |
| `src/contexts/WalletContext.tsx` | React context: wallet detection, connection, error state, session management |
| `src/components/WalletConnect.tsx` | Header button: connect/disconnect, status, inline error display |
| `src/components/ProofPanel.tsx` | "Generate Private Proof" button + step-by-step progress/error/success display |
| `src/components/StatusCard.tsx` | Post-proof result card (proof ID, commitment hash, timestamp) |
| `src/components/ConfirmDialog.tsx` | Portal-rendered modal dialog with backdrop blur and framer-motion animation |
| `src/lib/isomorphic-ws-fix.mjs` | WebSocket shim for Next.js webpack |
| `public/contract/identity/` | ZK assets served to browser via FetchZkConfigProvider |

## Wallet Flow
1. Page loads → polls for `window.midnight['1am']` (6s timeout → "not-found")
2. User clicks "Connect Wallet" → `wallet.connect('preview')` → `createConnectedSession(api)`
3. Session stored in WalletContext → reused everywhere (no redundant `connect()` calls)
4. User clicks "Generate Private Proof" → `generateProof(address, onStatus, session)`
5. Proof result displayed in StatusCard

## Error Handling
- `getErrorMessage()` in `midnight.ts` maps raw errors to user-friendly text
- WalletContext has `connectError` state + `clearError()` with 6s auto-dismiss
- Errors shown as inline red text below the button (no layout shift)

## Build Commands
```bash
npm run dev          # next dev --webpack
npm run build        # next build --webpack
npm run compile      # compact compile contracts/identity.compact contracts/managed/identity
npm run sync:zk      # copies ZK assets to public/
```

## Tooling Requirements
- Node.js 20+ (v20.20.2 used)
- Compact compiler: `source $HOME/.local/bin/env` then `compact compile ...`
- 1AM wallet extension for browser
- Compact CLI installed at `~/.local/bin/compact`, compiler at `~/.compact/versions/0.31.0/`

## CRITICAL RULES
- **Never push after the first commit without asking.** After every commit (including amends), ask "push?" and wait for an explicit yes. The only exception is when the user proactively says "push" to batch multiple commits — after that batch you must ask again.
- If the user says "push" once, do NOT assume it applies to subsequent commits in the same session. Ask again every time.
- Commit locally first, wait for user confirmation, then push. Every time.
- Always update CHANGELOG.md and AGENTS.md before every commit
- Verify all bug fixes and features from the session are logged in CHANGELOG.md before the first commit. If something is missing, update and amend.

## Contract Architecture (`contracts/identity.compact`)

### Ledger State
- `registrations: MerkleTree<16, Bytes<32>>` — Merkle tree of registered identity commitments (depth 16, max 65536 leaves)
- `verifyCount: Counter` — total number of verifications performed

### Witnesses (private inputs via witness functions)
- `callerSecret(): Bytes<32>` — user's private secret (32 bytes), supplied by the dApp at proof time
- `findPath(commitment: Bytes<32>): MerkleTreePath<16, Bytes<32>>` — finds the Merkle path for a given commitment leaf (computed from ledger state)

### Circuits
- **`register()`** — Takes secret via witness → computes `identityCommitment(secret)` = `persistentHash([pad("shadowvote:identity:v1"), secret])` → inserts commitment into Merkle tree. The commitment is **disclosed** (public on-chain). Increments `verifyCount`.
- **`proveIdentity()`** — Takes secret via witness → recomputes commitment → finds Merkle path via witness (checks membership against actual tree) → discloses computed root. No direct Merkle tree access in circuit (avoids `registrations.checkRoot` BMT bug in `partitionTranscripts`). Membership verified by witness querying `registrations.findPathForLeaf`. Increments `verifyCount`.

### Circuit flow
```
secret (private) → identityCommitment → findPath → merklePathRoot (disclosed public)
                                           ↑
                               (witness: queries actual on-chain tree)
```

## Witness Implementation Requirements
- `callerSecret`: returns a deterministic 32-byte value from user's wallet identity. Should use `persistentHash([domain_sep, user_public_key])` to produce a stable secret per user without storing anything.
- `findPath`: queries the on-chain `registrations` Merkle tree via `registrations.findPathForLeaf(commitment)` to produce the Merkle path.

## Next Steps Roadmap

### Phase 1: Real ZK Proving (current)
1. Import generated contract bindings (`Contract`, `ledger` from `contracts/managed/identity/contract/`)
2. Create typed providers (`IdentityCircuits`, `IdentityPrivateState`, `IdentityProviders`)
3. Create `CompiledContract` with vacant witnesses + compiled file assets from `FetchZkConfigProvider`
4. Implement witness functions (`callerSecret`, `findPath`) using ledger state queries
5. Deploy contract via `deployContract` from `@midnight-ntwrk/midnight-js-contracts`
6. Wire `generateProof` → calls `register()` first-time → calls `proveIdentity()` to produce real ZK proof
7. Add DUST check/generation flow (preprod faucet or automatic generation)

### Phase 2: Contract Lifecycle
- Persistent contract address (store after deploy, rejoin via `findDeployedContract`)
- Contract redeploy on recompile (verifier keys change when Compact contract changes)
- `createUnprovenDeployTx` + `submitTxAsync` pattern

### Phase 3: Persistence & Polish
- Persistent private state (LevelDB or localStorage)
- Multi-network support (preview, mainnet)
- Proof history stored locally

## Proven Transaction Pattern
When calling circuits via the low-level API, the flow is:
1. Build unproven transaction via `createUnprovenDeployTx` / `createUnprovenCallTx`
2. Prove via proof provider (1AM wallet's proving provider)
3. Balance via `walletProvider.balanceTx`
4. Sign intents (⚠️ known bug: signRecipe hardcodes 'pre-proof' but proven intents contain 'proof' data)
5. Submit via `submitTxAsync` (skips `watchForTxData` — no blocking on indexer)
6. UI reports immediate "Transaction submitted, waiting for indexer..." status

The "Failed to clone intent" fix requires manual signing via `signTransactionIntents()` — see midnight-js skill for implementation.

## Deploy & Circuit Call Flow
- Deploy: `createUnprovenDeployTx` + `submitTxAsync` + `waitForContractIndexing()` (polls state)
- Register (first-time): `findDeployedContract` + `createUnprovenCallTx('register')` + `submitTxAsync` → retries `proveIdentity` up to 60s waiting for register to be indexed
- ProveIdentity (reuse): `findDeployedContract` + `createUnprovenCallTx('proveIdentity')` + `submitTxAsync`
- Confirmation: after proveIdentity submit, polls `ledger(new ChargedState(state.state)).verifyCount` up to 20s — waits for counter to increment (proves on-chain indexing)
- Real-time status updates: "Building tx...", "Confirm in your 1AM wallet...", "Submitted, awaiting confirmation...", "Proof confirmed on-chain"

## Known Limitations
- Network hardcoded to `preview`
- Private state is in-memory only (lost on page reload)
- localStorage key `shadowvote:contract-address-preview` for contract address persistence
- Contract redeploy on recompile (verifier keys change when Compact contract changes)
