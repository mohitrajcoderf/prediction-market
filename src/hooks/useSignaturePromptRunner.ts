'use client'

import { useCallback } from 'react'
import { useSignaturePrompt } from '@/stores/useSignaturePrompt'

interface SignaturePromptOptions {
  enabled?: boolean
  title?: string
  description?: string
}

export function useSignaturePromptRunner() {
  const showPrompt = useSignaturePrompt(state => state.showPrompt)
  const hidePrompt = useSignaturePrompt(state => state.hidePrompt)

  const runWithSignaturePrompt = useCallback(async <T>(
    action: (dismissPrompt: () => void) => Promise<T>,
    options: SignaturePromptOptions = {},
  ): Promise<T> => {
    const { enabled = true, title, description } = options
    if (!enabled) {
      return await action(() => undefined)
    }

    showPrompt({ title, description })
    let dismissed = false
    function dismissPrompt() {
      if (dismissed) {
        return
      }
      dismissed = true
      hidePrompt()
    }

    try {
      return await action(dismissPrompt)
    }
    finally {
      dismissPrompt()
    }
  }, [hidePrompt, showPrompt])

  return {
    runWithSignaturePrompt,
  }
}
