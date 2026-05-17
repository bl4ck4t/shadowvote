'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createConnectedSession, getErrorMessage, checkProofStatus } from '@/lib/midnight'
import type { ConnectedSession } from '@/lib/midnight'

export type WalletStatus = 'checking' | 'detected' | 'not-found'

type WalletContextType = {
  address: string | null
  isConnected: boolean
  isConnecting: boolean
  connectError: string | null
  walletStatus: WalletStatus
  session: ConnectedSession | null
  connect: (network?: string) => Promise<ConnectedSession | undefined>
  disconnect: () => void
  clearError: () => void
  checkProofStatus: (txId: string) => Promise<boolean>
}

const WalletContext = createContext<WalletContextType | null>(null)

export function useWallet(): WalletContextType {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider')
  return ctx
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [walletStatus, setWalletStatus] = useState<WalletStatus>('checking')
  const [session, setSession] = useState<ConnectedSession | null>(null)
  const connectingRef = useRef(false)

  useEffect(() => {
    const startedAt = Date.now()
    const id = setInterval(() => {
      const w1am = (window as any).midnight?.['1am']
      if (w1am) { setWalletStatus('detected'); clearInterval(id); return }
      if (Date.now() - startedAt >= 6000) { setWalletStatus('not-found'); clearInterval(id) }
    }, 300)
    return () => clearInterval(id)
  }, [])

  const connect = useCallback(async (network = 'preview') => {
    if (connectingRef.current) return
    connectingRef.current = true
    setIsConnecting(true)
    setConnectError(null)
    try {
      const wallet = (window as any).midnight?.['1am']
      if (!wallet) throw new Error('1AM wallet extension not detected')

      const api = await wallet.connect(network)
      if (!api) throw new Error('Wallet connection returned no response')

      const sess = await createConnectedSession(api)
      setSession(sess)
      setAddress(sess.unshieldedAddress)
      setIsConnected(true)
      return sess
    } catch (e) {
      setConnectError(getErrorMessage(e))
    } finally {
      connectingRef.current = false
      setIsConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    const tryDisconnect = async () => {
      const wallet = (window as any).midnight?.['1am']
      if (session?.api && typeof session.api.disconnect === 'function') {
        try { await session.api.disconnect() } catch { /* ignore */ }
      }
      if (wallet && typeof wallet.disconnect === 'function') {
        try { await wallet.disconnect() } catch { /* ignore */ }
      }
      try { localStorage.removeItem('shadowvote:contract-address-preview') } catch { /* noop */ }
      try { localStorage.removeItem('shadowvote:contract-fingerprint-preview') } catch { /* noop */ }
      session?.providers.privateStateProvider.clear()
      session?.providers.privateStateProvider.clearSigningKeys()
    }
    tryDisconnect()
    setAddress(null); setIsConnected(false); setSession(null); setConnectError(null); setWalletStatus('detected')
  }, [session])

  const clearError = useCallback(() => setConnectError(null), [])

  const checkStatus = useCallback(async (txId: string): Promise<boolean> => {
    if (!session) return false
    return checkProofStatus(txId, session.config.indexerUri)
  }, [session])

  return (
    <WalletContext.Provider value={{
      address, isConnected, isConnecting, connectError, walletStatus,
      session, connect, disconnect, clearError,
      checkProofStatus: checkStatus,
    }}>
      {children}
    </WalletContext.Provider>
  )
}
