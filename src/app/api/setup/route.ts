import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  // Verificar que no haya usuarios — solo se puede usar una vez
  const count = await prisma.user.count()
  if (count > 0) {
    return NextResponse.json(
      { error: "El panel ya está configurado" },
      { status: 403 }
    )
  }

  const { name, email, password } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Todos los campos son requeridos" },
      { status: 400 }
    )
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres" },
      { status: 400 }
    )
  }

  const hashed = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: { name, email, password: hashed, role: "ADMIN" },
  })

  return NextResponse.json({ ok: true, userId: user.id })
}