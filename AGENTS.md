# Tezcapanel — Agent Instructions (Commit 3)

## Objetivo

1. Crear el agente del servidor en Node.js con métricas reales (CPU, RAM, disco, uptime)
2. Conectar métricas al dashboard con auto-refresh cada 5 segundos
3. Crear páginas faltantes que dan 404: Terminal, Usuarios, Configuración
4. Agregar página ProGate para módulos PRO bloqueados (Correo, DNS, Firewall, Backups)
5. Dar contenido básico a módulos Community: Web, Bases de datos

---

## Contexto

- **Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, NextAuth v5, Prisma + SQLite, Zustand
- **Agente:** Node.js con `systeminformation` — vive en `/agent` como proceso independiente
- **Puerto agente:** 7070 (localhost only)
- **Problema actual:** Terminal, Usuarios, Configuración dan 404. Web y Bases de datos vacías.
  Módulos PRO redirigen a `#` sin página propia. Dashboard muestra "–" en todas las métricas.
- **IMPORTANTE:** No modificar nada fuera de los archivos listados aquí.

---

## Parte 1 — Agente Node.js

### Instalar dependencia del agente

Ejecutar en la raíz del proyecto:

```bash
npm install systeminformation
```

---

### `agent/server.js` — CREAR

```js
const http = require("http")
const si = require("systeminformation")

const PORT = 7070
const HOST = "127.0.0.1"
const TOKEN = process.env.AGENT_TOKEN

if (!TOKEN) {
  console.error("❌ AGENT_TOKEN no definido — exporta la variable de entorno")
  process.exit(1)
}

// --- Auth helper ---
function isAuthorized(req) {
  const auth = req.headers["authorization"] ?? ""
  return auth === `Bearer ${TOKEN}`
}

// --- CORS + JSON headers ---
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
  const running = new Set(
    processes.list.map((p) => p.name.toLowerCase())
  )

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

async function handleRestartService(name, res) {
  const allowed = ["nginx", "mysql", "postfix", "named"]
  if (!allowed.includes(name)) {
    res.writeHead(400)
    res.end(JSON.stringify({ error: "service not allowed" }))
    return
  }
  // TODO: ejecutar systemctl restart {name} con validación adicional
  res.end(JSON.stringify({ ok: true }))
}

// --- Router ---
const server = http.createServer(async (req, res) => {
  setHeaders(res)

  // OPTIONS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204)
    res.end()
    return
  }

  // Auth check
  if (!isAuthorized(req)) {
    res.writeHead(401)
    res.end(JSON.stringify({ error: "unauthorized" }))
    return
  }

  const url = req.url ?? "/"
  const method = req.method ?? "GET"

  try {
    if (method === "GET" && url === "/health") {
      res.end(JSON.stringify({ status: "ok", version: "0.1.0" }))

    } else if (method === "GET" && url === "/metrics") {
      await handleMetrics(res)

    } else if (method === "GET" && url === "/services") {
      await handleServices(res)

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
  console.log(`✔ tezcaagent v0.1.0 escuchando en http://${HOST}:${PORT}`)
})
```

---

### `agent/package.json` — CREAR

```json
{
  "name": "tezcaagent",
  "version": "0.1.0",
  "description": "Tezcapanel server agent",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "systeminformation": "*"
  }
}
```

---

### Agregar script al `package.json` raíz

En la sección `"scripts"` del `package.json` de la raíz, agregar:

```json
"agent": "AGENT_TOKEN=$AGENT_TOKEN node agent/server.js",
"agent:dev": "AGENT_TOKEN=$AGENT_TOKEN node --watch agent/server.js"
```

---

## Parte 2 — API route de métricas

### `src/app/api/metrics/route.ts` — CREAR

```ts
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

const AGENT_URL = process.env.AGENT_URL ?? "http://127.0.0.1:7070"
const AGENT_TOKEN = process.env.AGENT_TOKEN ?? ""

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const [metricsRes, servicesRes] = await Promise.all([
      fetch(`${AGENT_URL}/metrics`, {
        headers: { Authorization: `Bearer ${AGENT_TOKEN}` },
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      }),
      fetch(`${AGENT_URL}/services`, {
        headers: { Authorization: `Bearer ${AGENT_TOKEN}` },
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      }),
    ])

    const metrics = await metricsRes.json()
    const services = await servicesRes.json()

    return NextResponse.json({ metrics, services })
  } catch {
    return NextResponse.json({ error: "agent_unavailable" }, { status: 503 })
  }
}
```

---

## Parte 3 — Dashboard con métricas reales

### `src/components/dashboard/metrics-provider.tsx` — CREAR

```tsx
"use client"

import { useEffect } from "react"
import { useServerStore } from "@/store/server.store"

