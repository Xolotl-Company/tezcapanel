# Tezcapanel — Agent Instructions (Commit 4)

## Objetivo

Implementar el módulo de IA Pro — un asistente con Claude integrado directamente en el panel
que puede diagnosticar problemas, responder preguntas, y proponer acciones ejecutables en el
servidor con aprobación del usuario.

---

## Contexto

- **Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, NextAuth v5, Prisma + SQLite, Zustand
- **API IA:** Anthropic API (`@anthropic-ai/sdk`) — modelo `claude-opus-4-5`
- **Agente Node.js:** corre en puerto 7070, expone `/metrics` y `/services`
- **Commits anteriores:** dashboard con métricas reales, sidebar funcional, auth con DB

---

## Paso 1 — Instalar dependencia

```bash
npm install @anthropic-ai/sdk
```

Agregar al `.env`:
```env
ANTHROPIC_API_KEY="tu_api_key_de_anthropic"
```

---

## Paso 2 — Tipos para el módulo IA

### `src/types/ai.ts` — CREAR

```typescript
export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  actions?: ProposedAction[]
  actionsExecuted?: boolean
}

export interface ProposedAction {
  id: string
  label: string
  description: string
  command: string
  risk: "low" | "medium" | "high"
  confirmed?: boolean
}

export interface ServerContext {
  hostname: string
  os: string
  cpu: { usage: number; cores: number; model: string }
  memory: { total: number; used: number; free: number }
  disk: { total: number; used: number; free: number }
  uptime: number
  services: { name: string; status: string }[]
}
```

---

## Paso 3 — Store del chat

### `src/store/chat.store.ts` — CREAR

```typescript
import { create } from "zustand"
import type { ChatMessage } from "@/types/ai"

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  setLoading: (loading: boolean) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  clearMessages: () => set({ messages: [] }),
}))
```

---

## Paso 4 — API Route de IA

### `src/app/api/ai/chat/route.ts` — CREAR

```typescript
import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import type { ServerContext } from "@/types/ai"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const AGENT_URL = process.env.AGENT_URL ?? "http://127.0.0.1:7070"
const AGENT_TOKEN = process.env.AGENT_TOKEN ?? ""

async function getServerContext(): Promise<ServerContext | null> {
  try {
    const [metricsRes, servicesRes] = await Promise.all([
      fetch(`${AGENT_URL}/metrics`, {
        headers: { Authorization: `Bearer ${AGENT_TOKEN}` },
        signal: AbortSignal.timeout(3000),
      }),
      fetch(`${AGENT_URL}/services`, {
        headers: { Authorization: `Bearer ${AGENT_TOKEN}` },
        signal: AbortSignal.timeout(3000),
      }),
    ])
    const metrics = await metricsRes.json()
    const services = await servicesRes.json()
    return { ...metrics, services }
  } catch {
    return null
  }
}

function buildSystemPrompt(context: ServerContext | null): string {
  const contextStr = context
    ? `
## Estado actual del servidor

- **Hostname:** ${context.hostname}
- **OS:** ${context.os}
- **CPU:** ${context.cpu.usage.toFixed(1)}% uso, ${context.cpu.cores} núcleos (${context.cpu.model})
- **RAM:** ${(context.memory.used / 1024 / 1024 / 1024).toFixed(1)} GB usados de ${(context.memory.total / 1024 / 1024 / 1024).toFixed(1)} GB
- **Disco:** ${(context.disk.used / 1024 / 1024 / 1024).toFixed(1)} GB usados de ${(context.disk.total / 1024 / 1024 / 1024).toFixed(1)} GB
- **Uptime:** ${Math.floor(context.uptime / 86400)}d ${Math.floor((context.uptime % 86400) / 3600)}h
- **Servicios:**
${context.services.map((s) => `  - ${s.name}: ${s.status}`).join("\n")}
`
    : "\n## Estado del servidor: No disponible (agente desconectado)\n"

  return `Eres el asistente de IA integrado en Tezcapanel, un panel de administración de servidores Linux.
Tu nombre es Tezca. Eres experto en administración de servidores Linux, Nginx, Apache, MySQL, DNS, correo electrónico y seguridad.

