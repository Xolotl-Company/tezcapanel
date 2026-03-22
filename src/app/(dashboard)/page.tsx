"use client"

import { useServerStore } from "@/store/server.store"
import { MetricCard } from "@/components/dashboard/metric-card"
import { ServicesStatus } from "@/components/dashboard/services-status-live"
import { formatBytes, formatUptime } from "@/lib/utils"
import { Cpu, HardDrive, Clock, MemoryStick } from "lucide-react"

export default function DashboardPage() {
  const { metrics, error } = useServerStore()

  const cpuValue    = metrics?.cpu?.usage != null ? `${metrics.cpu.usage.toFixed(1)}%` : "–"
  const ramValue    = metrics?.memory?.used != null ? formatBytes(metrics.memory.used) : "–"
  const diskValue   = metrics?.disk?.used != null ? formatBytes(metrics.disk.used) : "–"
  const uptimeValue = metrics?.uptime != null ? formatUptime(metrics.uptime) : "–"

  const ramSubtitle = metrics?.memory?.total
    ? `de ${formatBytes(metrics.memory.total)} total`
    : error === "agent_unavailable" ? "Agente no disponible" : "Conectando..."

  const diskSubtitle = metrics?.disk?.total
    ? `de ${formatBytes(metrics.disk.total)} total`
    : ""

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">
          {metrics?.hostname ?? "Panel de control"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {metrics?.os ?? "Conectando con el servidor..."}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="CPU"
          value={cpuValue}
          subtitle={metrics?.cpu?.cores ? `${metrics.cpu.cores} núcleos` : "–"}
          icon={Cpu}
          trend={metrics?.cpu?.usage != null && metrics.cpu.usage > 80 ? "down" : "neutral"}
        />
        <MetricCard
          title="Memoria RAM"
          value={ramValue}
          subtitle={ramSubtitle}
          icon={MemoryStick}
          trend={
            metrics?.memory?.used != null && metrics?.memory?.total
              ? metrics.memory.used / metrics.memory.total > 0.85 ? "down" : "neutral"
              : "neutral"
          }
        />
        <MetricCard
          title="Disco"
          value={diskValue}
          subtitle={diskSubtitle}
          icon={HardDrive}
          trend={
            metrics?.disk?.used != null && metrics?.disk?.total
              ? metrics.disk.used / metrics.disk.total > 0.9 ? "down" : "neutral"
              : "neutral"
          }
        />
        <MetricCard
          title="Uptime"
          value={uptimeValue}
          subtitle="Tiempo activo del servidor"
          icon={Clock}
          trend="up"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ServicesStatus />
      </div>
    </div>
  )
}

