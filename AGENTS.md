# ShadowVote — Project Context

## Overview
Private identity verification dApp using Midnight Network ZK proving. Users connect their 1AM wallet and generate zero-knowledge proofs to verify identity without revealing private data.

## Tech Stack
- **Framework**: Next.js 16 (webpack mode, NOT Turbopack)
- **Styling**: Tailwind v4 + framer-motion
- **Wallet**: 1AM wallet extension (`window.midnight['1am']`)
- **ZK**: Midnight Network — Compact smart contract language + midnight-js SDK
- **Network**: Preprod (hardcoded)

## Key Files

| File | Purpose |
|------|---------|
| `contracts/identity.compact` | Compact smart contract: `register` + `proveIdentity` circuits using MerkleTree<16, Bytes<32>> |
| `contracts/managed/identity/` | Compiled ZK assets (prover/verifier keys, ZKIR) + TypeScript bindings |
| `src/lib/midnight.ts` | SDK integration: `createConnectedSession`, `detectWallet`, `generateProof`, `getErrorMessage` |
| `src/contexts/WalletContext.tsx` | React context: wallet detection, connection, error state, session management |
| `src/components/WalletConnect.tsx` | Header button: connect/disconnect, status, inline error display |
| `src/components/ProofPanel.tsx` | "Generate Private Proof" button + step-by-step progress/error/success display |
| `src/components/StatusCard.tsx` | Post-proof result card (proof ID, commitment hash, timestamp) |
| `src/lib/isomorphic-ws-fix.mjs` | WebSocket shim for Next.js webpack |
| `public/contract/identity/` | ZK assets served to browser via FetchZkConfigProvider |

## Wallet Flow
1. Page loads → polls for `window.midnight['1am']` (6s timeout → "not-found")
2. User clicks "Connect Wallet" → `wallet.connect('preprod')` → `createConnectedSession(api)`
3. Session stored in WalletContext → reused everywhere (no redundant `connect()` calls)
4. User clicks "Generate Private Proof" → `generateProof(address, setStatus, session)`
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

## Known Limitations
- ZK proving is still mocked (`generateProof` returns a dummy proof, doesn't call the actual contract circuits yet)
- Network hardcoded to `preprod`
- Private state is in-memory only (lost on page reload)
- No contract deployment flow yet — needs `createUnprovenDeployTx` + `submitTxAsync` pattern
