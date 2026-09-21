import type {
  FarmatodoProduct,
  City,
  Store,
  SearchResult,
  SearchOptions,
  ProductOfferInfo,
  PromotionCampaign
} from "./types";

const ALGOLIA_HOST = "https://api-search.farmatodo.com";
const ALGOLIA_APP_ID = "VCOJEYD2PO";
const ALGOLIA_API_KEY = "869a91e98550dd668b8b1dc04bca9011";
const ALGOLIA_INDEX = "products-venezuela";

const GATEWAY_HOST = "https://gw-backend-ve.farmatodo.com";
const TRANSACTIONAL_HOST = "https://api-transactional.farmatodo.com";

let cachedExchangeRate: { rate: number; timestamp: number } | null = null;
let cachedCities: City[] | null = null;
const cachedStoresByCity = new Map<string, Store[]>();

/**
 * Obtiene la tasa oficial de cambio Farmatodo/BCV en Bs/$
 */
export async function getExchangeRate(): Promise<number> {
  const now = Date.now();
  if (cachedExchangeRate && now - cachedExchangeRate.timestamp < 10 * 60 * 1000) {
    return cachedExchangeRate.rate;
  }

  try {
    const res = await fetch(`${GATEWAY_HOST}/oms/v3/currency/exchange?country=VEN`, {
      headers: {
        "country": "VEN",
        "source": "WEB",
        "Content-Type": "application/json"
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.data?.currencyValue) {
        const rate = Number(data.data.currencyValue);
        cachedExchangeRate = { rate, timestamp: now };
        return rate;
      }
    }
  } catch (err) {
    // Si falla la red, usar caché previo si existe
    if (cachedExchangeRate) return cachedExchangeRate.rate;
  }

  // Tasa fallback aproximada de referencia en caso de estar offline
  return 850.0;
}

/**
 * Busca productos en el índice Algolia de Farmatodo Venezuela
 */
export async function searchProducts(options: SearchOptions = {}): Promise<SearchResult> {
  const {
    query = "",
    page = 0,
    hitsPerPage = 24,
    department,
    subCategory,
    onlyInStock = false,
    onlyOffers = false,
    suggestedId
  } = options;

  const filterParts: string[] = [];
  if (department) {
    filterParts.push(`departments:"${department}"`);
  }
  if (subCategory) {
    filterParts.push(`subCategory:"${subCategory}"`);
  }
  if (onlyInStock) {
    filterParts.push(`hasStock:true`);
  }
  if (onlyOffers) {
    const now = Date.now();
    filterParts.push(`outofstore:false AND offerStartDate <= ${now} AND offerEndDate >= ${now}`);
  }
  if (suggestedId) {
    filterParts.push(`id_suggested:'${suggestedId}'`);
  }

  const payload: any = {
    query,
    page,
    hitsPerPage,
    facets: ["departments", "subCategory", "marca", "id_suggested"]
  };

  if (filterParts.length > 0) {
    payload.filters = filterParts.join(" AND ");
  }

  const url = `${ALGOLIA_HOST}/1/indexes/${ALGOLIA_INDEX}/query?x-algolia-application-id=${ALGOLIA_APP_ID}&x-algolia-api-key=${ALGOLIA_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Error en búsqueda Algolia: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  return {
    hits: (data.hits || []) as FarmatodoProduct[],
    nbHits: data.nbHits || 0,
    page: data.page || 0,
    nbPages: data.nbPages || 0,
    hitsPerPage: data.hitsPerPage || hitsPerPage,
    processingTimeMS: data.processingTimeMS || 0,
    facets: data.facets || {}
  };
}

/**
 * Obtiene un producto por su ID
 */
export async function getProductById(id: string): Promise<FarmatodoProduct | null> {
  const url = `${ALGOLIA_HOST}/1/indexes/${ALGOLIA_INDEX}/query?x-algolia-application-id=${ALGOLIA_APP_ID}&x-algolia-api-key=${ALGOLIA_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      filters: `objectID:${id}`,
      hitsPerPage: 1
    })
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (data.hits && data.hits.length > 0) {
    return data.hits[0] as FarmatodoProduct;
  }
  return null;
}

/**
 * Obtiene el directorio de 56 ciudades activas en Venezuela
 */
