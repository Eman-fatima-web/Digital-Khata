import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

import { Button } from './Button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Route-level error boundary. A render crash in one page (Reports, AI, …)
 * shows a recoverable error card while the rest of the shell — navigation,
 * header, data layer — stays usable. Errors are never swallowed silently.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Page error:', error, info.componentStack)
  }

  private handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-2xl border border-danger/20 bg-surface-card p-6 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
              <AlertTriangle size={26} />
            </div>
            <h2 className="mt-4 text-lg font-bold text-ink">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              This page could not be displayed. Your data is safe — it is
              stored locally. Try again, or use the menu to open another page.
            </p>
            <p className="mt-3 break-words rounded-xl bg-surface px-3 py-2 text-xs text-ink-subtle" role="alert">
              {this.state.error.message || 'Unknown error'}
            </p>
            <Button variant="outline" className="mt-5" onClick={this.handleReset}>
              <RotateCcw size={16} />
              Try again
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
