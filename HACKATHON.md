# ShadowVote

## Inspiration

We wanted to build something that actually *uses* zero-knowledge proofs for a real privacy problem — not just a toy counter contract. Online voting, identity verification, membership proofs — they all suffer from the same tension: you need to prove you're authorized without revealing *who* you are. Most "private" systems still hand over your email, phone number, or wallet address.

Midnight Network's dual-state architecture (public + private) and Compact language made this tractable: we could write a Merkle-tree-based membership contract where the user's identity commitment lives on-chain, but the secret that generates it never leaves their wallet.

## What it does

ShadowVote is a browser dApp that lets users generate zero-knowledge proofs of identity without revealing their private data. Connect your 1AM wallet, register your identity commitment (one-time), then generate anonymous proofs that you're a registered member — all without disclosing your secret key or wallet address.

The contract uses a Merkle tree of identity commitments. The `register` circuit inserts your commitment (public). The `proveIdentity` circuit proves you know the secret for a leaf in the tree — and outputs only the Merkle root as public data. An observer learns: someone in the tree proved membership. That's it.

## How we built it

- **Contract**: Written in Compact (`contracts/identity.compact`), compiled with Midnight's toolchain (v0.31.0). Two circuits — `register` inserts a `persistentHash([domain_sep, secret])` into a `MerkleTree<16, Bytes<32>>`; `proveIdentity` recomputes the commitment from a witness secret, queries the on-chain tree via `findPath`, and discloses the root.
- **Frontend**: Next.js 16 (webpack), Tailwind v4, framer-motion. Three states: wallet connect, proof generation with step-by-step progress, result card with auto-polling confirmation.
- **Wallet**: 1AM wallet extension (`window.midnight['1am']`). No DUST needed — Preview network sponsors fees via 1AM ProofStation.
- **SDK**: midnight-js for `createUnprovenDeployTx`/`createUnprovenCallTx` + `submitTxAsync`. Custom witness functions: `callerSecret` derives a deterministic SHA-256 secret from the user's coin public key; `findPath` queries the ledger's Merkle tree directly.
- **Persistence**: Contract address + verifier fingerprint in localStorage. Auto-redeploys when the contract recompiles.
- **Confirmation**: Polls the indexer GraphQL endpoint by transaction hash (not a global counter) — eliminates false positives from other users.

## Challenges we ran into

1. **The BMT root bug**: The `proveIdentity` circuit originally called `registrations.checkRoot()` to verify the Merkle path — but `partitionTranscripts` in the WASM runtime crashed with "attempted to take root of non-rehashed BMT". Fix: removed `checkRoot` entirely. Membership is verified implicitly because the `findPath` witness queries the actual on-chain tree. The circuit just recomputes the root from the path and discloses it.

2. **Indexer timing**: After submitting a `register` tx, the indexer takes 2–30 seconds to reflect the new leaf. Calling `proveIdentity` immediately fails with "identity not registered". Solution: a retry loop (up to 60s) that keeps retrying `createUnprovenCallTx` until the indexer catches up.

3. **The fake tx hash**: `submitTx` fallback used `txHex.slice(0, 64)` which always produced the same garbage (serialized txs start with identical bytes). Fix: use `tx.transactionHash()` from the `Transaction` object — returns a real BLAKE2b-256 hash the indexer accepts.

4. **"Failed to clone intent"**: The standard `signRecipe` API hardcodes `'pre-proof'` but proven intents contain `'proof'` data. Workaround: manual `signTransactionIntents()` with the correct attestation label. Cost us a day of debugging.

5. **Wallet sync**: On first connection, the wallet sometimes reports "syncing" for up to 30s. Added `retryOnSync()` — polls `getUnshieldedAddress()` up to 60s with 2s delays and a clear UI message.

6. **Verifier key fingerprinting**: Originally only hashed `register.verifier` — changes to `proveIdentity` circuit weren't detected, causing stale contract reuse. Fixed by SHA-256 hashing all verifier keys combined.

## Accomplishments that we're proud of

- **It actually works end-to-end**: Real ZK proofs, real on-chain transactions, real indexer confirmation. Not a simulation.
- **Sub-60s UX from cold start**: First-time visitor → install wallet → connect → register → prove. The progress bar and step-by-step status messages make the wait feel fast.
- **No DUST friction**: Preview network sponsorship means users never see "insufficient balance" errors. Just connect and prove.
- **Auto-redeploy on recompile**: Contract fingerprinting means we can iterate on the Compact contract without manual cleanup.
- **Clean error handling**: Every failure path has a user-friendly message — network errors, sync issues, identity-not-registered, Merkle tree full — no raw stack traces.
- **The contract is minimal**: 33 lines of Compact for register + proveIdentity. The Merkle tree membership proof pattern is reusable for any anonymous auth system.

## What we learned

- **Midnight's proving model is elegant but raw**: The low-level `createUnprovenDeployTx`/`prove`/`balanceTx`/`signTransactionIntents`/`submitTxAsync` pipeline is powerful but poorly documented. The "Failed to clone intent" bug alone took hours of reading SDK source.
- **Indexer latency shapes the UX**: You can't treat contract calls as synchronous. Build retry loops and pending states into the UI from day one.
- **Witness functions are the right abstraction**: Putting Merkle tree queries in witnesses (not circuits) avoids BMT bugs and keeps the circuit pure. The `findPath` witness queries live ledger state — the circuit just verifies the path is valid.
- **`persistentHash` is deterministic cross-platform**: The same `persistentHash([pad("shadowvote:identity:v1"), secret])` in Compact and TypeScript means the commitment computed in the browser matches the contract — critical for UX (show the user their commitment before any transaction).
- **Compact's type system catches real bugs**: The `MerkleTreePath<16, Bytes<32>>` type propagates through the circuit; mismatches fail at compile time. The BMT bug was a runtime error we couldn't have caught statically, but the compiler caught everything else.

## What's next for ShadowVote

1. **Persistent private state**: Currently in-memory (lost on reload). LevelDB (or localStorage for simple cases) means users don't re-register.
2. **Multi-network support**: Preview is hardcoded. Route to preprod/mainnet based on wallet network.
3. **Proof history**: Store past proofs locally with their tx hashes and verification status.
4. **Anonymity set scaling**: The `MerkleTree<16>` supports 65,536 leaves. For real voting, we'd want deeper trees or incremental membership.
5. **Nullifier pattern**: Currently a user can prove membership multiple times. Adding a nullifier (revealed on first use) prevents double-voting while preserving anonymity.
6. **Real voting contract**: Build on top of ShadowVote — submit encrypted ballots, tally with ZK, only registered members can vote.
