import fs from "fs";
import path from "path";
import os from "os";
import type { AppConfig } from "./types";

const CONFIG_FILE = path.join(os.homedir(), ".farmatodo-cli.json");

const DEFAULT_CONFIG: AppConfig = {
  defaultCity: "CCS",
  useNerdFonts: true
};

export function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch (_) {}
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(cfg: Partial<AppConfig>): AppConfig {
  const current = loadConfig();
  const updated = { ...current, ...cfg };
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), "utf-8");
  } catch (e) {
    console.error("No se pudo guardar la configuración:", e);
  }
  return updated;
}