Tienes acceso al estado en tiempo real del servidor donde está instalado Tezcapanel.
${contextStr}

## Tu comportamiento

1. **Responde en español** siempre, de forma clara y concisa.
2. **Usa el contexto del servidor** para dar respuestas específicas y relevantes.
3. **Cuando el usuario pida ejecutar algo**, propón las acciones en formato JSON estructurado
   al final de tu respuesta usando este formato exacto:

\`\`\`json
{
  "actions": [
    {
      "id": "action_1",
      "label": "Instalar Nginx",
      "description": "Instala nginx via apt y lo habilita como servicio",
      "command": "apt install -y nginx && systemctl enable nginx && systemctl start nginx",
      "risk": "low"
    }
  ]
}
\`\`\`

4. **Niveles de riesgo:**
   - \`low\`: operaciones de lectura, instalaciones estándar
   - \`medium\`: cambios de configuración, reinicios de servicios
   - \`high\`: eliminación de datos, cambios en firewall, modificaciones críticas

5. **NUNCA ejecutes nada sin proponer las acciones primero** — el usuario debe aprobar.
6. **Si detectas problemas** en el estado del servidor (RAM alta, disco lleno, servicios caídos),
   mencionalo proactivamente.
7. **Sé conciso** — respuestas cortas y al punto. Usa markdown para formatear código.

## Restricciones
- No propongas acciones que puedan dañar irreversiblemente el servidor sin advertencia clara.
- No compartas el AGENT_TOKEN ni el AUTH_SECRET bajo ninguna circunstancia.
- Si no sabes algo, dilo — no inventes comandos.`
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { messages } = await req.json()

  const context = await getServerContext()
  const systemPrompt = buildSystemPrompt(context)

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  })

  const content = response.content[0]
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response type" }, { status: 500 })
  }

  // Extraer acciones propuestas del JSON en la respuesta
  let actions = null
  let text = content.text

  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1])
      if (parsed.actions) {
        actions = parsed.actions
        // Remover el bloque JSON del texto visible
        text = text.replace(/```json\n[\s\S]*?\n```/, "").trim()
      }
    } catch {
      // Si no parsea, dejamos el texto como está
    }
  }

  return NextResponse.json({ text, actions })
}
```

---

## Paso 5 — Componentes del chat

### `src/components/ai/chat-message.tsx` — CREAR

```tsx
"use client"

import { cn } from "@/lib/utils"
import type { ChatMessage, ProposedAction } from "@/types/ai"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bot, User, AlertTriangle, CheckCircle2, Terminal } from "lucide-react"

interface ChatMessageProps {
  message: ChatMessage
  onConfirmActions?: (messageId: string, actions: ProposedAction[]) => void
}

const riskConfig = {
  low:    { label: "Bajo riesgo",  className: "border-primary/50 text-primary" },
  medium: { label: "Riesgo medio", className: "border-accent/50 text-accent" },
  high:   { label: "Alto riesgo",  className: "border-destructive/50 text-destructive" },
}