export function MetricsProvider({ children }: { children: React.ReactNode }) {
  const { setMetrics, setServices, setLoading, setError } = useServerStore()

  async function fetchMetrics() {
    try {
      const res = await fetch("/api/metrics")
      if (!res.ok) {
        setError(res.status === 503 ? "agent_unavailable" : "fetch_error")
        return
      }
      const data = await res.json()
      setMetrics(data.metrics)
      setServices(data.services)
    } catch {
      setError("fetch_error")
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchMetrics().finally(() => setLoading(false))
    const interval = setInterval(fetchMetrics, 5000)
    return () => clearInterval(interval)
  }, [])

  return <>{children}</>
}
```

---

### `src/app/(dashboard)/layout.tsx` — REEMPLAZAR

```tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { MetricsProvider } from "@/components/dashboard/metrics-provider"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar user={session.user} />
        <main className="flex-1 overflow-y-auto p-6">
          <MetricsProvider>
            {children}
          </MetricsProvider>
        </main>
      </div>
    </div>
  )
}
```

---

### `src/components/dashboard/services-status-live.tsx` — CREAR

```tsx
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
```

---

### `src/app/(dashboard)/page.tsx` — REEMPLAZAR

```tsx
"use client"

import { useServerStore } from "@/store/server.store"
import { MetricCard } from "@/components/dashboard/metric-card"
import { ServicesStatus } from "@/components/dashboard/services-status-live"
import { formatBytes, formatUptime } from "@/lib/utils"
import { Cpu, HardDrive, Clock, MemoryStick } from "lucide-react"

export default function DashboardPage() {
  const { metrics, error } = useServerStore()

  const cpuValue    = metrics ? `${metrics.cpu.usage.toFixed(1)}%` : "–"
  const ramValue    = metrics ? formatBytes(metrics.memory.used) : "–"
  const diskValue   = metrics ? formatBytes(metrics.disk.used) : "–"
  const uptimeValue = metrics ? formatUptime(metrics.uptime) : "–"

  const ramSubtitle  = metrics
    ? `de ${formatBytes(metrics.memory.total)} total`
    : error === "agent_unavailable" ? "Agente no disponible" : "Conectando..."

  const diskSubtitle = metrics
    ? `de ${formatBytes(metrics.disk.total)} total`
    : ""

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">
          {metrics?.hostname ?? "Panel de control"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {metrics?.os ?? "Conectando con el servidor..."}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="CPU"
          value={cpuValue}
          subtitle={metrics ? `${metrics.cpu.cores} núcleos` : "–"}
          icon={Cpu}
          trend={metrics && metrics.cpu.usage > 80 ? "down" : "neutral"}
        />
        <MetricCard
          title="Memoria RAM"
          value={ramValue}
          subtitle={ramSubtitle}
          icon={MemoryStick}
          trend={metrics && metrics.memory.used / metrics.memory.total > 0.85 ? "down" : "neutral"}
        />
        <MetricCard
          title="Disco"
          value={diskValue}
          subtitle={diskSubtitle}
          icon={HardDrive}
          trend={metrics && metrics.disk.used / metrics.disk.total > 0.9 ? "down" : "neutral"}
        />
        <MetricCard
          title="Uptime"
          value={uptimeValue}
          subtitle="Tiempo activo del servidor"
          icon={Clock}
          trend="up"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ServicesStatus />
      </div>
    </div>
  )
}
```

---

## Parte 4 — Páginas faltantes

### `src/app/(dashboard)/terminal/page.tsx` — CREAR

```tsx
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
```

---

### `src/app/(dashboard)/users/page.tsx` — CREAR

```tsx
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Users } from "lucide-react"

