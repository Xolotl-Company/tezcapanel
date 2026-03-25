#!/bin/bash

set -e

# =============================================================================
# Tezcapanel — Script de instalación
# Soporta: Ubuntu 20.04+, Debian 11+, Rocky Linux 8+, AlmaLinux 8+, RHEL 8+
# Uso: curl -fsSL https://raw.githubusercontent.com/Xolotl-Company/tezcapanel/main/install.sh | bash
# =============================================================================

APP_DIR="/opt/tezcapanel"
REPO="https://github.com/Xolotl-Company/tezcapanel.git"
NODE_VERSION="20"
PANEL_PORT="8080"
AGENT_PORT="7070"
AGENT_WS_PORT="7071"

# --- Colores ---
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()    { echo -e "${GREEN}✔${NC} $1"; }
info()   { echo -e "${BLUE}→${NC} $1"; }
warn()   { echo -e "${YELLOW}⚠${NC} $1"; }
error()  { echo -e "${RED}✖ Error:${NC} $1"; exit 1; }
header() { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# =============================================================================
# 1. Verificar root
# =============================================================================
header "Verificando requisitos"

[ "$EUID" -ne 0 ] && error "Ejecuta como root: sudo bash install.sh"
log "Corriendo como root"

# =============================================================================
# 2. Detectar distro
# =============================================================================
if [ -f /etc/os-release ]; then
  . /etc/os-release
  DISTRO=$ID
  DISTRO_VERSION=$VERSION_ID
  DISTRO_MAJOR=$(echo $VERSION_ID | cut -d. -f1)
else
  error "No se puede detectar el sistema operativo"
fi

log "Sistema detectado: $PRETTY_NAME"

case $DISTRO in
  ubuntu|debian)
    PKG_MANAGER="apt-get"
    PKG_UPDATE="apt-get update -y"
    PKG_INSTALL="apt-get install -y"
    ;;
  rhel|centos|rocky|almalinux|fedora)
    PKG_MANAGER="dnf"
    PKG_UPDATE="dnf update -y"
    PKG_INSTALL="dnf install -y"
    # En CentOS 7 usar yum
    if ! command -v dnf &>/dev/null; then
      PKG_MANAGER="yum"
      PKG_UPDATE="yum update -y"
      PKG_INSTALL="yum install -y"
    fi
    ;;
  *)
    error "Distro no soportada: $DISTRO. Soportadas: Ubuntu, Debian, Rocky Linux, AlmaLinux, RHEL"
    ;;
esac

# =============================================================================
# 3. Instalar dependencias del sistema
# =============================================================================
header "Instalando dependencias del sistema"

$PKG_UPDATE

case $DISTRO in
  ubuntu|debian)
    $PKG_INSTALL curl wget git build-essential
    ;;
  rhel|centos|rocky|almalinux|fedora)
    $PKG_INSTALL curl wget git gcc-c++ make
    # EPEL para Rocky/AlmaLinux
    if [[ "$DISTRO" == "rocky" || "$DISTRO" == "almalinux" ]]; then
      $PKG_INSTALL epel-release || true
    fi
    ;;
esac

log "Dependencias instaladas"

# =============================================================================
# 4. Instalar Node.js 20 LTS
# =============================================================================
header "Instalando Node.js $NODE_VERSION LTS"

if command -v node &>/dev/null; then
  CURRENT_NODE=$(node -v | cut -d. -f1 | tr -d 'v')
  if [ "$CURRENT_NODE" -ge "$NODE_VERSION" ]; then
    log "Node.js $(node -v) ya está instalado"
  else
    warn "Node.js $(node -v) instalado pero se requiere v$NODE_VERSION+"
    INSTALL_NODE=true
  fi
else
  INSTALL_NODE=true
fi

if [ "$INSTALL_NODE" = true ]; then
  info "Instalando Node.js $NODE_VERSION via NodeSource..."
  case $DISTRO in
    ubuntu|debian)
      curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
      $PKG_INSTALL nodejs
      ;;
    rhel|centos|rocky|almalinux|fedora)
      curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
      $PKG_INSTALL nodejs
      # node-pty requiere python3 y make
      $PKG_INSTALL python3 make gcc-c++
      ;;
  esac
fi

log "Node.js $(node -v) listo"
log "npm $(npm -v) listo"

# =============================================================================
# 5. Clonar / actualizar repositorio
# =============================================================================
header "Descargando Tezcapanel"

if [ -d "$APP_DIR/.git" ]; then
  info "Actualizando instalación existente..."
  cd $APP_DIR
  git pull origin main
  log "Repositorio actualizado"
else
  info "Clonando repositorio..."
  mkdir -p $APP_DIR
  git clone $REPO $APP_DIR
  cd $APP_DIR
  log "Repositorio clonado"
fi

cd $APP_DIR

# =============================================================================
# 6. Instalar dependencias npm
# =============================================================================
header "Instalando dependencias npm"

npm install --production=false
log "Dependencias instaladas"

# Recompilar node-pty para la versión de Node instalada
info "Compilando módulos nativos..."
npm rebuild node-pty
log "Módulos nativos compilados"

# =============================================================================
# 7. Configurar variables de entorno
# =============================================================================
header "Configurando entorno"

