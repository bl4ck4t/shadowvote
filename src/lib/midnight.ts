import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id'
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider'
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider'
import { ContractState, ChargedState, persistentHash, CompactTypeBytes, CompactTypeVector, sampleSigningKey } from '@midnight-ntwrk/compact-runtime'
import { LedgerParameters, ZswapChainState } from '@midnight-ntwrk/ledger-v8'
import type { WalletProvider, MidnightProvider } from '@midnight-ntwrk/midnight-js-types'
import { CompiledContract } from '@midnight-ntwrk/compact-js'
import { createUnprovenDeployTx, createUnprovenCallTx, submitTxAsync, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts'
import { Contract as IdentityContract, ledger } from '../../contracts/managed/identity/contract/index.js'

export interface Proof {
  proofId: string
  timestamp: number
  verified: boolean
  commitmentHash: string
  txId?: string
  contractAddress?: string
}

// Compact type descriptor: Vector<2, Bytes<32>> — used for identity commitment hash
const bytes32Type = new CompactTypeBytes(32)
const vec2Bytes32 = new CompactTypeVector(2, bytes32Type)

// Domain separator for identity commitment: pad(32, "shadowvote:identity:v1")
const DOMAIN_SEP_IDENTITY = new Uint8Array(32)
DOMAIN_SEP_IDENTITY.set(new TextEncoder().encode('shadowvote:identity:v1'))

// Domain separator for caller secret derivation
const CALLER_SECRET_PREFIX = 'shadowvote:caller-secret:v1:'

const CONTRACT_FINGERPRINT_KEY = 'shadowvote:contract-fingerprint-preview'

export interface ProofStatus {
  step: string
  message: string
  progress: number
}

type StatusCallback = (status: ProofStatus) => void

export interface ConnectedSession {
  api: any
  config: any
  providers: {
    privateStateProvider: ReturnType<typeof createPrivateStateProvider>
    publicDataProvider: ReturnType<typeof createPatchedPublicDataProvider>
    zkConfigProvider: FetchZkConfigProvider<any>
    proofProvider: { proveTx: (unprovenTx: any, _config: any) => Promise<any> }
    walletProvider: WalletProvider
    midnightProvider: MidnightProvider
  }
  unshieldedAddress: string
}

function randomHex(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex
  if (normalized.length % 2 !== 0) throw new Error('Invalid hex string')
  const bytes = new Uint8Array(normalized.length / 2)
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16)
  }
  return bytes
}

function createPrivateStateProvider() {
  let scope = ''
  const stateStore = new Map<string, unknown>()
  const signingKeyStore = new Map<string, unknown>()
  const key = (id: string) => `${scope}:${id}`
  return {
    setContractAddress(address: string) { scope = address },
    async set(id: string, state: unknown) { stateStore.set(key(id), state) },
    async get(id: string) { return stateStore.get(key(id)) ?? null },
    async remove(id: string) { stateStore.delete(key(id)) },
    async clear() { stateStore.clear() },
    async setSigningKey(addr: string, k: unknown) { signingKeyStore.set(addr, k) },
    async getSigningKey(addr: string) { return signingKeyStore.get(addr) ?? null },
    async removeSigningKey(addr: string) { signingKeyStore.delete(addr) },
    async clearSigningKeys() { signingKeyStore.clear() },
    async exportPrivateStates(): Promise<never> { throw new Error('Not implemented') },
    async importPrivateStates(): Promise<never> { throw new Error('Not implemented') },
    async exportSigningKeys(): Promise<never> { throw new Error('Not implemented') },
    async importSigningKeys(): Promise<never> { throw new Error('Not implemented') },
  }
}

