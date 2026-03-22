"use client"

import { useState, useEffect, useCallback } from "react"
import { CreateDatabaseDialog } from "@/components/databases/create-database-dialog"
import { ChangePasswordDialog } from "@/components/databases/change-password-dialog"
import { Button } from "@/components/ui/button"
import { Database, Plus, RefreshCw, Trash2, KeyRound, ExternalLink, Archive } from "lucide-react"
import { formatBytes } from "@/lib/utils"

interface DB {
  id: string
  name: string
  user: string
  host: string
  size?: number | null
  createdAt: string
}

export default function DatabasesPage() {
  const [databases, setDatabases] = useState<DB[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedDb, setSelectedDb] = useState<DB | null>(null)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [error, setError] = useState("")

  const fetchDatabases = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/databases")
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setDatabases(data.databases ?? [])
    } catch {
      setError("Error al cargar las bases de datos")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDatabases() }, [fetchDatabases])

  async function handleCreate(formData: { name: string; user: string; password: string }) {
    const res = await fetch("/api/databases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Error al crear")
    await fetchDatabases()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar la base de datos ${name}?`)) return
    await fetch(`/api/databases/${id}`, { method: "DELETE" })
    await fetchDatabases()
  }

  async function handleChangePassword(id: string, password: string) {
    const res = await fetch(`/api/databases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Error al cambiar contraseña")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Bases de datos</h1>
          <p className="text-sm text-muted-foreground mt-1">MySQL / MariaDB</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost" size="icon"
            className="w-8 h-8 text-muted-foreground"
            onClick={fetchDatabases}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 h-8"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nueva DB
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg px-4 py-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-semibold mt-1">{databases.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg px-4 py-3">
          <p className="text-xs text-muted-foreground">Motor</p>
          <p className="text-sm font-semibold mt-1 text-primary">MySQL / MariaDB</p>
        </div>
        <div className="bg-card border border-border rounded-lg px-4 py-3">
          <p className="text-xs text-muted-foreground">Tamaño total</p>
          <p className="text-sm font-semibold mt-1">
            {databases.reduce((acc, db) => acc + (db.size ?? 0), 0) > 0
              ? formatBytes(databases.reduce((acc, db) => acc + (db.size ?? 0), 0))
              : "–"
            }
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4 h-12 animate-pulse" />
          ))}
        </div>
      ) : databases.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-muted border border-border flex items-center justify-center">
            <Database className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">No hay bases de datos</p>
            <p className="text-xs text-muted-foreground mt-1">
              Crea tu primera base de datos con el botón &quot;Nueva DB&quot;
            </p>
          </div>
          <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Crear primera DB
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Cabecera */}
          <div className="grid grid-cols-[2fr_1.5fr_1fr_100px_100px_90px_auto] gap-4 px-5 py-3 border-b border-border bg-secondary/30">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Base de datos</span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider text-center">Usuario</span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider text-center">Host</span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider text-center">Quota</span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider text-center">Backup</span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider text-center">Location</span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider text-right">Acciones</span>
          </div>

          {/* Filas */}
          <div className="divide-y divide-border">
            {databases.map((db) => (
              <div
  key={db.id}
  className="grid grid-cols-[2fr_1.5fr_1fr_100px_100px_90px_auto] gap-4 px-5 py-3.5 items-center hover:bg-secondary/20 transition-colors"
>
                {/* DB name */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Database className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-sm font-mono font-medium truncate">{db.name}</span>
                </div>

                {/* Usuario */}
                <span className="text-sm font-mono text-muted-foreground truncate text-center">{db.user}</span>

                {/* Host */}
                <span className="text-sm text-muted-foreground text-center">{db.host}</span>

                {/* Quota */}
                <span className="text-xs text-muted-foreground text-center">
                  {db.size ? formatBytes(db.size) : "–"}
                </span>

                {/* Backup */}
                <span className="text-xs text-muted-foreground text-center">–</span>

                {/* Location */}
                <span className="text-xs text-muted-foreground text-center">Localhost</span>

                {/* Acciones */}
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => window.open(`http://localhost/phpmyadmin`, "_blank")}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    phpMyAdmin
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 text-muted-foreground hover:text-accent"
                    title="Cambiar contraseña"
                    onClick={() => {
                      setSelectedDb(db)
                      setShowChangePassword(true)
                    }}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 text-muted-foreground hover:text-primary"
                    title="Backup"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 text-muted-foreground hover:text-destructive"
                    title="Eliminar"
                    onClick={() => handleDelete(db.id, db.name)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreate && (
        <CreateDatabaseDialog
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}

      {showChangePassword && selectedDb && (
        <ChangePasswordDialog
          db={selectedDb}
          onClose={() => {
            setShowChangePassword(false)
            setSelectedDb(null)
          }}
          onSave={handleChangePassword}
        />
      )}
    </div>
  )
}