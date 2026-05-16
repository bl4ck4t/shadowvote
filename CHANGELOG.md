# Changelog

## 0.1.0 (2026-05-16)

- Initial scaffold: Next.js 16 + Tailwind v4 + Solana (Phantom) wallet
- Private identity verification UI with mock ZK proof flow
- Phantom wallet connection with proper async handling

### Added
- Phantom wallet connect/disconnect with `@solana/wallet-adapter-react`
- Mock private proof generation with step-by-step progress indicators
- Animated status card showing proof ID, commitment hash, and timestamp
- Background glow effects and responsive layout

### Changed
- Wallet connection: removed `setTimeout` hack, proper `select` + `await connect` + try/catch

## 0.2.0 (2026-05-16)

- Real Midnight Network ZK proving integration via 1AM wallet

### Added
- Compact smart contract (`contracts/identity.compact`) with `register` and `proveIdentity` circuits using Merkle tree for anonymous membership proofs
- Compiled ZK proving/verification keys and ZKIR artifacts for both circuits
- `@midnight-ntwrk` SDK dependencies (midnight-js, wallet SDK, compact-runtime, ledger-v8)
- `src/lib/midnight.ts`: full SDK integration with `createConnectedSession`, `detectWallet`, patched indexer public data provider, in-memory private state provider, and proof provider
- `src/contexts/WalletContext.tsx`: React context for 1AM wallet detection, connection, and session management
- `src/lib/isomorphic-ws-fix.mjs`: WebSocket shim for Next.js compatibility
- Next.js webpack config for WASM, top-level await, isomorphic-ws alias
- `npm run compile` and `npm run sync:zk` scripts for contract compilation and ZK asset syncing
- ZK assets hosted from `public/contract/identity/` for browser FetchZkConfigProvider

### Changed
- `src/components/Providers.tsx`: wraps app with both Solana and Midnight wallet providers
- `src/components/ProofPanel.tsx`: improved error handling showing actual error messages
- `package.json`: pinned Midnight SDK versions to exact numbers
