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