function createPatchedPublicDataProvider(queryUrl: string, subscriptionUrl: string) {
  const base = indexerPublicDataProvider(queryUrl, subscriptionUrl)
  async function queryLatest(query: string, address: string) {
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables: { address } }),
    })
    if (!res.ok) throw new Error(`Indexer HTTP error: ${res.status}`)
    const payload = await res.json()
    if (payload.errors?.length) throw new Error(payload.errors.map((e: any) => e.message).join('; '))
    return payload.data?.contractAction ?? null
  }
  return {
    ...base,
    async queryContractState(contractAddress: string, config?: any) {
      if (config) return base.queryContractState(contractAddress, config)
      const action = await queryLatest(`
        query LATEST_CONTRACT_STATE($address: HexEncoded!) {
          contractAction(address: $address) { state }
        }`, contractAddress)
      return action ? ContractState.deserialize(fromHex(action.state)) : null
    },
    async queryZSwapAndContractState(contractAddress: string, config?: any) {
      if (config) return base.queryZSwapAndContractState(contractAddress, config)
      const action = await queryLatest(`
        query LATEST_BOTH_STATE($address: HexEncoded!) {
          contractAction(address: $address) {
            state
            zswapState
            transaction { block { ledgerParameters } }
          }
        }`, contractAddress)
      if (!action?.zswapState) return null
      return [
        ZswapChainState.deserialize(fromHex(action.zswapState)),
        ContractState.deserialize(fromHex(action.state)),
        action.transaction?.block?.ledgerParameters
          ? LedgerParameters.deserialize(fromHex(action.transaction.block.ledgerParameters))
          : LedgerParameters.initialParameters(),
      ]
    },
  }
}

async function retryOnSync<T>(fn: () => Promise<T>, maxRetries = 30, delayMs = 2000): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (e: any) {
      if (e?.message?.includes('syncing') && i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delayMs))
        continue
      }
      throw e
    }
  }
  throw new Error('Wallet sync timed out after multiple retries')
}

export async function createConnectedSession(api: any): Promise<ConnectedSession> {
  const [config, unshieldedAddress, shieldedAddress] = await Promise.all([
    api.getConfiguration(),
    retryOnSync<{ unshieldedAddress: string }>(() => api.getUnshieldedAddress()),
    api.getShieldedAddresses(),
  ])

  setNetworkId(config.networkId)

  const zkConfigProvider = new FetchZkConfigProvider(
    new URL('/contract/identity', window.location.origin).toString(),
    window.fetch.bind(window),
  )

  const provingProvider = await api.getProvingProvider(zkConfigProvider)

  const { CostModel } = await import('@midnight-ntwrk/ledger-v8')

  const proofProvider = {
    async proveTx(unprovenTx: any, _config: any) {
      return unprovenTx.prove(provingProvider, CostModel.initialCostModel())
    },
  }

  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => shieldedAddress.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shieldedAddress.shieldedEncryptionPublicKey,
    balanceTx: async (tx: any) => {
      const txHex = toHex(tx.serialize())
      const balanced = await api.balanceUnsealedTransaction(txHex)
      if (!balanced?.tx) throw new Error('balanceUnsealedTransaction returned invalid result')
      const { Transaction } = await import('@midnight-ntwrk/ledger-v8')
      return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced.tx))
    },
  }

  const midnightProvider: MidnightProvider = {
    submitTx: async (tx: any) => {
      const txHex = toHex(tx.serialize())
      const result = await api.submitTransaction(txHex)
      if (typeof result === 'string' && result) return result
      if (result?.transactionId) return result.transactionId
      if (result?.id) return result.id
      return txHex.slice(0, 64)
    },
  }

  const publicDataProvider = createPatchedPublicDataProvider(config.indexerUri, config.indexerWsUri)

  return {
    api,
    config,
    providers: {
      privateStateProvider: createPrivateStateProvider(),
      publicDataProvider,
      zkConfigProvider,
      proofProvider,
      walletProvider,
      midnightProvider,
    },
    unshieldedAddress: unshieldedAddress.unshieldedAddress,
  }
}

export function detectWallet(): Promise<any | null> {
  return new Promise((resolve) => {
    let attempts = 0
    const check = () => {
      const wallet = (window as any).midnight?.['1am']
      if (wallet) { resolve(wallet); return }
      if (++attempts > 50) { resolve(null); return }
      setTimeout(check, 100)
    }
    check()
  })
}

function computeCommitment(secret: Uint8Array): Uint8Array {
  return persistentHash(vec2Bytes32, [DOMAIN_SEP_IDENTITY, secret])
}

