import { test, expect, describe, afterEach } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { FarmatodoTUI } from "../src/tui";
import type { FarmatodoProduct, Store, City } from "../src/types";

let testSetup: Awaited<ReturnType<typeof createTestRenderer>> | null = null;

afterEach(() => {
  if (testSetup) {
    testSetup.renderer.destroy();
    testSetup = null;
  }
});

const mockProducts: FarmatodoProduct[] = [
  {
    id: "101",
    objectID: "101",
    mediaDescription: "Acetaminofén 500 mg Calox Caja x 10 Tabletas",
    marca: "Calox",
    departments: ["Salud y Medicamentos"],
    subCategory: "Analgésicos",
    fullPrice: 369,
    unitPrice: 369,
    fullPriceByCity: [{ cityCode: "CCS", fullPrice: 369 }],
    offerPrice: 0,
    hasStock: true,
    stores_with_stock: [146, 118],
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
    fullPrice: 1898,
    unitPrice: 1898,
    fullPriceByCity: [{ cityCode: "CCS", fullPrice: 1898 }],
    offerPrice: 0,
    hasStock: true,
    stores_with_stock: [146],
    stores_with_low_stock: [118],
    mediaImageUrl: "https://example.com/item2.jpg",
    requirePrescription: "true",
    url: "item-102"
  }
];

const mockStores: Store[] = [
  { id: 146, name: "TEPUY", city: "CCS", latitude: 10.4856, longitude: -66.8634, address: "Las Mercedes" },
  { id: 118, name: "CHUAO", city: "CCS", latitude: 10.4823, longitude: -66.8459, address: "Av. Araure" }
];

const mockCities: City[] = [
  { cityId: "CCS", name: "Caracas", active: true, countryId: "VE", latitude: 10.48, longitude: -66.90, defaultStoreId: 146, deliveryType: "EXPRESS" },
  { cityId: "VAL", name: "Valencia", active: true, countryId: "VE", latitude: 10.16, longitude: -68.00, defaultStoreId: 102, deliveryType: "EXPRESS" }
];

describe("Farmatodo TUI Visual and Functional Tests (OpenTUI Core)", () => {
  test("Renders initial dashboard without text overlapping or footer overflow", async () => {
    testSetup = await createTestRenderer({ width: 100, height: 26 });
    const app = new FarmatodoTUI(testSetup.renderer);

    app.loading = false;
    app.exchangeRate = 849.56;
    app.selectedCity = "CCS";
    app.products = mockProducts;
    app.stores = mockStores;
    app.cities = mockCities;
    app.updateView();

    await testSetup.renderOnce();
    const frame = testSetup.captureCharFrame();
    const lines = frame.split("\n");

    // 1. Verificar límites de altura del viewport
    expect(lines.length).toBeLessThanOrEqual(28);

    // 2. Cabecera limpia y formateada
    expect(frame).toContain("FARMATODO VENEZUELA");
    expect(frame).toContain("Tasa BCV: Bs.");
    expect(frame).toContain("Ciudad: [CCS]");

    // 3. No existen caracteres de sobreescritura extraños
    expect(frame).not.toContain("T(Presionaa");
    expect(frame).not.toContain("Buscador0de");

    // 4. Pestañas visibles en una sola fila
    expect(frame).toContain("[1] Destacados");
    expect(frame).toContain("[2] Farmacias");
    expect(frame).toContain("[3] Deptos");
    expect(frame).toContain("[4] Ciudades");

    // 5. Productos listados y panel de detalle con tarjeta de imagen
    expect(frame).toContain("Acetaminofén 500 mg");
    expect(frame).toContain("Bs. 369,00");
    expect(frame).toContain("Imagen");

    // 6. Barra de comandos inferior
    expect(frame).toContain("[Tab/1-4] Vistas");
  });

  test("Tab switching updates content cleanly", async () => {
    testSetup = await createTestRenderer({ width: 100, height: 26 });
    const app = new FarmatodoTUI(testSetup.renderer);

    app.loading = false;
    app.stores = mockStores;
    app.cities = mockCities;
    app.updateView();

    // Cambiar a pestaña 2 (Farmacias)
    testSetup.mockInput.pressKey("2");
    await testSetup.renderOnce();

    let frame = testSetup.captureCharFrame();
    expect(frame).toContain("FARMACIAS EN CCS");
    expect(frame).toContain("TEPUY");
    expect(frame).toContain("Las Mercedes");

    // Cambiar a pestaña 4 (Ciudades)
    testSetup.mockInput.pressKey("4");
    await testSetup.renderOnce();

    frame = testSetup.captureCharFrame();
    expect(frame).toContain("CIUDADES");
    expect(frame).toContain("[CCS] Caracas");
    expect(frame).toContain("[VAL] Valencia");
  });

  test("Opens product detail modal with stock in local stores", async () => {
    testSetup = await createTestRenderer({ width: 100, height: 26 });
    const app = new FarmatodoTUI(testSetup.renderer);

    app.loading = false;
    app.products = mockProducts;
    app.stores = mockStores;
    app.selectedIndex = 0;
    app.updateView();

    // Presionar Enter para abrir detalle
    testSetup.mockInput.pressEnter();
    await testSetup.renderOnce();

    const frame = testSetup.captureCharFrame();
    expect(frame).toContain("[PRECIO Y TASA OFICIAL]");
    expect(frame).toContain("Acetaminofén 500 mg Calox");
    expect(frame).toContain("SUCURSALES EN CCS");
    expect(frame).toContain("Imagen");

    // Cerrar modal enviando evento escape
    testSetup.renderer.keyInput.emit("keypress", { name: "escape" });
    await testSetup.renderOnce();

    const closedFrame = testSetup.captureCharFrame();
    expect(closedFrame).toContain("DESTACADOS Y RECOMENDADOS");
  });

  test("Search mode accepts input and displays search state", async () => {
    testSetup = await createTestRenderer({ width: 100, height: 26 });
    const app = new FarmatodoTUI(testSetup.renderer);

    app.loading = false;
    app.products = mockProducts;
    app.updateView();

    // Activar buscador con '/'
    testSetup.mockInput.pressKey("/");
    await testSetup.renderOnce();

    let frame = testSetup.captureCharFrame();
    expect(frame).toContain("[_] (Enter/Esc)");

    // Escribir texto con typeText
    testSetup.mockInput.typeText("flips");
    await testSetup.renderOnce();

    frame = testSetup.captureCharFrame();
    expect(frame).toContain("[flips_] (Enter/Esc)");

    // Cancelar enviando escape
    testSetup.renderer.keyInput.emit("keypress", { name: "escape" });
    await testSetup.renderOnce();

    frame = testSetup.captureCharFrame();
    expect(frame).not.toContain("[flips_] (Enter/Esc)");
  });
});
