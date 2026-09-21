# Script de instalacion para Farmatodo CLI en Windows (PowerShell)
# "farmatodo pero para la gente q le gusta full usar la compu"

$ErrorActionPreference = 'Stop'

Write-Host "  ______                               _               _       " -ForegroundColor Blue
Write-Host " |  ____|                             | |             | |      " -ForegroundColor Blue
Write-Host " | |__ __ _ _ __ _ __ ___   __ _ _   _| |_ ___   __ _ | |      " -ForegroundColor Blue
Write-Host " |  __/ _`` | '__| '_ `` _ \ / _`` | | | | __/ _ \ / _`` || |      " -ForegroundColor Blue
Write-Host " | | | (_| | |  | | | | | | (_| | |_| | || (_) | (_| ||_|____  " -ForegroundColor Blue
Write-Host " |_|  \__,_|_|  |_| |_| |_|\__,_|\__,_|\__\___/ \__,_(_)_____| " -ForegroundColor Blue
Write-Host ""
Write-Host "farmatodo pero para la gente q le gusta full usar la compu`n" -ForegroundColor Cyan

# 1. Comprobar o instalar Bun
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "==> Bun no detectado. Instalando Bun runtime..." -ForegroundColor Yellow
    irm bun.sh/install.ps1 | iex
    $env:BUN_INSTALL = "$env:USERPROFILE\.bun"
    $env:PATH = "$env:BUN_INSTALL\bin;$env:PATH"
}

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Error "No se pudo detectar 'bun' en el PATH. Por favor instala bun desde https://bun.sh y vuelve a ejecutar."
    exit 1
}

# 2. Preparar directorio de instalacion (~/.local/bin)
$InstallDir = "$env:USERPROFILE\.local\bin"
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# 3. Descargar codigo o usar repositorio local
$TempDir = "$env:TEMP\farmatodo-cli-build"
$CurrentDir = Get-Location

if ((Test-Path "package.json") -and (Select-String -Path "package.json" -Pattern '"name": "farmatodo-cli"' -Quiet)) {
    Write-Host "==> Construyendo binario desde el repositorio local..." -ForegroundColor Cyan
    $BuildDir = $CurrentDir
} else {
    Write-Host "==> Descargando codigo fuente de Farmatodo CLI..." -ForegroundColor Cyan
    if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }
    git clone --depth 1 "https://github.com/italovisconti/farmatodo-cli.git" $TempDir
    $BuildDir = $TempDir
}

Push-Location $BuildDir
try {
    Write-Host "==> Instalando dependencias con bun..." -ForegroundColor Cyan
    bun install

    Write-Host "==> Compilando binario nativo independiente..." -ForegroundColor Cyan
    bun build --compile --minify src/index.ts --outfile dist/farmatodo.exe

    Copy-Item "dist/farmatodo.exe" -Destination "$InstallDir\farmatodo.exe" -Force
} finally {
    Pop-Location
    if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }
}

# 4. Asegurar PATH del usuario
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$InstallDir;$UserPath", "User")
    $env:PATH = "$InstallDir;$env:PATH"
    Write-Host "==> Agregado $InstallDir al PATH del usuario." -ForegroundColor Green
}

Write-Host ""
Write-Host "==> Instalacion completada exitosamente en $InstallDir\farmatodo.exe" -ForegroundColor Green
Write-Host ""
Write-Host "Para iniciar la interfaz interactiva:" -ForegroundColor White
Write-Host "    farmatodo" -ForegroundColor Green
Write-Host ""
Write-Host "Para ver los comandos directos:" -ForegroundColor White
Write-Host "    farmatodo --help" -ForegroundColor Green
Write-Host "    farmatodo ofertas" -ForegroundColor Green
Write-Host "    farmatodo buscar `"ibuprofeno`"" -ForegroundColor Green
Write-Host ""
