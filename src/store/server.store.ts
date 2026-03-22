import { create } from "zustand"
import type { ServerMetrics, Service } from "@/types"

interface ServerState {
  metrics: ServerMetrics | null
  services: Service[]
  isLoading: boolean
  lastUpdated: Date | null
  error: string | null
  setMetrics: (metrics: ServerMetrics) => void
  setServices: (services: Service[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useServerStore = create<ServerState>((set) => ({
  metrics: null,
  services: [],
  isLoading: false,
  lastUpdated: null,
  error: null,
  setMetrics: (metrics) => set({ metrics, lastUpdated: new Date(), error: null }),
  setServices: (services) => set({ services }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
}))
