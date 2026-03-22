# Tezcapanel — Agent Instructions (Commit 1)

## Objetivo

Configurar la base del proyecto Tezcapanel: instalar dependencias, crear la estructura
de carpetas, y generar los archivos base. El proyecto ya existe como un boilerplate de
`create-next-app` con Next.js + TypeScript + Tailwind CSS.

**No modificar** archivos existentes a menos que se indique explícitamente.

---

## Contexto del proyecto

- **Repo:** Xolotl-Company/tezcapanel
- **Stack actual:** Next.js 15, TypeScript, Tailwind CSS, App Router
- **Directorio raíz:** contiene `src/app/`, `package.json`, `tsconfig.json`
- **Objetivo final:** Panel de administración de servidores Linux (alternativa a cPanel/aaPanel)

---

## Paso 1 — Instalar dependencias

Ejecuta los siguientes comandos en la raíz del proyecto:

```bash
npm install next-auth@beta @auth/prisma-adapter bcryptjs
npm install --save-dev @types/bcryptjs
npm install prisma @prisma/client
npm install zustand
npm install clsx tailwind-merge lucide-react
```

Luego inicializa Prisma con SQLite:

```bash
npx prisma init --datasource-provider sqlite
```

Luego inicializa shadcn/ui con estos valores:
- Style: `Default`
- Base color: `Slate`
- CSS variables: `Yes`

```bash
npx shadcn@latest init
```

Luego instala los componentes de shadcn necesarios:

```bash
npx shadcn@latest add button card input label badge separator avatar dropdown-menu toast tooltip
```

---

## Paso 2 — Crear estructura de carpetas

Crea los siguientes directorios (vacíos si no existe contenido aún):

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (dashboard)/
│   │   ├── web/
│   │   ├── databases/
│   │   ├── mail/
│   │   └── dns/
│   └── api/
│       ├── auth/
│       │   └── [...nextauth]/
│       └── agent/
│           └── [...route]/
├── components/
│   ├── layout/
│   └── dashboard/
├── lib/
├── store/
└── types/

agent/
├── handlers/
├── middleware/
├── config/
└── systemd/
```

---

## Paso 3 — Crear archivos

Crea cada archivo con exactamente el contenido especificado a continuación.

---

### `.env`

> Solo crear si no existe. Nunca sobreescribir.

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="REEMPLAZA_CON_TU_SECRET"
AGENT_URL="http://127.0.0.1:7070"
AGENT_TOKEN="REEMPLAZA_CON_TU_TOKEN"
NODE_ENV="development"
```

Agrega `.env` al `.gitignore` si no está ya incluido.

---

### `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String
  role      String   @default("ADMIN")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String
  target    String?
  metadata  String?
  createdAt DateTime @default(now())
}
```

---

### `src/lib/prisma.ts`

```typescript
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

---

### `src/lib/utils.ts`

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
```

---

### `src/lib/auth.ts`

```typescript
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user) return null

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
})
```

---

### `src/lib/agent-client.ts`

```typescript
const AGENT_URL = process.env.AGENT_URL ?? "http://127.0.0.1:7070"
const AGENT_TOKEN = process.env.AGENT_TOKEN ?? ""

export interface ServerMetrics {
  cpu: {
    usage: number
    cores: number
    model: string
  }
  memory: {
    total: number
    used: number
    free: number
  }
  disk: {
    total: number
    used: number
    free: number
  }
  uptime: number
  hostname: string
  os: string
}

export interface ServiceStatus {
  name: string
  status: "running" | "stopped" | "unknown"
  pid?: number
}

export async function agentFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${AGENT_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${AGENT_TOKEN}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
    signal: AbortSignal.timeout(5000),
  })

  if (!res.ok) {
    throw new Error(`Agent error ${res.status}: ${await res.text()}`)
  }

  return res.json() as Promise<T>
}

export const agentAPI = {
  getMetrics: () => agentFetch<ServerMetrics>("/metrics"),
  getServices: () => agentFetch<ServiceStatus[]>("/services"),
  restartService: (name: string) =>
    agentFetch<{ ok: boolean }>(`/services/${name}/restart`, { method: "POST" }),
}
```

---

### `src/types/index.ts`

```typescript
export type UserRole = "ADMIN" | "USER"

