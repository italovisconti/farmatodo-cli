<h1 align="center">farmatodo-cli 💊🇻🇪</h1>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Runtime-Bun-fbf0df?logo=bun&logoColor=black" alt="Bun" />
  <img src="https://img.shields.io/badge/TUI-OpenTUI_React-61DAFB?logo=react&logoColor=black" alt="OpenTUI" />
  <img src="https://img.shields.io/badge/CLI-Commander-ff6348" alt="Commander" />
  <img src="https://img.shields.io/badge/License-MIT-4CAF50" alt="License" />
</p>

<p align="center">
  CLI y TUI interactiva no oficial para explorar productos, medicamentos, disponibilidad en tiempo real por sucursal, tasa de cambio oficial BCV, y ver fotos de <strong>Farmatodo Venezuela</strong> directo desde tu terminal.
</p>

<p align="center">
  <em>"— ¿Hay acetaminofén en el Farmatodo de Las Mercedes?"</em><br>
  <em>"— Déjame revisar la terminal..."</em>
</p>

---

## 📑 Índice

- [✨ Características](#-características)
- [🚀 Instalación Rápida](#-instalación-rápida)
  - [Ejecutable Binario Independiente](#ejecutable-binario-independiente)
  - [Desde Código Fuente con Bun](#desde-código-fuente-con-bun)
- [🖥️ Interfaz Visual TUI (OpenTUI)](#️-interfaz-visual-tui-opentui)
- [⚡ Comandos de Terminal (Modo CLI)](#-comandos-de-terminal-modo-cli)
  - [Búsqueda de Medicamentos y Productos](#búsqueda-de-medicamentos-y-productos)
  - [Detalle de Producto y Fotos en Terminal](#detalle-de-producto-y-fotos-en-terminal)
  - [Inventario por Sucursal](#inventario-por-sucursal)
  - [Tasa Oficial de Cambio (Bs / USD)](#tasa-oficial-de-cambio-bs--usd)
  - [Sucursales y Farmacias Cercanas](#sucursales-y-farmacias-cercanas)
  - [Directorio de Ciudades](#directorio-de-ciudades)
  - [Departamentos y Categorías](#departamentos-y-categorías)
  - [Configuración Local](#configuración-local)
- [🖼️ Renderizado de Imágenes en Terminal](#️-renderizado-de-imágenes-en-terminal)
- [🛠️ Tecnologías Utilizadas](#️-tecnologías-utilizadas)
- [📄 Licencia](#-licencia)

---

## ✨ Características

- 🔍 **Búsqueda Instantánea:** Consulta en milisegundos contra el catálogo oficial de Farmatodo Venezuela.
- 🏪 **Disponibilidad por Sucursal:** Consulta en qué farmacia exacta de tu ciudad (Las Mercedes, Chuao, Sabana Grande, etc.) hay stock o pocas unidades.
- 💵 **Doble Precio Dinámico:** Conversión automática de precios de Bolívares (Bs.) a Dólares ($ USD) con la tasa oficial BCV de Farmatodo en tiempo real.
- 💊 **Alerta de Récipe Médico:** Distintivo destacado para medicamentos que requieren récipe (`REQUIERE RÉCIPE`).
- 🖼️ **Visor de Fotos en Terminal:** Renderizado de alta resolución en terminales compatibles con Kitty/iTerm/Sixel/ANSI o apertura instantánea en navegador con un botón.
- 🎨 **Dashboard TUI con OpenTUI:** Navegación visual con pestañas para productos, farmacias, departamentos y 56 ciudades venezolanas.
- 📊 **Soporte JSON Nativo:** Bandera `--json` en todos los comandos para automatizaciones, scripts y pipelines.

---

## 🚀 Instalación Rápida

### Ejecutable Binario Independiente

No necesitas tener instalado Node.js o Bun para ejecutarlo:

```bash
# Compilar binario en la carpeta del proyecto
bun run build

# O mover a tus binarios globales del sistema
sudo cp dist/farmatodo /usr/local/bin/

# Ejecutar
farmatodo
```

### Desde Código Fuente con Bun

```bash
# Clonar o entrar al directorio
cd farmatodo-cli

# Instalar dependencias
bun install

# Iniciar la TUI interactiva
bun start

# O crear symlink global
bun link
```

---

## 🖥️ Interfaz Visual TUI (OpenTUI)

Inicia la experiencia gráfica interactiva en la terminal:

```bash
farmatodo
# o explícitamente
farmatodo tui
```

### Atajos de teclado en TUI:
- `[1]`, `[2]`, `[3]`, `[4]` o `[Tab]`: Alternar entre **Productos**, **Farmacias**, **Departamentos** y **Ciudades**.
- `[↑]` / `[↓]` o `[j]` / `[k]`: Navegar la lista de elementos.
- `[/]` o `[s]`: Activar la barra de búsqueda en tiempo real.
- `[Enter]`: Abrir modal de detalle completo del producto con desglose de sucursales con inventario.
- `[p]` o `[i]`: **Ver la foto del producto renderizada en la terminal**.
- `[o]`: Abrir la imagen en tu navegador web.
- `[c]`: Cambiar de ciudad rápidamente (Caracas, Valencia, Maracaibo, etc.).
- `[r]`: Recargar datos y tasas en vivo.
- `[q]` o `[Esc]`: Salir o cerrar modal.

---

## ⚡ Comandos de Terminal (Modo CLI)

### Búsqueda de Medicamentos y Productos

```bash
# Búsqueda básica
farmatodo buscar "ibuprofeno"

# Filtrar únicamente productos en stock
farmatodo buscar "acetaminofen" --en-stock

# Filtrar por departamento específico
farmatodo buscar "aspirina" -d "Salud y Medicamentos"

# Especificar ciudad y límite de resultados
farmatodo buscar "vitamina c" -c VAL -l 10

# Salida en formato JSON para pipelines
farmatodo buscar "flips" --json
```

### Detalle de Producto y Fotos en Terminal

```bash
# Ver información y stock por sucursales
farmatodo producto 111028732

# Ver información incluyendo la FOTO del producto en la terminal
farmatodo producto 111028732 --imagen

# Abrir la foto en el navegador web
farmatodo producto 111028732 --abrir-imagen
```

### Inventario por Sucursal

```bash
# Comprobar en qué farmacias de Caracas hay disponibilidad
farmatodo stock 111028732 -c CCS

# Comprobar disponibilidad en Valencia
farmatodo stock 111028732 -c VAL
```

### Tasa Oficial de Cambio (Bs / USD)

```bash
# Muestra la tasa del día y tabla de conversiones comunes
farmatodo tasa
```

### Sucursales y Farmacias Cercanas

```bash
# Listar farmacias en Caracas
farmatodo farmacias -c CCS

# Listar farmacias cercanas a unas coordenadas GPS
farmatodo farmacias --cerca-de "10.4806,-66.9036"
```

### Directorio de Ciudades

```bash
# Listar las 56 ciudades con cobertura activa
farmatodo ciudades
```

### Departamentos y Categorías

```bash
# Ver catálogo de departamentos y número de productos
farmatodo departamentos
```

### Configuración Local

```bash
# Ver configuración actual
farmatodo config ver

# Establecer tu ciudad preferida (se guardará en ~/.farmatodo-cli.json)
farmatodo config set-ciudad VAL
```

---

## 🖼️ Renderizado de Imágenes en Terminal

`farmatodo-cli` detecta automáticamente las capacidades de tu emulador de terminal:
1. Si tienes instalado `timg`, aprovecha los protocolos nativos de imagen (**Kitty Graphics Protocol**, **iTerm2 Inline Images** o **Sixel** con colores de 24 bits).
2. Si no, utiliza `terminal-image` para generar bloques Unicode adaptados a la paleta de tu terminal.
3. Además, con `--abrir-imagen` o presionando `[o]` en la TUI, puedes ver la foto en alta resolución directamente en tu navegador.

---

---

## 📸 Validación Visual y Generador de Screenshots

El proyecto cuenta con un sistema headless de renderizado y captura visual directa de la TUI mediante `@opentui/core/testing` y Pillow:

```bash
# Genera capturas de pantalla PNG de alta resolución de todas las vistas en .screenshots/
bun run screenshot
```

Vistas capturadas automáticamente:
- `tui_dashboard.png`: Dashboard principal con destacados y tasa oficial.
- `tui_detail_modal.png`: Modal con inventario en tiempo real por sucursal.
- `tui_stores.png`: Directorio de farmacias con distancias y estado.
- `tui_departments.png`: Explorador de categorías.
- `tui_search.png`: Modo interactivo de búsqueda.

---

## 🛠️ Tecnologías Utilizadas

- **[Bun](https://bun.sh/):** Runtime de JavaScript ultrarrápido y compilador de binarios nativos.
- **[TypeScript](https://www.typescriptlang.org/):** Tipado estricto para las respuestas de catálogo y farmacias.
- **[@opentui/core](https://github.com/anomalyco/opentui):** Framework imperativo de alto rendimiento para interfaces de terminal (sin sobrecarga de React ni JSX).
- **[Commander.js](https://github.com/tj/commander.js):** Parser de argumentos y comandos CLI robusto.
- **[Picocolors](https://github.com/alexeyraspopov/picocolors):** Formateo ANSI ultra liviano.
- **[timg](https://timg.systems/) & [terminal-image](https://github.com/sindresorhus/terminal-image):** Renderizado gráfico en terminal.

---

## 📄 Licencia

MIT License. Este proyecto es una herramienta no oficial desarrollada con fines educativos y de utilidad comunitaria. Las marcas y datos pertenecen a Farmatodo.
