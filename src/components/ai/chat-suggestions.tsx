"use client"

interface Suggestion {
  label: string
  prompt: string
}

const suggestions: Suggestion[] = [
  { label: "🔍 Diagnóstico", prompt: "Analiza el estado actual del servidor y dime si hay algo que deba atender" },
  { label: "⚡ Optimizar RAM", prompt: "Mi RAM está al límite, ¿cómo puedo optimizar el uso de memoria?" },
  { label: "🌐 Instalar Nginx", prompt: "Quiero instalar y configurar Nginx en el servidor" },
  { label: "🗄️ Instalar MySQL", prompt: "Instala MySQL y crea una base de datos para WordPress" },
  { label: "🔒 Revisar seguridad", prompt: "Revisa la configuración de seguridad del servidor y dame recomendaciones" },
  { label: "📋 Ver logs", prompt: "¿Cómo puedo ver los logs de errores de Nginx?" },
]

interface ChatSuggestionsProps {
  onSelect: (prompt: string) => void
}

export function ChatSuggestions({ onSelect }: ChatSuggestionsProps) {
  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-muted-foreground text-center">
        Hola, soy <strong className="text-primary">Tezca</strong> — tu asistente de servidor.
        ¿En qué te ayudo?
      </p>
      <div className="grid grid-cols-2 gap-2">
        {suggestions.map((s) => (
          <button
            key={s.prompt}
            onClick={() => onSelect(s.prompt)}
            className="text-left px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80
              border border-border text-xs transition-colors"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
