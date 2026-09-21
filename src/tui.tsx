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
import { getSpinnerFrames } from "./spinner";
import { loadConfig, saveConfig } from "./config";
import type { FarmatodoProduct, City, Store } from "./types";

// Paleta Corporativa Oficial de Farmatodo Venezuela
const THEME = {
  navy: "#002855",         // Azul marino Farmatodo
  navyDark: "#001633",     // Azul noche para contraste
  blueAccent: "#00A3E0",   // Celeste / Cyan de marca
  red: "#E31B23",          // Rojo oficial cruz médica
  gold: "#FFC72C",         // Amarillo dorado Farmatodo (Mundo Ofertas)
  white: "#FFFFFF",        // Blanco puro
  grayLight: "#CBD5E1",    // Gris claro texto secundario
  grayMuted: "#64748B",    // Gris tenue para metadatos
  grayDark: "#0F172A",     // Fondo oscuro
  borderNavy: "#1E3A8A",   // Borde azul elegante
  green: "#10B981",        // Verde stock disponible
  amber: "#F59E0B",        // Ámbar pocas unidades
  rxRed: "#EF4444"         // Rojo récipe médico
};

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
  const columns = Math.max(70, dims.width || 80);
  const rows = Math.max(20, dims.height || 24);
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

  // Búsqueda: Iniciamos VACÍO para mostrar recomendaciones/destacados de Farmatodo
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Navegación
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Modales
  const [detailModalProduct, setDetailModalProduct] = useState<FarmatodoProduct | null>(null);
  const [modalStockMap, setModalStockMap] = useState<{ store: Store; hasStock: boolean; isLowStock: boolean }[]>([]);
  const [showImageView, setShowImageView] = useState(false);
  const [imageArt, setImageArt] = useState<string>("");
  const [loadingImage, setLoadingImage] = useState(false);

  const [spinnerIdx, setSpinnerIdx] = useState(0);

  useEffect(() => {
    if (!loading && !loadingImage) return;
    const timer = setInterval(() => {
      setSpinnerIdx((prev) => (prev + 1) % spinnerFrames.length);
    }, 80);
    return () => clearInterval(timer);
  }, [loading, loadingImage, spinnerFrames.length]);

  // Carga inicial: Carga productos recomendados/destacados oficiales
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [rate, fetchedCities, initialSearch, fetchedStores, fetchedDepts] = await Promise.all([
        getExchangeRate(),
        fetchCities(),
        searchProducts({ query: "", hitsPerPage: 30 }),
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

  const executeSearch = async (term: string, dept = selectedDepartment) => {
    setLoading(true);
    try {
      const res = await searchProducts({
        query: term,
        department: dept || undefined,
        hitsPerPage: 30
      });
      setProducts(res.hits);
      setSelectedIndex(0);
    } catch (e) {
      console.error("Error al buscar:", e);
    } finally {
      setLoading(false);
    }
  };

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

  const openDetailModal = async (prod: FarmatodoProduct) => {
    setDetailModalProduct(prod);
    try {
      const map = await getProductStockInStores(prod, selectedCity);
      setModalStockMap(map);
    } catch (e) {
      setModalStockMap([]);
    }
  };

  const openTerminalImage = async (prod: FarmatodoProduct) => {
    if (!prod || !prod.mediaImageUrl) return;
    setShowImageView(true);
    setLoadingImage(true);
    try {
      const targetWidth = Math.max(28, Math.min(columns - 14, 46));
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
    if (isSearching) {
      if (event.name === "escape") {
        setIsSearching(false);
        setSearchInput("");
        return;
      }
      if (event.name === "return" || event.name === "enter") {
        setIsSearching(false);
        const trimmed = searchInput.trim();
        setSearchQuery(trimmed);
        executeSearch(trimmed);
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

    if (event.name === "q") {
      renderer.destroy();
      process.exit(0);
      return;
    }

    if (event.name === "r") {
      setSearchQuery("");
      setSelectedDepartment("");
      loadInitialData();
      return;
    }

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

    if (event.name === "/" || event.name === "s") {
      setIsSearching(true);
      setSearchInput("");
      return;
    }

    if (event.name === "p" || event.name === "i") {
      if (currentProduct) openTerminalImage(currentProduct);
      return;
    }

    if (event.name === "o") {
      if (currentProduct?.mediaImageUrl) openImageInBrowser(currentProduct.mediaImageUrl);
      return;
    }

    if (event.name === "up" || event.name === "k") {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (event.name === "down" || event.name === "j") {
      setSelectedIndex((prev) => Math.min(currentListLength - 1, prev + 1));
      return;
    }

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

  // Cálculo milimétrico de alturas para eliminar el desbordamiento:
  // Altura total: rows
  // Header: 3 filas
  // Barra de tabs: 2 filas (1 fila de tabs + 1 fila de separación)
  // Footer: 3 filas
  // Altura neta disponible: rows - 8 filas
  const contentHeight = Math.max(8, rows - 8);
  const innerListHeight = Math.max(6, contentHeight - 2); // restando bordes

  // Paginación en ventana deslizante
  const itemRowHeight = 2;
  const maxVisibleItems = Math.max(2, Math.floor(innerListHeight / itemRowHeight));
  const scrollOffset = Math.min(
    Math.max(0, selectedIndex - Math.floor(maxVisibleItems / 2)),
    Math.max(0, currentListLength - maxVisibleItems)
  );

  // 1. VISOR DE FOTO EN TERMINAL
  if (showImageView) {
    const prod = detailModalProduct || currentProduct;
    return (
      <box width={columns} height={rows} flexDirection="column" border borderStyle="rounded" borderColor={THEME.blueAccent}>
        <box height={1} paddingX={1} flexDirection="row" justifyContent="space-between">
          <text fg={THEME.gold}>
            <strong>[FOTO] {prod?.mediaDescription?.toUpperCase()}</strong>
          </text>
          <text fg={THEME.blueAccent}><strong>ID: #{prod?.id}</strong></text>
        </box>

        <box flexGrow={1} justifyContent="center" alignItems="center" flexDirection="column" overflow="hidden">
          {loadingImage ? (
            <text fg={THEME.blueAccent}><strong>{currentSpinnerFrame} Descargando imagen oficial...</strong></text>
          ) : (
            <scrollbox height={Math.max(6, rows - 6)}>
              <text fg={THEME.white}>{imageArt}</text>
            </scrollbox>
          )}
        </box>

        <box height={1} paddingX={1} backgroundColor={THEME.navy} flexDirection="row" justifyContent="space-between">
          <text fg={THEME.white}><strong>[Esc/q] Volver  |  [o] Abrir en navegador</strong></text>
          <text fg={THEME.gold}><strong>Farmatodo VE</strong></text>
        </box>
      </box>
    );
  }

  // 2. MODAL DE DETALLE COMPLETO
  if (detailModalProduct) {
    const priceBs = formatBs(detailModalProduct.fullPrice);
    const priceUsd = formatUsd(detailModalProduct.fullPrice, exchangeRate);
    const hasRx = detailModalProduct.requirePrescription === "true" || detailModalProduct.requirePrescription === true;
    const availableStores = modalStockMap.filter((s) => s.hasStock);

    return (
      <box width={columns} height={rows} flexDirection="column">
        {/* Cabecera modal */}
        <box height={3} border borderStyle="rounded" borderColor={THEME.blueAccent} paddingX={1} flexDirection="row" justifyContent="space-between" alignItems="center">
          <text fg={THEME.white}>
            <span fg={THEME.red}><strong>[+] </strong></span>
            <strong>{detailModalProduct.mediaDescription}</strong>
            <span fg={THEME.grayMuted}> | {detailModalProduct.marca || "Laboratorio"}</span>
          </text>
          <text fg={THEME.gold}><strong>ID: #{detailModalProduct.id}</strong></text>
        </box>

        {/* Paneles del modal */}
        <box height={contentHeight} flexDirection="row">
          <box width="50%" border borderStyle="rounded" borderColor={THEME.borderNavy} paddingX={1} flexDirection="column">
            <text fg={THEME.blueAccent}><strong>[PRECIO Y TASA OFICIAL]</strong></text>
            <text fg={THEME.green}><strong>{priceBs}</strong></text>
            <text fg={THEME.gold}><strong>{priceUsd}</strong></text>
            <text fg={THEME.grayMuted}>Tasa oficial: Bs. {exchangeRate.toFixed(2)} / $</text>

            <box height={1} />
            {hasRx && (
              <text fg={THEME.rxRed}><strong>[!] REQUIERE RÉCIPE MÉDICO OBLIGATORIO</strong></text>
            )}

            <box height={1} />
            <text fg={THEME.blueAccent}><strong>[CATEGORÍA]</strong></text>
            <text fg={THEME.grayLight}>Depto: {detailModalProduct.departments?.join(", ") || "General"}</text>
            <text fg={THEME.grayLight}>Rubro: {detailModalProduct.subCategory || "General"}</text>

            <box height={1} />
            <text fg={THEME.gold}><strong>[p] o [i]: Ver foto en terminal</strong></text>
            <text fg={THEME.grayMuted}>[o]: Abrir imagen en navegador web</text>
          </box>

          <box width="50%" border borderStyle="rounded" borderColor={THEME.borderNavy} paddingX={1} flexDirection="column">
            <text fg={THEME.green}><strong>[SUCURSALES EN {selectedCity}]</strong></text>
            <scrollbox height={innerListHeight - 2}>
              {modalStockMap.length === 0 ? (
                <text fg={THEME.grayMuted}>Consultando disponibilidad...</text>
              ) : availableStores.length === 0 ? (
                <text fg={THEME.rxRed}>Sin unidades disponibles en farmacias de {selectedCity}</text>
              ) : (
                modalStockMap.map(({ store, hasStock, isLowStock }, idx) => (
                  <box key={idx} flexDirection="column" marginBottom={1}>
                    <text fg={hasStock ? (isLowStock ? THEME.amber : THEME.green) : THEME.grayMuted}>
                      <strong>{hasStock ? (isLowStock ? "▲ [Pocas un.] " : "✔ [Disponible] ") : "✖ [Agotado] "}{store.name}</strong>
                    </text>
                    <text fg={THEME.grayMuted}>{"  "}{store.address.slice(0, 48)}</text>
                  </box>
                ))
              )}
            </scrollbox>
          </box>
        </box>

        {/* Footer modal */}
        <box height={3} border borderStyle="rounded" borderColor={THEME.blueAccent} paddingX={1} flexDirection="row" justifyContent="space-between" alignItems="center">
          <text fg={THEME.white}><strong>[Esc/q] Volver a la lista  |  [p/i] Ver foto  |  [o] Web</strong></text>
          <text fg={THEME.blueAccent}><strong>Ciudad: {selectedCity}</strong></text>
        </box>
      </box>
    );
  }

  // 3. DASHBOARD PRINCIPAL
  const isRecommendedMode = !searchQuery && !selectedDepartment;

  return (
    <box width={columns} height={rows} flexDirection="column">
      {/* Cabecera Principal Limpia y Sin Solapamientos (3 filas fijas) */}
      <box height={3} border borderStyle="rounded" borderColor={THEME.blueAccent} paddingX={1} flexDirection="row" justifyContent="space-between" alignItems="center">
        <box flexDirection="row">
          <text fg={THEME.red}><strong>[+] </strong></text>
          <text fg={THEME.blueAccent}><strong>FARMATODO VENEZUELA</strong></text>
          <text fg={THEME.grayMuted}>  |  Tasa BCV: </text>
          <text fg={THEME.gold}><strong>Bs. {exchangeRate.toFixed(2)}/$</strong></text>
        </box>
        <box flexDirection="row">
          <text fg={THEME.grayMuted}>Ciudad: </text>
          <text fg={THEME.white}><strong>[{selectedCity}]</strong></text>
          <text fg={THEME.grayMuted}>  (Presiona </text>
          <text fg={THEME.gold}><strong>[c]</strong></text>
          <text fg={THEME.grayMuted}>)</text>
        </box>
      </box>

      {/* Barra de Pestañas Tipo Botón (Pill Buttons) con Espaciado Elegante */}
      <box height={1} marginY={1} flexDirection="row" justifyContent="space-between" alignItems="center">
        <box flexDirection="row">
          <box paddingX={1} style={{ backgroundColor: activeTab === "products" ? THEME.navy : THEME.navyDark }}>
            <text fg={activeTab === "products" ? THEME.gold : THEME.grayMuted}>
              <strong>[1] {searchQuery ? "Búsqueda" : "Recomendados"}</strong>
            </text>
          </box>
          <box width={1} />
          <box paddingX={1} style={{ backgroundColor: activeTab === "stores" ? THEME.navy : THEME.navyDark }}>
            <text fg={activeTab === "stores" ? THEME.gold : THEME.grayMuted}>
              <strong>[2] Farmacias</strong>
            </text>
          </box>
          <box width={1} />
          <box paddingX={1} style={{ backgroundColor: activeTab === "departments" ? THEME.navy : THEME.navyDark }}>
            <text fg={activeTab === "departments" ? THEME.gold : THEME.grayMuted}>
              <strong>[3] Deptos</strong>
            </text>
          </box>
          <box width={1} />
          <box paddingX={1} style={{ backgroundColor: activeTab === "cities" ? THEME.navy : THEME.navyDark }}>
            <text fg={activeTab === "cities" ? THEME.gold : THEME.grayMuted}>
              <strong>[4] Ciudades</strong>
            </text>
          </box>
        </box>

        {/* Buscador o indicador */}
        <box paddingX={1}>
          {isSearching ? (
            <text fg={THEME.gold}>
              <strong>¿Qué buscas?: [{searchInput}_] </strong>
              <span fg={THEME.grayMuted}>(Enter: Buscar, Esc: Cancelar)</span>
            </text>
          ) : searchQuery ? (
            <text fg={THEME.blueAccent}>
              <span fg={THEME.grayMuted}>Filtro: </span>
              <strong>"{searchQuery}"</strong>
              <span fg={THEME.grayMuted}> [Presiona / para cambiar]</span>
            </text>
          ) : (
            <text fg={THEME.grayMuted}>
              Presiona <span fg={THEME.gold}><strong>[/]</strong></span> para buscar cualquier producto
            </text>
          )}
        </box>
      </box>

      {/* Contenido Central: Panel Dividido */}
      {loading ? (
        <box height={contentHeight} justifyContent="center" alignItems="center" flexDirection="column">
          <text fg={THEME.blueAccent}><strong>{currentSpinnerFrame} Consultando catálogo oficial de Farmatodo...</strong></text>
        </box>
      ) : (
        <box height={contentHeight} flexDirection="row">
          {/* Panel Izquierdo: Lista con Scroll Windowed (0% Desbordamiento) */}
          <box width="50%" height={contentHeight} border borderStyle="rounded" borderColor={THEME.borderNavy} paddingX={1} flexDirection="column" overflow="hidden">
            <box height={1} marginBottom={1} flexDirection="row" justifyContent="space-between">
              <text fg={THEME.blueAccent}>
                <strong>
                  {activeTab === "products" && (isRecommendedMode ? `DESTACADOS Y RECOMENDADOS` : `RESULTADOS (${products.length})`)}
                  {activeTab === "stores" && `FARMACIAS EN ${selectedCity} (${stores.length})`}
                  {activeTab === "departments" && `DEPARTAMENTOS (${departments.length})`}
                  {activeTab === "cities" && `CIUDADES (${cities.length})`}
                </strong>
              </text>
              <text fg={THEME.grayMuted}>
                {currentListLength > 0 ? `${selectedIndex + 1}/${currentListLength}` : "0/0"}
              </text>
            </box>

            <box flexGrow={1} flexDirection="column" overflow="hidden">
              {/* TAB 1: PRODUCTOS */}
              {activeTab === "products" && (
                products.length === 0 ? (
                  <text fg={THEME.amber}>No se encontraron productos. Presiona [/] para buscar.</text>
                ) : (
                  products.slice(scrollOffset, scrollOffset + maxVisibleItems).map((p, relIdx) => {
                    const absIdx = scrollOffset + relIdx;
                    const isSel = absIdx === selectedIndex;
                    const priceBs = formatBs(p.fullPrice);
                    const priceUsd = formatUsd(p.fullPrice, exchangeRate);
                    const stockCount = p.stores_with_stock?.length || 0;
                    const stockText = stockCount > 0 ? `✔ ${stockCount} tiendas` : "✖ Sin stock";

                    return (
                      <box key={p.id} flexDirection="column" marginBottom={1}>
                        <text fg={isSel ? THEME.gold : THEME.white}>
                          <strong>{isSel ? "▸ " : "  "}{p.mediaDescription.slice(0, 36)}</strong>
                        </text>
                        <text fg={isSel ? THEME.blueAccent : THEME.grayMuted}>
                          {"    "}{priceBs} ({priceUsd})  •  {stockText}
                        </text>
                      </box>
                    );
                  })
                )
              )}

              {/* TAB 2: FARMACIAS */}
              {activeTab === "stores" && (
                stores.length === 0 ? (
                  <text fg={THEME.amber}>No hay farmacias registradas para {selectedCity}.</text>
                ) : (
                  stores.slice(scrollOffset, scrollOffset + maxVisibleItems).map((st, relIdx) => {
                    const absIdx = scrollOffset + relIdx;
                    const isSel = absIdx === selectedIndex;
                    const dist = st.distanceInKm ? ` (~${st.distanceInKm.toFixed(1)} km)` : "";
                    return (
                      <box key={st.id} flexDirection="column" marginBottom={1}>
                        <text fg={isSel ? THEME.gold : THEME.white}>
                          <strong>{isSel ? "▸ " : "  "}{st.name}{dist}</strong>
                        </text>
                        <text fg={THEME.grayMuted}>{"    "}{st.address.slice(0, 38)}</text>
                      </box>
                    );
                  })
                )
              )}

              {/* TAB 3: DEPARTAMENTOS */}
              {activeTab === "departments" && (
                departments.slice(scrollOffset, scrollOffset + (maxVisibleItems * 2)).map((d, relIdx) => {
                  const absIdx = scrollOffset + relIdx;
                  const isSel = absIdx === selectedIndex;
                  return (
                    <box key={d.name} marginBottom={1}>
                      <text fg={isSel ? THEME.gold : THEME.white}>
                        <strong>{isSel ? "▸ " : "  "}{d.name}</strong>
                      </text>
                      <text fg={THEME.blueAccent}> ({d.count})</text>
                    </box>
                  );
                })
              )}

              {/* TAB 4: CIUDADES */}
              {activeTab === "cities" && (
                cities.slice(scrollOffset, scrollOffset + (maxVisibleItems * 2)).map((c, relIdx) => {
                  const absIdx = scrollOffset + relIdx;
                  const isSel = absIdx === selectedIndex;
                  const isCurrent = c.cityId === selectedCity;
                  return (
                    <box key={c.cityId} marginBottom={1}>
                      <text fg={isSel ? THEME.gold : isCurrent ? THEME.green : THEME.white}>
                        <strong>{isSel ? "▸ " : "  "}[{c.cityId}] {c.name}</strong>
                      </text>
                      {isCurrent && <text fg={THEME.blueAccent}> (Activa)</text>}
                    </box>
                  );
                })
              )}
            </box>
          </box>

          {/* Panel Derecho: Ficha del Producto o Banner de Bienvenida */}
          <box width="50%" height={contentHeight} border borderStyle="rounded" borderColor={THEME.borderNavy} paddingX={1} flexDirection="column" overflow="hidden">
            {activeTab === "products" && currentProduct && (
              <box flexDirection="column">
                <text fg={THEME.blueAccent}>
                  <strong>{isRecommendedMode ? "[PRODUCTO RECOMENDADO]" : "[FICHA DEL PRODUCTO]"}</strong>
                </text>
                <box height={1} />
                <text fg={THEME.white}><strong>{currentProduct.mediaDescription}</strong></text>
                <text fg={THEME.grayMuted}>Marca: {currentProduct.marca || "N/A"} | ID: #{currentProduct.id}</text>
                
                <box height={1} />
                <text fg={THEME.green}><strong>Precio: {formatBs(currentProduct.fullPrice)}</strong></text>
                <text fg={THEME.gold}><strong>Equivalente: {formatUsd(currentProduct.fullPrice, exchangeRate)}</strong></text>

                {currentProduct.requirePrescription === "true" && (
                  <box marginTop={1}>
                    <text fg={THEME.rxRed}><strong>[!] Medicamento con Récipe Médico</strong></text>
                  </box>
                )}

                <box height={1} />
                <text fg={THEME.blueAccent}>
                  <strong>Disponibilidad: {currentProduct.stores_with_stock?.length || 0} sucursales</strong>
                </text>
                <text fg={THEME.grayMuted}>Ciudad: {selectedCity}</text>

                <box height={1} />
                <text fg={THEME.gold}><strong>[p] o [i]: Ver fotografía oficial</strong></text>
                <text fg={THEME.grayLight}>[Enter]: Consultar farmacias con stock en {selectedCity}</text>
                
                {isRecommendedMode && (
                  <box marginTop={1} border borderStyle="single" borderColor={THEME.borderNavy} paddingX={1}>
                    <text fg={THEME.grayMuted}>Tip: Presiona <span fg={THEME.gold}>[/]</span> para buscar cualquier producto específico.</text>
                  </box>
                )}
              </box>
            )}

            {activeTab === "stores" && stores[selectedIndex] && (
              <box flexDirection="column">
                <text fg={THEME.blueAccent}><strong>[FARMACIA FARMATODO]</strong></text>
                <box height={1} />
                <text fg={THEME.white}><strong>{stores[selectedIndex].name}</strong></text>
                <text fg={THEME.grayMuted}>ID Tienda: #{stores[selectedIndex].id}</text>
                <box height={1} />
                <text fg={THEME.blueAccent}>Dirección:</text>
                <text fg={THEME.grayLight}>{stores[selectedIndex].address}</text>
                <box height={1} />
                <text fg={THEME.green}>✔ Abierta con entrega y atención</text>
              </box>
            )}

            {activeTab === "departments" && departments[selectedIndex] && (
              <box flexDirection="column">
                <text fg={THEME.blueAccent}><strong>[DEPARTAMENTO]</strong></text>
                <box height={1} />
                <text fg={THEME.white}><strong>{departments[selectedIndex].name}</strong></text>
                <text fg={THEME.gold}>{departments[selectedIndex].count} productos registrados</text>
                <box height={1} />
                <text fg={THEME.grayLight}>Presiona [Enter] para filtrar el catálogo por este departamento.</text>
              </box>
            )}

            {activeTab === "cities" && cities[selectedIndex] && (
              <box flexDirection="column">
                <text fg={THEME.blueAccent}><strong>[CAMBIAR CIUDAD]</strong></text>
                <box height={1} />
                <text fg={THEME.white}><strong>{cities[selectedIndex].name} ({cities[selectedIndex].cityId})</strong></text>
                <text fg={THEME.grayMuted}>Tienda de cabecera: #{cities[selectedIndex].defaultStoreId}</text>
                <box height={1} />
                <text fg={THEME.gold}>Presiona [Enter] para activar esta ciudad.</text>
                <text fg={THEME.grayMuted}>El inventario y disponibilidad se calcularán para esta zona.</text>
              </box>
            )}
          </box>
        </box>
      )}

      {/* Footer Fijo con Hotkeys (3 filas exactas) */}
      <box height={3} border borderStyle="rounded" borderColor={THEME.blueAccent} paddingX={1} flexDirection="row" justifyContent="space-between" alignItems="center">
        <text fg={THEME.white}>
          <span fg={THEME.gold}><strong>[Tab/1-4]</strong></span> Vistas  |  
          <span fg={THEME.gold}><strong> [/]</strong></span> Buscar  |  
          <span fg={THEME.gold}><strong> [↑/↓]</strong></span> Navegar  |  
          <span fg={THEME.gold}><strong> [Enter]</strong></span> Detalle  |  
          <span fg={THEME.gold}><strong> [p/i]</strong></span> Foto  |  
          <span fg={THEME.gold}><strong> [c]</strong></span> Ciudad  |  
          <span fg={THEME.gold}><strong> [r]</strong></span> Inicio  |  
          <span fg={THEME.gold}><strong> [q]</strong></span> Salir
        </text>
        <text fg={THEME.blueAccent}><strong>Farmatodo VE</strong></text>
      </box>
    </box>
  );
}

export async function renderTUI() {
  const renderer = await createCliRenderer();
  createRoot(renderer).render(<FarmatodoApp />);
}
