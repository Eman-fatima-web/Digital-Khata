import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Customer, SyncConflictRecord } from '../../core/types'
import Conflicts from './Conflicts'
import { AppProvider } from '../../context/AppProvider'
import { generateId } from '../../lib/utils'

vi.mock('../../hooks/useKhataData', () => ({
  useSyncConflicts: vi.fn(),
}))

vi.mock('../../data/repositories/syncConflictRepo', () => ({
  resolveSyncConflict: vi.fn(),
}))

import { useSyncConflicts } from '../../hooks/useKhataData'
import { resolveSyncConflict } from '../../data/repositories/syncConflictRepo'

const mockedUseSyncConflicts = vi.mocked(useSyncConflicts)
const mockedResolveSyncConflict = vi.mocked(resolveSyncConflict)

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: overrides.id ?? generateId(),
    userId: 'user-1',
    shopId: 'shop-1',
    name: 'Test Customer',
    phone: '03001234567',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    syncStatus: 'synced',
    version: 1,
    ...overrides,
  }
}

function makeConflict(overrides: Partial<SyncConflictRecord> = {}): SyncConflictRecord {
  return {
    id: overrides.id ?? generateId(),
    table: 'customers',
    recordId: 'c1',
    local: makeCustomer({ id: 'c1', name: 'Local Name' }),
    remote: makeCustomer({ id: 'c1', name: 'Remote Name', version: 2 }),
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderWithProvider(ui: React.ReactElement) {
  return render(<AppProvider>{ui}</AppProvider>)
}

describe('Conflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  describe('empty state', () => {
    it('renders empty state when there are no conflicts', () => {
      mockedUseSyncConflicts.mockReturnValue([])

      renderWithProvider(<Conflicts />)

      expect(screen.getByText('No sync conflicts')).toBeInTheDocument()
      expect(screen.getByText('Your local and cloud records are in agreement.')).toBeInTheDocument()
    })

    it('renders nothing while loading', () => {
      mockedUseSyncConflicts.mockReturnValue(undefined)

      renderWithProvider(<Conflicts />)

      // Title is always shown; only the content area is hidden while loading
      expect(screen.getByText('Resolve sync conflicts')).toBeInTheDocument()
      expect(screen.queryByText('No sync conflicts')).not.toBeInTheDocument()
    })
  })

  describe('conflict cards', () => {
    it('shows local and cloud versions', () => {
      const conflict = makeConflict()
      mockedUseSyncConflicts.mockReturnValue([conflict])

      renderWithProvider(<Conflicts />)

      expect(screen.getByText('This device')).toBeInTheDocument()
      expect(screen.getByText('Cloud version')).toBeInTheDocument()
      expect(screen.getByText('Local Name')).toBeInTheDocument()
      expect(screen.getByText('Remote Name')).toBeInTheDocument()
    })

    it('displays Keep Local and Use Remote actions', () => {
      const conflict = makeConflict()
      mockedUseSyncConflicts.mockReturnValue([conflict])

      renderWithProvider(<Conflicts />)

      expect(screen.getByText('Keep this device')).toBeInTheDocument()
      expect(screen.getByText('Use cloud version')).toBeInTheDocument()
    })

    it('requires confirmation before resolving with local', async () => {
      const conflict = makeConflict()
      mockedUseSyncConflicts.mockReturnValue([conflict])

      renderWithProvider(<Conflicts />)

      const keepLocalButton = screen.getByText('Keep this device')
      fireEvent.click(keepLocalButton)

      expect(window.confirm).toHaveBeenCalledWith(
        'Keep this device version? It will be queued for a new sync.',
      )
      expect(mockedResolveSyncConflict).toHaveBeenCalledWith(conflict, 'local')
    })

    it('requires confirmation before resolving with remote', async () => {
      const conflict = makeConflict()
      mockedUseSyncConflicts.mockReturnValue([conflict])

      renderWithProvider(<Conflicts />)

      const useRemoteButton = screen.getByText('Use cloud version')
      fireEvent.click(useRemoteButton)

      expect(window.confirm).toHaveBeenCalledWith(
        'Use the cloud version? Your local version will be replaced after this confirmation.',
      )
      expect(mockedResolveSyncConflict).toHaveBeenCalledWith(conflict, 'remote')
    })

    it('does not resolve if user cancels confirmation', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const conflict = makeConflict()
      mockedUseSyncConflicts.mockReturnValue([conflict])

      renderWithProvider(<Conflicts />)

      const keepLocalButton = screen.getByText('Keep this device')
      fireEvent.click(keepLocalButton)

      expect(window.confirm).toHaveBeenCalled()
      expect(mockedResolveSyncConflict).not.toHaveBeenCalled()
    })
  })
})
