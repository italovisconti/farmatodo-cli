# Plan de Arquitectura e Implementación: Farmatodo CLI 💊🇻🇪

Documento de referencia técnica y arquitectura de **`farmatodo-cli`**, una herramienta no oficial de terminal (CLI y TUI) para **Farmatodo Venezuela**, modelada siguiendo el stack moderno de [`cinex-cli`](../cinex-cli).

---

## 1. Objetivos del Proyecto

1. **Velocidad y Agilidad:** Proveer una forma ultrarrápida de consultar medicamentos y productos de consumo masivo sin lidiar con tiempos de carga de la web/app.
2. **Localizador Crítico de Inventario:** Resolver el problema más frecuente en Venezuela: *«¿En qué farmacia cercana tienen este medicamento en existencia?»*.
3. **Precios Duales en Tiempo Real:** Mostrar precios en Bolívares (Bs.) y Dólares ($ USD) calculados automáticamente con la tasa oficial BCV provista por el backend de Farmatodo.
4. **Inspección Visual:** Permitir renderizar las fotografías oficiales de los productos directamente en la terminal (usando protocolos Sixel, Kitty, iTerm2 o medios bloques ANSI).
5. **Doble Modo:** 
   - **TUI Interactiva (OpenTUI React):** Dashboard navegable con teclado, pestañas y modales.
   - **CLI Scriptable (Commander):** Subcomandos rápidos (`buscar`, `producto`, `stock`, `tasa`, `farmacias`) con soporte `--json` para scripts bash y pipelines.

---

## 2. Reingeniería Inversa: Endpoints Oficiales Descubiertos

A partir del análisis del bundle JavaScript de Farmatodo (`main-es2018.*.js`), se identificaron y validaron los siguientes servicios públicos sin bloqueo:

### A. Buscador y Catálogo (Algolia)
- **Host:** `https://api-search.farmatodo.com`
- **Índice:** `products-venezuela`
- **App ID:** `VCOJEYD2PO`
- **API Key Pública:** `869a91e98550dd668b8b1dc04bca9011`
- **Endpoint:** `POST https://api-search.farmatodo.com/1/indexes/products-venezuela/query`
- **Payload Clave:**
  ```json
  {
    "query": "ibuprofeno",
    "hitsPerPage": 24,
    "page": 0,
    "facets": ["departments", "subCategory", "marca"],
    "filters": "departments:\"Salud y Medicamentos\" AND hasStock:true"
  }
  ```
- **Campos devueltos por producto:**
  - `id` / `objectID`: Identificador único de Farmatodo (ej. `111028732`).
  - `mediaDescription`: Nombre completo y presentación comercial.
  - `marca`: Laboratorio o marca fabricante.
  - `fullPrice` / `unitPrice`: Precio actual en Bolívares (Bs.).
  - `fullPriceByCity`: Desglose de precio por ciudad.
  - `stores_with_stock`: Array numérico de IDs de sucursales con inventario disponible.
  - `stores_with_low_stock`: Array numérico de IDs de sucursales con pocas unidades.
  - `requirePrescription`: `"true"` o `"false"` (aviso de récipe médico).
  - `mediaImageUrl`: URL de la fotografía en `lh3.googleusercontent.com`.

### B. Tasa Oficial de Cambio (BCV / Farmatodo)
- **Endpoint:** `GET https://gw-backend-ve.farmatodo.com/oms/v3/currency/exchange?country=VEN`
- **Headers requeridos:**
  ```http
  country: VEN
  source: WEB
  Content-Type: application/json
  ```
- **Respuesta:**
  ```json
  {
    "code": "OK",
    "message": "success",
    "data": {
      "currencyValue": 849.56
    }
  }
  ```

### C. Directorio de 56 Ciudades Activas
- **Endpoint:** `GET https://api-transactional.farmatodo.com/catalog/r/VE/v1/cities/active/geo-zone/`
- **Respuesta:** Array con las 56 ciudades de cobertura en Venezuela (`CCS`, `VAL`, `MCBO`, `BQTO`, `BRC`, etc.), coordenadas de referencia y tienda por defecto.

