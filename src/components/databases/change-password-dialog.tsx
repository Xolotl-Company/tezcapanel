"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, KeyRound, X } from "lucide-react"

interface ChangePasswordDialogProps {
  db: { id: string; name: string; user: string }
  onClose: () => void
  onSave: (id: string, password: string) => Promise<void>
}

export function ChangePasswordDialog({ db, onClose, onSave }: ChangePasswordDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")

  async function handleSubmit() {
    setError("")
    if (!password || password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres")
      return
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden")
      return
    }

    setLoading(true)
    try {
      await onSave(db.id, password)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cambiar contraseña")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Cambiar contraseña</h2>
          </div>
          <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-secondary/50 border border-border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">
              DB: <span className="font-mono text-foreground">{db.name}</span>
              {" · "}
              Usuario: <span className="font-mono text-foreground">{db.user}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Nueva contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-input border-border text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar contraseña</Label>
            <Input
              id="confirm"
              type="password"
              placeholder="Repite la contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="bg-input border-border text-sm"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="bg-secondary/50 border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              El cambio se aplicará en MySQL via el agente del servidor.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Guardando...</>
              : <><KeyRound className="w-3.5 h-3.5 mr-1.5" />Cambiar</>
            }
          </Button>
        </div>
      </div>
    </div>
  )
}