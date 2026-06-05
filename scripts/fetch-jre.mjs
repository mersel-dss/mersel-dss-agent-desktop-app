#!/usr/bin/env node
/**
 * Platforma özel Adoptium Temurin JRE 8'i indirir ve `src-tauri/resources/jre`
 * dizinine NORMALİZE ederek yerleştirir.
 *
 * Normalize sonrası tüm platformlarda yapı aynıdır:
 *   src-tauri/resources/jre/bin/java[.exe]
 *   src-tauri/resources/jre/lib/...
 * (macOS arşivindeki `Contents/Home` katmanı düzleştirilir.)
 *
 * Kullanım:
 *   pnpm fetch-jre                      # host platform/mimari için
 *   pnpm fetch-jre --os linux --arch x64
 *   pnpm fetch-jre --os mac   --arch aarch64
 *   pnpm fetch-jre --os windows --arch x64
 *
 * Bağımlılık yok (Node 18+ yerleşik fetch + sistem tar/unzip kullanılır).
 */

import { createWriteStream } from "node:fs";
import { mkdir, rm, readdir, stat, cp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const JRE_DEST = join(PROJECT_ROOT, "src-tauri", "resources", "jre");

/** CLI argümanlarını ayrıştırır (--os, --arch). */
function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--os") out.os = args[++i];
    else if (args[i] === "--arch") out.arch = args[++i];
  }
  return out;
}

/** Node platform/mimarisini Adoptium API terimlerine çevirir. */
function detectTarget(override) {
  const platformMap = { darwin: "mac", linux: "linux", win32: "windows" };
  const archMap = { x64: "x64", arm64: "aarch64" };

  const apiOs = override.os ?? platformMap[process.platform];
  const apiArch = override.arch ?? archMap[process.arch];

  if (!apiOs) throw new Error(`Desteklenmeyen platform: ${process.platform}`);
  if (!apiArch) throw new Error(`Desteklenmeyen mimari: ${process.arch}`);
  return { apiOs, apiArch };
}

/**
 * Denenecek mimari adaylarını döner. Temurin JRE 8'in bazı platform/mimari
 * kombinasyonları yoktur (örn. macOS aarch64 — Apple Silicon'da Rosetta ile x64
 * çalışır; Windows aarch64 da x64 emülasyonuyla çalışır). Bu durumlarda x64'e
 * düşülür.
 */
function archCandidates(apiOs, apiArch) {
  if (apiArch === "aarch64" && (apiOs === "mac" || apiOs === "windows")) {
    return ["aarch64", "x64"];
  }
  return [apiArch];
}

/** Adoptium "latest binary" yönlendirme URL'i. */
function downloadUrl(apiOs, apiArch) {
  // imageType=jre, jvmImpl=hotspot, GA (genel kullanıma açık), sürüm 8.
  return (
    `https://api.adoptium.net/v3/binary/latest/8/ga/${apiOs}/${apiArch}` +
    `/jre/hotspot/normal/eclipse?project=jdk`
  );
}

/** Aday mimarileri sırayla dener; ilk yanıt veren arşivi indirir. */
async function downloadFirstAvailable(apiOs, candidates, dest) {
  for (const arch of candidates) {
    const url = downloadUrl(apiOs, arch);
    console.log(`↓ Deneniyor (${apiOs}/${arch}): ${url}`);
    const res = await fetch(url, { redirect: "follow" });
    if (res.ok && res.body) {
      await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
      console.log(`✓ Arşiv kaydedildi (${arch}): ${dest}`);
      return arch;
    }
    console.log(`  · ${arch} mevcut değil (HTTP ${res.status})`);
  }
  throw new Error(
    `JRE 8 indirilemedi: ${apiOs} için denenen mimariler [${candidates.join(", ")}] mevcut değil`,
  );
}

