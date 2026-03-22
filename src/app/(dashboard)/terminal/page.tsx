"use client"

import { useEffect, useState } from "react"
import { TerminalEmulator } from "@/components/terminal/terminal-emulator"
import { Badge } from "@/components/ui/badge"
import { Terminal, Wifi, WifiOff } from "lucide-react"

export default function TerminalPage() {
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/terminal/token")
      .then((r) => r.json())
      .then((data) => {
        setToken(data.token)
        setLoading(false)
      })
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center">
            <Terminal className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Terminal</h1>
            <p className="text-xs text-muted-foreground">Acceso directo al servidor</p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={token
            ? "border-primary/50 text-primary text-[10px]"
            : "border-border text-muted-foreground text-[10px]"
          }
        >
          {token
            ? <><Wifi className="w-3 h-3 mr-1" />Conectado</>
            : <><WifiOff className="w-3 h-3 mr-1" />Desconectado</>
          }
        </Badge>
      </div>

      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="w-full h-full rounded-lg bg-[#0d0d0d] border border-border flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Iniciando terminal...</p>
          </div>
        ) : (
          <TerminalEmulator token={token} />
        )}
      </div>
    </div>
  )
}