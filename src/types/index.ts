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
