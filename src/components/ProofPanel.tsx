'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import { generateProof } from '@/lib/midnight'
import type { ProofStatus } from '@/lib/midnight'

interface ProofPanelProps {
  onProofComplete: (result: any) => void
}

const statusIcons: Record<string, string> = {
  connecting: '⟐',
  signing: '⟡',
  generating: '⟢',
  verifying: '⟣',
  success: '◆',
}

export function ProofPanel({ onProofComplete }: ProofPanelProps) {
  const { publicKey } = useWallet()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<ProofStatus | null>(null)

  const handleGenerate = async () => {
    if (!publicKey) return
    setLoading(true)
    setStatus(null)

    try {
      const proof = await generateProof(publicKey.toBase58(), setStatus)
      onProofComplete(proof)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Proof generation failed'
      setStatus({ step: 'error', message: msg, progress: 0 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <motion.button
        onClick={handleGenerate}
        disabled={!publicKey || loading}
        whileHover={publicKey && !loading ? { scale: 1.02 } : {}}
        whileTap={publicKey && !loading ? { scale: 0.98 } : {}}
        className="relative w-full px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600/20 
                   to-blue-600/20 border border-purple-500/30 hover:border-purple-400/60 
                   transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed
                   overflow-hidden group"
      >
        {loading && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-blue-600/10 to-purple-600/10"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        )}
        <span className="relative text-base font-medium text-zinc-200">
          {loading ? 'Generating Private Proof...' : 'Generate Private Proof'}
        </span>
      </motion.button>

      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 rounded-xl bg-white/[0.03] border border-white/5 p-4">
              <div className="flex items-center gap-3">
                <motion.span
                  key={status.step}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-purple-400 text-lg"
                >
                  {statusIcons[status.step] || '◇'}
                </motion.span>
                <span className={`text-sm ${
                  status.step === 'success' ? 'text-emerald-400' :
                  status.step === 'error' ? 'text-red-400' :
                  'text-zinc-300'
                }`}>
                  {status.message}
                </span>
              </div>
              {status.step !== 'success' && status.step !== 'error' && (
                <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${status.progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
