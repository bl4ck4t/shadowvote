# ShadowVote

Private identity verification dApp using **Midnight Network** zero-knowledge proofs. Connect your 1AM wallet and generate anonymous membership proofs without revealing your identity.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ Wallet    │  │ ProofPanel   │  │ StatusCard │  │
│  │ Connect   │  │ Generate ZK  │  │ Result +   │  │
│  │ (1AM ext) │  │ proof        │  │ auto-poll  │  │
│  └────┬─────┘  └──────┬───────┘  └─────┬─────┘  │
│       │               │                │         │
│  ┌────┴───────────────┴────────────────┴────┐    │
│  │          midnight.ts (SDK layer)          │    │
│  │  createConnectedSession / generateProof   │    │
│  └────────────────┬──────────────────────────┘    │
└───────────────────┼──────────────────────────────┘
                    │
┌───────────────────┼──────────────────────────────┐
│  Midnight Network │  (Preview)                    │
│                   ▼                               │
│  ┌──────────────────────────┐                     │
│  │ Identity Contract        │                     │
│  │  register()              │    Merkle tree      │
│  │  proveIdentity()         │ ←  of commitments  │
│  └──────────┬───────────────┘                     │
│             │                                     │
│  ┌──────────▼───────────────┐                     │
│  │ Indexer (GraphQL)        │                     │
│  │  queryContractState      │                     │
│  │  queryTransactionStatus  │                     │
│  └──────────────────────────┘                     │
└──────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (webpack) |
| Language | TypeScript |
| Styling | Tailwind v4 + framer-motion |
| Smart Contract | Compact (Midnight Network) |
| ZK Proving | Midnight JS SDK + 1AM Proving Provider |
| Wallet | 1AM browser extension (`window.midnight['1am']`) |
| Network | Preview (sponsored fees, no DUST needed) |
| Persistence | localStorage (contract address + verifier fingerprint) |
| Indexer | Midnight Indexer (GraphQL) |

## Smart Contract

The contract lives in `contracts/identity.compact` (33 lines):

- **`register()`** — Takes a secret via witness → computes `identityCommitment = persistentHash([pad("shadowvote:identity:v1"), secret])` → inserts commitment into `MerkleTree<16, Bytes<32>>` → disclosed publicly
- **`proveIdentity()`** — Takes secret → recomputes commitment → queries Merkle tree via `findPath` witness → outputs Merkle root (public). No direct Merkle tree access in circuit (avoids BMT bug)

## Getting Started

### Prerequisites

- Node.js 20+
- 1AM wallet browser extension
- Compact CLI (`~/.local/bin/compact`, compiler at `~/.compact/versions/0.31.0/`)

### Install

```bash
npm install
```

### Development

```bash
npm run dev        # next dev --webpack
```

### Build

```bash
npm run build      # next build --webpack
```

### Compile Contract (if you modify `contracts/identity.compact`)

```bash
source $HOME/.local/bin/env
npm run compile    # compact compile contracts/identity.compact contracts/managed/identity
npm run sync:zk    # copy ZK assets to public/
```

## Project Structure

```
├── contracts/
│   ├── identity.compact            # Compact smart contract
│   └── managed/identity/           # Compiled ZK assets + TS bindings
│       ├── contract/               # Generated TypeScript contract bindings
│       ├── keys/                   # Prover/verifier keys
│       ├── zkir/                   # ZK intermediate representation
│       └── compiler/               # Compiler metadata
├── src/
│   ├── app/page.tsx                # Main page / layout
│   ├── lib/
│   │   ├── midnight.ts             # SDK integration (core logic)
│   │   └── isomorphic-ws-fix.mjs   # WebSocket shim for webpack
│   ├── contexts/
│   │   └── WalletContext.tsx        # Wallet state management
│   ├── components/
│   │   ├── WalletConnect.tsx        # Connect/disconnect button
│   │   ├── ProofPanel.tsx           # Proof generation UI
│   │   ├── StatusCard.tsx           # Proof result display
│   │   ├── ConfirmDialog.tsx        # Modal dialog
│   │   └── Providers.tsx            # React context providers
├── public/contract/identity/       # Served ZK assets
├── HACKATHON.md                    # Hackathon submission story
└── AGENTS.md                       # Detailed project context
```

## Wallet Flow

1. Page loads → polls for `window.midnight['1am']` (6s timeout → "not-found")
2. User clicks "Connect Wallet" → `wallet.connect('preview')` → `createConnectedSession(api)`
3. Session stored in WalletContext → reused everywhere
4. User clicks "Generate Private Proof" → `generateProof(address, onStatus, session)`
5. Result displayed in StatusCard with auto-polling confirmation

## Transaction Lifecycle

```
Deploy (first-time):
  createUnprovenDeployTx → submitTxAsync → waitForContractIndexing

Register (first-time):
  findDeployedContract → createUnprovenCallTx('register') → submitTxAsync
  → retry createUnprovenCallTx('proveIdentity') up to 60s (waiting for indexer)

Prove Identity (subsequent visits):
  findDeployedContract → createUnprovenCallTx('proveIdentity') → submitTxAsync

Confirmation (both paths):
  Query indexer by tx hash every 2s for up to 20s
```

## Error Handling

All errors are mapped to user-friendly messages via `getErrorMessage()` in `midnight.ts`. Categories:

- Wallet not found / network mismatch / sync in progress
- Transaction failures (custom errors 196/171)
- Indexer timeouts / network errors
- User rejection / cancellation
- Identity not registered / Merkle tree full
- DUST/balance issues (with sponsored fee guidance)

## Key Design Decisions

- **No `checkRoot()` in circuit** — avoids BMT binary Merkle tree bug in WASM `partitionTranscripts`
- **Deterministic secrets** — `callerSecret` uses SHA-256 of `"shadowvote:caller-secret:v1:" + coinPublicKey` for stable identity per wallet
- **Verifier fingerprinting** — SHA-256 of all verifier keys combined; auto-redeploys on contract recompile
- **Tx-specific confirmation** — polls by transaction hash, not global counter (avoids false positives from other users)
- **Preview network** — fees sponsored by 1AM ProofStation, zero DUST/faucet interaction

## Limitations

- Network hardcoded to `preview`
- Private state is in-memory only (lost on page reload)
- Contract address stored in localStorage (cleared on disconnect)
- Max 65,536 registered identities (Merkle tree depth 16)
