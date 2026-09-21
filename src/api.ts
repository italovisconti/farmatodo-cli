import type {
  FarmatodoProduct,
  City,
  Store,
  SearchResult,
  SearchOptions
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
    onlyInStock = false
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

  const payload: any = {
    query,
    page,
    hitsPerPage,
    facets: ["departments", "subCategory", "marca"]
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
