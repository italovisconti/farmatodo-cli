import terminalImage from "terminal-image";
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

import { NativeImage } from "@opentui/core";

// Tier 1: Caché en memoria
const imageCache = new Map<string, string>();
const nativeImageCache = new Map<string, NativeImage>();
const pendingFetches = new Set<string>();

/**
 * Obtiene el directorio persistente para el caché de imágenes
 */
export function getCacheDir(): string {
  if (process.env.FARMATODO_CACHE_DIR) {
    return process.env.FARMATODO_CACHE_DIR;
  }
  if (process.env.XDG_CACHE_HOME) {
    return path.join(process.env.XDG_CACHE_HOME, "farmatodo-cli", "images");
  }
  const home = os.homedir();
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    return path.join(localAppData, "farmatodo-cli", "cache", "images");
  }
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Caches", "farmatodo-cli", "images");
  }
  return path.join(home, ".cache", "farmatodo-cli", "images");
}

function ensureCacheDir(): string {
  const dir = getCacheDir();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (_) {}
  return dir;
}

function getCacheFilePath(url: string): string {
  const hash = crypto.createHash("sha256").update(url).digest("hex");
  return path.join(getCacheDir(), `${hash}.img`);
}

/**
 * Lee la imagen del caché en disco si existe
 */
export function readFromDiskCache(url: string): Buffer | null {
  try {
    const filePath = getCacheFilePath(url);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
  } catch (_) {}
  return null;
}

/**
 * Guarda la imagen en el caché en disco
 */
export function writeToDiskCache(url: string, data: Buffer | Uint8Array) {
  try {
    ensureCacheDir();
    const filePath = getCacheFilePath(url);
    fs.writeFileSync(filePath, data);
  } catch (_) {}
}

export function getCachedNativeImage(url: string): NativeImage | null {
  if (!url) return null;
  // 1. Memoria
  if (nativeImageCache.has(url)) {
    return nativeImageCache.get(url)!;
  }
  // 2. Disco
  const diskBuf = readFromDiskCache(url);
  if (diskBuf) {
    try {
      const img = NativeImage.decode(new Uint8Array(diskBuf));
      nativeImageCache.set(url, img);
      return img;
    } catch (_) {}
  }
  return null;
}

export function setCachedNativeImage(url: string, img: NativeImage) {
  nativeImageCache.set(url, img);
}

export async function preloadNativeImage(
  url: string,
  onLoaded?: (img: NativeImage) => void
): Promise<NativeImage | null> {
  if (!url) return null;

  // 1. Memoria
  if (nativeImageCache.has(url)) {
    const cached = nativeImageCache.get(url)!;
    onLoaded?.(cached);
    return cached;
  }

  // 2. Disco persistente
  const diskBuf = readFromDiskCache(url);
  if (diskBuf) {
    try {
      const img = NativeImage.decode(new Uint8Array(diskBuf));
      nativeImageCache.set(url, img);
      onLoaded?.(img);
      return img;
    } catch (_) {}
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
    const uint8 = new Uint8Array(buf);
    writeToDiskCache(url, uint8);

    const img = NativeImage.decode(uint8);
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
 * Precarga en segundo plano una lista de URLs de imágenes sin bloquear la UI
 */
export function preloadBatch(urls: string[]) {
  const cleanUrls = urls.filter((u) => u && !nativeImageCache.has(u));
  for (const url of cleanUrls.slice(0, 10)) {
    preloadNativeImage(url).catch(() => {});
  }
}

/**
 * Retorna estadísticas del caché de imágenes en disco
 */
export function getImageCacheStats(): { dir: string; count: number; sizeBytes: number; sizeFormatted: string } {
  const dir = getCacheDir();
  let count = 0;
  let sizeBytes = 0;

  try {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.endsWith(".img")) {
          const stat = fs.statSync(path.join(dir, file));
          count++;
          sizeBytes += stat.size;
        }
      }
    }
  } catch (_) {}

  const sizeMB = sizeBytes / (1024 * 1024);
  const sizeFormatted = sizeMB >= 1 ? `${sizeMB.toFixed(2)} MB` : `${(sizeBytes / 1024).toFixed(1)} KB`;

  return { dir, count, sizeBytes, sizeFormatted };
}

/**
 * Elimina todos los archivos del caché de imágenes en disco
 */
export function clearDiskCache(): number {
  const dir = getCacheDir();
  let deleted = 0;

  try {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.endsWith(".img")) {
          try {
            fs.unlinkSync(path.join(dir, file));
            deleted++;
          } catch (_) {}
        }
      }
    }
  } catch (_) {}

  imageCache.clear();
  nativeImageCache.clear();
  return deleted;
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
    let buffer = readFromDiskCache(imageUrl);
    if (!buffer) {
      const res = await fetch(imageUrl);
      if (!res.ok) return "[No se pudo descargar la imagen]";
      const arrayBuf = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuf);
      writeToDiskCache(imageUrl, buffer);
    }

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
