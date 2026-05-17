# Changelog

## 0.5.6 (2026-05-17)

### Added
- `queryTransactionStatus`: queries indexer by normalized tx hash (strips `0x`, lowercases) — replaces global `verifyCount` counter
- `checkProofStatus` export from `midnight.ts` for tx-specific confirmation checking
- `checkProofStatus` on WalletContext — wraps session's `config.indexerUri` for component use
- Auto-poll in StatusCard: when proof is `pending` with a `txId`, polls every 5s and auto-transitions to confirmed
- Explorer link on pending StatusCard: shows block explorer URL with message that indexer is slow, letting users check status directly

### Changed
- `submitTxAsync` return value (tx hash) is now captured and stored in `Proof.txId`
- Confirmation polling uses `queryTransactionStatus` by tx hash instead of global `verifyCount` — eliminates false positives from other users' transactions
- `Proof` interface gains `pending?: boolean` and `explorerUrl?: string` fields
- Removed `ChargedState` and `ledger` imports (no longer needed without `queryVerifyCount`)
- Removed `queryVerifyCount` function

### Fixed
- `submitTx` fallback `txHex.slice(0, 64)` always produced the same garbage hash (serialized tx starts with identical bytes) — now uses `tx.transactionHash()` from the `Transaction` object which returns a proper BLAKE2b-256 hex hash the indexer accepts

## 0.5.5 (2026-05-17)

### Fixed
- `preCount` was captured after `submitTxAsync`, so a fast indexer could increment the count before the query, causing the poll loop to never detect a change and falsely time out — `preCount` is now read before submitting in both deploy and reuse paths

## 0.5.4 (2026-05-17)

### Changed
- First-time flow (deploy path) now calls `proveIdentity` after `register` with up to 60s retry loop waiting for register tx to be indexed, then calls proveIdentity — previously jumped to "success" after register without generating a proof
- Proof confirmation now polls `ledger(new ChargedState(state.state)).verifyCount` for up to 20s after proveIdentity submit — previously checked only for state existence (always truthy post-deploy)
- Removed diagnostic console.log/warn/error logging from `generateProof` and `queryVerifyCount` after confirming polling works

### Fixed
- `ledger()` from generated contract bindings expects `ChargedState`, not `ContractState` — `queryVerifyCount` now wraps raw state in `new ChargedState(state.state)` before passing to `ledger()`

## 0.5.3 (2026-05-17)

### Fixed
- `proveIdentity` circuit crashed with "attempted to take root of non-rehashed bmt" WASM error during `partitionTranscripts` — removed `registrations.checkRoot()` call from circuit, membership is now verified by the `findPath` witness querying the actual Merkle tree via `registrations.findPathForLeaf`
- Fingerprint only hashed `register.verifier`, so changes to `proveIdentity` circuit weren't detected, causing `verifyContractState` to reject stale contracts — fingerprint now combines SHA-256 hashes of all verifier keys
- Updated `AGENTS.md` contract architecture and deploy flow descriptions

## 0.5.2 (2026-05-17)

### Added
- Contract fingerprint: SHA-256 hash of compiled ZKIR stored in localStorage alongside contract address
- Auto-redeploy on recompile: if the compiled contract's fingerprint changes (e.g. after `npm run compile`), stale localStorage is cleared and a fresh contract is deployed

## 0.5.1 (2026-05-17)

### Added
- `ConfirmDialog` component: animated modal with backdrop blur, portal-rendered to document.body to avoid stacking context issues
- Confirmation dialog before disconnecting wallet (replaces native `window.confirm`)

### Fixed
- Wallet disconnect only cleared React state — now calls `api.disconnect()`, clears localStorage contract address, and resets wallet status to `'detected'` instead of `'checking'` so the Connect button reappears
- Disconnect dialog was trapped inside `<header>` stacking context, rendering behind `<main>` content — fixed by rendering dialog via `createPortal` to `document.body`
- Disconnect dialog buttons were unresponsive when `isConnected` state changed — fixed by mounting dialog at component root level instead of inside a conditional block

## 0.5.0 (2026-05-17)

- Preview network (sponsored fees, no faucet/DUST needed)
- All blocking `watchForTxData` calls replaced with low-level `createUnprovenDeployTx`/`createUnprovenCallTx` + `submitTxAsync`
- Real-time status updates for every step (building tx, wallet confirmation, indexer wait)

### Added
- `retryOnSync()`: retries `getUnshieldedAddress()` up to 60s when 1AM wallet is still syncing
- `waitForContractIndexing()`: polls indexer for contract state with per-second progress callback
- Error mapping for wallet sync errors
- Intermediate status updates during all phases (before proving, before signing, during indexer wait)

### Changed
- Default network: `preprod` → `preview` (1AM ProofStation sponsors fees, zero DUST/faucet needed)
- `deployContract` → `createUnprovenDeployTx` + `submitTxAsync`: deploy no longer blocks on `watchForTxData`
- `contract.callTx.*` → `findDeployedContract` (state init) + `createUnprovenCallTx` + `submitTxAsync`: circuit calls no longer block on `watchForTxData`
- Error messages: DUST errors reference sponsored fees on preview/mainnet instead of preprod faucet
- localStorage key: `shadowvote:contract-address-preview` (network-prefixed)

### Fixed
- UI freezing on "Deploying identity contract" / "Registering identity" — status now updates immediately after submission

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

## 0.5.0 (2026-05-17)

- Switched default network from preprod to preview (sponsored fees, no faucet/DUST needed)

### Added
- `retryOnSync()` in `createConnectedSession`: retries `getUnshieldedAddress()` up to 60s when wallet is still syncing
- Error mapping for wallet sync errors with user-friendly message

### Changed
- Default network: `preprod` → `preview` across `WalletContext`, `WalletConnect`, and `generateProof` fallback
- Error messages updated: DUST errors now reference sponsored fees on preview/mainnet instead of preprod faucet

## 0.4.0 (2026-05-17)

- Real ZK circuit integration: `generateProof` deploys the identity contract and calls `register`/`proveIdentity` circuits instead of returning mock data

### Added
- `CompiledContract` setup with witness implementations (`callerSecret` produces deterministic 32-byte secret from wallet key, `findPath` queries ledger Merkle tree)
- `deployContract`/`findDeployedContract` flow: first-time deploys and registers, subsequent calls find contract and call `proveIdentity`
- Deterministic identity commitment computation using `persistentHash` matching contract circuit
- Contract address persistence via localStorage
- Step-aware error context in error messages showing which operation failed
- DUST/insufficient balance error detection with faucet guidance

### Changed
- `src/lib/midnight.ts`: `generateProof()` rewritten to call real circuits, added helper functions (`deriveSecret`, `computeCommitment`, `getStoredContractAddress`, `storeContractAddress`)
- `Proof` interface: added optional `txId` and `contractAddress` fields
- Error mapping: added handlers for custom errors (code 196/171), `Failed to clone intent`, `identity not registered`, Merkle tree full

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