export interface NavItem {
  label: string
  href: string
  icon: string
  badge?: string
  proOnly?: boolean
}

export interface ServerMetrics {
  cpu: { usage: number; cores: number; model: string }
  memory: { total: number; used: number; free: number }
  disk: { total: number; used: number; free: number }
  uptime: number
  hostname: string
  os: string
}

export type ServiceStatus = "running" | "stopped" | "unknown"

export interface Service {
  name: string
  displayName: string
  status: ServiceStatus
  pid?: number
}
```

---

### `src/store/server.store.ts`

```typescript
import { create } from "zustand"
import type { ServerMetrics, Service } from "@/types"

interface ServerState {
  metrics: ServerMetrics | null
  services: Service[]
  isLoading: boolean
  lastUpdated: Date | null
  error: string | null
  setMetrics: (metrics: ServerMetrics) => void
  setServices: (services: Service[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useServerStore = create<ServerState>((set) => ({
  metrics: null,
  services: [],
  isLoading: false,
  lastUpdated: null,
  error: null,
  setMetrics: (metrics) => set({ metrics, lastUpdated: new Date(), error: null }),
  setServices: (services) => set({ services }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
}))
```

---

### `src/components/layout/nav-items.ts`

```typescript
import type { NavItem } from "@/types"

export const navItems: NavItem[] = [
  { label: "Dashboard",      href: "/",          icon: "LayoutDashboard" },
  { label: "Web",            href: "/web",        icon: "Globe" },
  { label: "Bases de datos", href: "/databases",  icon: "Database" },
  { label: "Correo",         href: "/mail",       icon: "Mail",    proOnly: true },
  { label: "DNS",            href: "/dns",        icon: "Server",  proOnly: true },
  { label: "Firewall",       href: "/firewall",   icon: "Shield",  proOnly: true },
  { label: "Backups",        href: "/backups",    icon: "Archive", proOnly: true },
  { label: "Terminal",       href: "/terminal",   icon: "Terminal" },
  { label: "Usuarios",       href: "/users",      icon: "Users" },
  { label: "Configuración",  href: "/settings",   icon: "Settings" },
]
```

---

### `src/app/api/auth/[...nextauth]/route.ts`

```typescript
import { handlers } from "@/lib/auth"

export const { GET, POST } = handlers
```

---

### `src/app/api/agent/[...route]/route.ts`

```typescript
import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

const AGENT_URL = process.env.AGENT_URL ?? "http://127.0.0.1:7070"
const AGENT_TOKEN = process.env.AGENT_TOKEN ?? ""

export async function GET(
  req: NextRequest,
  { params }: { params: { route: string[] } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const path = "/" + params.route.join("/")

  try {
    const res = await fetch(`${AGENT_URL}${path}`, {
      headers: { Authorization: `Bearer ${AGENT_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Agent unavailable" }, { status: 503 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { route: string[] } }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const path = "/" + params.route.join("/")
  const body = await req.json().catch(() => ({}))

  try {
    const res = await fetch(`${AGENT_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AGENT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Agent unavailable" }, { status: 503 })
  }
}
```

---

### `src/app/(auth)/login/page.tsx`

```typescript
// Placeholder — se implementa en Commit 2
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Login — próximo commit</p>
    </div>
  )
}
```

---

### `src/app/(dashboard)/page.tsx`

```typescript
// Placeholder — se implementa en Commit 2
export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Tezcapanel</h1>
      <p className="text-muted-foreground mt-2">Dashboard — próximo commit</p>
    </div>
  )
}
```

---

### `src/app/(dashboard)/web/page.tsx`

```typescript
export default function WebPage() {
  return <div className="p-8"><h1 className="text-xl font-bold">Web</h1></div>
}
```

---

### `src/app/(dashboard)/databases/page.tsx`

```typescript
export default function DatabasesPage() {
  return <div className="p-8"><h1 className="text-xl font-bold">Bases de datos</h1></div>
}
```

---

### `src/app/(dashboard)/mail/page.tsx`

```typescript
export default function MailPage() {
  return <div className="p-8"><h1 className="text-xl font-bold">Correo</h1></div>
}
```

---

### `src/app/(dashboard)/dns/page.tsx`

```typescript
export default function DnsPage() {
  return <div className="p-8"><h1 className="text-xl font-bold">DNS</h1></div>
}
```

---

### `agent/go.mod`

```
module github.com/Xolotl-Company/tezcapanel/agent

go 1.22

require (
  github.com/go-chi/chi/v5 v5.0.12
  github.com/shirou/gopsutil/v3 v3.24.1
)
```

---

### `agent/main.go`

```go
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

var agentToken string

func main() {
	agentToken = os.Getenv("AGENT_TOKEN")
	if agentToken == "" {
		log.Fatal("AGENT_TOKEN no definido")
	}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(authMiddleware)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	r.Get("/metrics", getMetrics)
	r.Get("/services", getServices)
	r.Post("/services/{name}/restart", restartService)

	addr := "127.0.0.1:7070"
	fmt.Printf("tezcaagent corriendo en %s\n", addr)
	log.Fatal(http.ListenAndServe(addr, r))
}
```

---

### `agent/middleware/auth.go`

```go
package main

import (
	"net/http"
	"strings"
)

func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if token != agentToken {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
```

---

### `agent/handlers/metrics.go`

```go
package main

import (
	"encoding/json"
	"net/http"
	"runtime"
	"time"

	"github.com/go-chi/chi/v5"
)

type Metrics struct {
	CPU    CPUInfo  `json:"cpu"`
	Memory MemInfo  `json:"memory"`
	Disk   DiskInfo `json:"disk"`
	Uptime int64    `json:"uptime"`
	Host   string   `json:"hostname"`
	OS     string   `json:"os"`
}

type CPUInfo  struct { Usage float64 `json:"usage"`; Cores int    `json:"cores"`; Model string `json:"model"` }
type MemInfo  struct { Total uint64  `json:"total"`; Used  uint64 `json:"used"`;  Free  uint64 `json:"free"` }
type DiskInfo struct { Total uint64  `json:"total"`; Used  uint64 `json:"used"`;  Free  uint64 `json:"free"` }

var startTime = time.Now()

func getMetrics(w http.ResponseWriter, r *http.Request) {
	// Stub — Commit 3 integra gopsutil para datos reales del sistema
	m := Metrics{
		CPU:    CPUInfo{Usage: 0, Cores: runtime.NumCPU(), Model: "Unknown"},
		Memory: MemInfo{},
		Disk:   DiskInfo{},
		Uptime: int64(time.Since(startTime).Seconds()),
		Host:   "localhost",
		OS:     runtime.GOOS,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(m)
}

func getServices(w http.ResponseWriter, r *http.Request) {
	services := []map[string]string{
		{"name": "nginx",  "status": "unknown"},
		{"name": "mysql",  "status": "unknown"},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(services)
}

func restartService(w http.ResponseWriter, r *http.Request) {
	_ = chi.URLParam(r, "name")
	// TODO Commit 3: ejecutar systemctl restart {name}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}
```

---

### `agent/systemd/tezcaagent.service`

```ini
[Unit]
Description=Tezcapanel Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/tezcapanel/agent
ExecStart=/opt/tezcapanel/agent/tezcaagent
Restart=always
RestartSec=5
Environment=AGENT_TOKEN=REEMPLAZA_CON_TU_TOKEN

[Install]
WantedBy=multi-user.target
```

---

## Paso 4 — Verificación

Una vez creados todos los archivos, ejecuta:

```bash
npx prisma migrate dev --name init
npx prisma generate
npm run build
```

No debe haber errores de TypeScript ni de compilación.

---

## Paso 5 — Commit

```bash
git add .
git commit -m "chore: setup core dependencies and project structure"
```

---

## Notas para el agente

- El archivo `.env` **nunca** se commitea. Verificar que esté en `.gitignore`.
- Los archivos placeholder en `(dashboard)` y `(auth)` son temporales. Se reemplazarán en el Commit 2.
- El directorio `agent/` es un módulo Go independiente. No forma parte del build de Next.js.
- `src/lib/utils.ts` puede sobreescribir el `utils.ts` que genera shadcn — es intencional, el contenido es compatible.
- Todos los imports usan el alias `@/` que ya está configurado en `tsconfig.json`.
