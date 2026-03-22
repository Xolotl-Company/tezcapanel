import { Database } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function DatabasesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Bases de datos</h1>
          <p className="text-sm text-muted-foreground mt-1">MySQL / MariaDB</p>
        </div>
        <Badge variant="secondary" className="text-xs">Commit 4</Badge>
      </div>
      <div className="bg-card border border-border rounded-lg p-8 flex flex-col items-center justify-center gap-4 min-h-[300px]">
        <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Database className="w-6 h-6 text-primary" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">Gestión de bases de datos</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Crea usuarios y bases de datos MySQL/MariaDB, gestiona permisos y realiza backups con un clic.
          </p>
        </div>
      </div>
    </div>
  )
}