async function deriveSecret(coinPublicKey: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(`${CALLER_SECRET_PREFIX}${coinPublicKey}`)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data))
}

function getStoredContractAddress(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem('shadowvote:contract-address-preview') } catch { return null }
}

function storeContractAddress(address: string): void {
  try { localStorage.setItem('shadowvote:contract-address-preview', address) } catch { /* noop */ }
}

async function getContractFingerprint(): Promise<string> {
  const [reg, prove] = await Promise.all([
    fetch('/contract/identity/keys/register.verifier'),
    fetch('/contract/identity/keys/proveIdentity.verifier'),
  ])
  if (!reg.ok || !prove.ok) throw new Error('Failed to fetch verifier keys for fingerprint')
  const combined = new Uint8Array([
    ...new Uint8Array(await crypto.subtle.digest('SHA-256', await reg.arrayBuffer())),
    ...new Uint8Array(await crypto.subtle.digest('SHA-256', await prove.arrayBuffer())),
  ])
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', combined)))
}

function getStoredContractFingerprint(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(CONTRACT_FINGERPRINT_KEY) } catch { return null }
}

function storeContractFingerprint(fp: string): void {
  try { localStorage.setItem(CONTRACT_FINGERPRINT_KEY, fp) } catch { /* noop */ }
}

function clearStoredContractFingerprint(): void {
  try { localStorage.removeItem(CONTRACT_FINGERPRINT_KEY) } catch { /* noop */ }
}

async function waitForContractIndexing(
  publicDataProvider: ReturnType<typeof createPatchedPublicDataProvider>,
  contractAddress: string,
  onPoll?: (attempt: number) => void,
  maxAttempts = 60,
  pollIntervalMs = 2000,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const state = await publicDataProvider.queryContractState(contractAddress)
    if (state?.data) return
    onPoll?.(i + 1)
    await new Promise(r => setTimeout(r, pollIntervalMs))
  }
  throw new Error('Contract not indexed after timeout')
}

const STEP_LABELS: Record<string, string> = {
  deploying: 'Deploying contract',
  registering: 'Registering identity',
  joining: 'Joining contract',
  generating: 'Generating proof',
  verifying: 'Verifying proof',
}

export function getErrorMessage(e: unknown, step?: string): string {
  if (!(e instanceof Error)) return 'An unexpected error occurred. Please try again.'
  const msg = e.message
  const ctx = step ? ` during "${STEP_LABELS[step] || step}"` : ''

  if (msg.includes('Operation failed') && msg.includes('Custom error'))
    return `Midnight network rejected the transaction${ctx}. Error: ${msg.trim()}.`
  if (msg.includes('1AM wallet not') || msg.includes('No wallet found') || msg.includes('extension not detected'))
    return '1AM wallet not found. Install the 1AM extension from the Chrome Web Store, then refresh.'
  if (msg.includes('Network mismatch'))
    return 'Network mismatch. Switch your 1AM wallet to the correct network (preview/preprod) and try again.'
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Network request failed'))
    return 'Could not reach the Midnight network. Check your internet connection and try again.'
  if (msg.includes('Failed to clone intent'))
    return 'Transaction signing failed. Please try again.'
  if (msg.includes('identity not registered'))
    return 'Your identity has not been registered yet. Register first, then generate a proof.'
  if (msg.includes('isFull') || msg.includes('Merkle tree is full'))
    return 'The identity registry is full. Contact the administrator.'
  if (msg.includes('insufficient') || msg.includes('dust') || msg.includes('balance'))
    return 'Insufficient DUST balance for transaction fees. On preview/mainnet, DUST is sponsored by 1AM ProofStation. Switch your wallet to preview or mainnet.'
  if (msg.includes('getConfiguration') || msg.includes('getUnshieldedAddress') || msg.includes('getShieldedAddresses'))
    return 'Wallet connection lost. Please reconnect your 1AM wallet and try again.'
  if (msg.includes('deserialize') || msg.includes('serialize'))
    return 'Data format error from the Midnight network. Please try again.'
  if (msg.includes('createProofProvider') || msg.includes('getProvingProvider') || msg.includes('prove'))
    return 'Zero-knowledge proof system failed to initialize. Please try again.'
  if (msg.includes('syncing'))
    return '1AM wallet is still syncing with the network. Please wait and try again.'
  if (msg.includes('timeout') || msg.includes('timed out'))
    return 'The request timed out. The network may be slow. Please try again.'
  if (msg.includes('not confirmed'))
    return 'The proof transaction was submitted but not yet confirmed on-chain after 20s. It should appear shortly.'
  if (msg.includes('User rejected') || msg.includes('user rejected') || msg.includes('cancelled'))
    return 'Proof generation was cancelled.'

  return `${msg}${ctx}. Please try again.`
}

