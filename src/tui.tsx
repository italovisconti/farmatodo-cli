import React, { useState, useEffect } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import {
  searchProducts,
  getProductById,
  getExchangeRate,
  fetchCities,
  fetchNearbyStores,
  getProductStockInStores,
  getDepartments
} from "./api";
import { renderProductImage, openImageInBrowser } from "./image";
import { getGlyphs } from "./glyphs";
import { getSpinnerFrames } from "./spinner";
import { loadConfig, saveConfig } from "./config";
import type { FarmatodoProduct, City, Store } from "./types";

function formatBs(val: number): string {
  return `Bs. ${Number(val).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUsd(bs: number, rate: number): string {
  if (!rate || rate <= 0) return "$0.00";
  const usd = bs / rate;
  return `$${usd.toFixed(2)} USD`;
}

function FarmatodoApp() {
  const renderer = useRenderer();
  const dims = useTerminalDimensions();
  const columns = dims.width || 80;
  const rows = dims.height || 24;
  const NF = getGlyphs();
  const spinnerFrames = getSpinnerFrames();
  const initialConfig = loadConfig();

  // Estados principales
  const [loading, setLoading] = useState(true);
  const [exchangeRate, setExchangeRate] = useState<number>(850.0);
  const [selectedCity, setSelectedCity] = useState<string>(initialConfig.defaultCity || "CCS");
  const [activeTab, setActiveTab] = useState<"products" | "stores" | "departments" | "cities">("products");

  // Datos
  const [products, setProducts] = useState<FarmatodoProduct[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [departments, setDepartments] = useState<{ name: string; count: number }[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");

  // Navegación y selección
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("acetaminofen");
  const [searchInput, setSearchInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Modales
  const [detailModalProduct, setDetailModalProduct] = useState<FarmatodoProduct | null>(null);
  const [modalStockMap, setModalStockMap] = useState<{ store: Store; hasStock: boolean; isLowStock: boolean }[]>([]);
  const [showImageView, setShowImageView] = useState(false);
  const [imageArt, setImageArt] = useState<string>("");
  const [loadingImage, setLoadingImage] = useState(false);

  // Spinner animation
  const [spinnerIdx, setSpinnerIdx] = useState(0);

  useEffect(() => {
    if (!loading && !loadingImage) return;
    const timer = setInterval(() => {
      setSpinnerIdx((prev) => (prev + 1) % spinnerFrames.length);
    }, 80);
    return () => clearInterval(timer);
  }, [loading, loadingImage, spinnerFrames.length]);

  // Cargar datos iniciales
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [rate, fetchedCities, initialSearch, fetchedStores, fetchedDepts] = await Promise.all([
        getExchangeRate(),
        fetchCities(),
        searchProducts({ query: searchQuery, hitsPerPage: 20 }),
        fetchNearbyStores(selectedCity),
        getDepartments()
      ]);

      setExchangeRate(rate);
      setCities(fetchedCities);
      setProducts(initialSearch.hits);
      setStores(fetchedStores);
      setDepartments(fetchedDepts);
    } catch (err) {
      console.error("Error cargando datos en TUI:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Cargar productos al cambiar búsqueda o departamento
  const executeSearch = async (term: string, dept = selectedDepartment) => {
    setLoading(true);
    try {
      const res = await searchProducts({
        query: term,
        department: dept || undefined,
        hitsPerPage: 25
      });
      setProducts(res.hits);
      setSelectedIndex(0);
    } catch (e) {
      console.error("Error al buscar:", e);
    } finally {
      setLoading(false);
    }
  };

  // Actualizar sucursales si cambia de ciudad
  const handleCityChange = async (newCityId: string) => {
    setSelectedCity(newCityId);
    saveConfig({ defaultCity: newCityId });
    try {
      const newStores = await fetchNearbyStores(newCityId);
      setStores(newStores);
    } catch (e) {}
    setActiveTab("products");
    setSelectedIndex(0);
  };

  // Cargar stock para el modal de detalle
  const openDetailModal = async (prod: FarmatodoProduct) => {
    setDetailModalProduct(prod);
    try {
      const map = await getProductStockInStores(prod, selectedCity);
      setModalStockMap(map);
    } catch (e) {
      setModalStockMap([]);
    }
  };

  // Renderizar imagen de producto en terminal
  const openTerminalImage = async (prod: FarmatodoProduct) => {
    if (!prod || !prod.mediaImageUrl) return;
    setShowImageView(true);
    setLoadingImage(true);
    try {
      const targetWidth = Math.max(30, Math.min(columns - 10, 48));
      const art = await renderProductImage(prod.mediaImageUrl, targetWidth);
      setImageArt(art);
    } catch (e) {
      setImageArt("[Error al renderizar imagen]");
    } finally {
      setLoadingImage(false);
    }
  };

  const currentListLength =
    activeTab === "products"
      ? products.length
      : activeTab === "stores"
      ? stores.length
      : activeTab === "departments"
      ? departments.length
      : cities.length;

  const currentProduct = activeTab === "products" ? products[selectedIndex] : null;

  // Manejo de teclado
  useKeyboard((event: { name: string; sequence?: string }) => {
    // Si el usuario está escribiendo en el buscador
    if (isSearching) {
      if (event.name === "escape") {
        setIsSearching(false);
        setSearchInput("");
        return;
      }
      if (event.name === "return" || event.name === "enter") {
        setIsSearching(false);
        if (searchInput.trim()) {
          setSearchQuery(searchInput.trim());
          executeSearch(searchInput.trim());
        }
        return;
      }
      if (event.name === "backspace") {
        setSearchInput((prev) => prev.slice(0, -1));
        return;
      }
      if (event.sequence && event.sequence.length === 1 && /^[\w\s\-\.\,\á\é\í\ó\ú\ñ]$/i.test(event.sequence)) {
        setSearchInput((prev) => prev + event.sequence);
        return;
      }
      return;
    }

    // Salir del visor de imagen
    if (showImageView) {
      if (event.name === "escape" || event.name === "p" || event.name === "i" || event.name === "q") {
        setShowImageView(false);
        return;
      }
      if (event.name === "o") {
        const prod = detailModalProduct || currentProduct;
        if (prod?.mediaImageUrl) openImageInBrowser(prod.mediaImageUrl);
        return;
      }
      return;
    }

    // Salir del modal de detalle
    if (detailModalProduct) {
      if (event.name === "escape" || event.name === "q") {
        setDetailModalProduct(null);
        return;
      }
      if (event.name === "p" || event.name === "i") {
        openTerminalImage(detailModalProduct);
        return;
      }
      if (event.name === "o") {
        if (detailModalProduct.mediaImageUrl) openImageInBrowser(detailModalProduct.mediaImageUrl);
        return;
      }
      return;
    }

    // Navegación general
    if (event.name === "q") {
      renderer.destroy();
      process.exit(0);
      return;
    }

    if (event.name === "r") {
      loadInitialData();
      return;
    }

    // Cambiar de tab con teclas 1, 2, 3, 4 o Tab
    if (event.name === "tab") {
      if (activeTab === "products") setActiveTab("stores");
      else if (activeTab === "stores") setActiveTab("departments");
      else if (activeTab === "departments") setActiveTab("cities");
      else setActiveTab("products");
      setSelectedIndex(0);
      return;
    }

    if (event.name === "1") { setActiveTab("products"); setSelectedIndex(0); return; }
    if (event.name === "2") { setActiveTab("stores"); setSelectedIndex(0); return; }
    if (event.name === "3") { setActiveTab("departments"); setSelectedIndex(0); return; }
    if (event.name === "4" || event.name === "c") { setActiveTab("cities"); setSelectedIndex(0); return; }

    // Activar buscador
    if (event.name === "/" || event.name === "s") {
      setIsSearching(true);
      setSearchInput("");
      return;
    }

    // Ver foto del producto seleccionado
    if (event.name === "p" || event.name === "i") {
      if (currentProduct) openTerminalImage(currentProduct);
      return;
    }

    if (event.name === "o") {
      if (currentProduct?.mediaImageUrl) openImageInBrowser(currentProduct.mediaImageUrl);
      return;
    }

    // Subir / Bajar en la lista
    if (event.name === "up" || event.name === "k") {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (event.name === "down" || event.name === "j") {
      setSelectedIndex((prev) => Math.min(currentListLength - 1, prev + 1));
      return;
    }

    // Enter / Seleccionar elemento
    if (event.name === "return" || event.name === "enter") {
      if (activeTab === "products" && products[selectedIndex]) {
        openDetailModal(products[selectedIndex]);
      } else if (activeTab === "departments" && departments[selectedIndex]) {
        const dept = departments[selectedIndex].name;
        setSelectedDepartment(dept);
        setActiveTab("products");
        executeSearch(searchQuery, dept);
      } else if (activeTab === "cities" && cities[selectedIndex]) {
        handleCityChange(cities[selectedIndex].cityId);
      }
    }
  });

  const currentSpinnerFrame = spinnerFrames[spinnerIdx];

  // 1. VISOR DE IMAGEN EN TERMINAL
  if (showImageView) {
    const prod = detailModalProduct || currentProduct;
    return (
      <box width={columns} height={rows} flexDirection="column" padding={1} border style={{ borderColor: "blue" }}>
        <box border padding={1} marginBottom={1} style={{ borderColor: "cyan" }}>
          <text fg="yellow">
            <strong>{NF.image} FOTO DEL PRODUCTO: {prod?.mediaDescription?.toUpperCase()}</strong>
          </text>
        </box>

        <box flexGrow={1} justifyContent="center" alignItems="center" flexDirection="column">
          {loadingImage ? (
            <text fg="cyan"><strong>{currentSpinnerFrame} Descargando y renderizando imagen en terminal...</strong></text>
          ) : (
            <scrollbox height={rows - 8}>
              <text fg="white">{imageArt}</text>
            </scrollbox>
          )}
        </box>

        <box marginTop={1} style={{ backgroundColor: "blue" }} padding={1} flexDirection="row" justifyContent="space-between">
          <text fg="white"><strong>[Esc/q] Volver | [o] Abrir en navegador</strong></text>
          <text fg="yellow"><strong>ID: #{prod?.id}</strong></text>
        </box>
      </box>
    );
  }

  // 2. MODAL DE DETALLE COMPLETO DEL PRODUCTO
  if (detailModalProduct) {
    const priceBs = formatBs(detailModalProduct.fullPrice);
    const priceUsd = formatUsd(detailModalProduct.fullPrice, exchangeRate);
    const hasRx = detailModalProduct.requirePrescription === "true" || detailModalProduct.requirePrescription === true;
    const availableStores = modalStockMap.filter((s) => s.hasStock);

    return (
      <box width={columns} height={rows} flexDirection="column" padding={1} border style={{ borderColor: "cyan" }}>
        <box border padding={1} marginBottom={1} style={{ borderColor: "yellow" }}>
          <text fg="yellow">
            <strong>{NF.pill} {detailModalProduct.mediaDescription.toUpperCase()}</strong>
          </text>
          <text fg="gray"> | Marca: {detailModalProduct.marca || "N/A"} | ID: #{detailModalProduct.id}</text>
        </box>

        <box flexDirection="row" flexGrow={1}>
          {/* Columna Izquierda: Precios y Descripción */}
          <box width="45%" flexDirection="column" paddingRight={1} border style={{ borderColor: "gray" }}>
            <text fg="cyan"><strong>[PRECIO Y TASA OFICIAL]</strong></text>
            <text fg="green"><strong>{priceBs}</strong></text>
            <text fg="yellow"><strong>{priceUsd}</strong></text>
            <text fg="gray">Tasa BCV/Farmatodo: Bs. {exchangeRate.toFixed(2)} / $</text>

            <box height={1} />
            {hasRx && (
              <box border padding={1} style={{ borderColor: "red" }} marginBottom={1}>
                <text fg="red"><strong>{NF.warning} REQUIERE RÉCIPE MÉDICO OBLIGATORIO</strong></text>
              </box>
            )}

            <text fg="cyan"><strong>[INFORMACIÓN DEL PRODUCTO]</strong></text>
            <text fg="white">Departamento: {detailModalProduct.departments?.join(", ") || "General"}</text>
            <text fg="white">Categoría: {detailModalProduct.subCategory || "General"}</text>

            <box height={1} />
            <text fg="yellow"><strong>{NF.image} Presiona [p] o [i] para ver la foto en terminal</strong></text>
            <text fg="gray">Presiona [o] para abrir imagen en navegador</text>
          </box>

          {/* Columna Derecha: Disponibilidad en Sucursales */}
          <box width="55%" flexDirection="column" paddingLeft={1} border style={{ borderColor: "gray" }}>
            <text fg="green"><strong>{NF.store} DISPONIBILIDAD EN SUCURSALES ({selectedCity}):</strong></text>
            <scrollbox height={rows - 10}>
              {modalStockMap.length === 0 ? (
                <text fg="gray">Consultando inventario en farmacias...</text>
              ) : availableStores.length === 0 ? (
                <text fg="red">✖ Agotado en todas las farmacias registradas de {selectedCity}</text>
              ) : (
                modalStockMap.map(({ store, hasStock, isLowStock }, idx) => (
                  <box key={idx} flexDirection="column" marginBottom={1}>
                    <text fg={hasStock ? (isLowStock ? "yellow" : "green") : "gray"}>
                      <strong>{hasStock ? (isLowStock ? "▲ [Pocas unidades]" : "✔ [Disponible]") : "✖ [Sin stock]"} {store.name}</strong>
                    </text>
                    <text fg="gray">{store.address.slice(0, 55)}</text>
                  </box>
                ))
              )}
            </scrollbox>
          </box>
        </box>

        {/* Footer Modal */}
        <box border marginTop={1} padding={1} style={{ borderColor: "cyan" }} flexDirection="row" justifyContent="space-between">
          <text fg="yellow"><strong>[Esc/q] Volver al listado  |  [p/i] Ver foto  |  [o] Abrir foto web</strong></text>
          <text fg="green"><strong>Ciudad: {selectedCity}</strong></text>
        </box>
      </box>
    );
  }

  // 3. VISTA PRINCIPAL (DASHBOARD TUI)
  return (
    <box width={columns} height={rows} flexDirection="column" padding={1}>
      {/* Cabecera Principal */}
      <box border padding={1} marginBottom={1} style={{ borderColor: "blue" }} flexDirection="row" justifyContent="space-between">
        <box flexDirection="column">
          <text fg="blue">
            <strong>{NF.cross} FARMATODO VENEZUELA CLI</strong>
          </text>
          <text fg="gray">Buscador de medicamentos, precios duales y stock por sucursal</text>
        </box>
        <box flexDirection="column" alignItems="flex-end">
          <text fg="yellow">
            <strong>{NF.dollar} Tasa oficial: Bs. {exchangeRate.toFixed(2)} / $</strong>
          </text>
          <text fg="cyan">
            {NF.city} Ciudad: <strong>[{selectedCity}]</strong> (Presiona [c] para cambiar)
          </text>
        </box>
      </box>

      {/* Barra de Tabs y Buscador */}
      <box border paddingX={1} marginBottom={1} style={{ borderColor: "cyan" }} flexDirection="row" justifyContent="space-between">
        <box flexDirection="row">
          <text fg={activeTab === "products" ? "green" : "gray"}>
            <strong>[1] {NF.pill} Productos</strong>
          </text>
          <text fg="gray">  |  </text>
          <text fg={activeTab === "stores" ? "green" : "gray"}>
            <strong>[2] {NF.store} Farmacias</strong>
          </text>
          <text fg="gray">  |  </text>
          <text fg={activeTab === "departments" ? "green" : "gray"}>
            <strong>[3] {NF.tag} Departamentos</strong>
          </text>
          <text fg="gray">  |  </text>
          <text fg={activeTab === "cities" ? "green" : "gray"}>
            <strong>[4] {NF.city} Ciudades</strong>
          </text>
        </box>
        <box>
          {isSearching ? (
            <text fg="yellow"><strong>Buscar: [{searchInput}_] (Enter: buscar, Esc: salir)</strong></text>
          ) : (
            <text fg="cyan">Búsqueda actual: "{searchQuery}" {selectedDepartment ? `[${selectedDepartment}]` : ""} (Presiona [/])</text>
          )}
        </box>
      </box>

      {/* Contenido Central: Panel Dividido */}
      {loading ? (
        <box flexGrow={1} justifyContent="center" alignItems="center" flexDirection="column">
          <text fg="cyan"><strong>{currentSpinnerFrame} Conectando con Farmatodo Venezuela...</strong></text>
        </box>
      ) : (
        <box flexDirection="row" flexGrow={1}>
          {/* Panel Izquierdo: Lista de Resultados */}
          <box width="50%" flexDirection="column" paddingRight={1} border style={{ borderColor: "gray" }}>
            <scrollbox height={rows - 10}>
              {activeTab === "products" && (
                products.length === 0 ? (
                  <text fg="yellow">No se encontraron productos para "{searchQuery}". Presiona [/] para buscar otro término.</text>
                ) : (
                  products.map((p, idx) => {
                    const isSel = idx === selectedIndex;
                    const priceBs = formatBs(p.fullPrice);
                    const priceUsd = formatUsd(p.fullPrice, exchangeRate);
                    const stockCount = p.stores_with_stock?.length || 0;
                    const stockText = stockCount > 0 ? `✔ ${stockCount} tiendas` : "✖ Sin stock";

                    return (
                      <box key={idx} flexDirection="column" marginBottom={1}>
                        <text fg={isSel ? "yellow" : "white"}>
                          <strong>{isSel ? "▶ " : "  "}{p.mediaDescription.slice(0, 38)}</strong>
                        </text>
                        <text fg={isSel ? "green" : "gray"}>
                          {"    "}{priceBs} ({priceUsd})  •  {stockText}
                        </text>
                      </box>
                    );
                  })
                )
              )}

              {activeTab === "stores" && (
                stores.length === 0 ? (
                  <text fg="yellow">No se encontraron farmacias registradas para {selectedCity}.</text>
                ) : (
                  stores.map((st, idx) => {
                    const isSel = idx === selectedIndex;
                    const dist = st.distanceInKm ? ` (~${st.distanceInKm.toFixed(1)} km)` : "";
                    return (
                      <box key={idx} flexDirection="column" marginBottom={1}>
                        <text fg={isSel ? "yellow" : "white"}>
                          <strong>{isSel ? "▶ " : "  "}{st.name}{dist}</strong>
                        </text>
                        <text fg="gray">{"    "}{st.address.slice(0, 40)}</text>
                      </box>
                    );
                  })
                )
              )}

              {activeTab === "departments" && (
                departments.map((d, idx) => {
                  const isSel = idx === selectedIndex;
                  return (
                    <box key={idx} marginBottom={1}>
                      <text fg={isSel ? "yellow" : "white"}>
                        <strong>{isSel ? "▶ " : "  "}{d.name}</strong>
                      </text>
                      <text fg="green"> ({d.count} productos)</text>
                    </box>
                  );
                })
              )}

              {activeTab === "cities" && (
                cities.map((c, idx) => {
                  const isSel = idx === selectedIndex;
                  const isCurrent = c.cityId === selectedCity;
                  return (
                    <box key={idx} marginBottom={1}>
                      <text fg={isSel ? "yellow" : isCurrent ? "green" : "white"}>
                        <strong>{isSel ? "▶ " : "  "}[{c.cityId}] {c.name}</strong>
                      </text>
                      {isCurrent && <text fg="cyan"> (Activa)</text>}
                    </box>
                  );
                })
              )}
            </scrollbox>
          </box>

          {/* Panel Derecho: Vista Previa y Detalles */}
          <box width="50%" flexDirection="column" paddingLeft={1} border style={{ borderColor: "gray" }}>
            {activeTab === "products" && currentProduct && (
              <box flexDirection="column">
                <text fg="yellow"><strong>[DETALLE DEL PRODUCTO SELECCIONADO]</strong></text>
                <box height={1} />
                <text fg="white"><strong>{currentProduct.mediaDescription}</strong></text>
                <text fg="gray">Marca: {currentProduct.marca || "N/A"} | ID: #{currentProduct.id}</text>
                
                <box height={1} />
                <text fg="green"><strong>Precio Bs: {formatBs(currentProduct.fullPrice)}</strong></text>
                <text fg="yellow"><strong>Precio USD: {formatUsd(currentProduct.fullPrice, exchangeRate)}</strong></text>

                <box height={1} />
                {currentProduct.requirePrescription === "true" && (
                  <text fg="red"><strong>{NF.warning} Requiere Récipe Médico</strong></text>
                )}

                <box height={1} />
                <text fg="cyan"><strong>{NF.store} Tiendas con stock: {currentProduct.stores_with_stock?.length || 0}</strong></text>
                <text fg="gray">Ciudad activa: {selectedCity}</text>

                <box height={1} />
                <text fg="magenta"><strong>{NF.image} Presiona [p] o [i] para ver la foto en terminal!</strong></text>
                <text fg="gray">Presiona [Enter] para ver disponibilidad por farmacia.</text>
              </box>
            )}

            {activeTab === "stores" && stores[selectedIndex] && (
              <box flexDirection="column">
                <text fg="yellow"><strong>[INFORMACIÓN DE SUCURSAL]</strong></text>
                <box height={1} />
                <text fg="white"><strong>{stores[selectedIndex].name}</strong></text>
                <text fg="gray">ID Tienda: #{stores[selectedIndex].id}</text>
                <box height={1} />
                <text fg="cyan">Dirección:</text>
                <text fg="white">{stores[selectedIndex].address}</text>
              </box>
            )}

            {activeTab === "departments" && departments[selectedIndex] && (
              <box flexDirection="column">
                <text fg="yellow"><strong>[FILTRAR POR DEPARTAMENTO]</strong></text>
                <box height={1} />
                <text fg="white">Presiona [Enter] para filtrar los productos de la categoría: {departments[selectedIndex].name}</text>
              </box>
            )}

            {activeTab === "cities" && cities[selectedIndex] && (
              <box flexDirection="column">
                <text fg="yellow"><strong>[CAMBIO DE CIUDAD]</strong></text>
                <box height={1} />
                <text fg="white">Presiona [Enter] para seleccionar [{cities[selectedIndex].cityId}] {cities[selectedIndex].name} como tu ciudad principal.</text>
                <box height={1} />
                <text fg="gray">Esto actualizará automáticamente la consulta de stock en las farmacias de esa ciudad.</text>
              </box>
            )}
          </box>
        </box>
      )}

      {/* Footer con Hotkeys */}
      <box border marginTop={1} paddingX={1} flexDirection="row" justifyContent="space-between" style={{ borderColor: "cyan" }}>
        <text fg="yellow">
          <strong>[Tab/1-4] Vistas  |  [/] Buscar  |  [↑/↓] Navegar  |  [Enter] Detalle  |  [p/i] {NF.image} Foto  |  [c] Ciudad  |  [q] Salir</strong>
        </text>
      </box>
    </box>
  );
}

export async function renderTUI() {
  const renderer = await createCliRenderer();
  createRoot(renderer).render(<FarmatodoApp />);
}
