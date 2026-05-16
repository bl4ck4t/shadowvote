'use client'

import { FC, ReactNode } from 'react'
import { WalletProvider } from '@/contexts/WalletContext'

export const Providers: FC<{ children: ReactNode }> = ({ children }) => {
  return <WalletProvider>{children}</WalletProvider>
}
