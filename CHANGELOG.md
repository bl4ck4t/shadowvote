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

## 0.3.0 (2026-05-16)

- Dropped Solana/Phantom entirely, migrated to 1AM-only wallet
- Comprehensive error handling with user-friendly messages on UI

### Added
- `getErrorMessage()` in `src/lib/midnight.ts`: maps errors to actionable messages (network mismatch, wallet not found, timeouts, user rejection, etc.)
- `connectError` state in `WalletContext.tsx`: tracks connection errors and auto-clears
- Error display in `WalletConnect.tsx`: red error text with 6s auto-dismiss
- `CHANGELOG.md`

### Changed
- `src/components/Providers.tsx`: simplified to only `WalletProvider` (removed Solana providers)
- `src/components/WalletConnect.tsx`: rewritten for 1AM wallet with four states (checking, connected, disconnected, not-found + error)
- `src/components/ProofPanel.tsx`: uses 1AM wallet context instead of Solana `useWallet()`, passes existing session to `generateProof()`
- `src/lib/midnight.ts`: `generateProof()` accepts optional session param — skips redundant `wallet.connect()` when already connected, preventing network mismatch errors
- `src/contexts/WalletContext.tsx`: `connect()` now catches and stores errors via `setConnectError()`
- `src/lib/solana.ts`: removed `getPhantomWallet()`, kept only `shortenAddress()`
- `src/app/page.tsx`: updated footer tagline

### Removed
- `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, `@solana/wallet-adapter-wallets`, `@solana/web3.js` dependencies (909 packages)

### Fixed
- Network mismatch error: `generateProof()` reuses existing session instead of calling `wallet.connect()` again
- WalletConnect error display: clean inline text with auto-dismiss, no layout shift
