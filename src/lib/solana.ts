export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

export function getPhantomWallet(): { isPhantom: boolean; solana?: any } {
  if (typeof window === 'undefined') return { isPhantom: false }
  const provider = (window as any).solana
  return { isPhantom: provider?.isPhantom ?? false, solana: provider }
}
