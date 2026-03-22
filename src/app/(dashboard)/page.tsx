import { auth } from "@/lib/auth"
import { MetricCard } from "@/components/dashboard/metric-card"
import { ServicesStatus } from "@/components/dashboard/services-status"
import { Cpu, HardDrive, Clock, MemoryStick } from "lucide-react"

export default async function DashboardPage() {
  const session = await auth()
  const firstName = session?.user?.name?.split(" ")[0] ?? "Admin"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Hola, {firstName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Resumen del servidor — métricas en tiempo real llegan en el Commit 3
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="CPU"         value="–" subtitle="Sin datos aún" icon={Cpu} />
        <MetricCard title="Memoria RAM" value="–" subtitle="Sin datos aún" icon={MemoryStick} />
        <MetricCard title="Disco"       value="–" subtitle="Sin datos aún" icon={HardDrive} />
        <MetricCard title="Uptime"      value="–" subtitle="Sin datos aún" icon={Clock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ServicesStatus />
      </div>
    </div>
  )
}

