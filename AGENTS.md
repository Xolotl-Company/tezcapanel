# Tezcapanel — Agent Instructions (Commit 2)

## Objetivo

Implementar el sistema de autenticación completo y el layout del dashboard con sidebar.
Al terminar este commit, el panel debe tener: página de login funcional, sesiones JWT,
rutas protegidas, sidebar de navegación, topbar, y el dashboard home con métricas placeholder.

---

## Contexto del proyecto

- **Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, NextAuth v5, Prisma + SQLite, Zustand
- **Identidad visual:** Panel de servidores con estética inspirada en cultura prehispánica mexicana.
  Nombre "Tezcapanel" viene de Tezcatlipoca. Paleta: negro profundo, verde esmeralda (`#10B981`),
  gris carbón, acentos en ámbar/dorado. Tipografía seria pero moderna. Dark mode por defecto.
- **Commit anterior:** Ya existe toda la estructura de carpetas, dependencias instaladas,
  `src/lib/auth.ts`, `src/lib/prisma.ts`, `src/lib/utils.ts`, `src/lib/agent-client.ts`,
  `src/store/server.store.ts`, `src/types/index.ts`, `src/components/layout/nav-items.ts`

---

## Archivos a crear / modificar

---

### `src/app/layout.tsx` — Root layout (MODIFICAR el existente)

```tsx
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "Tezcapanel",
  description: "Panel de administración de servidores",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

> Instala Geist si no está: `npm install geist`

---

### `src/app/globals.css` — Design tokens (REEMPLAZAR contenido completo)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 5%;
    --foreground: 0 0% 95%;
    --card: 0 0% 8%;
    --card-foreground: 0 0% 95%;
    --popover: 0 0% 8%;
    --popover-foreground: 0 0% 95%;
    --primary: 160 84% 39%;
    --primary-foreground: 0 0% 100%;
    --secondary: 0 0% 12%;
    --secondary-foreground: 0 0% 85%;
    --muted: 0 0% 12%;
    --muted-foreground: 0 0% 50%;
    --accent: 43 96% 56%;
    --accent-foreground: 0 0% 5%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --border: 0 0% 15%;
    --input: 0 0% 12%;
    --ring: 160 84% 39%;
    --radius: 0.5rem;
    --sidebar-width: 240px;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { @apply bg-background; }
  ::-webkit-scrollbar-thumb { @apply bg-border rounded-full; }
  ::-webkit-scrollbar-thumb:hover { @apply bg-muted-foreground; }
}
```

---

### `src/app/(auth)/login/page.tsx` — Página de login (REEMPLAZAR placeholder)

```tsx
"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Shield } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: "", password: "" })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const result = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    })

    if (result?.error) {
      toast({
        variant: "destructive",
        title: "Credenciales incorrectas",
        description: "Verifica tu email y contraseña.",
      })
      setLoading(false)
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Grid de fondo */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative w-full max-w-sm">
        {/* Glow verde */}
        <div className="absolute -inset-px bg-gradient-to-b from-primary/20 to-transparent rounded-xl blur-sm" />

        <div className="relative bg-card border border-border rounded-xl p-8 shadow-2xl">
          {/* Icono */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Tezcapanel</h1>
            <p className="text-sm text-muted-foreground mt-1">Accede a tu panel de control</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@servidor.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="current-password"
                className="bg-input border-border"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium mt-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Tezcapanel — Panel de administración de servidores
        </p>
      </div>
    </div>
  )
}
```

---

### `src/components/layout/sidebar.tsx` — Sidebar (CREAR)

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { navItems } from "./nav-items"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  LayoutDashboard, Globe, Database, Mail, Server,
  Shield, Archive, Terminal, Users, Settings, ChevronRight,
} from "lucide-react"

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard, Globe, Database, Mail, Server,
  Shield, Archive, Terminal, Users, Settings,
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[var(--sidebar-width)] h-screen bg-card border-r border-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center gap-3 px-5 border-b border-border">
        <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Shield className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="font-semibold text-sm tracking-wide">Tezcapanel</span>
        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-4">
          Community
        </Badge>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = iconMap[item.icon] ?? ChevronRight
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.proOnly ? "#" : item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  item.proOnly && "opacity-50 cursor-not-allowed"
                )}
              >
                <Icon className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                )} />
                <span className="flex-1">{item.label}</span>
                {item.proOnly && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 h-3.5 border-accent/50 text-accent"
                  >
                    PRO
                  </Badge>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/50">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-muted-foreground">Servidor activo</span>
        </div>
      </div>
    </aside>
  )
}
```

---

### `src/components/layout/topbar.tsx` — Topbar (CREAR)

```tsx
"use client"

