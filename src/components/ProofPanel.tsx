'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWallet } from '@/contexts/WalletContext'
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
  const { isConnected, address, session } = useWallet()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<ProofStatus | null>(null)

  const handleGenerate = async () => {
    if (!address) return
    setLoading(true)
    setStatus(null)

    try {
      const proof = await generateProof(address, setStatus, session ?? undefined)
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
        disabled={!isConnected || loading}
        whileHover={isConnected && !loading ? { scale: 1.02 } : {}}
        whileTap={isConnected && !loading ? { scale: 0.98 } : {}}
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
            <div className={`rounded-xl border p-4 ${
              status.step === 'success'
                ? 'border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-transparent'
                : status.step === 'error'
                ? 'border-red-500/30 bg-gradient-to-b from-red-500/10 to-transparent'
                : 'bg-white/[0.03] border border-white/5'
            }`}>
              <div className="flex items-start gap-3">
                {status.step === 'error' ? (
                  <div className="shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4m0 4h.01" strokeLinecap="round" />
                    </svg>
                  </div>
                ) : status.step === 'success' ? (
                  <div className="shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                ) : (
                  <motion.span
                    key={status.step}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-purple-400 text-lg shrink-0 mt-0.5"
                  >
                    {statusIcons[status.step] || '◇'}
                  </motion.span>
                )}
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${
                    status.step === 'success' ? 'text-emerald-300' :
                    status.step === 'error' ? 'text-red-300' :
                    'text-zinc-200'
                  }`}>
                    {status.step === 'error' ? 'Proof Failed' :
                     status.step === 'success' ? 'Proof Verified' :
                     status.message}
                  </p>
                  {(status.step === 'error' || status.step === 'success') && (
                    <p className="text-[11px] font-mono text-zinc-500 mt-1 leading-relaxed">
                      {status.message}
                    </p>
                  )}
                </div>
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
