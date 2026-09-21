import terminalImage from "terminal-image";
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";

import { NativeImage } from "@opentui/core";

const imageCache = new Map<string, string>();
const nativeImageCache = new Map<string, NativeImage>();
const pendingFetches = new Set<string>();

export function getCachedNativeImage(url: string): NativeImage | null {
  return nativeImageCache.get(url) || null;
}

export function setCachedNativeImage(url: string, img: NativeImage) {
  nativeImageCache.set(url, img);
}

export async function preloadNativeImage(
  url: string,
  onLoaded?: (img: NativeImage) => void
): Promise<NativeImage | null> {
  if (!url) return null;
  if (nativeImageCache.has(url)) {
    const cached = nativeImageCache.get(url)!;
    onLoaded?.(cached);
    return cached;
  }
  if (pendingFetches.has(url)) return null;
  pendingFetches.add(url);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      pendingFetches.delete(url);
      return null;
    }
    const buf = await res.arrayBuffer();
    const img = NativeImage.decode(new Uint8Array(buf));
    nativeImageCache.set(url, img);
    pendingFetches.delete(url);
    onLoaded?.(img);
    return img;
  } catch (err) {
    pendingFetches.delete(url);
    return null;
  }
}

/**
 * Envía el comando de Kitty Graphics Protocol para eliminar cualquier imagen flotante del búfer
 */
export function clearKittyImages() {
  if (process.env.NODE_ENV === "test" || process.env.BUN_TEST || !process.stdout || !process.stdout.isTTY) {
    return;
  }
  try {
    process.stdout.write("\x1b_Ga=d,d=A\x1b\\");
  } catch (_) {}
}

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

    // Prioridad 2: terminal-image forzando renderizado en semibloques ANSI puros (evita Kitty escapes flotantes no administrados)
    const renderFn = typeof terminalImage === "function" ? terminalImage : (terminalImage as any).buffer;
    if (typeof renderFn === "function") {
      const ascii = await renderFn(buffer, { width, preferNativeRender: false });
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
