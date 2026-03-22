export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  actions?: ProposedAction[]
  actionsExecuted?: boolean
}

export interface ProposedAction {
  id: string
  label: string
  description: string
  command: string
  risk: "low" | "medium" | "high"
  confirmed?: boolean
}

export interface ServerContext {
  hostname: string
  os: string
  cpu: { usage: number; cores: number; model: string }
  memory: { total: number; used: number; free: number }
  disk: { total: number; used: number; free: number }
  uptime: number
  services: { name: string; status: string }[]
}
