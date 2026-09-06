import { useAuth } from '../context/AuthProvider'

const OFFLINE_OWNER = {
  userId: 'offline-default',
  shopId: 'offline-default',
}

export function useOwner() {
  const { user } = useAuth()
  return user
    ? { userId: user.id, shopId: user.businessId }
    : OFFLINE_OWNER
}
