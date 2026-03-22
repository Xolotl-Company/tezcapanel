const http = require("http")
const { exec } = require("child_process")
const { WebSocketServer } = require("ws")
const pty = require("node-pty")
const os = require("os")
const si = require("systeminformation")

const PORT = 7070
const HOST = "127.0.0.1"
const TOKEN = process.env.AGENT_TOKEN

if (!TOKEN) {
  console.error("❌ AGENT_TOKEN no definido — exporta la variable de entorno")
  process.exit(1)
}

// --- Lista blanca de comandos permitidos ---
const ALLOWED_COMMANDS = [
  /^apt(-get)? (install|remove|update|upgrade) -y [\w\s\-\.]+$/,
  /^apt(-get)? install -y [\w\s\-\.]+$/,
  /^yum (install|remove|update) -y [\w\s\-\.]+$/,
  /^dnf (install|remove|update) -y [\w\s\-\.]+$/,
  /^systemctl (start|stop|restart|reload|enable|disable|status) [\w\-\.]+$/,
  /^nginx -t$/,
  /^nginx -s reload$/,
  /^mysql -e "CREATE DATABASE [\w]+ CHARACTER SET utf8mb4"$/,
  /^mysql -e "CREATE USER '[\w]+'@'localhost' IDENTIFIED BY '[^']+'"$/,
  /^mysql -e "GRANT ALL ON [\w]+\.\* TO '[\w]+'@'localhost'"$/,
  /^mysql -e "FLUSH PRIVILEGES"$/,
  /^mysqldump [\w\s\-\.]+ > [\w\/\-\.]+$/,
  /^certbot --nginx -d [\w\.\-]+ --non-interactive --agree-tos -m [\w@\.\-]+$/,
  /^certbot renew --dry-run$/,
  /^certbot renew$/,
  /^mkdir -p \/etc\/(nginx|apache2|mysql|postfix)\//,
  /^mkdir -p \/var\/www\/[\w\-\.]+$/,
  /^chown -R www-data:www-data \/var\/www\/[\w\-\.]+$/,
  /^chmod -R 755 \/var\/www\/[\w\-\.]+$/,
  /^cat \/var\/log\/(nginx|apache2|mysql|syslog|auth\.log)(\/[\w\-\.]+)?$/,
  /^tail -n \d+ \/var\/log\/(nginx|apache2|mysql|syslog|auth\.log)(\/[\w\-\.]+)?$/,
  /^df -h$/,
  /^free -h$/,
  /^top -bn1$/,
  /^ps aux$/,
  /^netstat -tlnp$/,
  /^ss -tlnp$/,
  /^ufw (enable|disable|status|allow|deny) ?[\w\/]*$/,
  /^wget -O [\w\/\-\.]+ https:\/\/[\w\.\-\/\?=&]+$/,
  /^cat \/etc\/nginx\/sites-available\/[\w\.\-]+$/,
  /^ln -s \/etc\/nginx\/sites-available\/[\w\.\-]+ \/etc\/nginx\/sites-enabled\/[\w\.\-]+$/,
  /^rm \/etc\/nginx\/sites-enabled\/[\w\.\-]+$/,
  /^ls \/etc\/nginx\/sites-(available|enabled)$/,
  /^mkdir -p \/var\/www\/[\w\.\-]+(\/public_html)?$/,
  /^chown -R \$USER:\$USER \/var\/www\/[\w\.\-]+$/,
  /^tee \/etc\/nginx\/sites-available\/[\w\.\-]+$/,
  /^mysqldump [\w\s\-\.]+ > [\w\/\-\.]+$/,
  /^mkdir -p \/var\/backups\/tezcapanel$/,
]

function isCommandAllowed(command) {
  return ALLOWED_COMMANDS.some((pattern) => pattern.test(command.trim()))
}

function executeCommand(command, timeout = 30000) {
  return new Promise((resolve, reject) => {
    if (!isCommandAllowed(command)) {
      reject(new Error(`Comando no permitido: ${command}`))
      return
    }
    exec(command, { timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && error.killed) {
        reject(new Error("Comando excedió el tiempo límite"))
        return
      }
      resolve({
        success: !error,
        stdout: stdout?.trim() ?? "",
        stderr: stderr?.trim() ?? "",
        exitCode: error?.code ?? 0,
      })
    })
  })
}

function isAuthorized(req) {
  const auth = req.headers["authorization"] ?? ""
  return auth === `Bearer ${TOKEN}`
}

function setHeaders(res) {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000")
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type")
}

async function handleMetrics(res) {
  const [cpuData, cpuLoad, mem, disk, osInfo] = await Promise.all([
    si.cpu(),
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.osInfo(),
  ])

  const rootDisk = disk.find((d) => d.mount === "/") ?? disk[0] ?? {}

  const metrics = {
    cpu: {
      usage: parseFloat((cpuLoad.currentLoad ?? 0).toFixed(1)),
      cores: cpuData.cores ?? 1,
      model: `${cpuData.manufacturer} ${cpuData.brand}`.trim() || "Unknown",
    },
    memory: {
      total: mem.total ?? 0,
      used: mem.used ?? 0,
      free: mem.free ?? 0,
    },
    disk: {
      total: rootDisk.size ?? 0,
      used: rootDisk.used ?? 0,
      free: (rootDisk.size ?? 0) - (rootDisk.used ?? 0),
    },
    uptime: Math.floor(si.time().uptime ?? 0),
    hostname: osInfo.hostname ?? "localhost",
    os: `${osInfo.distro ?? osInfo.platform} ${osInfo.release ?? ""}`.trim(),
  }

  res.end(JSON.stringify(metrics))
}

