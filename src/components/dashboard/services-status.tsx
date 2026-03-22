import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface Service {
  name: string
  displayName: string
  status: "running" | "stopped" | "unknown"
}

const mockServices: Service[] = [
  { name: "nginx",   displayName: "Nginx",   status: "unknown" },
  { name: "mysql",   displayName: "MySQL",   status: "unknown" },
  { name: "postfix", displayName: "Postfix", status: "unknown" },
  { name: "bind9",   displayName: "DNS",     status: "unknown" },
]

const statusConfig = {
  running: { label: "Activo",   className: "bg-primary/10 text-primary border-primary/20" },
  stopped: { label: "Detenido", className: "bg-destructive/10 text-destructive border-destructive/20" },
  unknown: { label: "–",        className: "bg-muted text-muted-foreground border-border" },
}

export function ServicesStatus() {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Estado de servicios</h3>
      <div className="space-y-2">
        {mockServices.map((svc) => {
          const config = statusConfig[svc.status]
          return (
            <div key={svc.name} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  svc.status === "running" && "bg-primary",
                  svc.status === "stopped" && "bg-destructive",
                  svc.status === "unknown" && "bg-muted-foreground",
                )} />
                <span className="text-sm">{svc.displayName}</span>
              </div>
              <Badge variant="outline" className={cn("text-[10px] h-5", config.className)}>
                {config.label}
              </Badge>
            </div>
          )
        })}
      </div>
    </div>
  )
}
