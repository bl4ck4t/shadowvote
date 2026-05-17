'use client'

import { motion } from 'framer-motion'
import { useWallet } from '@/contexts/WalletContext'
import { useEffect } from 'react'

export function WalletConnect() {
  const { address, isConnected, isConnecting, connectError, walletStatus, connect, disconnect, clearError } = useWallet()

  useEffect(() => {
    if (connectError) {
      const timer = setTimeout(clearError, 6000)
      return () => clearTimeout(timer)
    }
  }, [connectError, clearError])

  if (walletStatus === 'checking') {
    return (
      <span className="text-zinc-600 text-[11px] font-mono animate-pulse">
        Checking wallet...
      </span>
    )
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-sm text-zinc-300 font-mono">
          {address?.slice(0, 4)}...{address?.slice(-4)}
        </span>
        <button
          onClick={() => { if (window.confirm('Disconnect wallet?')) disconnect() }}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <button
        onClick={() => connect('preview')}
        disabled={isConnecting}
        className="group relative px-6 py-3 rounded-xl bg-white/5 border border-white/10 
                   hover:bg-white/10 hover:border-purple-500/50 transition-all duration-300
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          {isConnecting ? (
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
              Connect Wallet
            </>
          )}
        </span>
      </button>
      {connectError && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[11px] font-mono text-red-400 mt-2 leading-relaxed max-w-[240px]"
        >
          {connectError}
        </motion.p>
      )}
      {!connectError && walletStatus === 'not-found' && (
        <p className="text-[10px] font-mono text-zinc-600 mt-2">
          Install{' '}
          <a href="https://1am.xyz" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-purple-400 underline underline-offset-2">1AM wallet</a>
          {' '}extension
        </p>
      )}
    </motion.div>
  )
}