export async function fetchCities(): Promise<City[]> {
  if (cachedCities && cachedCities.length > 0) {
    return cachedCities;
  }

  try {
    const res = await fetch(`${TRANSACTIONAL_HOST}/catalog/r/VE/v1/cities/active/geo-zone/`);
    if (res.ok) {
      const json = await res.json();
      if (json?.data && Array.isArray(json.data)) {
        cachedCities = json.data as City[];
        return cachedCities;
      }
    }
  } catch (err) {
    console.error("Error cargando ciudades:", err);
  }

  return [
    { cityId: "CCS", name: "Caracas", active: true, countryId: "VE", latitude: 10.4806, longitude: -66.9036, defaultStoreId: 146, deliveryType: "EXPRESS" },
    { cityId: "VAL", name: "Valencia", active: true, countryId: "VE", latitude: 10.162, longitude: -68.0077, defaultStoreId: 102, deliveryType: "EXPRESS" },
    { cityId: "MCBO", name: "Maracaibo", active: true, countryId: "VE", latitude: 10.6549, longitude: -71.6441, defaultStoreId: 101, deliveryType: "EXPRESS" },
    { cityId: "BQTO", name: "Barquisimeto", active: true, countryId: "VE", latitude: 10.0647, longitude: -69.357, defaultStoreId: 107, deliveryType: "EXPRESS" }
  ];
}

/**
 * Obtiene las sucursales/farmacias cercanas por ciudad o coordenadas
 */
export async function fetchNearbyStores(cityId = "CCS", coords?: { lat: number; lng: number }): Promise<Store[]> {
  const cacheKey = coords ? `${coords.lat},${coords.lng}` : cityId.toUpperCase();
  if (cachedStoresByCity.has(cacheKey)) {
    return cachedStoresByCity.get(cacheKey)!;
  }

  try {
    let url = `${TRANSACTIONAL_HOST}/route/r/VE/v1/stores/nearby?cityId=${encodeURIComponent(cityId)}`;
    if (coords) {
      url = `${TRANSACTIONAL_HOST}/route/r/VE/v1/stores/nearby?lat=${coords.lat}&lng=${coords.lng}`;
    }

    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      if (json?.nearbyStores && Array.isArray(json.nearbyStores)) {
        const stores = json.nearbyStores as Store[];
        cachedStoresByCity.set(cacheKey, stores);
        return stores;
      }
    }
  } catch (err) {
    console.error(`Error consultando sucursales para ${cityId}:`, err);
  }

  return [];
}

/**
 * Obtiene el estado de stock de un producto en las sucursales de una ciudad
 */
export async function getProductStockInStores(
  product: FarmatodoProduct,
  cityId = "CCS"
): Promise<{ store: Store; hasStock: boolean; isLowStock: boolean }[]> {
  const stores = await fetchNearbyStores(cityId);
  const stockSet = new Set(product.stores_with_stock || []);
  const lowStockSet = new Set(product.stores_with_low_stock || []);

  return stores.map((store) => {
    const hasStock = stockSet.has(store.id);
    const isLowStock = lowStockSet.has(store.id);
    return {
      store,
      hasStock: hasStock || isLowStock,
      isLowStock
    };
  });
}

/**
 * Obtiene la lista de departamentos y conteo de productos
 */
