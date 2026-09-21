<p align="center">
  <img src="static/logo-farmatodo-cli.png" alt="Farmatodo CLI" width="420" />
</p>

# Farmatodo CLI & TUI

farmatodo pero para la gente q le gusta full usar la compu

![Farmatodo TUI](.screenshots/tui_dashboard.png)

---

## Instalacion

Ejecuta el script de instalacion automatica en tu terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/italovisconti/farmatodo-cli/master/install.sh | bash
```

O si ya tienes el repositorio clonado:

```bash
./install.sh
```

El script se encarga de compilar el binario nativo independiente e instalarlo en `~/.local/bin/farmatodo`.

---

## Inicio Rapido

### Requisitos manuales (opcional)
- [Bun](https://bun.sh) (v1.0+)

### Ejecucion desde codigo fuente

```bash
# Instalar dependencias
bun install

# Iniciar la interfaz TUI
bun start
```

### Compilar binario nativo manualmente
```bash
bun run build
./dist/farmatodo
```

---

## Controles en la TUI

| Tecla | Accion |
|---|---|
| `[Tab]` / `[1-5]` | Alternar vistas: Catalogo, Ofertas, Farmacias, Departamentos, Ciudades |
| `[↑]` / `[↓]` | Desplazarse por la lista |
| `[/]` | Busqueda interactiva de productos |
| `[Enter]` | Ver detalle completo del producto y sucursales con stock |
| `[p]` / `[i]` | Ver fotografia oficial ampliada |
| `[o]` | Abrir imagen en navegador web |
| `[c]` | Cambiar ciudad activa (Caracas, Valencia, Maracaibo, etc.) |
| `[q]` / `[Esc]` | Volver / Salir |

---

## Comandos CLI

Para consultar directamente desde la consola o en scripts:

```bash
# Consultar todas las promociones y ofertas con descuento activo
farmatodo ofertas

# Ver las campanas y grupos destacados de ofertas (Higiene, Dulces, etc.)
farmatodo ofertas --campanas

# Filtrar ofertas por grupo promocional especifico
farmatodo ofertas -g 9837

# Buscar productos en general (o filtrar solo los que tienen descuento)
farmatodo buscar "galleta"
farmatodo buscar "rosal" --ofertas

# Consultar la tasa oficial BCV del dia
farmatodo tasa

# Consultar disponibilidad de un producto por farmacias
farmatodo stock 111694893 -c CCS

# Listar farmacias en una ciudad
farmatodo farmacias -c CCS
```

---

## Pruebas y Validacion Visual

```bash
# Ejecutar suite de pruebas
bun test

# Regenerar capturas visuales de todas las vistas en .screenshots/
bun run screenshot
```

---

## Licencia

MIT. Proyecto no oficial con fines educativos y de utilidad comunitaria.
