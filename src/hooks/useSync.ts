import { useEffect, useState } from 'react'

import { syncService } from '../data/services/syncService'

export function useSync(): {
  state: 'idle' | 'syncing' | 'error'
  sync: () => Promise<boolean>
} {
  const [state, setState] = useState(() => syncService.getState())

  useEffect(() => {
    return syncService.subscribe(setState)
  }, [])

  return {
    state,
    sync: () => syncService.sync(),
  }
}
