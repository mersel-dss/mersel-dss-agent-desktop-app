#!/usr/bin/env node
/**
 * WinSW (Windows Service Wrapper) ikilisini indirip `src-tauri/resources/
 * win-service/WinSW.exe` olarak gömer. WinSW, gömülü JRE + servis jar'ını
 * GERÇEK bir Windows Service'e (services.msc'de görünür, Session 0'da gizli
 * koşan, çökünce OS'un yeniden başlattığı birim) sarmalar.
 *
 * Sürüm bu build anına kilitlenir. Yalnız Windows installer (NSIS) bu exe'yi
 * kullanır; macOS/Linux build'lerinde indirilmese de `win-service/` klasörü
 * (register/unregister PowerShell scriptleri) yine de paketlenir — zararsızdır.
 *
 * Bağımlılık yok (Node 18+ yerleşik fetch).
 */

import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const DEST_DIR = join(PROJECT_ROOT, "src-tauri", "resources", "win-service");
const DEST = join(DEST_DIR, "WinSW.exe");

// WinSW v2 (.NET Framework 4.6.1 — Windows 10/11'de yerleşik). x64 self-contained
// gerektirmediği için küçük (~0.4 MB). Sürüm bilinçli olarak pinlenmiştir.
const WINSW_VERSION = process.env.WINSW_VERSION || "v2.12.0";
const WINSW_URL = `https://github.com/winsw/winsw/releases/download/${WINSW_VERSION}/WinSW-x64.exe`;

function authHeaders() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const headers = { "user-agent": "mersel-dss-agent-desktop" };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

async function main() {
  await mkdir(DEST_DIR, { recursive: true });
  console.log(`↓ WinSW ${WINSW_VERSION} → ${DEST}`);
  const res = await fetch(WINSW_URL, {
    headers: authHeaders(),
    redirect: "follow",
  });
  if (!res.ok || !res.body) {
    throw new Error(`WinSW indirme başarısız (HTTP ${res.status}): ${WINSW_URL}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(DEST));
  console.log(`✓ WinSW gömüldü → ${DEST}`);
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
