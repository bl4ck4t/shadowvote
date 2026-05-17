'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { WalletConnect } from '@/components/WalletConnect'
import { ProofPanel } from '@/components/ProofPanel'
import { StatusCard } from '@/components/StatusCard'
import type { Proof } from '@/lib/midnight'

export default function Home() {
  const [proof, setProof] = useState<Proof | null>(null)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[40%] h-[40%] rounded-full 
                        bg-purple-600/10 blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full 
                        bg-blue-600/10 blur-[120px] animate-pulse-glow" 
             style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">
              ShadowVote
            </h1>
            <p className="text-[10px] text-zinc-600 tracking-widest uppercase mt-0.5">
              Private verification powered by Midnight
            </p>
          </div>
          <WalletConnect />
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col">
        <div className="max-w-2xl mx-auto w-full px-6 pt-20 pb-12 flex-1 flex flex-col">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-8 flex-1 flex flex-col"
          >
            {/* Hero */}
            <div className="text-center space-y-3 pb-4">
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-2xl font-light text-zinc-100"
              >
                Private Identity Verification
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-sm text-zinc-500 max-w-md mx-auto leading-relaxed"
              >
                Connect your wallet to generate a zero-knowledge proof.
                Your identity stays private — only the verification is shared.
              </motion.p>
            </div>

            {/* Proof Section */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 space-y-6">
              <ProofPanel onProofComplete={setProof} />
              <StatusCard proof={proof} onProofUpdated={setProof} />
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Footer */}
            <motion.footer
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="text-center pb-8"
            >
              <p className="text-[10px] text-zinc-700 tracking-wider uppercase">
                Private verification powered by Midnight
              </p>
            </motion.footer>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
