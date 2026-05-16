'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createConnectedSession, detectWallet } from '@/lib/midnight'
import type { ConnectedSession } from '@/lib/midnight'

export type WalletStatus = 'checking' | 'detected' | 'not-found'

type WalletContextType = {
  address: string | null
  isConnected: boolean
  isConnecting: boolean
  walletStatus: WalletStatus
  session: ConnectedSession | null
  connect: (network?: string) => Promise<ConnectedSession | undefined>
  disconnect: () => void
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

  const connect = useCallback(async (network = 'preprod') => {
    if (connectingRef.current) return
    connectingRef.current = true
    setIsConnecting(true)
    try {
      const api = await (window as any).midnight?.['1am']?.connect(network)
      if (!api) throw new Error('No wallet found')
      const sess = await createConnectedSession(api)
      setSession(sess)
      setAddress(sess.unshieldedAddress)
      setIsConnected(true)
      return sess
    } finally {
      connectingRef.current = false
      setIsConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setAddress(null); setIsConnected(false); setSession(null)
    setWalletStatus('checking')
  }, [])

  return (
    <WalletContext.Provider value={{ address, isConnected, isConnecting, walletStatus, session, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}