### D. Directorio de Farmacias y Sucursales
- **Por Ciudad:** `GET https://api-transactional.farmatodo.com/route/r/VE/v1/stores/nearby?cityId=CCS`
- **Por Coordenadas GPS:** `GET https://api-transactional.farmatodo.com/route/r/VE/v1/stores/nearby?lat=10.4806&lng=-66.9036`
- **Respuesta:**
  ```json
  {
    "nearbyStores": [
      {
        "id": 146,
        "name": "TEPUY",
        "city": "CCS",
        "latitude": 10.4856,
        "longitude": -66.8634,
        "address": "AV RIO DE JANEIRO CON CALLE MONTERREY URB LAS MERCEDES",
        "distanceInKm": 0
      }
    ]
  }
### E. Promociones, Descuentos y Campañas (Mundo Ofertas)
Descubiertos e interceptados en vivo con `agent-browser` (skills `core` y `derive-client`):
- **Catálogo de Ofertas Globales (Algolia):**
  - **Filtro:** `outofstore:false AND offerStartDate <= <TIMESTAMP> AND offerEndDate >= <TIMESTAMP>`
  - **Estructura del Hit:** `offerPriceByCity`: `[{ "cityCode": "CCS", "offerPrice": 2796.8, "offerText": "20%" }]`, `stores_with_offer`.
- **Campañas / Grupos de Oferta Destacados:**
  - **Endpoint:** `POST https://api-transactional.farmatodo.com/VE/home/offers/suggest-affinity?key=AIzaSyAidR6Tt0K60gACR78aWThMQb7L5u6Wpag`
  - **Filtro en Algolia:** `id_suggested:'<ID>'` (ej. `9837` para Higiene del Hogar, `9830` para Dulces y Snacks).
- **Motor de Mejor Oferta / Best Deal:**
  - **Endpoint:** `POST https://api-transactional.farmatodo.com/calculate-best-deal/r/VE/v1/calculate-best-deal`
  - Valida reglas de cupones, delivery, primera compra y descuentos por cesta.

---

## 3. Matriz Tecnológica (Stack Cinex-CLI)