import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Bell, LogOut, Settings, User } from "lucide-react"

interface TopbarProps {
  user?: { name?: string | null; email?: string | null }
}

export function Topbar({ user }: TopbarProps) {
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0].toUpperCase() ?? "U"

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Panel de control</span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-muted-foreground hover:text-foreground"
        >
          <Bell className="w-4 h-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.name ?? "Administrador"}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Configuración
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
```

---

### `src/app/(dashboard)/layout.tsx` — Layout protegido (CREAR)

```tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"

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
          {children}
        </main>
      </div>
    </div>
  )
}
```

---

### `src/components/dashboard/metric-card.tsx` — Card de métrica (CREAR)

```tsx
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  trend?: "up" | "down" | "neutral"
  className?: string
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend = "neutral",
  className,
}: MetricCardProps) {
  return (
    <div className={cn(
      "bg-card border border-border rounded-lg p-5 flex flex-col gap-4",
      className
    )}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground font-medium">{title}</span>
        <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {subtitle && (
          <p className={cn(
            "text-xs mt-1",
            trend === "up" && "text-primary",
            trend === "down" && "text-destructive",
            trend === "neutral" && "text-muted-foreground",
          )}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}
```

---

### `src/components/dashboard/services-status.tsx` — Estado de servicios (CREAR)

```tsx
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
```

---

### `src/app/(dashboard)/page.tsx` — Dashboard home (REEMPLAZAR placeholder)

```tsx
import { auth } from "@/lib/auth"
import { MetricCard } from "@/components/dashboard/metric-card"
import { ServicesStatus } from "@/components/dashboard/services-status"
import { Cpu, HardDrive, Clock, MemoryStick } from "lucide-react"

export default async function DashboardPage() {
  const session = await auth()
  const firstName = session?.user?.name?.split(" ")[0] ?? "Admin"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Hola, {firstName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Resumen del servidor — métricas en tiempo real llegan en el Commit 3
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="CPU"         value="–" subtitle="Sin datos aún" icon={Cpu} />
        <MetricCard title="Memoria RAM" value="–" subtitle="Sin datos aún" icon={MemoryStick} />
        <MetricCard title="Disco"       value="–" subtitle="Sin datos aún" icon={HardDrive} />
        <MetricCard title="Uptime"      value="–" subtitle="Sin datos aún" icon={Clock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ServicesStatus />
      </div>
    </div>
  )
}
```

---

### `scripts/create-admin.ts` — Crear usuario admin inicial (CREAR)

```typescript
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const email    = process.env.ADMIN_EMAIL    ?? "admin@tezcapanel.local"
  const password = process.env.ADMIN_PASSWORD ?? "admin123"
  const name     = process.env.ADMIN_NAME     ?? "Administrador"

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`✔ Usuario ${email} ya existe`)
    return
  }

  const hashed = await bcrypt.hash(password, 12)
  const user   = await prisma.user.create({
    data: { email, password: hashed, name, role: "ADMIN" },
  })

  console.log(`✔ Usuario admin creado: ${user.email}`)
  console.log(`  Email:    ${email}`)
  console.log(`  Password: ${password}`)
  console.log(`  ⚠ Cambia la contraseña después del primer login`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

Agregar a `package.json` en la sección `"scripts"`:

```json
"create-admin": "tsx scripts/create-admin.ts"
```

Instalar tsx: `npm install --save-dev tsx`

---

## Paso final — Verificación y commit

```bash
# 1. Dependencias nuevas
npm install geist
npm install --save-dev tsx

# 2. Migrar DB si no se hizo antes
npx prisma migrate dev --name init
npx prisma generate

# 3. Crear usuario admin
npm run create-admin

# 4. Verificar sin errores TypeScript
npm run build

# 5. Commit
git add .
git commit -m "feat: auth system and dashboard layout"
```

---

## Notas para el agente

- `next-auth`, `prisma`, `zustand`, `shadcn/ui` ya están instalados del Commit 1. No reinstalar.
- `globals.css` debe **reemplazarse completamente** — no hacer merge con el anterior.
- `src/app/layout.tsx` debe **reemplazarse** — el boilerplate de create-next-app ya no sirve.
- Si `src/lib/utils.ts` fue sobreescrito por shadcn, restaurar la versión del Commit 1 que incluye `formatBytes` y `formatUptime`.
- Los módulos `web`, `databases`, `mail`, `dns` mantienen sus placeholders — no modificar.
- Si `MemoryStick` no existe en la versión de lucide-react instalada, usar `Memory` como fallback.
- El script `create-admin.ts` es solo para desarrollo. En producción el `install.sh` manejará esto.
