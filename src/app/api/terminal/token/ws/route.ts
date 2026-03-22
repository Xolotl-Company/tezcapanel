import { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  const agentToken = process.env.AGENT_TOKEN ?? ""

  if (token !== agentToken) {
    return new Response("Unauthorized", { status: 401 })
  }

  // Redirigir al WebSocket del agente
  return new Response(null, {
    status: 101,
    headers: {
      "X-Accel-Redirect": `ws://127.0.0.1:7071?token=${token}`,
    },
  })
}