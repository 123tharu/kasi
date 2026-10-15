import { Component, type ReactNode } from 'react'

/** Wipes the offline copy of the app (service worker + caches) and reloads the latest version. */
export async function repairApp() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
    const keys = (await caches?.keys?.()) ?? []
    await Promise.all(keys.map((k) => caches.delete(k)))
  } catch {
    /* best effort */
  }
  location.reload()
}

/** Shows what went wrong instead of a blank screen, with a one-tap repair. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }
  render() {
    const e = this.state.error
    if (!e) return this.props.children
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="text-4xl">🛠️</div>
        <div className="mt-4 text-lg font-semibold">This screen hit a problem</div>
        <p className="mt-2 text-sm text-muted">Tap Repair to load the latest version of Kasi. Your data is safe in your database.</p>
        <pre className="mt-4 whitespace-pre-wrap break-words rounded-2xl bg-card2 p-3 text-left text-xs text-faint">{String(e.message || e).slice(0, 400)}</pre>
        <button onClick={repairApp} className="mt-5 rounded-full bg-ink px-6 py-3 font-semibold text-bg">
          Repair
        </button>
      </div>
    )
  }
}
