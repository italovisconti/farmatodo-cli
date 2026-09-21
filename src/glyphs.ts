export interface Glyphs {
  pill: string;
  cross: string;
  store: string;
  city: string;
  dollar: string;
  bolivar: string;
  tag: string;
  cart: string;
  search: string;
  arrow: string;
  check: string;
  crossMark: string;
  warning: string;
  star: string;
  image: string;
  clock: string;
}

const NERD_GLYPHS: Glyphs = {
  pill: "💊",
  cross: "✚",
  store: "🏪",
  city: "📍",
  dollar: "💵",
  bolivar: "🇻🇪",
  tag: "🏷️",
  cart: "🛒",
  search: "🔍",
  arrow: "›",
  check: "✔",
  crossMark: "✖",
  warning: "⚠",
  star: "★",
  image: "🖼️",
  clock: "🕒"
};

const STANDARD_GLYPHS: Glyphs = {
  pill: "[Rx]",
  cross: "[+]",
  store: "[SUCURSAL]",
  city: "[CIUDAD]",
  dollar: "[$]",
  bolivar: "[Bs]",
  tag: "[PRECIO]",
  cart: "[CARRITO]",
  search: "[BUSCAR]",
  arrow: ">",
  check: "[OK]",
  crossMark: "[X]",
  warning: "[!]",
  star: "*",
  image: "[FOTO]",
  clock: "[HORA]"
};

export function getGlyphs(): Glyphs {
  const env = process.env;
  if (env.NO_NERD_FONTS === "1" || env.NERD_FONTS === "0" || env.NERD_FONTS === "false") {
    return STANDARD_GLYPHS;
  }

  const termProgram = env.TERM_PROGRAM || "";
  const isNerdSupported =
    env.NERD_FONTS === "1" ||
    env.NERD_FONTS === "true" ||
    termProgram.includes("iTerm") ||
    termProgram.includes("WezTerm") ||
    termProgram.includes("kitty") ||
    termProgram.includes("Alacritty") ||
    termProgram.includes("vscode") ||
    env.TERMINAL_EMULATOR?.includes("JetBrains") ||
    Boolean(env.COLORTERM);

  return isNerdSupported ? NERD_GLYPHS : STANDARD_GLYPHS;
}
