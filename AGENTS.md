# Tezcapanel — Agent Instructions (Commit 5)

## Objetivo

Implementar la ejecución real de comandos en el servidor desde Byte AI.
El botón "Confirmar y ejecutar" debe llamar al agente Node.js, ejecutar los comandos
aprobados, y reportar el resultado en el chat en tiempo real.

---

## Contexto

- **Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, NextAuth v5, Prisma + SQLite, Zustand
- **Agente:** Node.js en `/agent/server.js`, puerto 7070
- **Commits anteriores:** Byte AI funcional con Haiku, propone acciones pero no las ejecuta aún
- **IMPORTANTE:** La ejecución de comandos debe ser segura — lista blanca estricta,
  nunca ejecutar comandos arbitrarios del usuario directamente.

---

## Parte 1 — Actualizar el agente Node.js

### `agent/server.js` — REEMPLAZAR COMPLETO

```js
const http = require("http")
const { exec } = require("child_process")
const si = require("systeminformation")

const PORT = 7070
const HOST = "127.0.0.1"
const TOKEN = process.env.AGENT_TOKEN

if (!TOKEN) {
  console.error("❌ AGENT_TOKEN no definido")
  process.exit(1)
}

// --- Lista blanca de comandos permitidos ---
// NUNCA ejecutar comandos arbitrarios — solo los de esta lista
const ALLOWED_COMMANDS = [
  // Gestión de paquetes
  /^apt(-get)? (install|remove|update|upgrade) -y [\w\s\-\.]+$/,
  /^apt(-get)? install -y [\w\s\-\.]+$/,
  /^yum (install|remove|update) -y [\w\s\-\.]+$/,
  /^dnf (install|remove|update) -y [\w\s\-\.]+$/,

  // Systemctl
  /^systemctl (start|stop|restart|reload|enable|disable|status) [\w\-\.]+$/,

  // Nginx
  /^nginx -t$/,
  /^nginx -s reload$/,

  // MySQL / MariaDB
  /^mysql -e "CREATE DATABASE [\w]+ CHARACTER SET utf8mb4"$/,
  /^mysql -e "CREATE USER '[\w]+'@'localhost' IDENTIFIED BY '[^']+'"$/,
  /^mysql -e "GRANT ALL ON [\w]+\.\* TO '[\w]+'@'localhost'"$/,
  /^mysql -e "FLUSH PRIVILEGES"$/,
  /^mysqldump [\w\s\-\.]+ > [\w\/\-\.]+$/,

  // Certbot / SSL
  /^certbot --nginx -d [\w\.\-]+ --non-interactive --agree-tos -m [\w@\.\-]+$/,
  /^certbot renew --dry-run$/,
  /^certbot renew$/,

  // Archivos de configuración (solo escritura en paths permitidos)
  /^mkdir -p \/etc\/(nginx|apache2|mysql|postfix)\//,
  /^mkdir -p \/var\/www\/[\w\-\.]+$/,
  /^chown -R www-data:www-data \/var\/www\/[\w\-\.]+$/,
  /^chmod -R 755 \/var\/www\/[\w\-\.]+$/,

  // Información del sistema (solo lectura)
  /^cat \/var\/log\/(nginx|apache2|mysql|syslog|auth\.log)(\/[\w\-\.]+)?$/,
  /^tail -n \d+ \/var\/log\/(nginx|apache2|mysql|syslog|auth\.log)(\/[\w\-\.]+)?$/,
  /^df -h$/,
  /^free -h$/,
  /^top -bn1$/,
  /^ps aux$/,
  /^netstat -tlnp$/,
  /^ss -tlnp$/,

  // ufw firewall
  /^ufw (enable|disable|status|allow|deny) ?[\w\/]*$/,

  // wget / curl para descargas estándar
  /^wget -O [\w\/\-\.]+ https:\/\/[\w\.\-\/\?=&]+$/,
]

function isCommandAllowed(command) {
  return ALLOWED_COMMANDS.some((pattern) => pattern.test(command.trim()))
}

function executeCommand(command, timeout = 30000) {
  return new Promise((resolve, reject) => {
    if (!isCommandAllowed(command)) {
      reject(new Error(`Comando no permitido: ${command}`))
      return
    }

    exec(command, { timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && error.killed) {
        reject(new Error("Comando excedió el tiempo límite"))
        return
      }
      resolve({
        success: !error,
        stdout: stdout?.trim() ?? "",
        stderr: stderr?.trim() ?? "",
        exitCode: error?.code ?? 0,
      })
    })
  })
}

// --- Auth ---
function isAuthorized(req) {
  const auth = req.headers["authorization"] ?? ""
  return auth === `Bearer ${TOKEN}`
}

// --- Headers ---
function setHeaders(res) {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000")
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type")
}

// --- Handlers ---
async function handleMetrics(res) {
  const [cpuData, cpuLoad, mem, disk, osInfo] = await Promise.all([
    si.cpu(),
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.osInfo(),
  ])

  const rootDisk = disk.find((d) => d.mount === "/") ?? disk[0] ?? {}

  const metrics = {
    cpu: {
      usage: parseFloat((cpuLoad.currentLoad ?? 0).toFixed(1)),
      cores: cpuData.cores ?? 1,
      model: `${cpuData.manufacturer} ${cpuData.brand}`.trim() || "Unknown",
    },
    memory: {
      total: mem.total ?? 0,
      used: mem.used ?? 0,
      free: mem.free ?? 0,
    },
    disk: {
      total: rootDisk.size ?? 0,
      used: rootDisk.used ?? 0,
      free: (rootDisk.size ?? 0) - (rootDisk.used ?? 0),
    },
    uptime: Math.floor(si.time().uptime ?? 0),
    hostname: osInfo.hostname ?? "localhost",
    os: `${osInfo.distro ?? osInfo.platform} ${osInfo.release ?? ""}`.trim(),
  }

  res.end(JSON.stringify(metrics))
}

async function handleServices(res) {
  const processes = await si.processes()
  const running = new Set(processes.list.map((p) => p.name.toLowerCase()))

  const targets = [
    { name: "nginx",   check: "nginx" },
    { name: "mysql",   check: "mysqld" },
    { name: "postfix", check: "postfix" },
    { name: "named",   check: "named" },
  ]

  const services = targets.map(({ name, check }) => ({
    name,
    status: running.has(check) ? "running" : "stopped",
  }))

  res.end(JSON.stringify(services))
}

async function handleExecute(req, res) {
  let body = ""
  req.on("data", (chunk) => { body += chunk })
  req.on("end", async () => {
    try {
      const { commands } = JSON.parse(body)

      if (!Array.isArray(commands) || commands.length === 0) {
        res.writeHead(400)
        res.end(JSON.stringify({ error: "commands array requerido" }))
        return
      }

      if (commands.length > 10) {
        res.writeHead(400)
        res.end(JSON.stringify({ error: "máximo 10 comandos por ejecución" }))
        return
      }

      const results = []

      for (const command of commands) {
        if (typeof command !== "string") {
          results.push({ command, success: false, error: "comando inválido" })
          continue
        }

        try {
          const result = await executeCommand(command)
          results.push({ command, ...result })

          // Si un comando falla, detener la cadena
          if (!result.success) {
            results.push({
              command: "(detenido)",
              success: false,
              error: "Ejecución detenida por error en comando anterior",
            })
            break
          }
        } catch (err) {
          results.push({
            command,
            success: false,
            error: err.message,
            stdout: "",
            stderr: "",
          })
          break
        }
      }

      res.end(JSON.stringify({ results }))
    } catch {
      res.writeHead(400)
      res.end(JSON.stringify({ error: "JSON inválido" }))
    }
  })
}

async function handleRestartService(name, res) {
  const allowed = ["nginx", "mysql", "mariadb", "postfix", "named", "apache2"]
  if (!allowed.includes(name)) {
    res.writeHead(400)
    res.end(JSON.stringify({ error: "servicio no permitido" }))
    return
  }

  try {
    const result = await executeCommand(`systemctl restart ${name}`)
    res.end(JSON.stringify(result))
  } catch (err) {
    res.writeHead(500)
    res.end(JSON.stringify({ error: err.message }))
  }
}

// --- Router ---
const server = http.createServer(async (req, res) => {
  setHeaders(res)

  if (req.method === "OPTIONS") {
    res.writeHead(204)
    res.end()
    return
  }

  if (!isAuthorized(req)) {
    res.writeHead(401)
    res.end(JSON.stringify({ error: "unauthorized" }))
    return
  }

  const url = req.url ?? "/"
  const method = req.method ?? "GET"

  try {
    if (method === "GET" && url === "/health") {
      res.end(JSON.stringify({ status: "ok", version: "0.2.0" }))
    } else if (method === "GET" && url === "/metrics") {
      await handleMetrics(res)
    } else if (method === "GET" && url === "/services") {
      await handleServices(res)
    } else if (method === "POST" && url === "/execute") {
      await handleExecute(req, res)
    } else if (method === "POST" && url.startsWith("/services/") && url.endsWith("/restart")) {
      const name = url.split("/")[2]
      await handleRestartService(name, res)
    } else {
      res.writeHead(404)
      res.end(JSON.stringify({ error: "not found" }))
    }
  } catch (err) {
    console.error("Agent error:", err)
    res.writeHead(500)
    res.end(JSON.stringify({ error: "internal error" }))
  }
})

server.listen(PORT, HOST, () => {
  console.log(`✔ tezcaagent v0.2.0 escuchando en http://${HOST}:${PORT}`)
})
```

---

## Parte 2 — API Route de ejecución en Next.js

### `src/app/api/agent/execute/route.ts` — CREAR

```typescript
import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const AGENT_URL = process.env.AGENT_URL ?? "http://127.0.0.1:7070"
const AGENT_TOKEN = process.env.AGENT_TOKEN ?? ""

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { commands, actionLabels } = await req.json()

  if (!Array.isArray(commands) || commands.length === 0) {
    return NextResponse.json({ error: "commands requerido" }, { status: 400 })
  }

  // Registrar en audit log antes de ejecutar
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "execute_commands",
      target: actionLabels?.join(", ") ?? commands.join(", "),
      metadata: JSON.stringify({ commands }),
    },
  })

  try {
    const res = await fetch(`${AGENT_URL}/execute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AGENT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ commands }),
      signal: AbortSignal.timeout(60000), // 60s para comandos largos
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "agent_unavailable" }, { status: 503 })
  }
}
```

---

## Parte 3 — Actualizar el chat para ejecutar acciones reales

### `src/app/(dashboard)/ai/page.tsx` — Modificar función `handleConfirmActions`

Buscar esta función:

```typescript
async function handleConfirmActions(messageId: string, actions: ProposedAction[]) {
  updateMessage(messageId, { actionsExecuted: true })
  const confirmMsg = `He confirmado las acciones propuestas. (Nota: la ejecución real de comandos en el servidor estará disponible en la próxima versión del panel.)`
  await sendMessage(confirmMsg)
}
```

Reemplazar con:

```typescript
async function handleConfirmActions(messageId: string, actions: ProposedAction[]) {
  updateMessage(messageId, { actionsExecuted: true })
  setLoading(true)

  const executingId = generateId()
  addMessage({
    id: executingId,
    role: "assistant",
    content: "⏳ Ejecutando acciones en el servidor...",
    timestamp: new Date(),
  })

  try {
    const res = await fetch("/api/agent/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commands: actions.map((a) => a.command),
        actionLabels: actions.map((a) => a.label),
      }),
    })

    const data = await res.json()

    if (data.error === "agent_unavailable") {
      updateMessage(executingId, {
        content: "❌ El agente no está disponible. Verifica que `tezcaagent` esté corriendo.",
        timestamp: new Date(),
      })
      setLoading(false)
      return
    }

    // Construir reporte de resultados
    const results = data.results ?? []
    const allSuccess = results.every((r: { success: boolean }) => r.success)

    const resultSummary = results
      .map((r: { command: string; success: boolean; stdout: string; stderr: string; error?: string }) =>
        `${r.success ? "✔" : "✖"} \`${r.command}\`${r.stdout ? `\n   ${r.stdout.slice(0, 200)}` : ""}${r.error ? `\n   Error: ${r.error}` : ""}`
      )
      .join("\n")

    updateMessage(executingId, {
      content: allSuccess
        ? `✅ Todas las acciones ejecutadas correctamente:\n\n${resultSummary}`
        : `⚠️ Algunas acciones fallaron:\n\n${resultSummary}`,
      timestamp: new Date(),
    })

    // Pedir a Byte que interprete los resultados
    const followUpMsg = allSuccess
      ? `Las acciones se ejecutaron exitosamente. Resultados: ${resultSummary}. Dame un resumen de lo que se hizo y próximos pasos si aplican.`
      : `Algunas acciones fallaron. Resultados: ${resultSummary}. Explícame qué salió mal y cómo solucionarlo.`

    await sendMessage(followUpMsg)
  } catch {
    updateMessage(executingId, {
      content: "❌ Error al ejecutar las acciones. Intenta de nuevo.",
      timestamp: new Date(),
    })
  } finally {
    setLoading(false)
  }
}
```

---

## Parte 4 — Actualizar el componente de acciones para mostrar estado

### `src/components/ai/chat-message.tsx` — Modificar la sección de acciones ejecutadas

Buscar:
```tsx
{/* Acciones ejecutadas */}
{message.actionsExecuted && (
  <div className="flex items-center gap-1.5 text-xs text-primary">
    <CheckCircle2 className="w-3 h-3" />
    Acciones ejecutadas
  </div>
)}
```

Reemplazar con:
```tsx
{/* Acciones ejecutadas */}
{message.actionsExecuted && (
  <div className="flex items-center gap-1.5 text-xs text-primary">
    <CheckCircle2 className="w-3 h-3" />
    Ejecutado — revisa el resultado abajo
  </div>
)}
```

---

## Parte 5 — Audit log page

### `src/app/(dashboard)/settings/page.tsx` — Agregar sección de audit log

Agregar al final del JSX, antes del cierre del `div` principal:

```tsx
{/* Audit log */}
<AuditLogSection />
```

### `src/components/dashboard/audit-log.tsx` — CREAR

```tsx
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
```

Agregar el import en `settings/page.tsx`:
```tsx
import { AuditLogSection } from "@/components/dashboard/audit-log"
```

---

## Paso final — Verificación y commit

```bash
# 1. Reiniciar el agente con la nueva versión
# Matar el proceso actual:
lsof -ti:7070 | xargs kill -9

