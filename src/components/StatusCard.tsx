'use client'

import { motion } from 'framer-motion'
import type { Proof } from '@/lib/midnight'

interface StatusCardProps {
  proof: Proof | null
}

export function StatusCard({ proof }: StatusCardProps) {
  if (!proof) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative rounded-2xl border border-emerald-500/30 bg-gradient-to-b 
                 from-emerald-500/5 to-transparent p-6 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] 
                      from-emerald-500/5 via-transparent to-transparent" />

      <div className="relative space-y-4">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center"
          >
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
          <div>
            <h3 className="text-lg font-semibold text-emerald-300">Proof Verified</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Sensitive data remained private</p>
          </div>
        </div>

        <div className="space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-zinc-500">Proof ID</span>
            <span className="text-zinc-300">{proof.proofId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Commitment</span>
            <span className="text-zinc-300">{proof.commitmentHash.slice(0, 16)}...</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Timestamp</span>
            <span className="text-zinc-300">{new Date(proof.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
