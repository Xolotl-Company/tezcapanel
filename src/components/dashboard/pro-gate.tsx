import { Badge } from "@/components/ui/badge"
import { Lock } from "lucide-react"

interface ProGateProps {
  module: string
  description?: string
}

export function ProGate({ module, description }: ProGateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="w-14 h-14 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
        <Lock className="w-6 h-6 text-accent" />
      </div>
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-lg font-semibold">{module}</h2>
          <Badge variant="outline" className="border-accent/50 text-accent text-[10px]">PRO</Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-sm">
          {description ?? `El módulo ${module} está disponible en el plan Pro.`}
        </p>
      </div>
      <div className="px-4 py-2 rounded-lg bg-accent/10 border border-accent/20 text-xs text-accent">
        Próximamente — tezcapanel.io
      </div>
    </div>
  )
}
