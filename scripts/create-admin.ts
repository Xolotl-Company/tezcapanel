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
