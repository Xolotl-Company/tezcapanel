import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

const AGENT_URL = process.env.AGENT_URL ?? "http://127.0.0.1:7070"
const AGENT_TOKEN = process.env.AGENT_TOKEN ?? ""

type Props = {
  params: Promise<{ route: string[] }>
}

export async function GET(req: NextRequest, props: Props) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const path = "/" + params.route.join("/")

  try {
    const res = await fetch(`${AGENT_URL}${path}`, {
      headers: { Authorization: `Bearer ${AGENT_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Agent unavailable" }, { status: 503 })
  }
}

export async function POST(req: NextRequest, props: Props) {
  const params = await props.params
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const path = "/" + params.route.join("/")
  const body = await req.json().catch(() => ({}))

  try {
    const res = await fetch(`${AGENT_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AGENT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Agent unavailable" }, { status: 503 })
  }
}