/** Arşivi (.tar.gz veya .zip) hedef dizine açar. */
function extract(archivePath, intoDir, isZip) {
  if (isZip && process.platform === "win32") {
    // Windows: PowerShell Expand-Archive en güvenilir yol.
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -Force -LiteralPath '${archivePath}' -DestinationPath '${intoDir}'`,
      ],
      { stdio: "inherit" },
    );
  } else {
    // macOS/Linux (ve Windows'ta bsdtar): tar hem .tar.gz hem .zip açar.
    execFileSync("tar", ["-xf", archivePath, "-C", intoDir], { stdio: "inherit" });
  }
}

/**
 * JRE dosyalarının izinlerini normalize eder. Temurin arşivindeki bazı dosyalar
 * salt-okunur (444) gelir; Tauri'nin dev modunda kaynakları `target/` altına
 * kopyalama adımı, salt-okunur hedef dosyaların üzerine yeniden yazamayıp
 * "Permission denied" verir. Sahibe yazma izni vererek (ve macOS karantina
 * xattr'larını temizleyerek) bu sorun kalıcı olarak önlenir. Windows'ta gerekmez.
 */
function normalizePermissions(dir) {
  if (process.platform === "win32") return;
  try {
    execFileSync("chmod", ["-R", "u+w", dir], { stdio: "ignore" });
  } catch {
    /* izin normalizasyonu kritik değil */
  }
  if (process.platform === "darwin") {
    try {
      execFileSync("xattr", ["-cr", dir], { stdio: "ignore" });
    } catch {
      /* xattr temizliği kritik değil */
    }
  }
}

/** Açılan dizindeki tek üst-düzey klasörü bulur. */
async function findExtractedRoot(dir) {
  const entries = await readdir(dir);
  for (const name of entries) {
    const full = join(dir, name);
    if ((await stat(full)).isDirectory()) return full;
  }
  throw new Error("Açılan arşivde kök dizin bulunamadı");
}

/** JRE home'u bulur (macOS'ta Contents/Home, diğerlerinde kök). */
async function resolveJreHome(extractedRoot) {
  const macHome = join(extractedRoot, "Contents", "Home");
  try {
    if ((await stat(macHome)).isDirectory()) return macHome;
  } catch {
    /* macOS dışı — kökü kullan */
  }
  return extractedRoot;
}

async function main() {
  const override = parseArgs();
  const { apiOs, apiArch } = detectTarget(override);
  const isZip = apiOs === "windows";
  const candidates = archCandidates(apiOs, apiArch);

  console.log(`» Hedef: ${apiOs}/${apiArch} (JRE 8)`);

  const work = await mkdtempSafe();
  const archive = join(work, isZip ? "jre.zip" : "jre.tar.gz");

  try {
    await downloadFirstAvailable(apiOs, candidates, archive);

    const extractDir = join(work, "extracted");
    await mkdir(extractDir, { recursive: true });
    extract(archive, extractDir, isZip);

    const root = await findExtractedRoot(extractDir);
    const home = await resolveJreHome(root);

    // Hedefi temizle (yalnızca .gitkeep kalsın), sonra JRE home içeriğini kopyala.
    await rm(JRE_DEST, { recursive: true, force: true });
    await mkdir(JRE_DEST, { recursive: true });
    await cp(home, JRE_DEST, { recursive: true });

    normalizePermissions(JRE_DEST);

    // Dizinin git tarafından izlenmeye devam etmesi için .gitkeep'i geri yaz
    // (JRE içeriği .gitignore ile hariç tutulur; klasörün kendisi korunmalı).
    await writeFile(
      join(JRE_DEST, ".gitkeep"),
      "Paketlenmiş JRE 1.8 dizini. İçerik `pnpm fetch-jre` ile doldurulur ve\n" +
        ".gitignore ile sürüm kontrolünden hariç tutulur; yalnızca bu dosya izlenir.\n",
    );

    console.log(`✓ JRE normalize edildi → ${JRE_DEST}`);
    const javaBin = join(JRE_DEST, "bin", apiOs === "windows" ? "java.exe" : "java");
    console.log(`  Doğrulama: ${javaBin}`);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/** Geçici çalışma dizini oluşturur. */
async function mkdtempSafe() {
  const dir = join(tmpdir(), `mersel-jre-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
