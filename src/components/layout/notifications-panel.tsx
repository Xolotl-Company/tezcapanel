"use client"

import { useEffect, useState, useRef } from "react"
import { Bell, X, Check, Info, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

const typeConfig = {
  info:    { icon: Info,          className: "text-primary" },
  warning: { icon: AlertTriangle, className: "text-accent" },
  success: { icon: CheckCircle2,  className: "text-primary" },
  error:   { icon: AlertTriangle, className: "text-destructive" },
}

export function NotificationsPanel() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  async function fetchNotifications() {
    const res = await fetch("/api/notifications")
    if (!res.ok) return
    const data = await res.json()
    setNotifications(data.notifications)
    setUnread(data.unread)
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "POST" })
    await fetchNotifications()
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  return (
    <div className="relative" ref={panelRef}>
      {/* Botón campana */}
      <Button
        variant="ghost"
        size="icon"
        className="relative w-8 h-8 text-muted-foreground hover:text-foreground"
        onClick={() => {
          setOpen(!open)
          if (!open && unread > 0) markAllRead()
        }}
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
        )}
      </Button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Notificaciones</span>
              {unread > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4">{unread}</Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Bell className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">Sin notificaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((n) => {
                  const config = typeConfig[n.type as keyof typeof typeConfig] ?? typeConfig.info
                  const Icon = config.icon
                  return (
                    <div
                      key={n.id}
                      className={cn(
                        "px-4 py-3 flex gap-3",
                        !n.read && "bg-primary/5"
                      )}
                    >
                      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", config.className)} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(n.createdAt).toLocaleString("es-MX", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      {!n.read && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={markAllRead}
              >
                <Check className="w-3 h-3 mr-1.5" />
                Marcar todas como leídas
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}