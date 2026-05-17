'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@/contexts/WalletContext'
import type { Proof } from '@/lib/midnight'

interface StatusCardProps {
  proof: Proof | null
  onProofUpdated?: (proof: Proof) => void
}

export function StatusCard({ proof, onProofUpdated }: StatusCardProps) {
  const { checkProofStatus } = useWallet()
  const [localProof, setLocalProof] = useState<Proof | null>(null)

  const activeProof = proof ?? localProof

  useEffect(() => {
    if (proof) setLocalProof(proof)
  }, [proof])

  useEffect(() => {
    if (!activeProof?.pending || !activeProof.txId) return
    const id = setInterval(async () => {
      try {
        const confirmed = await checkProofStatus(activeProof.txId!)
        if (confirmed) {
          const updated = { ...activeProof, verified: true, pending: false }
          setLocalProof(updated)
          onProofUpdated?.(updated)
        }
      } catch { /* will retry next interval */ }
    }, 5_000)
    return () => clearInterval(id)
  }, [activeProof, checkProofStatus, onProofUpdated])

  if (!activeProof) return null

  const isPending = activeProof.pending === true
  const borderColor = isPending ? 'border-amber-500/30' : 'border-emerald-500/30'
  const bgColor = isPending ? 'from-amber-500/5' : 'from-emerald-500/5'
  const glowColor = isPending ? 'from-amber-500/5' : 'from-emerald-500/5'
  const iconBg = isPending ? 'bg-amber-500/20' : 'bg-emerald-500/20'
  const iconColor = isPending ? 'text-amber-400' : 'text-emerald-400'
  const titleColor = isPending ? 'text-amber-300' : 'text-emerald-300'
  const title = isPending ? 'Proof Submitted' : 'Proof Verified'
  const subtitle = isPending ? 'Awaiting on-chain confirmation' : 'Sensitive data remained private'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`relative rounded-2xl border ${borderColor} bg-gradient-to-b 
                 ${bgColor} to-transparent p-6 overflow-hidden`}
    >
      <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] 
                      ${glowColor} via-transparent to-transparent`} />

      <div className="relative space-y-4">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className={`h-8 w-8 rounded-full ${iconBg} flex items-center justify-center`}
          >
            {isPending ? (
              <svg className={`w-4 h-4 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className={`w-4 h-4 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </motion.div>
          <div>
            <h3 className={`text-lg font-semibold ${titleColor}`}>{title}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
            {isPending && (
              <p className="text-[10px] text-zinc-600 mt-1">Auto-checking every 5s...</p>
            )}
          </div>
        </div>

        <div className="space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-zinc-500">Proof ID</span>
            <span className="text-zinc-300">{activeProof.proofId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Commitment</span>
            <span className="text-zinc-300">{activeProof.commitmentHash.slice(0, 16)}...</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Timestamp</span>
            <span className="text-zinc-300">{new Date(activeProof.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