export function ChatMessageItem({ message, onConfirmActions }: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div className={cn(
        "w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5",
        isUser
          ? "bg-secondary border border-border"
          : "bg-primary/10 border border-primary/20"
      )}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-muted-foreground" />
          : <Bot className="w-3.5 h-3.5 text-primary" />
        }
      </div>

      {/* Contenido */}
      <div className={cn("flex flex-col gap-2 max-w-[80%]", isUser && "items-end")}>
        <div className={cn(
          "rounded-lg px-4 py-3 text-sm",
          isUser
            ? "bg-secondary text-foreground"
            : "bg-card border border-border text-foreground"
        )}>
          {/* Renderizar markdown básico */}
          <div
            className="prose prose-invert prose-sm max-w-none
              prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-code:text-xs
              prose-pre:bg-muted prose-pre:border prose-pre:border-border"
            dangerouslySetInnerHTML={{
              __html: message.content
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                .replace(/`(.*?)`/g, '<code class="bg-muted px-1 rounded text-xs">$1</code>')
                .replace(/\n/g, "<br/>"),
            }}
          />
        </div>

        {/* Acciones propuestas */}
        {message.actions && message.actions.length > 0 && !message.actionsExecuted && (
          <div className="w-full bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs font-medium text-accent">Acciones propuestas</span>
            </div>
            <div className="divide-y divide-border">
              {message.actions.map((action) => (
                <div key={action.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{action.label}</span>
                    <Badge
                      variant="outline"
                      className={cn("text-[9px] h-4", riskConfig[action.risk].className)}
                    >
                      {riskConfig[action.risk].label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{action.description}</p>
                  <code className="text-[10px] bg-muted px-2 py-1 rounded block text-muted-foreground font-mono">
                    {action.command}
                  </code>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-border flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs bg-primary hover:bg-primary/90"
                onClick={() => onConfirmActions?.(message.id, message.actions!)}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Confirmar y ejecutar
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground">
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Acciones ejecutadas */}
        {message.actionsExecuted && (
          <div className="flex items-center gap-1.5 text-xs text-primary">
            <CheckCircle2 className="w-3 h-3" />
            Acciones ejecutadas
          </div>
        )}

        <span className="text-[10px] text-muted-foreground">
          {new Date(message.timestamp).toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  )
}
```

---

### `src/components/ai/chat-input.tsx` — CREAR

```tsx
"use client"

import { useState, useRef, KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { SendHorizontal, Loader2 } from "lucide-react"

interface ChatInputProps {
  onSend: (message: string) => void
  isLoading?: boolean
  disabled?: boolean
}

export function ChatInput({ onSend, isLoading, disabled }: ChatInputProps) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setValue("")
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex gap-2 items-end p-4 border-t border-border bg-card">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Pregunta algo o pide que haga algo en tu servidor..."
        className="min-h-[44px] max-h-[120px] resize-none bg-input border-border text-sm"
        disabled={disabled || isLoading}
        rows={1}
      />
      <Button
        onClick={handleSend}
        disabled={!value.trim() || isLoading || disabled}
        size="icon"
        className="h-11 w-11 shrink-0 bg-primary hover:bg-primary/90"
      >
        {isLoading
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <SendHorizontal className="w-4 h-4" />
        }
      </Button>
    </div>
  )
}
```

---

### `src/components/ai/chat-suggestions.tsx` — CREAR

```tsx
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
```

---

## Paso 6 — Página del módulo IA

### `src/app/(dashboard)/ai/page.tsx` — CREAR

```tsx
"use client"

import { useRef, useEffect } from "react"
import { useChatStore } from "@/store/chat.store"
import { ChatMessageItem } from "@/components/ai/chat-message"
import { ChatInput } from "@/components/ai/chat-input"
import { ChatSuggestions } from "@/components/ai/chat-suggestions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bot, Trash2 } from "lucide-react"
import type { ChatMessage, ProposedAction } from "@/types/ai"

function generateId() {
  return Math.random().toString(36).slice(2, 11)
}

export default function AIPage() {
  const { messages, isLoading, addMessage, updateMessage, setLoading, clearMessages } =
    useChatStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function sendMessage(content: string) {
    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content,
      timestamp: new Date(),
    }
    addMessage(userMessage)
    setLoading(true)

    const assistantId = generateId()
    addMessage({
      id: assistantId,
      role: "assistant",
      content: "...",
      timestamp: new Date(),
    })

    try {
      const history = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      })

      const data = await res.json()

      updateMessage(assistantId, {
        content: data.text,
        actions: data.actions ?? undefined,
        timestamp: new Date(),
      })
    } catch {
      updateMessage(assistantId, {
        content: "Lo siento, ocurrió un error al conectar con la IA. Intenta de nuevo.",
        timestamp: new Date(),
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmActions(messageId: string, actions: ProposedAction[]) {
    // Marcar acciones como ejecutadas en el mensaje
    updateMessage(messageId, { actionsExecuted: true })

    // Notificar al asistente que las acciones fueron aprobadas
    // En Commit 5 esto llamará al agente real para ejecutarlas
    const confirmMsg = `He confirmado las acciones propuestas. (Nota: la ejecución real de comandos en el servidor estará disponible en la próxima versión del panel.)`
    await sendMessage(confirmMsg)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">Tezca AI</h1>
              <Badge variant="outline" className="border-accent/50 text-accent text-[10px]">PRO</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Asistente inteligente de servidor</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-8"
            onClick={clearMessages}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 bg-background border border-border rounded-lg overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <ChatSuggestions onSelect={sendMessage} />
          ) : (
            <div className="p-4 space-y-4">
              {messages.map((message) => (
                <ChatMessageItem
                  key={message.id}
                  message={message}
                  onConfirmActions={handleConfirmActions}
                />
              ))}
              {isLoading && messages[messages.length - 1]?.content === "..." && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-card border border-border rounded-lg px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <ChatInput onSend={sendMessage} isLoading={isLoading} />
      </div>
    </div>
  )
}
```

---

## Paso 7 — Agregar IA al sidebar y nav-items

### `src/components/layout/nav-items.ts` — REEMPLAZAR

```typescript
import type { NavItem } from "@/types"

export const navItems: NavItem[] = [
  { label: "Dashboard",      href: "/",         icon: "LayoutDashboard" },
  { label: "Tezca AI",       href: "/ai",        icon: "Bot",     proOnly: true },
  { label: "Web",            href: "/web",       icon: "Globe" },
  { label: "Bases de datos", href: "/databases", icon: "Database" },
  { label: "Correo",         href: "/mail",      icon: "Mail",    proOnly: true },
  { label: "DNS",            href: "/dns",       icon: "Server",  proOnly: true },
  { label: "Firewall",       href: "/firewall",  icon: "Shield",  proOnly: true },
  { label: "Backups",        href: "/backups",   icon: "Archive", proOnly: true },
  { label: "Terminal",       href: "/terminal",  icon: "Terminal" },
  { label: "Usuarios",       href: "/users",     icon: "Users" },
  { label: "Configuración",  href: "/settings",  icon: "Settings" },
]
```

### `src/components/layout/sidebar.tsx` — Agregar Bot al iconMap

Buscar la línea del `iconMap` y agregar `Bot`:

```tsx
import {
  LayoutDashboard, Globe, Database, Mail, Server,
  Shield, Archive, Terminal, Users, Settings, ChevronRight, Bot,
} from "lucide-react"

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard, Globe, Database, Mail, Server,
  Shield, Archive, Terminal, Users, Settings, Bot,
}
```

---

## Paso 8 — Agregar shadcn Textarea si no está

```bash
npx shadcn@latest add textarea
```

---

## Paso final — Verificación y commit

```bash
# 1. Verificar que ANTHROPIC_API_KEY está en .env
# ANTHROPIC_API_KEY="sk-ant-..."

# 2. Build sin errores
npm run build

# 3. Verificar en dev:
# - /ai carga con sugerencias
# - El chat responde con contexto del servidor
# - Las acciones propuestas muestran el botón "Confirmar y ejecutar"

# 4. Commit
git add .
git commit -m "feat: tezca AI assistant with server context and proposed actions"
git push origin main
```

---

## Notas para el agente

- `@anthropic-ai/sdk` debe instalarse en la raíz del proyecto, no en `/agent`.
- La página `/ai` es `"use client"` porque usa Zustand y state local — correcto e intencional.
- El modelo a usar es `claude-opus-4-5` — no cambiar a otro modelo.
- Las acciones propuestas en este commit **no se ejecutan realmente** en el servidor —
  solo se muestran y se confirman visualmente. La ejecución real viene en Commit 5
  cuando se implemente el endpoint `/agent/execute` con validación de comandos permitidos.
- Si `ANTHROPIC_API_KEY` no está en `.env`, la ruta `/api/ai/chat` lanzará un error 500.
  Asegurarse de que la key esté configurada antes de probar.
- El historial del chat vive en Zustand (memoria del cliente) — se borra al recargar la página.
  Persistencia en DB viene en versión futura.
- `prose-invert` de Tailwind Typography puede requerir: `npm install @tailwindcss/typography`
  y agregarlo a `tailwind.config.ts` en el array de plugins: `plugins: [require('@tailwindcss/typography')]`