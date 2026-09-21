export interface Glyphs {
  brand: string;
  pill: string;
  cross: string;
  hospital: string;
  store: string;
  city: string;
  dollar: string;
  bolivar: string;
  tag: string;
  cart: string;
  search: string;
  arrow: string;
  pointer: string;
  bullet: string;
  check: string;
  crossMark: string;
  warning: string;
  star: string;
  sparkles: string;
  lightning: string;
  image: string;
  camera: string;
  clock: string;
  truck: string;
  package: string;
  recipe: string;
  globe: string;
  bank: string;
  exit: string;
  enter: string;
  heart: string;
}

const NERD_KITTY_GLYPHS: Glyphs = {
  brand: "\u271a",       // ✚ Farmatodo cross
  pill: "\uf0fa",        //  Medical kit
  cross: "\u271a",       // ✚
  hospital: "\uf0f8",    //  Hospital / Pharmacy
  store: "\uf0f8",       //  Pharmacy store
  city: "\uf041",        //  Map marker
  dollar: "\uf155",      //  Dollar
  bolivar: "Bs.",        // Bs.
  tag: "\uf02b",         //  Department tag
  cart: "\uf07a",        //  Cart
  search: "\uf002",      //  Search
  arrow: "\u203a",       // ›
  pointer: "\u276f",     // ❯
  bullet: "\u2022",      // •
  check: "\uf00c",       //  Check
  crossMark: "\uf00d",   //  Cross
  warning: "\uf071",     //  Warning triangle
  star: "\uf005",        //  Star
  sparkles: "\uf005",    //  Star
  lightning: "\uf0e7",   //  fa-bolt (Nerd Font)
  image: "\uf030",       //  Camera
  camera: "\uf030",      //  Camera
  clock: "\uf017",       //  Clock
  truck: "\uf0d1",       //  Truck
  package: "\uf1b2",     //  3D Package
  recipe: "\uf071 Rx",   //  Rx Prescription
  globe: "\uf0ac",       //  Globe
  bank: "BCV",           // BCV
  exit: "\uf08b",        //  Sign out
  enter: "\u21b5",       // ↵ Enter
  heart: "\uf21e"        //  Heartbeat
};

const STANDARD_GLYPHS: Glyphs = {
  brand: "[+]",
  pill: "[Rx]",
  cross: "[+]",
  hospital: "[FARMACIA]",
  store: "[SUCURSAL]",
  city: "[CIUDAD]",
  dollar: "[$]",
  bolivar: "[Bs]",
  tag: "[DEPTO]",
  cart: "[CARRITO]",
  search: "[BUSCAR]",
  arrow: ">",
  pointer: "▸",
  bullet: "•",
  check: "[OK]",
  crossMark: "[X]",
  warning: "[!]",
  star: "*",
  sparkles: "*",
  lightning: "~",
  image: "[FOTO]",
  camera: "[FOTO]",
  clock: "[HORA]",
  truck: "[ENVIO]",
  package: "[STOCK]",
  recipe: "[RECIPE]",
  globe: "[WEB]",
  bank: "[BCV]",
  exit: "[SALIR]",
  enter: "[ENTER]",
  heart: "<3"
};

export function getGlyphs(): Glyphs {
  const env = process.env;
  if (env.NO_NERD_FONTS === "1" || env.NERD_FONTS === "0" || env.NERD_FONTS === "false") {
    return STANDARD_GLYPHS;
  }

  // Activar por defecto para terminales modernos como Kitty, Alacritty, iTerm2, WezTerm
  return NERD_KITTY_GLYPHS;
}
