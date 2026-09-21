#!/usr/bin/env bash
# Script de instalacion para Farmatodo CLI
# "farmatodo pero para la gente q le gusta full usar la compu"

set -e

RESET="\033[0m"
BOLD="\033[1m"
GREEN="\033[32m"
BLUE="\033[34m"
YELLOW="\033[33m"
CYAN="\033[36m"
RED="\033[31m"

INSTALL_DIR="${HOME}/.local/bin"
BINARY_NAME="farmatodo"
REPO_URL="https://github.com/italovisconti/farmatodo-cli.git"
CLONE_DIR="${HOME}/.cache/farmatodo-cli-build"

print_step() {
  echo -e "${BLUE}==>${RESET} ${BOLD}$1${RESET}"
}

print_success() {
  echo -e "${GREEN}==>${RESET} ${BOLD}$1${RESET}"
}

print_warning() {
  echo -e "${YELLOW}warning:${RESET} $1"
}

print_error() {
  echo -e "${RED}error:${RESET} $1" >&2
}

echo -e "${BOLD}${BLUE}"
cat << 'EOF'
  ______                               _               _       
 |  ____|                             | |             | |      
 | |__ __ _ _ __ _ __ ___   __ _ _   _| |_ ___   __ _ | |      
 |  __/ _` | '__| '_ ` _ \ / _` | | | | __/ _ \ / _` || |      
 | | | (_| | |  | | | | | | (_| | |_| | || (_) | (_| ||_|____  
 |_|  \__,_|_|  |_| |_| |_|\__,_|\__,_|\__\___/ \__,_(_)_____| 
EOF
echo -e "${RESET}"
echo -e "${CYAN}farmatodo pero para la gente q le gusta full usar la compu${RESET}\n"

# 1. Verificar sistema operativo y arquitectura
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux*)  ;;
  Darwin*) ;;
  *)
    print_error "Sistema operativo no soportado: $OS"
    exit 1
    ;;
esac

# 2. Verificar dependencias basicas (git, curl)
command -v git >/dev/null 2>&1 || { print_error "Se requiere 'git' para continuar."; exit 1; }
command -v curl >/dev/null 2>&1 || { print_error "Se requiere 'curl' para continuar."; exit 1; }

# 3. Verificar o instalar Bun
if ! command -v bun >/dev/null 2>&1; then
  print_step "Bun no detectado. Instalando Bun (runtime ultra rapido)..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="${HOME}/.bun"
  export PATH="${BUN_INSTALL}/bin:${PATH}"
fi

if ! command -v bun >/dev/null 2>&1; then
  print_error "No se pudo encontrar 'bun' en el PATH. Por favor instala bun manualmente: https://bun.sh"
  exit 1
fi

# 4. Obtener codigo fuente y compilar
SCRIPT_DIR=""
if [ -f "package.json" ] && grep -q '"name": "farmatodo-cli"' package.json 2>/dev/null; then
  # Se esta ejecutando dentro del repositorio clonado
  SCRIPT_DIR="$(pwd)"
  print_step "Construyendo binario desde el repositorio local..."
  cd "$SCRIPT_DIR"
else
  # Se esta ejecutando via curl | bash
  print_step "Descargando codigo fuente de Farmatodo CLI..."
  rm -rf "$CLONE_DIR"
  git clone --depth 1 "$REPO_URL" "$CLONE_DIR"
  cd "$CLONE_DIR"
fi

print_step "Instalando dependencias con bun..."
bun install --frozen-lockfile >/dev/null 2>&1 || bun install

print_step "Compilando binario nativo independiente..."
bun run build

# 5. Instalar binario en ~/.local/bin
mkdir -p "$INSTALL_DIR"
cp dist/farmatodo "${INSTALL_DIR}/${BINARY_NAME}"
chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

# 6. Limpieza si se descargo en cache
if [ -d "$CLONE_DIR" ]; then
  rm -rf "$CLONE_DIR"
fi

# 7. Verificar PATH
PATH_INCLUDED=false
case ":$PATH:" in
  *":$INSTALL_DIR:"*) PATH_INCLUDED=true ;;
esac

echo ""
print_success "Instalacion completada exitosamente en ${INSTALL_DIR}/${BINARY_NAME}"

if [ "$PATH_INCLUDED" = false ]; then
  echo ""
  print_warning "${INSTALL_DIR} no esta actualmente en tu PATH."
  echo -e "Agrega la siguiente linea a tu archivo de configuracion (${BOLD}~/.bashrc${RESET} o ${BOLD}~/.zshrc${RESET}):"
  echo -e "\n    ${CYAN}export PATH=\"\$HOME/.local/bin:\$PATH\"${RESET}\n"
  echo -e "Luego recarga tu terminal con: ${BOLD}source ~/.bashrc${RESET} (o reabre tu consola)."
fi

echo -e "\n${BOLD}Para iniciar la interfaz interactiva:${RESET}"
echo -e "    ${GREEN}${BINARY_NAME}${RESET}\n"
echo -e "${BOLD}Para ver los comandos directos:${RESET}"
echo -e "    ${GREEN}${BINARY_NAME} --help${RESET}"
echo -e "    ${GREEN}${BINARY_NAME} ofertas${RESET}"
echo -e "    ${GREEN}${BINARY_NAME} buscar \"ibuprofeno\"${RESET}\n"