export default async function UsersPage() {
  const session = await auth()
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Usuarios</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Administra los usuarios con acceso al panel
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Usuarios del panel</span>
          <Badge variant="secondary" className="ml-auto">{users.length}</Badge>
        </div>
        <div className="divide-y divide-border">
          {users.map((user) => (
            <div key={user.id} className="px-5 py-3 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user.name ?? "Sin nombre"}</span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    user.email === session?.user?.email
                      ? "border-primary/50 text-primary text-[10px]"
                      : "text-[10px]"
                  }
                >
                  {user.role}
                </Badge>
                {user.email === session?.user?.email && (
                  <span className="text-[10px] text-muted-foreground">Tú</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

### `src/app/(dashboard)/settings/page.tsx` — CREAR

```tsx
import { auth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

export default async function SettingsPage() {
  const session = await auth()

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">Ajustes del panel y del servidor</p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-medium">Perfil</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Nombre</span>
            <span className="text-sm">{session?.user?.name ?? "—"}</span>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm">{session?.user?.email ?? "—"}</span>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Rol</span>
            <Badge variant="outline" className="text-[10px]">ADMIN</Badge>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-medium">Plan actual</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Versión</span>
            <Badge variant="secondary">Community</Badge>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Módulos Pro</span>
            <span className="text-sm text-muted-foreground">No incluidos</span>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Actualiza a Pro para desbloquear Correo, DNS, Firewall, Backups y el Asistente IA.
          </p>
        </div>
      </div>
    </div>
  )
}
```

---

## Parte 5 — ProGate para módulos PRO

### `src/components/dashboard/pro-gate.tsx` — CREAR

```tsx
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
```

### `src/app/(dashboard)/mail/page.tsx` — REEMPLAZAR

```tsx
import { ProGate } from "@/components/dashboard/pro-gate"
export default function MailPage() {
  return <ProGate module="Correo electrónico" description="Gestiona cuentas, aliases, DKIM/SPF y cuotas desde el panel." />
}
```

### `src/app/(dashboard)/dns/page.tsx` — REEMPLAZAR

```tsx
import { ProGate } from "@/components/dashboard/pro-gate"
export default function DnsPage() {
  return <ProGate module="DNS" description="Administra zonas DNS y registros A, MX, TXT, CNAME con editor visual." />
}
```

### `src/app/(dashboard)/firewall/page.tsx` — CREAR

```tsx
import { ProGate } from "@/components/dashboard/pro-gate"
export default function FirewallPage() {
  return <ProGate module="Firewall" description="Configura reglas de firewall y protección contra ataques." />
}
```

### `src/app/(dashboard)/backups/page.tsx` — CREAR

```tsx
import { ProGate } from "@/components/dashboard/pro-gate"
export default function BackupsPage() {
  return <ProGate module="Backups" description="Backups automáticos con retención configurable y restauración con un clic." />
}
```

---

## Parte 6 — Módulos Community con contenido

### `src/app/(dashboard)/web/page.tsx` — REEMPLAZAR

```tsx
import { Globe } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function WebPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Servidor Web</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión de sitios, virtual hosts y SSL</p>
        </div>
        <Badge variant="secondary" className="text-xs">Commit 4</Badge>
      </div>
      <div className="bg-card border border-border rounded-lg p-8 flex flex-col items-center justify-center gap-4 min-h-[300px]">
        <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Globe className="w-6 h-6 text-primary" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">Gestión de sitios web</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Crea virtual hosts para Nginx, Apache u OpenLiteSpeed con SSL automático via Let's Encrypt.
          </p>
        </div>
      </div>
    </div>
  )
}
```

### `src/app/(dashboard)/databases/page.tsx` — REEMPLAZAR

```tsx
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
```

---

## Parte 7 — Sidebar: quitar bloqueo en módulos PRO

### `src/components/layout/sidebar.tsx` — Modificar UNA línea

Buscar esta línea:
```tsx
href={item.proOnly ? "#" : item.href}
```

Reemplazar por:
```tsx
href={item.href}
```

Y quitar el estilo `cursor-not-allowed` del className para que los módulos PRO naveguen
a su página ProGate en lugar de no hacer nada.

Buscar:
```tsx
item.proOnly && "opacity-50 cursor-not-allowed"
```

Reemplazar por:
```tsx
item.proOnly && "opacity-60"
```

---

## Paso final — Verificación y commit

```bash
# 1. Verificar TypeScript sin errores
npm run build

# 2. Probar en desarrollo con el agente activo
# Terminal 1 — agente:
AGENT_TOKEN=tu_token_aqui node agent/server.js

# Terminal 2 — Next.js:
npm run dev

# 3. Verificar:
# - /terminal, /users, /settings → no dan 404
# - /mail, /dns, /firewall, /backups → muestran ProGate
# - Dashboard → métricas reales si el agente está corriendo
# - Dashboard → "Agente no disponible" si el agente NO está corriendo (no debe crashear)

# 4. Commit y push
git add .
git commit -m "feat: node agent, real metrics, missing pages and pro gate"
git push origin main
```

---

## Notas para el agente

- `systeminformation` ya está instalado en el `node_modules` raíz con `npm install systeminformation`.
  El archivo `agent/server.js` lo importa directamente con `require("systeminformation")`.
- `src/app/(dashboard)/page.tsx` pasa a `"use client"` porque usa Zustand — es correcto e intencional.
- El componente `ServicesStatus` original del Commit 2 queda obsoleto. Usar `services-status-live.tsx`.
  Actualizar cualquier import que lo referencie.
- Si `MemoryStick` no existe en la versión de lucide-react instalada, usar `Server` como fallback.
- El agente Node.js es opcional en desarrollo. Si no está corriendo, el dashboard muestra
  "Conectando..." / "Agente no disponible" sin crashear — esto es comportamiento esperado.
- `agent/package.json` es solo para documentación — las dependencias del agente van en el
  `package.json` raíz para simplificar. No ejecutar `npm install` dentro de `/agent`.