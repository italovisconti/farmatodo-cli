export interface FullPriceByCity {
  cityCode: string;
  fullPrice: number;
}

export interface CustomLabelByCity {
  cityCode: string;
  customLabel: string;
}

export interface FarmatodoProduct {
  id: string;
  objectID: string;
  mediaDescription: string;
  largeDescription?: string;
  marca: string;
  departments: string[];
  subCategory: string;
  fullPrice: number;
  unitPrice: number;
  fullPriceByCity: FullPriceByCity[];
  offerPrice: number;
  offerText?: string;
  hasStock: boolean;
  stores_with_stock: number[];
  stores_with_low_stock: number[];
  customLabelByCity?: CustomLabelByCity[];
  mediaImageUrl: string;
  listUrlImages?: string[];
  requirePrescription: string | boolean;
  labelPum?: string;
  measurePum?: number;
  url: string;
  sales?: number;
}

export interface City {
  cityId: string;
  name: string;
  active: boolean;
  countryId: string;
  latitude: number;
  longitude: number;
  defaultStoreId: number;
  deliveryType: string;
  cityName?: string;
}

export interface Store {
  id: number;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  address: string;
  distanceInKm?: number;
}

export interface ExchangeRateData {
  currencyValue: number;
}

export interface SearchOptions {
  query?: string;
  page?: number;
  hitsPerPage?: number;
  cityId?: string;
  department?: string;
  subCategory?: string;
  onlyInStock?: boolean;
}

export interface SearchResult {
  hits: FarmatodoProduct[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
  processingTimeMS: number;
  facets?: {
    departments?: Record<string, number>;
    subCategory?: Record<string, number>;
    marca?: Record<string, number>;
  };
}

export interface AppConfig {
  defaultCity: string;
  useNerdFonts?: boolean;
}
