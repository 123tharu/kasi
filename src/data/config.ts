export type AppConfig = { mode: 'supabase'; url: string; key: string } | { mode: 'demo' }

const LS_KEY = 'kasi-config'

function readLS(): AppConfig | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as AppConfig) : null
  } catch {
    return null
  }
}

/** "#setup=<base64 json>" link lets the phone pick up the laptop's settings via QR code. */
function readSetupHash(): AppConfig | null {
  const m = location.hash.match(/setup=([A-Za-z0-9+/=_-]+)/)
  if (!m) return null
  try {
    const j = JSON.parse(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (j.u && j.k) {
      const cfg: AppConfig = { mode: 'supabase', url: j.u, key: j.k }
      saveConfig(cfg)
      history.replaceState(null, '', location.pathname + location.search)
      return cfg
    }
  } catch {
    /* ignore */
  }
  return null
}

export function loadConfig(): AppConfig | null {
  const fromHash = readSetupHash()
  if (fromHash) return fromHash
  const ls = readLS()
  if (ls) return ls
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined
  if (url && key) return { mode: 'supabase', url, key }
  return null
}

export function saveConfig(cfg: AppConfig | null) {
  try {
    if (cfg) localStorage.setItem(LS_KEY, JSON.stringify(cfg))
    else localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
}

export function setupLink(cfg: { url: string; key: string }): string {
  const b = btoa(JSON.stringify({ u: cfg.url, k: cfg.key })).replace(/\+/g, '-').replace(/\//g, '_')
  return `${location.origin}${location.pathname}#setup=${b}`
}
