"use client"

import { useServerStore } from "@/store/server.store"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

const displayNames: Record<string, string> = {
  nginx:   "Nginx",
  mysql:   "MySQL",
  postfix: "Postfix",
  named:   "DNS (bind9)",
}

const statusConfig = {
  running: { label: "Activo",   dot: "bg-primary animate-pulse",     badge: "bg-primary/10 text-primary border-primary/20" },
  stopped: { label: "Detenido", dot: "bg-destructive",               badge: "bg-destructive/10 text-destructive border-destructive/20" },
  unknown: { label: "–",        dot: "bg-muted-foreground",          badge: "bg-muted text-muted-foreground border-border" },
}

export function ServicesStatus() {
  const { services } = useServerStore()

  const list = services.length > 0
    ? services
    : [
        { name: "nginx",   status: "unknown" },
        { name: "mysql",   status: "unknown" },
        { name: "postfix", status: "unknown" },
        { name: "named",   status: "unknown" },
      ]

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Estado de servicios</h3>
      <div className="space-y-2">
        {list.map((svc) => {
          const status = svc.status as keyof typeof statusConfig
          const config = statusConfig[status] ?? statusConfig.unknown
          return (
            <div key={svc.name} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <div className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
                <span className="text-sm">{displayNames[svc.name] ?? svc.name}</span>
              </div>
              <Badge variant="outline" className={cn("text-[10px] h-5", config.badge)}>
                {config.label}
              </Badge>
            </div>
          )
        })}
      </div>
    </div>
  )
}
