import { createTestRenderer } from "@opentui/core/testing";
import { FarmatodoTUI } from "../src/tui";
import type { FarmatodoProduct, Store, City } from "../src/types";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const mockProducts: FarmatodoProduct[] = [
  {
    id: "101",
    objectID: "101",
    mediaDescription: "Acetaminofén 500 mg Calox Caja x 10 Tabletas",
    marca: "Calox",
    departments: ["Salud y Medicamentos"],
    subCategory: "Analgésicos",
    fullPrice: 369.00,
    unitPrice: 369.00,
    fullPriceByCity: [{ cityCode: "CCS", fullPrice: 369.00 }],
    offerPrice: 0,
    hasStock: true,
    stores_with_stock: [146, 118, 102],
    stores_with_low_stock: [],
    mediaImageUrl: "https://example.com/item1.jpg",
    requirePrescription: "false",
    url: "item-101"
  },
  {
    id: "102",
    objectID: "102",
    mediaDescription: "Ibuprofeno 600 mg Ibutan Caja x 10 Tabletas",
    marca: "Meyer",
    departments: ["Salud y Medicamentos"],
    subCategory: "Analgésicos",
    fullPrice: 1898.50,
    unitPrice: 1898.50,
    fullPriceByCity: [{ cityCode: "CCS", fullPrice: 1898.50 }],
    offerPrice: 0,
    hasStock: true,
    stores_with_stock: [146],
    stores_with_low_stock: [118],
    mediaImageUrl: "https://example.com/item2.jpg",
    requirePrescription: "true",
    url: "item-102"
  },
  {
    id: "103",
    objectID: "103",
    mediaDescription: "Vitamina C 1000 mg Redoxon Tubo x 10 Comprimidos",
    marca: "Bayer",
    departments: ["Cuidado Personal", "Vitaminas"],
    subCategory: "Multivitamínicos",
    fullPrice: 2450.00,
    unitPrice: 2450.00,
    fullPriceByCity: [{ cityCode: "CCS", fullPrice: 2450.00 }],
    offerPrice: 0,
    hasStock: true,
    stores_with_stock: [146, 118],
    stores_with_low_stock: [],
    mediaImageUrl: "https://example.com/item3.jpg",
    requirePrescription: "false",
    url: "item-103"
  },
  {
    id: "104",
    objectID: "104",
    mediaDescription: "Protector Solar Facial Anthelios SPF 50+ 50ml",
    marca: "La Roche-Posay",
    departments: ["Belleza", "Dermocosmética"],
    subCategory: "Fotoprotección",
    fullPrice: 9101.00,
    unitPrice: 9101.00,
    fullPriceByCity: [{ cityCode: "CCS", fullPrice: 9101.00 }],
    offerPrice: 0,
    hasStock: true,
    stores_with_stock: [146],
    stores_with_low_stock: [],
    mediaImageUrl: "https://example.com/item4.jpg",
    requirePrescription: "false",
    url: "item-104"
  },
  {
    id: "105",
    objectID: "105",
    mediaDescription: "Flips Cereal Relleno de Dulce de Leche 220g",
    marca: "Alfonzo Rivas",
    departments: ["Alimentos y Bebidas"],
    subCategory: "Cereales",
    fullPrice: 580.00,
    unitPrice: 580.00,
    fullPriceByCity: [{ cityCode: "CCS", fullPrice: 580.00 }],
    offerPrice: 0,
    hasStock: true,
    stores_with_stock: [146, 118, 102],
    stores_with_low_stock: [],
    mediaImageUrl: "https://example.com/item5.jpg",
    requirePrescription: "false",
    url: "item-105"
  }
];

const mockStores: Store[] = [
  { id: 146, name: "TEPUY", city: "CCS", latitude: 10.4856, longitude: -66.8634, address: "Av. Principal de Las Mercedes" },
  { id: 118, name: "CHUAO", city: "CCS", latitude: 10.4823, longitude: -66.8459, address: "Av. Araure con Calle La Guairita" },
  { id: 102, name: "LA CASTELLANA", city: "CCS", latitude: 10.4990, longitude: -66.8530, address: "Av. Principal de La Castellana" }
];

const mockCities: City[] = [
  { cityId: "CCS", name: "Caracas", active: true, countryId: "VE", latitude: 10.48, longitude: -66.90, defaultStoreId: 146, deliveryType: "EXPRESS" },
  { cityId: "VAL", name: "Valencia", active: true, countryId: "VE", latitude: 10.16, longitude: -68.00, defaultStoreId: 102, deliveryType: "EXPRESS" },
  { cityId: "MAR", name: "Maracaibo", active: true, countryId: "VE", latitude: 10.65, longitude: -71.61, defaultStoreId: 105, deliveryType: "EXPRESS" }
];

const mockDepartments = [
  { name: "Salud y Medicamentos", count: 4820 },
  { name: "Cuidado Personal", count: 3210 },
  { name: "Belleza y Cosmética", count: 2150 },
  { name: "Alimentos y Bebidas", count: 1840 },
  { name: "Bebés y Maternidad", count: 960 },
  { name: "Cuidado del Hogar", count: 750 }
];

