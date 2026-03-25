#!/usr/bin/env bash
set -e

# ============================
# Configuración básica
# ============================
APP_USER="tezcapanel"
APP_DIR="/opt/tezcapanel"
REPO_URL="https://github.com/Xolotl-Company/tezcapanel.git"
BRANCH="main"

GREEN="\e[32m"
YELLOW="\e[33m"
RED="\e[31m"
RESET="\e[0m"

echo -e "${GREEN}=== Instalación de Tezcapanel ===${RESET}"

# ============================
# 1. Crear usuario de sistema
# ============================
if ! id "$APP_USER" &>/dev/null; then
  echo -e "${YELLOW}Creando usuario de sistema ${APP_USER}...${RESET}"
  useradd --system --create-home --shell /bin/bash "$APP_USER"
else
  echo -e "${YELLOW}Usuario ${APP_USER} ya existe, continuando...${RESET}"
fi

# ============================
# 2. Instalar dependencias
# ============================
echo -e "${YELLOW}Instalando dependencias del sistema...${RESET}"
if command -v dnf &>/dev/null; then
  dnf install -y git curl nodejs npm
elif command -v apt-get &>/dev/null; then
  apt-get update
  apt-get install -y git curl nodejs npm
else
  echo -e "${RED}No se detectó dnf ni apt-get. Instala git, curl, nodejs y npm manualmente.${RESET}"
  exit 1
fi

# ============================
# 3. Clonar / actualizar repo
# ============================
if [ -d "$APP_DIR/.git" ]; then
  echo -e "${YELLOW}Repositorio ya existe en ${APP_DIR}, actualizando...${RESET}"
  git -C "$APP_DIR" fetch --all
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only
else
  echo -e "${YELLOW}Clonando repositorio en ${APP_DIR}...${RESET}"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

# ============================
# 4. Crear .env de producción
# ============================
ENV_FILE="$APP_DIR/.env"

echo -e "${YELLOW}Configurando entorno (.env)...${RESET}"
if [ -f "$ENV_FILE" ]; then
  echo -e "${YELLOW}⚠ .env ya existe — no se sobreescribe${RESET}"
else
  echo -e "${YELLOW}Creando nuevo .env en ${ENV_FILE}...${RESET}"
  cat > "$ENV_FILE" <<EOF
# Base de datos SQLite de producción
DATABASE_URL="file:$APP_DIR/prisma/prod.db"

# Secretos y configuración
AUTH_SECRET="$(openssl rand -hex 32 || echo 'changeme')"
AGENT_URL="http://127.0.0.1:7070"
AGENT_TOKEN="changeme-token"
ANTHROPIC_API_KEY=""
NODE_ENV="production"
EOF
fi

chown "$APP_USER":"$APP_USER" "$ENV_FILE"

# ============================
# 5. Instalar dependencias Node
# ============================
echo -e "${YELLOW}Instalando dependencias de Node...${RESET}"
cd "$APP_DIR"
sudo -u "$APP_USER" npm install --omit=dev

# ============================
# 6. Prisma: migraciones + generate
# ============================
echo -e "${YELLOW}Inicializando base de datos...${RESET}"
cd "$APP_DIR"

# Cargar variables del .env para este proceso (por si acaso)
export $(grep -v '^#' .env | xargs)

# Si ya existe prod.db y hay conflicto, la borramos SOLO en instalación inicial
if [ -f "prisma/prod.db" ]; then
  echo -e "${YELLOW}⚠ prisma/prod.db ya existe, se mantendrá. Si ves errores P3005, bórrala manualmente.${RESET}"
fi

sudo -u "$APP_USER" npx prisma migrate deploy --schema=./prisma/schema.prisma
sudo -u "$APP_USER" npx prisma generate --schema=./prisma/schema.prisma

# ============================
# 7. Build de la app (si existe script)
# ============================
if [ -f "package.json" ] && grep -q '"build"' package.json; then
  echo -e "${YELLOW}Construyendo la aplicación...${RESET}"
  sudo -u "$APP_USER" npm run build
fi

# ============================
# 8. Servicio systemd
# ============================
SERVICE_FILE="/etc/systemd/system/tezcapanel.service"

echo -e "${YELLOW}Creando servicio systemd en ${SERVICE_FILE}...${RESET}"
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Tezcapanel - Panel de administración
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
KillSignal=SIGINT

[Install]
WantedBy=multi-user.target
EOF

# ============================
# 9. Habilitar servicio
# ============================
echo -e "${YELLOW}Habilitando y arrancando servicio tezcapanel...${RESET}"
systemctl daemon-reload
systemctl enable tezcapanel
systemctl restart tezcapanel

echo -e "${GREEN}=== Instalación completada. ===${RESET}"
echo -e "${GREEN}Revisa el estado con: systemctl status tezcapanel${RESET}"

