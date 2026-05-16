'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import type { WalletName } from '@solana/wallet-adapter-base'
import { motion } from 'framer-motion'
import { shortenAddress } from '@/lib/solana'

export function WalletConnect() {
  const { select, connect, disconnect, publicKey, connecting } = useWallet()

  const handleConnect = async () => {
    try {
      select('Phantom' as WalletName)
      await connect()
    } catch {
      console.error('Failed to connect to Phantom wallet')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {publicKey ? (
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm text-zinc-300 font-mono">
            {shortenAddress(publicKey.toBase58())}
          </span>
          <button
            onClick={disconnect}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="group relative px-6 py-3 rounded-xl bg-white/5 border border-white/10 
                     hover:bg-white/10 hover:border-purple-500/50 transition-all duration-300
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-zinc-200">
            {connecting ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-9-9" />
                  <path d="M21 3v6h-6" />
                  <path d="M21 3l-9 9" />
                </svg>
                Connect Phantom
              </>
            )}
          </span>
        </button>
      )}
    </motion.div>
  )
}
