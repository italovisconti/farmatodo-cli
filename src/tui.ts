import {
  createCliRenderer,
  BoxRenderable,
  TextRenderable,
  ImageRenderable,
  type CliRenderer
} from "@opentui/core";
import {
  searchProducts,
  getProductById,
  getExchangeRate,
  fetchCities,
  fetchNearbyStores,
  getProductStockInStores,
  getDepartments,
  getProductOfferInfo,
  fetchOffers
} from "./api";
import {
  renderProductImage,
  openImageInBrowser,
  clearKittyImages,
  getCachedNativeImage,
  preloadNativeImage
} from "./image";
import { loadConfig, saveConfig } from "./config";
import { getGlyphs } from "./glyphs";
import type { FarmatodoProduct, City, Store } from "./types";

const G = getGlyphs();

// Paleta Corporativa Oficial Farmatodo Venezuela
export const THEME = {
  navy: "#002855",
  navyDark: "#001633",
  blueAccent: "#00A3E0",
  red: "#E31B23",
  gold: "#FFC72C",
  white: "#FFFFFF",
  grayLight: "#CBD5E1",
  grayMuted: "#64748B",
  grayDark: "#0F172A",
  borderNavy: "#1E3A8A",
  green: "#10B981",
  amber: "#F59E0B",
  rxRed: "#EF4444"
};