if [ ! -f "$APP_DIR/.env" ]; then
  info "Generando tokens de seguridad..."

  AUTH_SECRET=$(openssl rand -base64 32)
  AGENT_TOKEN=$(openssl rand -hex 32)

  cat > $APP_DIR/.env << EOF
# Base de datos
DATABASE_URL="file:$APP_DIR/prisma/prod.db"

# Auth
AUTH_SECRET="$AUTH_SECRET"

# Agente
AGENT_URL="http://127.0.0.1:$AGENT_PORT"
AGENT_TOKEN="$AGENT_TOKEN"

# Entorno
NODE_ENV="production"
PORT=$PANEL_PORT
EOF

  log "Archivo .env generado"
  log "AUTH_SECRET generado automáticamente"
  log "AGENT_TOKEN generado automáticamente"
else
  warn ".env ya existe — no se sobreescribió"
  # Leer token existente
  AGENT_TOKEN=$(grep AGENT_TOKEN $APP_DIR/.env | cut -d'"' -f2)
fi

# =============================================================================
# 8. Base de datos
# =============================================================================
header "Inicializando base de datos"

cd $APP_DIR
npx prisma migrate deploy
npx prisma generate
log "Base de datos inicializada"

# =============================================================================
# 9. Build de producción
# =============================================================================
header "Compilando Tezcapanel"

cd $APP_DIR
npm run build
log "Build completado"

# =============================================================================
# 10. Crear servicios systemd
# =============================================================================
header "Configurando servicios del sistema"

# Servicio del panel (Next.js)
cat > /etc/systemd/system/tezcapanel.service << EOF
[Unit]
Description=Tezcapanel Panel
After=network.target tezcaagent.service

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
ExecStart=$(which node) node_modules/.bin/next start -p $PANEL_PORT
Restart=always
RestartSec=5
EnvironmentFile=$APP_DIR/.env

[Install]
WantedBy=multi-user.target
EOF

# Servicio del agente
cat > /etc/systemd/system/tezcaagent.service << EOF
[Unit]
Description=Tezcapanel Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
ExecStart=$(which node) agent/server.js
Restart=always
RestartSec=5
EnvironmentFile=$APP_DIR/.env

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable tezcapanel tezcaagent
log "Servicios systemd creados"

# =============================================================================
# 11. Configurar firewall
# =============================================================================
header "Configurando firewall"

if command -v ufw &>/dev/null; then
  ufw allow $PANEL_PORT/tcp
  ufw allow 22/tcp
  ufw --force enable
  log "UFW configurado (puerto $PANEL_PORT abierto)"
elif command -v firewall-cmd &>/dev/null; then
  firewall-cmd --permanent --add-port=$PANEL_PORT/tcp
  firewall-cmd --reload
  log "firewalld configurado (puerto $PANEL_PORT abierto)"
else
  warn "No se detectó firewall — abre el puerto $PANEL_PORT manualmente"
fi

# =============================================================================
# 12. CLI de administración
# =============================================================================
header "Instalando CLI"

cat > /usr/local/bin/tezcapanel << 'CLIEOF'
#!/bin/bash
case "$1" in
  start)    systemctl start tezcapanel tezcaagent ;;
  stop)     systemctl stop tezcapanel tezcaagent ;;
  restart)  systemctl restart tezcapanel tezcaagent ;;
  status)   systemctl status tezcapanel tezcaagent ;;
  logs)     journalctl -u tezcapanel -f ;;
  agent)    journalctl -u tezcaagent -f ;;
  update)
    cd /opt/tezcapanel
    git pull origin main
    npm install
    npm rebuild node-pty
    npm run build
    npx prisma migrate deploy
    systemctl restart tezcapanel tezcaagent
    echo "✔ Tezcapanel actualizado"
    ;;
  *)
    echo "Uso: tezcapanel {start|stop|restart|status|logs|agent|update}"
    ;;
esac
CLIEOF

chmod +x /usr/local/bin/tezcapanel
log "CLI instalado — comando: tezcapanel"

# =============================================================================
# 13. Iniciar servicios
# =============================================================================
header "Iniciando Tezcapanel"

systemctl restart tezcaagent
sleep 2
systemctl restart tezcapanel
sleep 3

# Verificar que están corriendo
if systemctl is-active --quiet tezcapanel; then
  log "Panel iniciado correctamente"
else
  warn "El panel no inició — revisa: journalctl -u tezcapanel"
fi

if systemctl is-active --quiet tezcaagent; then
  log "Agente iniciado correctamente"
else
  warn "El agente no inició — revisa: journalctl -u tezcaagent"
fi

# =============================================================================
# 14. Resumen final
# =============================================================================
IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ Tezcapanel instalado exitosamente${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Panel:    ${BLUE}http://$IP:$PANEL_PORT${NC}"
echo ""
echo -e "  Comandos útiles:"
echo -e "  ${YELLOW}tezcapanel status${NC}   — ver estado"
echo -e "  ${YELLOW}tezcapanel logs${NC}     — ver logs del panel"
echo -e "  ${YELLOW}tezcapanel agent${NC}    — ver logs del agente"
echo -e "  ${YELLOW}tezcapanel update${NC}   — actualizar a la última versión"
echo ""
echo -e "  Al abrir el panel por primera vez se te pedirá"
echo -e "  crear tu cuenta de administrador."
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"