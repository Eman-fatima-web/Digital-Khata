import { useEffect, useState } from 'react'

import { networkService } from '../data/services/networkService'

export function useNetwork(): boolean {
  const [isOnline, setIsOnline] = useState(() => networkService.isOnline())

  useEffect(() => {
    return networkService.subscribe(setIsOnline)
  }, [])

  return isOnline
}
