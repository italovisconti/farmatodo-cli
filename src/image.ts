import terminalImage from "terminal-image";
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";

const imageCache = new Map<string, string>();

/**
 * Renderiza la imagen de un producto en la terminal
 */
export async function renderProductImage(imageUrl: string, width = 40): Promise<string> {
  if (!imageUrl) return "[Sin imagen disponible]";

  const cacheKey = `${imageUrl}_${width}`;
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return "[No se pudo descargar la imagen]";

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    // Prioridad 1: Intentar usar `timg` si está en el sistema (24-bit truecolor halfblocks óptimos para Kitty y TUI)
    try {
      const isTimgInstalled = execSync("which timg", { stdio: "pipe" }).toString().trim();
      if (isTimgInstalled) {
        const tmpFile = path.join("/tmp", `farmatodo_${Date.now()}_${width}.jpg`);
        fs.writeFileSync(tmpFile, buffer);
        try {
          const output = execSync(`timg -p half -g ${width}x0 "${tmpFile}"`, { stdio: "pipe" }).toString();
          imageCache.set(cacheKey, output);
          try { fs.unlinkSync(tmpFile); } catch (_) {}
          return output;
        } catch (e) {
          try { fs.unlinkSync(tmpFile); } catch (_) {}
        }
      }
    } catch (_) {
      // Continuar a fallback
    }

    // Prioridad 2: terminal-image
    const renderFn = typeof terminalImage === "function" ? terminalImage : (terminalImage as any).buffer;
    if (typeof renderFn === "function") {
      const ascii = await renderFn(buffer, { width });
      imageCache.set(cacheKey, ascii);
      return ascii;
    }
  } catch (err) {
    console.error("Error al renderizar imagen del producto:", err);
  }

  return "[Error al procesar la imagen]";
}

/**
 * Abre la imagen en el visor del sistema o navegador web
 */
export function openImageInBrowser(url: string) {
  if (!url) return;
  try {
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
  } catch (e) {
    console.error("Error abriendo imagen en navegador:", e);
  }
}
