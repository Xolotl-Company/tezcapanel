"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

interface TerminalEmulatorProps {
  token: string
}

export function TerminalEmulator({ token }: TerminalEmulatorProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting")
  const [errorMsg, setErrorMsg] = useState("")
  const wsRef = useRef<WebSocket | null>(null)
  const xtermRef = useRef<import("@xterm/xterm").Terminal | null>(null)
  const fitRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null)

  useEffect(() => {
    if (!terminalRef.current || !token) return

    let disposed = false

    async function init() {
      const { Terminal } = await import("@xterm/xterm")
      const { FitAddon } = await import("@xterm/addon-fit")

      if (disposed) return

      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "JetBrains Mono, Fira Code, Cascadia Code, monospace",
        theme: {
          background: "#0d0d0d",
          foreground: "#e5e5e5",
          cursor: "#10B981",
          cursorAccent: "#0d0d0d",
          selectionBackground: "#10B98133",
          black: "#1a1a1a",
          red: "#ef4444",
          green: "#10B981",
          yellow: "#f59e0b",
          blue: "#3b82f6",
          magenta: "#8b5cf6",
          cyan: "#06b6d4",
          white: "#e5e5e5",
          brightBlack: "#404040",
          brightRed: "#f87171",
          brightGreen: "#34d399",
          brightYellow: "#fbbf24",
          brightBlue: "#60a5fa",
          brightMagenta: "#a78bfa",
          brightCyan: "#22d3ee",
          brightWhite: "#ffffff",
        },
      })

      const fitAddon = new FitAddon()
      terminal.loadAddon(fitAddon)
      terminal.open(terminalRef.current!)
      fitAddon.fit()

      xtermRef.current = terminal
      fitRef.current = fitAddon

      // Conectar directo al agente WebSocket
      const ws = new WebSocket(`ws://127.0.0.1:7071?token=${encodeURIComponent(token)}`)
      wsRef.current = ws

      ws.onopen = () => {
        if (disposed) { ws.close(); return }
        setStatus("connected")
        ws.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }))
      }

      ws.onmessage = (e) => terminal.write(e.data)

      ws.onerror = () => {
        setStatus("error")
        setErrorMsg("No se pudo conectar al agente. Verifica que tezcaagent esté corriendo.")
      }

      ws.onclose = () => {
        if (!disposed) terminal.write("\r\n\x1b[31mConexión cerrada\x1b[0m\r\n")
      }

      terminal.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "input", data }))
        }
      })

      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit()
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols: terminal.cols, rows: terminal.rows }))
        }
      })

      if (terminalRef.current) resizeObserver.observe(terminalRef.current)

      return () => {
        resizeObserver.disconnect()
        ws.close()
        terminal.dispose()
      }
    }

    let cleanupFn: (() => void) | undefined
    init().then((fn) => { cleanupFn = fn })

    return () => {
      disposed = true
      cleanupFn?.()
      wsRef.current?.close()
      xtermRef.current?.dispose()
    }
  }, [token])

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden bg-[#0d0d0d] border border-border">
      {status === "connecting" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d0d] z-10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Conectando con el servidor...
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d0d] z-10">
          <div className="text-center space-y-2">
            <p className="text-sm text-destructive">{errorMsg}</p>
            <p className="text-xs text-muted-foreground">
              Corre: <code className="bg-muted px-1 rounded">AGENT_TOKEN=tu_token node agent/server.js</code>
            </p>
          </div>
        </div>
      )}

      <div ref={terminalRef} className="w-full h-full p-2" />
    </div>
  )
}