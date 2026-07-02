import { useEffect, useState } from 'react'
import './App.css'

type Health = {
  status: string
  service: string
  database: string
}

function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: Health) => setHealth(data))
      .catch((err) => setError(String(err)))
  }, [])

  const ok = health?.status === 'ok' && health?.database === 'ok'

  return (
    <main className="app">
      <h1>LocalAsset Vault</h1>
      <p className="subtitle">Digital Asset Manager — scaffold</p>

      <section className="status-card">
        <h2>Backend connection</h2>
        {error && <p className="status bad">⚠ Cannot reach backend: {error}</p>}
        {!error && !health && <p className="status">Checking…</p>}
        {health && (
          <ul className="status-list">
            <li>
              <span className={`dot ${ok ? 'green' : 'amber'}`} /> API status:{' '}
              <strong>{health.status}</strong>
            </li>
            <li>
              <span className={`dot ${health.database === 'ok' ? 'green' : 'red'}`} /> Database:{' '}
              <strong>{health.database}</strong>
            </li>
            <li>Service: {health.service}</li>
          </ul>
        )}
      </section>
    </main>
  )
}

export default App
