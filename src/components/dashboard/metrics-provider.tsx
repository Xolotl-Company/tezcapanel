"use client"

import { useEffect } from "react"
import { useServerStore } from "@/store/server.store"

export function MetricsProvider({ children }: { children: React.ReactNode }) {
  const { setMetrics, setServices, setLoading, setError } = useServerStore()

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch("/api/metrics")
        if (!res.ok) {
          setError(res.status === 503 ? "agent_unavailable" : "fetch_error")
          return
        }
        const data = await res.json()
        setMetrics(data.metrics)
        setServices(data.services)
      } catch {
        setError("fetch_error")
      }
    }

    setLoading(true)
    fetchMetrics().finally(() => setLoading(false))
    const interval = setInterval(fetchMetrics, 5000)
    return () => clearInterval(interval)
  }, [setLoading, setMetrics, setServices, setError])

  return <>{children}</>
}