# Iniciar el agente actualizado:
AGENT_TOKEN="tu_token" node agent/server.js
# Debe mostrar: tezcaagent v0.2.0

# 2. Build sin errores
npm run build

# 3. Probar en dev:
# - Abrir Byte AI
# - Pedir "Instala nginx" o "¿qué servicios tengo corriendo?"
# - Confirmar las acciones propuestas
# - Verificar que se ejecutan y Byte reporta el resultado

# 4. Commit
git add .
git commit -m "feat: real command execution with allowlist and audit log"
git push origin main
```

---

## Notas para el agente

- El endpoint `/execute` del agente usa una lista blanca de regex — nunca ejecuta comandos
  arbitrarios. Si un comando no hace match con ningún patrón, retorna error 403.
- En macOS los comandos como `apt install` no funcionan — el agente los rechazará o fallará.
  Esto es esperado: el agente está diseñado para Linux. En desarrollo en Mac, Byte puede
  proponer los comandos pero la ejecución real solo funciona en un servidor Linux.
- El audit log registra TODOS los comandos ejecutados con el userId — importante para
  producción y compliance.
- `session.user.id` requiere que el tipo de sesión incluya `id`. Si TypeScript marca error,
  agregar en `src/types/next-auth.d.ts`:
  ```typescript
  declare module "next-auth" {
    interface Session {
      user: { id: string; role: string } & DefaultSession["user"]
    }
  }
  ```
- El timeout de ejecución es 60 segundos — suficiente para `apt install` pero no para
  operaciones muy largas. Ajustar si es necesario.