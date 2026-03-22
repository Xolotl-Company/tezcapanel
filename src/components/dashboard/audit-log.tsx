import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { History } from "lucide-react"

async function getAuditLogs() {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  })
}

export async function AuditLogSection() {
  const logs = await getAuditLogs()
  if (logs.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <History className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">Registro de actividad</h2>
        <Badge variant="secondary" className="ml-auto">{logs.length}</Badge>
      </div>
      <div className="divide-y divide-border max-h-64 overflow-y-auto">
        {logs.map((log) => (
          <div key={log.id} className="px-5 py-3 flex items-start justify-between gap-4">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-medium truncate">{log.action}</span>
              {log.target && (
                <span className="text-[10px] text-muted-foreground truncate">{log.target}</span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {new Date(log.createdAt).toLocaleString("es-MX", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}