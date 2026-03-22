import { Terminal } from "lucide-react"

export default function TerminalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Terminal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Terminal web en tiempo real
        </p>
      </div>
      <div className="bg-card border border-border rounded-lg p-8 flex flex-col items-center justify-center gap-4 min-h-[300px]">
        <div className="w-12 h-12 rounded-lg bg-muted border border-border flex items-center justify-center">
          <Terminal className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">Terminal interactiva</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Acceso SSH directo desde el navegador. Disponible en próxima versión.
          </p>
        </div>
      </div>
    </div>
  )
}