| Capa | Herramienta | Justificación |
| :--- | :--- | :--- |
| **Runtime** | [Bun](https://bun.sh/) | Ejecución nativa de TypeScript/JSX, inicio en milisegundos y compilador de binarios independientes (`bun build --compile`). |
| **Lenguaje** | TypeScript 5+ | Tipado estricto de las estructuras de datos de Farmatodo. |
| **CLI Engine** | [Commander.js 15](https://github.com/tj/commander.js) | Subcomandos, argumentos, banderas, spinners y soporte `--json`. |
| **TUI Reconciler** | [OpenTUI React 19](https://github.com/opentui) | Declaratividad tipo React para interfaces de consola complejas con Flexbox/Yoga. |
| **Estilos ANSI** | [Picocolors](https://github.com/alexeyraspopov/picocolors) | Formateo de texto en consola con cero overhead. |
| **Gráficos** | [timg](https://timg.systems/) & [terminal-image](https://github.com/sindresorhus/terminal-image) | Detección automática de Kitty/iTerm2/Sixel con fallback a bloques Unicode y apertura web. |
| **Tipografía** | `glyphs.ts` | Soporte Nerd Fonts con degradación elegante a ASCII plano. |

---

## 4. Estructura del Código Fuente

```text
farmatodo-cli/
├── PLAN.md                # Este documento de arquitectura y plan
├── README.md              # Guía de usuario y manual de comandos
├── package.json           # Dependencias y scripts de Bun
├── tsconfig.json          # Configuración del compilador TypeScript / OpenTUI
├── .gitignore             # Ignorar dist/, node_modules/, etc.
├── dist/
│   └── farmatodo          # Binario ejecutable compilado
└── src/
    ├── index.tsx          # Punto de entrada y enrutador CLI vs TUI
    ├── types.ts           # Interfaces de datos tipadas
    ├── config.ts          # Gestor de configuración (~/.farmatodo-cli.json)
    ├── api.ts             # Conexión HTTP (Algolia, Gateway, Stores, Exchange)
    ├── cli.ts             # Definición de subcomandos Commander
    ├── tui.tsx            # Dashboard interactivo OpenTUI React
    ├── image.ts           # Descarga y renderizado de imágenes en terminal
    ├── glyphs.ts          # Glifos Nerd Font vs ASCII
    └── spinner.ts         # Animación de carga CLI
```

---

## 5. Diseño de la Interfaz TUI (OpenTUI)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ✚ FARMATODO VENEZUELA CLI      💵 Tasa: Bs. 849.56/$ │ 📍 Ciudad: [CCS]     │
├─────────────────────────────────────────────────────────────────────────────┤
│ [1] 💊 Productos | [2] 🏪 Farmacias | [3] 🏷️ Depts | [4] 📍 Ciudades | [/]   │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ ▶ Ibuprofeno 600 mg Ibutan Siegfried │ [DETALLE DEL PRODUCTO SELECCIONADO]  │
│     Bs. 1.898,00 ($2.23 USD) • 109 t │                                      │
│                                      │ Ibuprofeno 600 mg Ibutan Siegfried   │
│   Acetaminofén 500 mg Calox          │ Marca: Meyer | ID: #111028732        │
│     Bs. 369,00 ($0.43 USD) • 201 ti  │                                      │
│                                      │ 🏷️ Bs. 1.898,00 | $2.23 USD          │
│   Vitamina C 500 mg Letisan Masticab │ ⚠ Requiere Récipe Médico             │
│     Bs. 708,00 ($0.83 USD) • 180 ti  │                                      │
│                                      │ 🏪 Farmacias en CCS con stock:       │
│   Cereal Flips Chocolate 120g        │   ✔ MARFIL (Bello Monte)             │
│     Bs. 1.761,00 ($2.07 USD) • 240 t │   ✔ AMBAR (San Ignacio - Pocas)      │
│                                      │   ✔ CHUAO (Av. Araure)               │
│                                      │                                      │
│                                      │ 🖼️ Presiona [p] para ver foto en TUI │
├──────────────────────────────────────┴──────────────────────────────────────┤
│ [Tab/1-4] Vistas | [/] Buscar | [Enter] Detalle | [p/i] Foto | [c] Ciudad   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Pruebas y Validación Realizadas

1. **Tasa de cambio:** Validada con respuesta real del Gateway (`849.56 Bs/$`).
2. **Búsqueda Algolia:** Probada con queries comunes: `"ibuprofeno"`, `"acetaminofen"`, `"vitamina c"`, `"flips"`.
3. **Cruce de stock:** Probado con Caracas (`CCS`), identificando sucursales activas (*Tepuy, Chuao, Marfil, Ambar*).
4. **Renderizado de imágenes:** Probado con `timg` y `terminal-image` sobre imágenes oficiales alojadas en Google Cloud Storage de Farmatodo.
5. **Compilación de binario:** Ejecución exitosa de `bun run build` generando un binario autónomo de ~60MB sin dependencias en `dist/farmatodo`.

---

## 7. Próximas Mejoras y Roadmap (Fase 2)

- [ ] **Carrito / Lista de Compras Local:** Posibilidad de armar una lista con `farmatodo lista agregar <ID>` y calcular el costo total de la cesta en Bs. y USD.
- [ ] **Alerta de Reposición de Stock:** Demonio en segundo plano que avise por notificación de escritorio cuando un medicamento sin stock vuelva a estar disponible en tu farmacia de confianza.
- [ ] **Historial de Precios:** Registro local de la variación de precios en USD a lo largo del tiempo.
- [ ] **Farmacias 24 Horas:** Marcador visual especial para sucursales que operan con turno nocturno.