async function handleServices(res) {
  const processes = await si.processes()
  const running = new Set(processes.list.map((p) => p.name.toLowerCase()))

  const targets = [
    { name: "nginx",   check: "nginx" },
    { name: "mysql",   check: "mysqld" },
    { name: "postfix", check: "postfix" },
    { name: "named",   check: "named" },
  ]

  const services = targets.map(({ name, check }) => ({
    name,
    status: running.has(check) ? "running" : "stopped",
  }))

  res.end(JSON.stringify(services))
}

async function handleExecute(req, res) {
  let body = ""
  req.on("data", (chunk) => { body += chunk })
  req.on("end", async () => {
    try {
      const { commands } = JSON.parse(body)

      if (!Array.isArray(commands) || commands.length === 0) {
        res.writeHead(400)
        res.end(JSON.stringify({ error: "commands array requerido" }))
        return
      }

      if (commands.length > 10) {
        res.writeHead(400)
        res.end(JSON.stringify({ error: "máximo 10 comandos por ejecución" }))
        return
      }

      const results = []

      for (const command of commands) {
        if (typeof command !== "string") {
          results.push({ command, success: false, error: "comando inválido" })
          continue
        }
        try {
          const result = await executeCommand(command)
          results.push({ command, ...result })
          if (!result.success) {
            results.push({
              command: "(detenido)",
              success: false,
              error: "Ejecución detenida por error en comando anterior",
            })
            break
          }
        } catch (err) {
          results.push({ command, success: false, error: err.message, stdout: "", stderr: "" })
          break
        }
      }

      res.end(JSON.stringify({ results }))
    } catch {
      res.writeHead(400)
      res.end(JSON.stringify({ error: "JSON inválido" }))
    }
  })
}

async function handleRestartService(name, res) {
  const allowed = ["nginx", "mysql", "mariadb", "postfix", "named", "apache2"]
  if (!allowed.includes(name)) {
    res.writeHead(400)
    res.end(JSON.stringify({ error: "service not allowed" }))
    return
  }
  try {
    const result = await executeCommand(`systemctl restart ${name}`)
    res.end(JSON.stringify(result))
  } catch (err) {
    res.writeHead(500)
    res.end(JSON.stringify({ error: err.message }))
  }
}

// --- Router HTTP ---
const server = http.createServer(async (req, res) => {
  setHeaders(res)

  if (req.method === "OPTIONS") {
    res.writeHead(204)
    res.end()
    return
  }

  if (!isAuthorized(req)) {
    res.writeHead(401)
    res.end(JSON.stringify({ error: "unauthorized" }))
    return
  }

  const url = req.url ?? "/"
  const method = req.method ?? "GET"

  try {
    if (method === "GET" && url === "/health") {
      res.end(JSON.stringify({ status: "ok", version: "0.3.0" }))
    } else if (method === "GET" && url === "/metrics") {
      await handleMetrics(res)
    } else if (method === "GET" && url === "/services") {
      await handleServices(res)
    } else if (method === "POST" && url === "/execute") {
      await handleExecute(req, res)
    } else if (method === "POST" && url.startsWith("/services/") && url.endsWith("/restart")) {
      const name = url.split("/")[2]
      await handleRestartService(name, res)
    } else {
      res.writeHead(404)
      res.end(JSON.stringify({ error: "not found" }))
    }
  } catch (err) {
    console.error("Agent error:", err)
    res.writeHead(500)
    res.end(JSON.stringify({ error: "internal error" }))
  }
})

server.listen(PORT, HOST, () => {
  console.log(`✔ tezcaagent v0.3.0 escuchando en http://${HOST}:${PORT}`)
})

// --- WebSocket Terminal ---
const wss = new WebSocketServer({ 
  port: 7071, 
  host: "127.0.0.1",
  verifyClient: (info) => {
    const origin = info.origin || info.req.headers.origin
    return !origin || 
           origin === "http://localhost:3000" ||
           origin.startsWith("http://192.168.") ||
           origin.startsWith("http://127.0.0.1")
  }
})

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://localhost")
  const token = url.searchParams.get("token")
  if (token !== TOKEN) {
    ws.close(1008, "Unauthorized")
    return
  }

 const shell = process.env.SHELL || "/bin/zsh"
let ptyProcess
try {
  ptyProcess = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: process.env.HOME || "/tmp",
    env: { ...process.env, TERM: "xterm-256color", LANG: "en_US.UTF-8" },
  })
} catch (err) {
  console.error("PTY error:", err.message)
  ws.send("\r\nError al iniciar terminal: " + err.message + "\r\n")
  ws.close()
  return
}

  ptyProcess.onData((data) => {
    if (ws.readyState === ws.OPEN) ws.send(data)
  })

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString())
      if (msg.type === "input") ptyProcess.write(msg.data)
      if (msg.type === "resize") ptyProcess.resize(msg.cols, msg.rows)
    } catch {
      ptyProcess.write(data.toString())
    }
  })

  ws.on("close", () => ptyProcess.kill())
  ptyProcess.onExit(() => { if (ws.readyState === ws.OPEN) ws.close() })

  console.log("✔ Terminal conectada")
})


console.log(`✔ Terminal WebSocket en ws://127.0.0.1:7071`)