export async function getDepartments(): Promise<{ name: string; count: number }[]> {
  const search = await searchProducts({ query: "", hitsPerPage: 0 });
  const depts = search.facets?.departments || {};
  return Object.entries(depts)
    .filter(([name]) => name && name !== "None")
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Determina si un producto tiene oferta activa para una ciudad dada y desglosa los precios/ahorro
 */
export function getProductOfferInfo(
  product: FarmatodoProduct,
  cityId = "CCS",
  exchangeRate = 850
): ProductOfferInfo {
  const normCity = cityId.toUpperCase();
  const originalPrice = product.fullPrice || 0;
  let offerPrice = 0;
  let discountText = "";

  // 1. Buscar precio de oferta específico para la ciudad
  if (product.offerPriceByCity && product.offerPriceByCity.length > 0) {
    const cityOffer = product.offerPriceByCity.find(
      (c) => c.cityCode?.toUpperCase() === normCity
    );
    if (cityOffer && cityOffer.offerPrice > 0 && cityOffer.offerPrice < originalPrice) {
      offerPrice = cityOffer.offerPrice;
      discountText = cityOffer.offerText || "";
    }
  }

  // 2. Fallback al offerPrice global si no vino en offerPriceByCity
  if (!offerPrice && product.offerPrice && product.offerPrice > 0 && product.offerPrice < originalPrice) {
    offerPrice = product.offerPrice;
    discountText = product.offerText || "";
  }

  // 3. Verificar ventana de tiempo de la oferta
  const now = Date.now();
  if (product.offerStartDate && product.offerEndDate) {
    if (now < product.offerStartDate || now > product.offerEndDate) {
      offerPrice = 0;
    }
  }

  if (offerPrice > 0 && offerPrice < originalPrice) {
    const savingsBs = originalPrice - offerPrice;
    const savingsUsd = exchangeRate > 0 ? savingsBs / exchangeRate : 0;
    const discountPercent = Math.round((savingsBs / originalPrice) * 100);
    if (!discountText) {
      discountText = `${discountPercent}%`;
    }
    return {
      hasOffer: true,
      originalPrice,
      offerPrice,
      discountText: discountText.includes("%") ? discountText : `${discountText}%`,
      discountPercent,
      savingsBs,
      savingsUsd
    };
  }

  return {
    hasOffer: false,
    originalPrice,
    offerPrice: originalPrice,
    discountText: "",
    discountPercent: 0,
    savingsBs: 0,
    savingsUsd: 0
  };
}

/**
 * Consulta las ofertas y descuentos activos en Farmatodo Venezuela
 */
export async function fetchOffers(options: {
  query?: string;
  cityId?: string;
  page?: number;
  hitsPerPage?: number;
  suggestedId?: string;
} = {}): Promise<SearchResult> {
  const {
    query = "",
    page = 0,
    hitsPerPage = 24,
    suggestedId
  } = options;

  return searchProducts({
    query,
    page,
    hitsPerPage,
    onlyOffers: !suggestedId,
    suggestedId
  });
}

/**
 * Obtiene las campañas y banners de ofertas sugeridas activas en la página principal
 */
export async function fetchPromotionalBanners(): Promise<PromotionCampaign[]> {
  try {
    const res = await fetch(
      `${TRANSACTIONAL_HOST}/VE/home/offers/suggest-affinity?key=AIzaSyAidR6Tt0K60gACR78aWThMQb7L5u6Wpag`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        body: JSON.stringify({
          idStoreGroup: 146,
          city: "CCS",
          source: "RESPONSIVE",
          idCustomerWebSafe: "ahZzfm9yYWNsZS1zZXJ2aWNlcy12emxhci4LEgRVc2VyIiQ1ZjZlMzUzNC0wZGU4LTRhYjAtYmY0MC0wNDUyNWNkNTc3YWQM",
          token: "anonymous",
          nearbyStores: [146, 124, 147]
        })
      }
    );

    if (res.ok) {
      const json = await res.json();
      if (json?.data && Array.isArray(json.data)) {
        return json.data.map((item: any) => ({
          id: String(item.id),
          name: item.firstDescription || `Oferta #${item.id}`,
          imageUrl: item.urlImage || "",
          url: item.deepLinkRedirectUrl || "",
          startDate: item.startDate,
          endDate: item.endDate
        }));
      }
    }
  } catch (err) {
    // Silencioso en fallback
  }

  // Fallback con los grupos observados más destacados
  return [
    { id: "9837", name: "Higiene del Hogar (Hasta 20% Dcto)" },
    { id: "9830", name: "Dulces y Snacks (Hasta 35% Dcto)" },
    { id: "9828", name: "Tratamiento Completo (Hasta 20% Dcto)" },
    { id: "9838", name: "Helados (Hasta 20% Dcto)" },
    { id: "9831", name: "Protección Solar (Hasta 30% Dcto)" },
    { id: "9834", name: "Higiene Personal (Hasta 20% Dcto)" },
    { id: "9840", name: "Cuidado Bucal (Hasta 20% Dcto)" },
    { id: "9832", name: "Cuidado del Cabello (Hasta 20% Dcto)" },
    { id: "9827", name: "Cesta de Bienestar a menos de REF. 0,99" },
    { id: "9839", name: "Cremas Corporales (Hasta 20% Dcto)" },
    { id: "9841", name: "Afeitado (Hasta 20% Dcto)" },
    { id: "9835", name: "Maquillaje (Hasta 35% Dcto)" },
    { id: "9842", name: "Cuidado Íntimo (Hasta 20% Dcto)" },
    { id: "9833", name: "Coloración (Hasta 20% Dcto)" }
  ];
}

