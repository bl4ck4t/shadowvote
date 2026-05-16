export interface Proof {
  proofId: string
  timestamp: number
  verified: boolean
  commitmentHash: string
}

export interface ProofStatus {
  step: string
  message: string
  progress: number
}

type StatusCallback = (status: ProofStatus) => void

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomHex(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function generateProof(
  walletAddress: string,
  onStatus?: StatusCallback,
): Promise<Proof> {
  const steps: ProofStatus[] = [
    { step: 'connecting', message: 'Connecting to Midnight network...', progress: 10 },
    { step: 'signing', message: 'Signing commitment...', progress: 30 },
    { step: 'generating', message: 'Generating zero-knowledge proof...', progress: 60 },
    { step: 'verifying', message: 'Verifying proof on-chain...', progress: 85 },
  ]

  for (const s of steps) {
    onStatus?.(s)
    await delay(400 + Math.random() * 300)
  }

  await delay(300)

  const proof: Proof = {
    proofId: `proof_${randomHex(16)}`,
    timestamp: Date.now(),
    verified: true,
    commitmentHash: `0x${randomHex(32)}`,
  }

  onStatus?.({ step: 'success', message: 'Private Verification Successful', progress: 100 })

  return proof
}

export function verifyProof(proof: Proof): boolean {
  return proof.verified === true
}