function formatBs(val: number): string {
  return `Bs. ${Number(val).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUsd(bs: number, rate: number): string {
  if (!rate || rate <= 0) return "$0.00";
  const usd = bs / rate;
  return `$${usd.toFixed(2)} USD`;
}

function wrapText(text: string, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + " " + word).length <= maxWidth) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function clearBox(box: BoxRenderable) {
  const children = [...box.getChildren()];
  for (const child of children) {
    box.remove(child);
    try {
      (child as any).destroy?.();
    } catch (_) {}
  }
}


export class FarmatodoTUI {
  renderer: CliRenderer;
  config = loadConfig();

  // Estado
  loading = true;
  exchangeRate = 850.0;
  selectedCity = this.config.defaultCity || "CCS";
  activeTab: "products" | "offers" | "stores" | "departments" | "cities" = "products";

  products: FarmatodoProduct[] = [];
  offers: FarmatodoProduct[] = [];
  stores: Store[] = [];
  cities: City[] = [];
  departments: { name: string; count: number }[] = [];
  selectedDepartment = "";

  selectedIndex = 0;
  searchQuery = ""; // Inicia sin búsqueda previa para mostrar destacados/recomendados
  searchInput = "";
  isSearching = false;

  detailModalProduct: FarmatodoProduct | null = null;
  modalStockMap: { store: Store; hasStock: boolean; isLowStock: boolean }[] = [];
  showImageView = false;
  imageArt = "";
  loadingImage = false;

  // Nodos UI persistentes de OpenTUI Core
  rootBox: BoxRenderable;
  headerBox: BoxRenderable;
  headerLeftText: TextRenderable;
  headerRightText: TextRenderable;

  tabBarBox: BoxRenderable;
  contentBox: BoxRenderable;
  leftListBox: BoxRenderable;
  rightDetailBox: BoxRenderable;

  footerBox: BoxRenderable;
  footerText: TextRenderable;

  modalContainer: BoxRenderable;

  constructor(renderer: CliRenderer) {
    this.renderer = renderer;

    // 1. Root container (fills terminal viewport exactly)
    this.rootBox = new BoxRenderable(renderer, {
      id: "root",
      width: "100%",
      height: "100%",
      flexDirection: "column"
    });

    // 2. Cabecera (3 líneas fijas con bordes redondeados)
    this.headerBox = new BoxRenderable(renderer, {
      id: "header",
      height: 3,
      border: true,
      borderStyle: "rounded",
      borderColor: THEME.blueAccent,
      paddingX: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center"
    });

    this.headerLeftText = new TextRenderable(renderer, {
      content: "[+] FARMATODO VENEZUELA | Tasa BCV: ...",
      fg: THEME.white
    });

    this.headerRightText = new TextRenderable(renderer, {
      content: "Ciudad: [CCS] (Presiona [c])",
      fg: THEME.grayMuted
    });

    this.headerBox.add(this.headerLeftText);
    this.headerBox.add(this.headerRightText);

    // 3. Barra de Tabs / Buscador (1 fila de altura)
    this.tabBarBox = new BoxRenderable(renderer, {
      id: "tabBar",
      height: 1,
      marginY: 1,
      flexDirection: "row",
      flexWrap: "nowrap",
      justifyContent: "space-between",
      alignItems: "center"
    });

    // 4. Contenido Central Dividido (FlexGrow para llenar el espacio vertical restante)
    this.contentBox = new BoxRenderable(renderer, {
      id: "contentArea",
      flexGrow: 1,
      flexDirection: "row",
      overflow: "hidden"
    });

    this.leftListBox = new BoxRenderable(renderer, {
      id: "leftList",
      width: "50%",
      height: "100%",
      border: true,
      borderStyle: "rounded",
      borderColor: THEME.borderNavy,
      paddingX: 1,
      flexDirection: "column",
      overflow: "hidden"
    });

    this.rightDetailBox = new BoxRenderable(renderer, {
      id: "rightDetail",
      width: "50%",
      height: "100%",
      border: true,
      borderStyle: "rounded",
      borderColor: THEME.borderNavy,
      paddingX: 1,
      flexDirection: "column",
      overflow: "hidden"
    });

    this.contentBox.add(this.leftListBox);
    this.contentBox.add(this.rightDetailBox);

    // 5. Footer (3 líneas fijas con atajos de teclado)
    this.footerBox = new BoxRenderable(renderer, {
      id: "footer",
      height: 3,
      border: true,
      borderStyle: "rounded",
      borderColor: THEME.blueAccent,
      paddingX: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center"
    });

    this.footerText = new TextRenderable(renderer, {
      content: `[Tab/1-5] Vistas  •  ${G.search} [/] Buscar  •  ▲▼ Navegar  •  ${G.enter} Detalle  •  ${G.camera} [p/i] Foto  •  ${G.city} [c] Ciudad  •  ${G.exit} [q] Salir`,
      fg: THEME.white
    });

    this.footerBox.add(this.footerText);

    // 6. Modal container (superpuesto a pantalla completa cuando esté activo)
    this.modalContainer = new BoxRenderable(renderer, {
      id: "modalContainer",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      visible: false
    });

    // Ensamblar árbol
    this.rootBox.add(this.headerBox);
    this.rootBox.add(this.tabBarBox);
    this.rootBox.add(this.contentBox);
    this.rootBox.add(this.footerBox);

    renderer.root.add(this.rootBox);
    renderer.root.add(this.modalContainer);

    this.setupKeybindings();
  }

  setupKeybindings() {
    this.renderer.keyInput.on("keypress", async (event: any) => {
      // 1. Modo escritura en buscador
      if (this.isSearching) {
        if (event.name === "escape") {
          this.isSearching = false;
          this.searchInput = "";
          this.updateView();
          return;
        }
        if (event.name === "return" || event.name === "enter") {
          this.isSearching = false;
          const query = this.searchInput.trim();
          this.searchQuery = query;
          this.searchInput = "";
          await this.executeSearch(query);
          return;
        }
        if (event.name === "backspace") {
          this.searchInput = this.searchInput.slice(0, -1);
          this.updateTabBar();
          this.renderer.requestRender();
          return;
        }
        if (event.sequence && event.sequence.length === 1 && /^[\w\s\-\.\,\á\é\í\ó\ú\ñ]$/i.test(event.sequence)) {
          this.searchInput += event.sequence;
          this.updateTabBar();
          this.renderer.requestRender();
          return;
        }
        return;
      }

      // 2. Visor de imagen activo
      if (this.showImageView) {
        if (event.name === "escape" || event.name === "p" || event.name === "i" || event.name === "q") {
          this.showImageView = false;
          clearKittyImages();
          this.updateModal();
          return;
        }
        if (event.name === "o") {
          const prod = this.detailModalProduct || this.getCurrentProduct();
          if (prod?.mediaImageUrl) openImageInBrowser(prod.mediaImageUrl);
          return;
        }
        return;
      }

      // 3. Modal de detalle activo
      if (this.detailModalProduct) {
        if (event.name === "escape" || event.name === "q") {
          this.detailModalProduct = null;
          clearKittyImages();
          this.updateModal();
          return;
        }
        if (event.name === "p" || event.name === "i") {
          await this.openTerminalImage(this.detailModalProduct);
          return;
        }
        if (event.name === "o") {
          if (this.detailModalProduct.mediaImageUrl) openImageInBrowser(this.detailModalProduct.mediaImageUrl);
          return;
        }
        return;
      }

      // 4. Controles globales
      if (event.name === "q") {
        clearKittyImages();
        this.renderer.destroy();
        process.exit(0);
        return;
      }

      if (event.name === "r") {
        this.searchQuery = "";
        this.selectedDepartment = "";
        await this.loadInitialData();
        return;
      }

      if (event.name === "tab") {
        if (this.activeTab === "products") this.activeTab = "offers";
        else if (this.activeTab === "offers") this.activeTab = "stores";
        else if (this.activeTab === "stores") this.activeTab = "departments";
        else if (this.activeTab === "departments") this.activeTab = "cities";
        else this.activeTab = "products";
        this.selectedIndex = 0;
        this.updateView();
        return;
      }

      if (event.name === "1") { this.activeTab = "products"; this.selectedIndex = 0; this.updateView(); return; }
      if (event.name === "2") { this.activeTab = "offers"; this.selectedIndex = 0; this.updateView(); return; }
      if (event.name === "3") { this.activeTab = "stores"; this.selectedIndex = 0; this.updateView(); return; }
      if (event.name === "4") { this.activeTab = "departments"; this.selectedIndex = 0; this.updateView(); return; }
      if (event.name === "5" || event.name === "c") { this.activeTab = "cities"; this.selectedIndex = 0; this.updateView(); return; }

      if (event.name === "/" || event.name === "s") {
        this.isSearching = true;
        this.searchInput = "";
        this.updateTabBar();
        this.renderer.requestRender();
        return;
      }

      const currentProd = this.getCurrentProduct();
      if (event.name === "p" || event.name === "i") {
        if (currentProd) await this.openTerminalImage(currentProd);
        return;
      }

      if (event.name === "o") {
        if (currentProd?.mediaImageUrl) openImageInBrowser(currentProd.mediaImageUrl);
        return;
      }

      const listLen = this.getCurrentListLength();
      if (event.name === "up" || event.name === "k") {
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.updateContentPanels();
        this.renderer.requestRender();
        return;
      }

      if (event.name === "down" || event.name === "j") {
        this.selectedIndex = Math.min(listLen - 1, this.selectedIndex + 1);
        this.updateContentPanels();
        this.renderer.requestRender();
        return;
      }

      if (event.name === "return" || event.name === "enter") {
        if (this.activeTab === "products" && this.products[this.selectedIndex]) {
          await this.openDetailModal(this.products[this.selectedIndex]!);
        } else if (this.activeTab === "offers" && this.offers[this.selectedIndex]) {
          await this.openDetailModal(this.offers[this.selectedIndex]!);
        } else if (this.activeTab === "departments" && this.departments[this.selectedIndex]) {
          const dept = this.departments[this.selectedIndex]!.name;
          this.selectedDepartment = dept;
          this.activeTab = "products";
          await this.executeSearch(this.searchQuery, dept);
        } else if (this.activeTab === "cities" && this.cities[this.selectedIndex]) {
          await this.handleCityChange(this.cities[this.selectedIndex]!.cityId);
        }
      }
    });
  }

  getCurrentListLength(): number {
    return this.activeTab === "products"
      ? this.products.length
      : this.activeTab === "offers"
      ? this.offers.length
      : this.activeTab === "stores"
      ? this.stores.length
      : this.activeTab === "departments"
      ? this.departments.length
      : this.cities.length;
  }

  getCurrentProduct(): FarmatodoProduct | null {
    if (this.activeTab === "products") return this.products[this.selectedIndex] || null;
    if (this.activeTab === "offers") return this.offers[this.selectedIndex] || null;
    return null;
  }

  async loadInitialData() {
    this.loading = true;
    this.updateView();

    try {
      const [rate, fetchedCities, initialSearch, fetchedOffers, fetchedStores, fetchedDepts] = await Promise.all([
        getExchangeRate(),
        fetchCities(),
        searchProducts({ query: "", hitsPerPage: 30 }),
        fetchOffers({ cityId: this.selectedCity, hitsPerPage: 40 }),
        fetchNearbyStores(this.selectedCity),
        getDepartments()
      ]);

      this.exchangeRate = rate;
      this.cities = fetchedCities;
      this.products = initialSearch.hits;
      this.offers = fetchedOffers.hits;
      this.stores = fetchedStores;
      this.departments = fetchedDepts;
    } catch (err) {
      console.error("Error al cargar datos en TUI:", err);
    } finally {
      this.loading = false;
      this.updateView();
    }
  }

  async executeSearch(term: string, dept = this.selectedDepartment) {
    this.loading = true;
    this.updateContentPanels();
    this.renderer.requestRender();

    try {
      const res = await searchProducts({
        query: term,
        department: dept || undefined,
        hitsPerPage: 30
      });
      this.products = res.hits;
      this.selectedIndex = 0;
    } catch (e) {
      console.error("Error al buscar:", e);
    } finally {
      this.loading = false;
      this.updateView();
    }
  }

  async handleCityChange(newCityId: string) {
    this.selectedCity = newCityId;
    saveConfig({ defaultCity: newCityId });
    try {
      this.stores = await fetchNearbyStores(newCityId);
    } catch (e) {}
    this.activeTab = "products";
    this.selectedIndex = 0;
    this.updateView();
  }

  async openDetailModal(prod: FarmatodoProduct) {
    this.detailModalProduct = prod;
    if (this.stores.length > 0) {
      const stockSet = new Set(prod.stores_with_stock || []);
      const lowStockSet = new Set(prod.stores_with_low_stock || []);
      this.modalStockMap = this.stores.map((store) => ({
        store,
        hasStock: stockSet.has(store.id) || lowStockSet.has(store.id),
        isLowStock: lowStockSet.has(store.id)
      }));
    } else {
      this.modalStockMap = [];
    }
    this.updateModal();

    try {
      const map = await getProductStockInStores(prod, this.selectedCity);
      if (map && map.length > 0) {
        this.modalStockMap = map;
        this.updateModal();
      }
    } catch (e) {}
  }

  async openTerminalImage(prod: FarmatodoProduct) {
    if (!prod || !prod.mediaImageUrl) return;
    clearKittyImages();
    this.showImageView = true;
    this.loadingImage = true;
    this.imageArt = "";
    this.updateModal();

    try {
      const cached = getCachedNativeImage(prod.mediaImageUrl);
      if (!cached) {
        await preloadNativeImage(prod.mediaImageUrl);
      }
      const targetWidth = Math.max(28, Math.min(this.renderer.width - 14, 46));
      this.imageArt = await renderProductImage(prod.mediaImageUrl, targetWidth);
    } catch (e) {
      this.imageArt = "[Error al renderizar imagen en cubos]";
    } finally {
      this.loadingImage = false;
      this.updateModal();
    }
  }

  // Actualización general de la interfaz
  updateView() {
    this.updateHeader();
    this.updateTabBar();
    this.updateContentPanels();
    this.updateModal();
    this.renderer.requestRender();
  }

  updateHeader() {
    this.headerLeftText.content = `${G.brand} FARMATODO VENEZUELA  |  ${G.lightning} Tasa BCV: Bs. ${this.exchangeRate.toFixed(2)} / $`;
    this.headerRightText.content = `${G.city} Ciudad: [${this.selectedCity}] (Presiona [c])`;
  }

  updateTabBar() {
    clearBox(this.tabBarBox);

    // Pill buttons de pestañas con iconos enriquecidos
    const tabs = [
      { id: "products", label: this.searchQuery ? `${G.search} [1] Búsqueda` : `${G.sparkles} [1] Catálogo` },
      { id: "offers", label: `${G.tag} [2] Ofertas` },
      { id: "stores", label: `${G.hospital} [3] Farmacias` },
      { id: "departments", label: `📁 [4] Deptos` },
      { id: "cities", label: `${G.city} [5] Ciudades` }
    ];

    const leftTabGroup = new BoxRenderable(this.renderer, {
      flexDirection: "row",
      flexWrap: "nowrap",
      flexShrink: 0
    });

    tabs.forEach((t) => {
      const isActive = this.activeTab === t.id;
      const btn = new BoxRenderable(this.renderer, {
        paddingX: 1,
        backgroundColor: isActive ? THEME.navy : THEME.navyDark,
        marginRight: 1,
        flexShrink: 0
      });
      const txt = new TextRenderable(this.renderer, {
        content: t.label,
        fg: isActive ? THEME.gold : THEME.grayMuted
      });
      btn.add(txt);
      leftTabGroup.add(btn);
    });

    this.tabBarBox.add(leftTabGroup);

    // Indicador o input del buscador
    const rightSearchBox = new BoxRenderable(this.renderer, {
      paddingX: 1
    });

    let searchContent = "";
    let searchColor = THEME.grayMuted;

    if (this.isSearching) {
      searchContent = `${G.search} [${this.searchInput}_] (Enter/Esc)`;
      searchColor = THEME.gold;
    } else if (this.searchQuery) {
      searchContent = `${G.search} "${this.searchQuery}" [/]`;
      searchColor = THEME.blueAccent;
    } else {
      searchContent = `${G.search} [/] Buscar`;
      searchColor = THEME.grayMuted;
    }

    const searchTxt = new TextRenderable(this.renderer, {
      content: searchContent,
      fg: searchColor
    });

    rightSearchBox.add(searchTxt);
    this.tabBarBox.add(rightSearchBox);
  }

  updateContentPanels() {
    clearBox(this.leftListBox);
    clearBox(this.rightDetailBox);

    if (this.loading) {
      const loadingTxt = new TextRenderable(this.renderer, {
        content: "Consultando catálogo oficial de Farmatodo...",
        fg: THEME.blueAccent
      });
      this.leftListBox.add(loadingTxt);
      return;
    }

    // Cálculo estricto de altura para ventana deslizante (0% desbordamiento)
    const availableHeight = Math.max(6, this.renderer.height - 11);
    const itemRowHeight = 3;
    const maxVisible = Math.max(2, Math.floor(availableHeight / itemRowHeight));

    const totalItems = this.getCurrentListLength();
    const scrollOffset = Math.min(
      Math.max(0, this.selectedIndex - Math.floor(maxVisible / 2)),
      Math.max(0, totalItems - maxVisible)
    );

    // --- PANEL IZQUIERDO: LISTA ---
    const isRecommended = !this.searchQuery && !this.selectedDepartment;
    let listTitle = "";
    if (this.activeTab === "products") {
      listTitle = isRecommended ? `${G.sparkles} CATÁLOGO (${this.products.length})` : `${G.search} RESULTADOS (${this.products.length})`;
    } else if (this.activeTab === "offers") {
      listTitle = `🏷️ MUNDO OFERTAS (${this.offers.length})`;
    } else if (this.activeTab === "stores") {
      listTitle = `${G.hospital} FARMACIAS EN ${this.selectedCity} (${this.stores.length})`;
    } else if (this.activeTab === "departments") {
      listTitle = `${G.tag} DEPARTAMENTOS (${this.departments.length})`;
    } else {
      listTitle = `${G.city} CIUDADES (${this.cities.length})`;
    }

    this.leftListBox.title = ` ${listTitle} [${totalItems > 0 ? this.selectedIndex + 1 : 0}/${totalItems}] `;

    // Renderizar ítems visibles
    if (this.activeTab === "products") {
      if (this.products.length === 0) {
        this.leftListBox.add(new TextRenderable(this.renderer, {
          content: `${G.warning} No se encontraron productos para "${this.searchQuery}". Presiona [/] para buscar.`,
          fg: THEME.amber
        }));
      } else {
        const visibleSlice = this.products.slice(scrollOffset, scrollOffset + maxVisible);
        visibleSlice.forEach((p, relIdx) => {
          const absIdx = scrollOffset + relIdx;
          const isSel = absIdx === this.selectedIndex;
          const offerInfo = getProductOfferInfo(p, this.selectedCity, this.exchangeRate);
          const priceBs = formatBs(offerInfo.hasOffer ? offerInfo.offerPrice : p.fullPrice);
          const priceUsd = formatUsd(offerInfo.hasOffer ? offerInfo.offerPrice : p.fullPrice, this.exchangeRate);
          const stockCount = p.stores_with_stock?.length || 0;
          const stockText = stockCount > 0 ? `${G.check} ${stockCount} disp.` : `${G.crossMark} Agotado`;
          const rxBadge = (p.requirePrescription === "true" || p.requirePrescription === true) ? `${G.warning} ` : "";
          const offerBadge = offerInfo.hasOffer ? `[-${offerInfo.discountText}] ` : "";
          const pointer = isSel ? `${G.pointer} ` : "  ";

          const titleTxt = new TextRenderable(this.renderer, {
            content: `${pointer}${rxBadge}${offerBadge}${p.mediaDescription.slice(0, 34)}`,
            fg: isSel ? THEME.gold : offerInfo.hasOffer ? THEME.green : THEME.white
          });

          const subtitleTxt = new TextRenderable(this.renderer, {
            content: `    ${G.dollar} ${priceBs} (${priceUsd}) ${G.bullet} ${stockText}`,
            fg: isSel ? THEME.blueAccent : THEME.grayMuted
          });

          const itemBox = new BoxRenderable(this.renderer, {
            flexDirection: "column",
            marginBottom: 1,
            overflow: "hidden"
          });
          itemBox.add(titleTxt);
          itemBox.add(subtitleTxt);
          this.leftListBox.add(itemBox);
        });
      }
    } else if (this.activeTab === "offers") {
      if (this.offers.length === 0) {
        this.leftListBox.add(new TextRenderable(this.renderer, {
          content: `${G.warning} No hay ofertas cargadas en este momento.`,
          fg: THEME.amber
        }));
      } else {
        const visibleSlice = this.offers.slice(scrollOffset, scrollOffset + maxVisible);
        visibleSlice.forEach((p, relIdx) => {
          const absIdx = scrollOffset + relIdx;
          const isSel = absIdx === this.selectedIndex;
          const offerInfo = getProductOfferInfo(p, this.selectedCity, this.exchangeRate);
          const currentPrice = offerInfo.hasOffer ? offerInfo.offerPrice : p.fullPrice;
          const priceBs = formatBs(currentPrice);
          const priceUsd = formatUsd(currentPrice, this.exchangeRate);
          const stockCount = p.stores_with_stock?.length || 0;
          const stockText = stockCount > 0 ? `${G.check} ${stockCount} disp.` : `${G.crossMark} Agotado`;
          const rxBadge = (p.requirePrescription === "true" || p.requirePrescription === true) ? `${G.warning} ` : "";
          const tag = offerInfo.hasOffer ? `[-${offerInfo.discountText}] ` : `[OFERTA] `;
          const pointer = isSel ? `${G.pointer} ` : "  ";

          const titleTxt = new TextRenderable(this.renderer, {
            content: `${pointer}${rxBadge}${tag}${p.mediaDescription.slice(0, 32)}`,
            fg: isSel ? THEME.gold : THEME.green
          });

          const subtitleContent = offerInfo.hasOffer
            ? `    ${G.dollar} ${priceBs} (${priceUsd}) ${G.bullet} Antes: ${formatBs(offerInfo.originalPrice)}`
            : `    ${G.dollar} ${priceBs} (${priceUsd}) ${G.bullet} ${stockText}`;

          const subtitleTxt = new TextRenderable(this.renderer, {
            content: subtitleContent,
            fg: isSel ? THEME.blueAccent : THEME.grayMuted
          });

          const itemBox = new BoxRenderable(this.renderer, {
            flexDirection: "column",
            marginBottom: 1,
            overflow: "hidden"
          });
          itemBox.add(titleTxt);
          itemBox.add(subtitleTxt);
          this.leftListBox.add(itemBox);
        });
      }
    } else if (this.activeTab === "stores") {
      if (this.stores.length === 0) {
        this.leftListBox.add(new TextRenderable(this.renderer, {
          content: `${G.warning} No hay farmacias registradas para ${this.selectedCity}.`,
          fg: THEME.amber
        }));
      } else {
        const visibleSlice = this.stores.slice(scrollOffset, scrollOffset + maxVisible);
        visibleSlice.forEach((st, relIdx) => {
          const absIdx = scrollOffset + relIdx;
          const isSel = absIdx === this.selectedIndex;
          const dist = st.distanceInKm ? ` (~${st.distanceInKm.toFixed(1)} km)` : "";
          const pointer = isSel ? `${G.pointer} ` : "  ";

          const titleTxt = new TextRenderable(this.renderer, {
            content: `${pointer}${G.hospital} ${st.name}${dist}`,
            fg: isSel ? THEME.gold : THEME.white
          });

          const subtitleTxt = new TextRenderable(this.renderer, {
            content: `    ${G.city} ${st.address.slice(0, 26)} ${G.bullet} ${G.clock} 24h`,
            fg: isSel ? THEME.blueAccent : THEME.grayMuted
          });

          const storeBox = new BoxRenderable(this.renderer, {
            flexDirection: "column",
            marginBottom: 1,
            overflow: "hidden"
          });
          storeBox.add(titleTxt);
          storeBox.add(subtitleTxt);
          this.leftListBox.add(storeBox);
        });
      }
    } else if (this.activeTab === "departments") {
      const visibleSlice = this.departments.slice(scrollOffset, scrollOffset + (maxVisible * 2));
      visibleSlice.forEach((d, relIdx) => {
        const absIdx = scrollOffset + relIdx;
        const isSel = absIdx === this.selectedIndex;
        const pointer = isSel ? `${G.pointer} ` : "  ";

        const deptTxt = new TextRenderable(this.renderer, {
          content: `${pointer}${G.tag} ${d.name} (${d.count.toLocaleString("es-VE")})`,
          fg: isSel ? THEME.gold : THEME.white
        });

        this.leftListBox.add(deptTxt);
      });
    } else if (this.activeTab === "cities") {
      const visibleSlice = this.cities.slice(scrollOffset, scrollOffset + (maxVisible * 2));
      visibleSlice.forEach((c, relIdx) => {
        const absIdx = scrollOffset + relIdx;
        const isSel = absIdx === this.selectedIndex;
        const isCurrent = c.cityId === this.selectedCity;
        const pointer = isSel ? `${G.pointer} ` : "  ";
        const status = isCurrent ? `  ${G.check} Activa` : "";

        const cityTxt = new TextRenderable(this.renderer, {
          content: `${pointer}${G.city} [${c.cityId}] ${c.name}${status}`,
          fg: isSel ? THEME.gold : isCurrent ? THEME.green : THEME.white
        });

        this.leftListBox.add(cityTxt);
      });
    }

    // --- PANEL DERECHO: DETALLE ---
    this.rightDetailBox.title = ` ${G.star} DETALLE `;

    const curProd = this.getCurrentProduct();
    if ((this.activeTab === "products" || this.activeTab === "offers") && curProd) {
      const panelWidth = Math.max(28, Math.floor(this.renderer.width * 0.5) - 6);

      // 1. Ficha de detalles del producto
      const detailText = new BoxRenderable(this.renderer, {
        flexDirection: "column",
        width: "100%",
        flexShrink: 0
      });
      this.rightDetailBox.add(detailText);

      // Evaluar si tiene oferta
      const offerInfo = getProductOfferInfo(curProd, this.selectedCity, this.exchangeRate);

      // Badges superiores de clasificación
      const deptoName = curProd.departments?.[0] || "Salud y Medicamentos";
      const isRx = curProd.requirePrescription === "true" || curProd.requirePrescription === true;
      const stockCount = curProd.stores_with_stock?.length || 0;

      const headerBadges = [
        offerInfo.hasOffer ? `🏷️ -${offerInfo.discountText} DCTO` : isRecommended ? `${G.sparkles} DESTACADO` : `${G.pill} ${deptoName.slice(0, 18)}`,
        isRx ? `${G.warning} RÉCIPE` : null,
        stockCount > 0 ? `${G.check} EN STOCK (${stockCount})` : `✗ AGOTADO`
      ].filter(Boolean).join(`  ${G.bullet}  `);

      detailText.add(new TextRenderable(this.renderer, {
        content: headerBadges,
        fg: offerInfo.hasOffer ? THEME.gold : isRx ? THEME.rxRed : THEME.blueAccent
      }));

      // Nombre / Presentación del producto con wrapping seguro
      const descLines = wrapText(curProd.mediaDescription || "", panelWidth);
      for (const line of descLines.slice(0, 2)) {
        detailText.add(new TextRenderable(this.renderer, {
          content: line,
          fg: THEME.white
        }));
      }

      // Categoría / Marca / ID
      const metaParts: string[] = [];
      if (curProd.subCategory) {
        metaParts.push(curProd.subCategory.slice(0, 16));
      }
      metaParts.push(`Marca: ${(curProd.marca || "N/A").slice(0, 14)}`);
      metaParts.push(`ID: #${curProd.id}`);

      detailText.add(new TextRenderable(this.renderer, {
        content: `${G.tag} ${metaParts.join(`  ${G.bullet}  `)}`,
        fg: THEME.grayMuted
      }));

      // Precios en Bolívares y Dólares (con oferta destacada si aplica)
      if (offerInfo.hasOffer) {
        const offerBs = formatBs(offerInfo.offerPrice);
        const offerUsd = formatUsd(offerInfo.offerPrice, this.exchangeRate);
        const origBs = formatBs(offerInfo.originalPrice);
        const savingsUsd = formatUsd(offerInfo.savingsBs, this.exchangeRate);

        detailText.add(new TextRenderable(this.renderer, {
          content: `${G.dollar} Oferta: ${offerBs} (${offerUsd})`,
          fg: THEME.green
        }));
        detailText.add(new TextRenderable(this.renderer, {
          content: `   ↳ Antes: ${origBs}  ${G.bullet}  Ahorro: ${formatBs(offerInfo.savingsBs)} (${savingsUsd})`,
          fg: THEME.gold
        }));
      } else {
        const priceBs = formatBs(curProd.fullPrice);
        const priceUsd = formatUsd(curProd.fullPrice, this.exchangeRate);
        detailText.add(new TextRenderable(this.renderer, {
          content: `${G.dollar} Precio: ${priceBs} (${priceUsd})`,
          fg: THEME.green
        }));
      }

      // Aviso de récipe obligatorio si aplica
      if (isRx) {
        detailText.add(new TextRenderable(this.renderer, {
          content: `${G.warning} [!] Requiere presentación de récipe médico`,
          fg: THEME.rxRed
        }));
      }

      // Disponibilidad en la ciudad seleccionada
      detailText.add(new TextRenderable(this.renderer, {
        content: `${G.city} ${stockCount} farmacias con disponibilidad en ${this.selectedCity}`,
        fg: THEME.blueAccent
      }));

      // Atajos de acción directos (compacto para evitar wraps accidentales)
      detailText.add(new TextRenderable(this.renderer, {
        content: `${G.enter} Sucursales  ${G.bullet}  ${G.camera} [p] Zoom  ${G.bullet}  ${G.globe} [o] Web`,
        fg: THEME.gold
      }));

      // 2. Tarjeta permanente de imagen: escala dinámicamente ocupando el espacio disponible
      const imageContainer = new BoxRenderable(this.renderer, {
        flexGrow: 1,
        minHeight: 8,
        width: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: THEME.blueAccent,
        title: ` ${G.camera} Imagen `,
        titleColor: THEME.gold,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 1,
        overflow: "hidden"
      });
      this.rightDetailBox.add(imageContainer);

      if (curProd.mediaImageUrl) {
        const cached = getCachedNativeImage(curProd.mediaImageUrl);
        if (cached) {
          const img = new ImageRenderable(this.renderer, {
            source: cached,
            width: "100%",
            height: "100%",
            fit: "fit",
            protocol: "blocks"
          });
          imageContainer.add(img);
        } else {
          imageContainer.add(new TextRenderable(this.renderer, {
            content: ` ${G.camera} Cargando imagen oficial...`,
            fg: THEME.grayMuted
          }));
          preloadNativeImage(curProd.mediaImageUrl, () => {
            if (this.getCurrentProduct()?.id === curProd.id && this.activeTab === "products") {
              this.updateContentPanels();
              this.renderer.requestRender();
            }
          });
        }
      } else {
        imageContainer.add(new TextRenderable(this.renderer, {
          content: ` ${G.camera} [Sin fotografía oficial disponible]`,
          fg: THEME.grayMuted
        }));
      }
    } else if (this.activeTab === "stores" && this.stores[this.selectedIndex]) {
      const st = this.stores[this.selectedIndex]!;
      this.rightDetailBox.add(new TextRenderable(this.renderer, {
        content: `${G.hospital} [SUCURSAL ${st.name}]`,
        fg: THEME.blueAccent
      }));
      this.rightDetailBox.add(new TextRenderable(this.renderer, {
        content: `ID Tienda: #${st.id}`,
        fg: THEME.grayMuted
      }));
      this.rightDetailBox.add(new TextRenderable(this.renderer, {
        content: `${G.city} Dirección: ${st.address}`,
        fg: THEME.white
      }));
      this.rightDetailBox.add(new TextRenderable(this.renderer, {
        content: `${G.check} Abierta 24h con entrega farmacéutica`,
        fg: THEME.green
      }));
    } else if (this.activeTab === "departments" && this.departments[this.selectedIndex]) {
      const dep = this.departments[this.selectedIndex]!;
      this.rightDetailBox.add(new TextRenderable(this.renderer, {
        content: `${G.tag} [DEPARTAMENTO ${dep.name.toUpperCase()}]`,
        fg: THEME.blueAccent
      }));
      this.rightDetailBox.add(new TextRenderable(this.renderer, {
        content: `${G.package} ${dep.count.toLocaleString("es-VE")} productos registrados`,
        fg: THEME.gold
      }));
      this.rightDetailBox.add(new TextRenderable(this.renderer, {
        content: `${G.enter} Presiona [Enter] para cargar los productos de este departamento.`,
        fg: THEME.grayLight
      }));
    } else if (this.activeTab === "cities" && this.cities[this.selectedIndex]) {
      const city = this.cities[this.selectedIndex]!;
      this.rightDetailBox.add(new TextRenderable(this.renderer, {
        content: `${G.city} [CIUDAD ${city.name.toUpperCase()} (${city.cityId})]`,
        fg: THEME.blueAccent
      }));
      this.rightDetailBox.add(new TextRenderable(this.renderer, {
        content: `Tienda default: #${city.defaultStoreId}  ${G.bullet}  ${G.truck} ${city.deliveryType}`,
        fg: THEME.grayMuted
      }));
      this.rightDetailBox.add(new TextRenderable(this.renderer, {
        content: `${G.enter} Presiona [Enter] para establecer como tu ciudad.`,
        fg: THEME.gold
      }));
      this.rightDetailBox.add(new TextRenderable(this.renderer, {
        content: "El inventario de farmacias se adaptará a esta localidad.",
        fg: THEME.grayMuted
      }));
    }
  }

  updateModal() {
    clearBox(this.modalContainer);

    // Si hay visor de imagen o modal de detalle
    if (this.showImageView) {
      this.rootBox.visible = false;
      this.modalContainer.visible = true;

      const prod = this.detailModalProduct || this.getCurrentProduct();
      const modalBox = new BoxRenderable(this.renderer, {
        width: "100%",
        height: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: THEME.blueAccent,
        title: ` ${G.camera} [FOTOGRAFÍA OFICIAL] ${prod?.mediaDescription?.toUpperCase() || ""} `,
        titleColor: THEME.gold,
        paddingX: 1,
        flexDirection: "column"
      });

      if (this.loadingImage) {
        modalBox.add(new TextRenderable(this.renderer, {
          content: "Descargando fotografía oficial...",
          fg: THEME.blueAccent
        }));
      } else {
        const imageContentBox = new BoxRenderable(this.renderer, {
          flexGrow: 1,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center"
        });
        const cached = prod?.mediaImageUrl ? getCachedNativeImage(prod.mediaImageUrl) : null;
        if (cached) {
          imageContentBox.add(new ImageRenderable(this.renderer, {
            source: cached,
            width: Math.min(this.renderer.width - 10, 48),
            height: Math.min(this.renderer.height - 6, 18),
            fit: "contain",
            protocol: "blocks"
          }));
        } else {
          imageContentBox.add(new TextRenderable(this.renderer, {
            content: this.imageArt || "[Sin fotografía disponible]",
            fg: THEME.white
          }));
        }
        modalBox.add(imageContentBox);
      }

      const footerModal = new BoxRenderable(this.renderer, {
        height: 1,
        marginTop: 1,
        flexDirection: "row",
        justifyContent: "space-between"
      });

      footerModal.add(new TextRenderable(this.renderer, {
        content: `[Esc/q] Volver a la lista  ${G.bullet}  ${G.globe} [o] Abrir en navegador`,
        fg: THEME.gold
      }));

      modalBox.add(footerModal);
      this.modalContainer.add(modalBox);
      return;
    }

    if (this.detailModalProduct) {
      this.rootBox.visible = false;
      this.modalContainer.visible = true;

      const p = this.detailModalProduct;
      const modalBox = new BoxRenderable(this.renderer, {
        width: "100%",
        height: "100%",
        border: true,
        borderStyle: "rounded",
        borderColor: THEME.blueAccent,
        title: ` ${G.brand} ${p.mediaDescription} `,
        titleColor: THEME.gold,
        paddingX: 1,
        flexDirection: "column"
      });

      // Contenido modal dividido
      const splitModal = new BoxRenderable(this.renderer, {
        flexGrow: 1,
        flexDirection: "row",
        overflow: "hidden"
      });

      const leftCol = new BoxRenderable(this.renderer, {
        width: "50%",
        flexDirection: "column",
        paddingRight: 1
      });

      const offerInfo = getProductOfferInfo(p, this.selectedCity, this.exchangeRate);

      if (offerInfo.hasOffer) {
        leftCol.add(new TextRenderable(this.renderer, {
          content: `🏷️ ¡OFERTA: -${offerInfo.discountText} DCTO!`,
          fg: THEME.gold
        }));

        leftCol.add(new TextRenderable(this.renderer, {
          content: `${formatBs(offerInfo.offerPrice)}  (${formatUsd(offerInfo.offerPrice, this.exchangeRate)})`,
          fg: THEME.green
        }));

        leftCol.add(new TextRenderable(this.renderer, {
          content: `Antes: ${formatBs(offerInfo.originalPrice)} • Ahorras: ${formatBs(offerInfo.savingsBs)}`,
          fg: THEME.amber
        }));
      } else {
        leftCol.add(new TextRenderable(this.renderer, {
          content: `${G.dollar} [PRECIO Y TASA OFICIAL]`,
          fg: THEME.blueAccent
        }));

        leftCol.add(new TextRenderable(this.renderer, {
          content: formatBs(p.fullPrice),
          fg: THEME.green
        }));

        leftCol.add(new TextRenderable(this.renderer, {
          content: formatUsd(p.fullPrice, this.exchangeRate),
          fg: THEME.gold
        }));
      }

      leftCol.add(new TextRenderable(this.renderer, {
        content: `${G.lightning} Tasa oficial BCV: Bs. ${this.exchangeRate.toFixed(2)} / $`,
        fg: THEME.grayMuted
      }));

      if (p.requirePrescription === "true" || p.requirePrescription === true) {
        leftCol.add(new TextRenderable(this.renderer, {
          content: `${G.warning} [!] REQUIERE RÉCIPE MÉDICO OBLIGATORIO`,
          fg: THEME.rxRed
        }));
      }

      leftCol.add(new TextRenderable(this.renderer, {
        content: `${G.tag} Depto: ${p.departments?.join(", ") || "General"}`,
        fg: THEME.grayLight
      }));

      leftCol.add(new TextRenderable(this.renderer, {
        content: `${G.camera} [p/i] Ver grande  ${G.bullet}  ${G.globe} [o] Web`,
        fg: THEME.gold
      }));

      if (p.mediaImageUrl) {
        const modalImageBox = new BoxRenderable(this.renderer, {
          width: 28,
          height: 12,
          border: true,
          borderStyle: "rounded",
          borderColor: THEME.blueAccent,
          title: ` ${G.camera} Imagen `,
          titleColor: THEME.gold,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
          overflow: "hidden"
        });
        const cached = getCachedNativeImage(p.mediaImageUrl);
        if (cached) {
          modalImageBox.add(new ImageRenderable(this.renderer, {
            source: cached,
            width: "100%",
            height: "100%",
            fit: "fit",
            protocol: "blocks"
          }));
        } else {
          modalImageBox.add(new TextRenderable(this.renderer, {
            content: ` ${G.camera} Cargando imagen...`,
            fg: THEME.grayMuted
          }));
          preloadNativeImage(p.mediaImageUrl, () => {
            if (this.detailModalProduct?.id === p.id) {
              this.updateModal();
              this.renderer.requestRender();
            }
          });
        }
        leftCol.add(modalImageBox);
      }

      const rightCol = new BoxRenderable(this.renderer, {
        width: "50%",
        flexDirection: "column",
        paddingLeft: 1
      });

      rightCol.add(new TextRenderable(this.renderer, {
        content: `${G.hospital} [SUCURSALES EN ${this.selectedCity}]`,
        fg: THEME.green
      }));

      if (this.modalStockMap.length === 0) {
        rightCol.add(new TextRenderable(this.renderer, {
          content: "Consultando disponibilidad en farmacias...",
          fg: THEME.grayMuted
        }));
      } else {
        const available = this.modalStockMap.filter(s => s.hasStock);
        if (available.length === 0) {
          rightCol.add(new TextRenderable(this.renderer, {
            content: `${G.crossMark} Sin unidades disponibles en farmacias de ${this.selectedCity}`,
            fg: THEME.rxRed
          }));
        } else {
          this.modalStockMap.slice(0, 10).forEach(({ store, hasStock, isLowStock }) => {
            rightCol.add(new TextRenderable(this.renderer, {
              content: `${hasStock ? (isLowStock ? `${G.warning} [Pocas un.] ` : `${G.check} [En Stock] `) : `${G.crossMark} [Agotado] `}${store.name}`,
              fg: hasStock ? (isLowStock ? THEME.amber : THEME.green) : THEME.grayMuted
            }));
            rightCol.add(new TextRenderable(this.renderer, {
              content: `   ${G.city} ${store.address.slice(0, 42)}`,
              fg: THEME.grayMuted
            }));
          });
        }
      }

      splitModal.add(leftCol);
      splitModal.add(rightCol);
      modalBox.add(splitModal);

      const footer = new BoxRenderable(this.renderer, {
        height: 1,
        marginTop: 1,
        flexDirection: "row",
        justifyContent: "space-between"
      });

      footer.add(new TextRenderable(this.renderer, {
        content: `[Esc/q] Volver  ${G.bullet}  ${G.camera} [p/i] Ver foto  ${G.bullet}  ${G.globe} [o] Web`,
        fg: THEME.white
      }));

      footer.add(new TextRenderable(this.renderer, {
        content: `${G.city} Ciudad: ${this.selectedCity}`,
        fg: THEME.blueAccent
      }));

      modalBox.add(footer);
      this.modalContainer.add(modalBox);
      return;
    }

    // Si no hay modal activo, restaurar vista principal
    this.rootBox.visible = true;
    this.modalContainer.visible = false;
  }
}

export async function renderTUI() {
  clearKittyImages();
  const renderer = await createCliRenderer();
  const app = new FarmatodoTUI(renderer);

  const cleanup = () => {
    clearKittyImages();
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    renderer.destroy();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    renderer.destroy();
    process.exit(0);
  });

  await app.loadInitialData();
}