async function captureAndSave(setup: Awaited<ReturnType<typeof createTestRenderer>>, filename: string, title: string) {
  await setup.renderOnce();
  const spans = setup.captureSpans();
  const tmpJson = path.join("/tmp", `spans_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
  const outPng = path.join(process.cwd(), ".screenshots", filename);

  fs.writeFileSync(tmpJson, JSON.stringify(spans));

  const res = spawnSync("python3", [
    path.join(__dirname, "render_screenshot.py"),
    tmpJson,
    outPng,
    title
  ]);

  if (fs.existsSync(tmpJson)) {
    fs.unlinkSync(tmpJson);
  }

  if (res.status !== 0) {
    console.error(`Error rendering screenshot ${filename}:`, res.stderr.toString());
  } else {
    console.log(`[OK] Generated: ${outPng}`);
  }
}

async function main() {
  const screenshotsDir = path.join(process.cwd(), ".screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log("📸 Generating visual screenshots for Farmatodo TUI...");

  // 1. Vista Principal (Dashboard)
  {
    const setup = await createTestRenderer({ width: 100, height: 26 });
    const app = new FarmatodoTUI(setup.renderer);
    app.loading = false;
    app.exchangeRate = 849.56;
    app.selectedCity = "CCS";
    app.products = mockProducts;
    app.stores = mockStores;
    app.cities = mockCities;
    app.selectedIndex = 0;
    app.updateView();

    await captureAndSave(setup, "tui_dashboard.png", "Farmatodo TUI — Destacados y Recomendados");
    setup.renderer.destroy();
  }

  // 2. Vista Modal Detalle
  {
    const setup = await createTestRenderer({ width: 100, height: 26 });
    const app = new FarmatodoTUI(setup.renderer);
    app.loading = false;
    app.exchangeRate = 849.56;
    app.selectedCity = "CCS";
    app.products = mockProducts;
    app.stores = mockStores;
    app.cities = mockCities;
    app.selectedIndex = 0;
    app.updateView();

    // Abrir modal de detalle
    setup.mockInput.pressEnter();

    await captureAndSave(setup, "tui_detail_modal.png", "Farmatodo TUI — Detalle de Producto y Stock Local");
    setup.renderer.destroy();
  }

  // 3. Vista Farmacias
  {
    const setup = await createTestRenderer({ width: 100, height: 26 });
    const app = new FarmatodoTUI(setup.renderer);
    app.loading = false;
    app.exchangeRate = 849.56;
    app.selectedCity = "CCS";
    app.products = mockProducts;
    app.stores = mockStores;
    app.cities = mockCities;
    app.updateView();

    // Cambiar a pestaña Farmacias
    setup.mockInput.pressKey("2");

    await captureAndSave(setup, "tui_stores.png", "Farmatodo TUI — Farmacias Cercanas");
    setup.renderer.destroy();
  }

  // 4. Vista Departamentos
  {
    const setup = await createTestRenderer({ width: 100, height: 26 });
    const app = new FarmatodoTUI(setup.renderer);
    app.loading = false;
    app.exchangeRate = 849.56;
    app.selectedCity = "CCS";
    app.products = mockProducts;
    app.stores = mockStores;
    app.cities = mockCities;
    app.departments = mockDepartments;
    app.updateView();

    // Cambiar a pestaña Departamentos
    setup.mockInput.pressKey("3");

    await captureAndSave(setup, "tui_departments.png", "Farmatodo TUI — Departamentos y Categorías");
    setup.renderer.destroy();
  }

  // 5. Vista Buscador Activo
  {
    const setup = await createTestRenderer({ width: 100, height: 26 });
    const app = new FarmatodoTUI(setup.renderer);
    app.loading = false;
    app.exchangeRate = 849.56;
    app.selectedCity = "CCS";
    app.products = mockProducts;
    app.stores = mockStores;
    app.cities = mockCities;
    app.updateView();

    // Activar buscador y teclear término
    setup.mockInput.pressKey("/");
    setup.mockInput.typeText("calox");

    await captureAndSave(setup, "tui_search.png", "Farmatodo TUI — Búsqueda en Vivo");
    setup.renderer.destroy();
  }

  // 6. Vista Modal de Imagen
  {
    const setup = await createTestRenderer({ width: 100, height: 26 });
    const app = new FarmatodoTUI(setup.renderer);
    app.loading = false;
    app.exchangeRate = 849.56;
    app.selectedCity = "CCS";
    app.products = mockProducts;
    app.stores = mockStores;
    app.cities = mockCities;
    app.selectedIndex = 0;
    app.showImageView = true;
    app.imageArt = "[ Fotografía oficial del producto ]\n\n  █▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀█\n  █  FARMATODO VE  █\n  █  CALOX 500mg   █\n  █▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄█";
    app.updateView();

    await captureAndSave(setup, "tui_image_modal.png", "Farmatodo TUI — Visor de Fotografía Oficial");
    setup.renderer.destroy();
  }

  console.log(" All screenshots generated in .screenshots/");
}

main().catch(console.error);