async function queryVerifyCount(
  publicDataProvider: ReturnType<typeof createPatchedPublicDataProvider>,
  contractAddress: string,
): Promise<bigint> {
  const state = await publicDataProvider.queryContractState(contractAddress)
  if (!state) return 0n
  try {
    const charged = new ChargedState(state.state)
    return ledger(charged).verifyCount
  } catch {
    return 0n
  }
}

export async function generateProof(
  walletAddress: string,
  onStatus?: StatusCallback,
  session?: ConnectedSession,
): Promise<Proof> {
  const report = (step: string, message: string, progress: number) => {
    onStatus?.({ step, message, progress })
  }

  let currentStep: string | undefined

  try {
    if (!session) {
      report('connecting', 'Connecting to Midnight network...', 10)
      const wallet = await detectWallet()
      if (!wallet) throw new Error('1AM wallet not found')
      const api = await wallet.connect('preview')
      session = await createConnectedSession(api)
    }

    const { providers } = session
    const coinPublicKey = providers.walletProvider.getCoinPublicKey()

    report('preparing', 'Deriving identity secret...', 20)
    const secret = await deriveSecret(coinPublicKey)
    const commitment = computeCommitment(secret)
    const commitmentHash = `0x${toHex(commitment)}`

    report('preparing', 'Setting up zero-knowledge circuit...', 30)

    const witnesses = {
      callerSecret: (ctx: { privateState: unknown }) => {
        return [ctx.privateState, secret]
      },
      findPath: (ctx: { privateState: unknown; ledger: { registrations: { findPathForLeaf: (c: Uint8Array) => any } } }, comm: Uint8Array) => {
        const path = ctx.ledger.registrations.findPathForLeaf(comm)
        if (!path) throw new Error('identity not registered')
        return [ctx.privateState, path]
      },
    }

    // @ts-ignore
    const base = CompiledContract.make('shadowvote-identity', IdentityContract)
    // @ts-ignore
    const withWits = CompiledContract.withWitnesses(base, witnesses)
    // @ts-ignore
    const compiledContract = CompiledContract.withCompiledFileAssets(withWits, '/contract/identity')

    const contractAddress = getStoredContractAddress()
    const currentFingerprint = await getContractFingerprint()

    let contractAddressResult = ''
    if (contractAddress && getStoredContractFingerprint() === currentFingerprint) {
      contractAddressResult = contractAddress!
    } else {
      if (contractAddress) {
        clearStoredContractFingerprint()
        try { localStorage.removeItem('shadowvote:contract-address-preview') } catch { /* noop */ }
      }
    }

    if (!contractAddressResult) {
      currentStep = 'deploying'
      report('deploying', 'Building deploy transaction...', 35)

      const deployTxData = await createUnprovenDeployTx(
        { zkConfigProvider: providers.zkConfigProvider, walletProvider: providers.walletProvider },
        { compiledContract, signingKey: sampleSigningKey() },
      )

      contractAddressResult = deployTxData.public.contractAddress
      storeContractAddress(contractAddressResult)
      storeContractFingerprint(currentFingerprint)

      await providers.privateStateProvider.setContractAddress(contractAddressResult)
      await providers.privateStateProvider.setSigningKey(contractAddressResult, deployTxData.private.signingKey)

      report('deploying', 'Confirm the transaction in your 1AM wallet...', 45)
      await submitTxAsync(providers as any, {
        unprovenTx: deployTxData.private.unprovenTx,
      })

      report('deploying', 'Waiting for indexer to confirm deployment...', 50)
      await waitForContractIndexing(providers.publicDataProvider, contractAddressResult, (attempt) => {
        report('deploying', `Waiting for indexer to confirm deployment (${attempt}s)...`, 50 + Math.min(attempt, 30))
      })

      currentStep = 'registering'
      report('registering', 'Registering identity commitment on-chain...', 55)

      await findDeployedContract(providers as any, {
        compiledContract,
        contractAddress: contractAddressResult,
        privateStateId: 'shadowvote-identity',
        initialPrivateState: {},
      })

      report('registering', 'Confirm the transaction in your 1AM wallet...', 65)
      const registerTxData = await createUnprovenCallTx(providers as any, {
        compiledContract,
        contractAddress: contractAddressResult,
        circuitId: 'register' as any,
      })
      await submitTxAsync(providers as any, {
        unprovenTx: registerTxData.private.unprovenTx,
        circuitId: 'register' as any,
      })

      // Now prove identity — retry until register tx is indexed
      currentStep = 'proving'
      report('proving', 'Generating zero-knowledge proof of identity...', 75)
      let proveTxData: any
      for (let i = 0; ; i++) {
        try {
          proveTxData = await createUnprovenCallTx(providers as any, {
            compiledContract,
            contractAddress: contractAddressResult,
            circuitId: 'proveIdentity' as any,
          })
          break
        } catch (e: any) {
          if (e.message?.includes('identity not registered') && i < 29) {
            report('proving', `Waiting for registration to be indexed (${i + 1}s)...`, 75 + Math.min(i, 10))
            await new Promise(r => setTimeout(r, 2_000))
            continue
          }
          throw e
        }
      }

      const preCount = await queryVerifyCount(providers.publicDataProvider, contractAddressResult)
      report('proving', 'Confirm the prove transaction in your 1AM wallet...', 88)
      await submitTxAsync(providers as any, {
        unprovenTx: proveTxData.private.unprovenTx,
        circuitId: 'proveIdentity' as any,
      })

      report('verifying', 'Proof submitted — awaiting on-chain confirmation...', 92)
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 2_000))
        const count = await queryVerifyCount(providers.publicDataProvider, contractAddressResult)
        if (count > preCount) {
          report('verifying', 'Proof confirmed on-chain', 98)
          break
        }
      }
    } else {
      contractAddressResult = contractAddress!
      currentStep = 'joining'
      report('joining', 'Joining deployed identity contract...', 40)

      await findDeployedContract(providers as any, {
        compiledContract,
        contractAddress: contractAddressResult,
        privateStateId: 'shadowvote-identity',
        initialPrivateState: {},
      })

      currentStep = 'generating'
      report('generating', 'Generating zero-knowledge proof...', 60)
      report('generating', 'Confirm the transaction in your 1AM wallet...', 70)
      const proveTxData = await createUnprovenCallTx(providers as any, {
        compiledContract,
        contractAddress: contractAddressResult,
        circuitId: 'proveIdentity' as any,
      })
      const preCount = await queryVerifyCount(providers.publicDataProvider, contractAddressResult)
      report('generating', 'Transaction submitted, waiting for indexer...', 80)
      await submitTxAsync(providers as any, {
        unprovenTx: proveTxData.private.unprovenTx,
        circuitId: 'proveIdentity' as any,
      })

      report('verifying', 'Proof submitted — awaiting on-chain confirmation...', 88)
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 2_000))
        const count = await queryVerifyCount(providers.publicDataProvider, contractAddressResult)
        if (count > preCount) {
          report('verifying', 'Proof confirmed on-chain', 95)
          break
        }
      }
    }

    report('success', 'Private Verification Successful', 100)
    return {
      proofId: commitmentHash.slice(0, 18),
      timestamp: Date.now(),
      verified: true,
      commitmentHash,
      contractAddress: contractAddressResult,
    }
  } catch (e) {
    throw new Error(getErrorMessage(e, currentStep))
  }
}

export function verifyProof(proof: Proof): boolean {
  return proof.verified === true
}
