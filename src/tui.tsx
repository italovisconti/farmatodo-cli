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

// Paleta Oficial de Colores Farmatodo
const THEME = {
  navy: "#002855",        // Azul marino institucional Farmatodo
  navyDark: "#001B3A",    // Azul noche para fondos
  blueAccent: "#00A3E0",  // Cyan / Celeste oficial
  red: "#E31B23",         // Rojo cruz médica Farmatodo
  gold: "#FFC72C",        // Amarillo dorado promociones
  white: "#FFFFFF",       // Blanco
  grayLight: "#E2E8F0",   // Gris claro texto secundario
  grayMuted: "#64748B",   // Gris pizarra tenue
  grayDark: "#1E293B",    // Gris oscuro
  borderNavy: "#1E3A8A",  // Borde azul corporativo
  borderActive: "#00A3E0",// Borde activo celeste
  green: "#10B981",       // Verde inventario disponible
  amber: "#F59E0B",       // Ámbar pocas unidades
  rxRed: "#EF4444"        // Rojo advertencia récipe
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
  const columns = Math.max(60, dims.width || 80);
  const rows = Math.max(18, dims.height || 24);
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

  // Navegación
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

  const [spinnerIdx, setSpinnerIdx] = useState(0);

  useEffect(() => {
    if (!loading && !loadingImage) return;
    const timer = setInterval(() => {
      setSpinnerIdx((prev) => (prev + 1) % spinnerFrames.length);
    }, 80);
    return () => clearInterval(timer);
  }, [loading, loadingImage, spinnerFrames.length]);

  // Carga inicial
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [rate, fetchedCities, initialSearch, fetchedStores, fetchedDepts] = await Promise.all([
        getExchangeRate(),
        fetchCities(),
        searchProducts({ query: searchQuery, hitsPerPage: 30 }),
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
      const targetWidth = Math.max(28, Math.min(columns - 12, 45));
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

  // Manejo de eventos de teclado
  useKeyboard((event: { name: string; sequence?: string }) => {
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

  // Cálculo estricto de alturas para evitar cualquier desbordamiento vertical
  // Estructura vertical fija:
  // - Header: 3 líneas
  // - Tab bar: 3 líneas
  // - Footer: 3 líneas
  // Altura total reservada = 9 líneas
  const availableContentHeight = Math.max(8, rows - 9);
  // Dentro del panel con borde (resta 2 filas por los bordes superior e inferior):
  const innerListHeight = Math.max(6, availableContentHeight - 2);

  // Paginación en ventana deslizante para que nunca sobrepase el contenedor
  const itemRowHeight = 2; // Cada producto ocupa exactamente 2 líneas
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
            <text fg={THEME.blueAccent}><strong>{currentSpinnerFrame} Descargando y procesando imagen en terminal...</strong></text>
          ) : (
            <scrollbox height={Math.max(6, rows - 6)}>
              <text fg={THEME.white}>{imageArt}</text>
            </scrollbox>
          )}
        </box>

        <box height={1} paddingX={1} backgroundColor={THEME.navy} flexDirection="row" justifyContent="space-between">
          <text fg={THEME.white}><strong>[Esc/q] Regresar a la lista  |  [o] Abrir en navegador web</strong></text>
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
            <span fg={THEME.grayMuted}> | Marca: {detailModalProduct.marca || "N/A"}</span>
          </text>
          <text fg={THEME.gold}><strong>ID: #{detailModalProduct.id}</strong></text>
        </box>

        {/* Contenido dividido modal */}
        <box height={availableContentHeight} flexDirection="row">
          {/* Lado izquierdo: Precios y Ficha */}
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
            <text fg={THEME.blueAccent}><strong>[CATÁLOGO]</strong></text>
            <text fg={THEME.grayLight}>Depto: {detailModalProduct.departments?.join(", ") || "General"}</text>
            <text fg={THEME.grayLight}>Rubro: {detailModalProduct.subCategory || "General"}</text>

            <box height={1} />
            <text fg={THEME.gold}><strong>[p] o [i]: Ver foto en terminal</strong></text>
            <text fg={THEME.grayMuted}>[o]: Abrir foto en navegador</text>
          </box>

          {/* Lado derecho: Sucursales con stock */}
          <box width="50%" border borderStyle="rounded" borderColor={THEME.borderNavy} paddingX={1} flexDirection="column">
            <text fg={THEME.green}><strong>[SUCURSALES EN {selectedCity}]</strong></text>
            <scrollbox height={innerListHeight - 2}>
              {modalStockMap.length === 0 ? (
                <text fg={THEME.grayMuted}>Consultando disponibilidad en farmacias...</text>
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

  // 3. DASHBOARD PRINCIPAL TUI
  return (
    <box width={columns} height={rows} flexDirection="column">
      {/* Cabecera Principal (3 filas exactas) */}
      <box height={3} border borderStyle="rounded" borderColor={THEME.blueAccent} paddingX={1} flexDirection="row" justifyContent="space-between" alignItems="center">
        <box flexDirection="row">
          <text fg={THEME.red}><strong>[+] </strong></text>
          <text fg={THEME.blueAccent}><strong>FARMATODO VENEZUELA</strong></text>
          <text fg={THEME.grayMuted}> | Medicamentos, Precios y Sucursales</text>
        </box>
        <box flexDirection="row">
          <text fg={THEME.gold}><strong>Tasa BCV: Bs. {exchangeRate.toFixed(2)}/$</strong></text>
          <text fg={THEME.grayMuted}>  |  </text>
          <text fg={THEME.blueAccent}><strong>Ciudad: [{selectedCity}]</strong></text>
        </box>
      </box>

      {/* Barra de Pestañas y Buscador (3 filas exactas) */}
      <box height={3} border borderStyle="rounded" borderColor={THEME.borderNavy} paddingX={1} flexDirection="row" justifyContent="space-between" alignItems="center">
        <box flexDirection="row">
          <text fg={activeTab === "products" ? THEME.gold : THEME.grayMuted}>
            <strong>[1] Productos</strong>
          </text>
          <text fg={THEME.grayMuted}> | </text>
          <text fg={activeTab === "stores" ? THEME.gold : THEME.grayMuted}>
            <strong>[2] Farmacias</strong>
          </text>
          <text fg={THEME.grayMuted}> | </text>
          <text fg={activeTab === "departments" ? THEME.gold : THEME.grayMuted}>
            <strong>[3] Deptos</strong>
          </text>
          <text fg={THEME.grayMuted}> | </text>
          <text fg={activeTab === "cities" ? THEME.gold : THEME.grayMuted}>
            <strong>[4] Ciudades</strong>
          </text>
        </box>

        <box>
          {isSearching ? (
            <text fg={THEME.gold}><strong>Buscar: [{searchInput}_] (Enter: buscar, Esc: cancelar)</strong></text>
          ) : (
            <text fg={THEME.blueAccent}>
              <span fg={THEME.grayMuted}>Filtro: </span>
              <strong>"{searchQuery}"</strong>
              <span fg={THEME.grayMuted}> [Presiona /]</span>
            </text>
          )}
        </box>
      </box>

      {/* Contenido Central: Panel Dividido con Control Estricto de Altura */}
      {loading ? (
        <box height={availableContentHeight} justifyContent="center" alignItems="center" flexDirection="column">
          <text fg={THEME.blueAccent}><strong>{currentSpinnerFrame} Consultando servicios de Farmatodo...</strong></text>
        </box>
      ) : (
        <box height={availableContentHeight} flexDirection="row">
          {/* Panel Izquierdo: Lista Paginada (Evita 100% el desbordamiento) */}
          <box width="50%" height={availableContentHeight} border borderStyle="rounded" borderColor={THEME.borderNavy} paddingX={1} flexDirection="column" overflow="hidden">
            <box height={1} marginBottom={1} flexDirection="row" justifyContent="space-between">
              <text fg={THEME.blueAccent}>
                <strong>
                  {activeTab === "products" && `PRODUCTOS (${products.length})`}
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
                  <text fg={THEME.amber}>No hay resultados para "{searchQuery}". Presiona [/] para buscar.</text>
                ) : (
                  products.slice(scrollOffset, scrollOffset + maxVisibleItems).map((p, relIdx) => {
                    const absIdx = scrollOffset + relIdx;
                    const isSel = absIdx === selectedIndex;
                    const priceBs = formatBs(p.fullPrice);
                    const priceUsd = formatUsd(p.fullPrice, exchangeRate);
                    const stockCount = p.stores_with_stock?.length || 0;
                    const stockText = stockCount > 0 ? `✔ ${stockCount} tiend.` : "✖ Sin stock";

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

          {/* Panel Derecho: Tarjeta de Ficha y Vista Previa */}
          <box width="50%" height={availableContentHeight} border borderStyle="rounded" borderColor={THEME.borderNavy} paddingX={1} flexDirection="column" overflow="hidden">
            {activeTab === "products" && currentProduct && (
              <box flexDirection="column">
                <text fg={THEME.blueAccent}><strong>[INFORMACIÓN DEL MEDICAMENTO]</strong></text>
                <box height={1} />
                <text fg={THEME.white}><strong>{currentProduct.mediaDescription}</strong></text>
                <text fg={THEME.grayMuted}>Marca: {currentProduct.marca || "N/A"} | ID: #{currentProduct.id}</text>
                
                <box height={1} />
                <text fg={THEME.green}><strong>Precio Bs: {formatBs(currentProduct.fullPrice)}</strong></text>
                <text fg={THEME.gold}><strong>Precio USD: {formatUsd(currentProduct.fullPrice, exchangeRate)}</strong></text>

                {currentProduct.requirePrescription === "true" && (
                  <box marginTop={1}>
                    <text fg={THEME.rxRed}><strong>[!] Requiere Récipe Médico Obligatorio</strong></text>
                  </box>
                )}

                <box height={1} />
                <text fg={THEME.blueAccent}>
                  <strong>Disponibilidad: {currentProduct.stores_with_stock?.length || 0} sucursales activas</strong>
                </text>
                <text fg={THEME.grayMuted}>Ciudad consultada: {selectedCity}</text>

                <box height={1} />
                <text fg={THEME.gold}><strong>[p] o [i]: Ver fotografía oficial en terminal</strong></text>
                <text fg={THEME.grayLight}>[Enter]: Ver desglose de farmacias con stock</text>
              </box>
            )}

            {activeTab === "stores" && stores[selectedIndex] && (
              <box flexDirection="column">
                <text fg={THEME.blueAccent}><strong>[SUCURSAL FARMATODO]</strong></text>
                <box height={1} />
                <text fg={THEME.white}><strong>{stores[selectedIndex].name}</strong></text>
                <text fg={THEME.grayMuted}>ID Sucursal: #{stores[selectedIndex].id}</text>
                <box height={1} />
                <text fg={THEME.blueAccent}>Dirección:</text>
                <text fg={THEME.grayLight}>{stores[selectedIndex].address}</text>
                <box height={1} />
                <text fg={THEME.green}>✔ Servicio Farmacéutico y Convenios</text>
              </box>
            )}

            {activeTab === "departments" && departments[selectedIndex] && (
              <box flexDirection="column">
                <text fg={THEME.blueAccent}><strong>[FILTRAR POR DEPARTAMENTO]</strong></text>
                <box height={1} />
                <text fg={THEME.white}><strong>{departments[selectedIndex].name}</strong></text>
                <text fg={THEME.gold}>{departments[selectedIndex].count} productos en catálogo</text>
                <box height={1} />
                <text fg={THEME.grayLight}>Presiona [Enter] para cargar los productos de este departamento.</text>
              </box>
            )}

            {activeTab === "cities" && cities[selectedIndex] && (
              <box flexDirection="column">
                <text fg={THEME.blueAccent}><strong>[SELECCIÓN DE CIUDAD]</strong></text>
                <box height={1} />
                <text fg={THEME.white}><strong>{cities[selectedIndex].name} ({cities[selectedIndex].cityId})</strong></text>
                <text fg={THEME.grayMuted}>Tienda principal: #{cities[selectedIndex].defaultStoreId}</text>
                <box height={1} />
                <text fg={THEME.gold}>Presiona [Enter] para establecer como tu ciudad.</text>
                <text fg={THEME.grayMuted}>El inventario y disponibilidad se adaptarán a esta ubicación.</text>
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
          <span fg={THEME.gold}><strong> [q]</strong></span> Salir
        </text>
        <text fg={THEME.blueAccent}><strong>v1.0.0</strong></text>
      </box>
    </box>
  );
}

export async function renderTUI() {
  const renderer = await createCliRenderer();
  createRoot(renderer).render(<FarmatodoApp />);
}
