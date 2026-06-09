#!/usr/bin/env node
/**
 * Platforma özel Adoptium Temurin JRE'leri indirir ve `src-tauri/resources/`
 * altına NORMALİZE ederek yerleştirir. İki ayrı runtime paketlenir çünkü
 * servisler farklı Java sürümleri ister:
 *   • Java 8  → `src-tauri/resources/jre`    (imza/doğrulama; mali mühür/PKCS#11)
 *   • Java 21 → `src-tauri/resources/jre21`  (XSLT önizleme; Spring Boot 3.4 + Saxon)
 *
 * Normalize sonrası tüm platformlarda yapı aynıdır:
 *   src-tauri/resources/<dest>/bin/java[.exe]
 *   src-tauri/resources/<dest>/lib/...
 * (macOS arşivindeki `Contents/Home` katmanı düzleştirilir.)
 *
 * Kullanım:
 *   pnpm fetch-jre                      # her iki sürüm, host platform/mimari için
 *   pnpm fetch-jre --version 21         # yalnızca Java 21
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
const RESOURCES_DIR = join(PROJECT_ROOT, "src-tauri", "resources");

/**
 * Paketlenecek JRE'ler. Her biri Adoptium feature sürümü + hedef alt dizin.
 * Servis-başına minimum Java sürümüyle (config.rs `min_java_major`) tutarlı:
 *   8  → jre   (imza/doğrulama),  21 → jre21 (XSLT önizleme).
 */
const JRE_TARGETS = [
  { version: "8", dir: "jre" },
  { version: "21", dir: "jre21" },
];

/** CLI argümanlarını ayrıştırır (--os, --arch, --version). */
function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--os") out.os = args[++i];
    else if (args[i] === "--arch") out.arch = args[++i];
    else if (args[i] === "--version") out.version = args[++i];
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
 * Denenecek mimari adaylarını döner. Temurin'in bazı platform/mimari
 * kombinasyonları yoktur (örn. Windows aarch64 — x64 emülasyonuyla çalışır).
 * Bu durumlarda x64'e düşülür.
 *
 * NOT: macOS aarch64 + Java 8, Temurin'de yoktur. Eskiden x64'e düşülüp Rosetta
 * ile çalıştırılıyordu; ancak Apple Silicon'da Rosetta x86_64 Java 8 süreçleri
 * güvenilmez biçimde askıda kalıp öldürülemez "zombie"lere dönüşerek imza ve
 * doğrulama servislerinin hiç başlamamasına yol açıyordu. Bu kombinasyon artık
 * `usesZulu()` üzerinden native arm64 Azul Zulu JRE 8 ile karşılanır.
 */
function archCandidates(apiOs, apiArch) {
  if (apiArch === "aarch64" && apiOs === "windows") {
    return ["aarch64", "x64"];
  }
  return [apiArch];
}

/**
 * Bu hedef için Adoptium yerine Azul Zulu kullanılmalı mı? Yalnızca Adoptium'un
 * native build sağlamadığı macOS aarch64 + Java 8 kombinasyonu için. Azul Zulu,
 * Apple Silicon için native arm64 JRE 8 yayınlar (Rosetta'ya gerek kalmaz).
 */
function usesZulu(version, apiOs, apiArch) {
  return version === "8" && apiOs === "mac" && apiArch === "aarch64";
}

/** Adoptium OS/mimari terimlerini Azul Zulu metadata API terimlerine çevirir. */
function zuluTerms(apiOs, apiArch) {
  const osMap = { mac: "macos", linux: "linux", windows: "windows" };
  const archMap = { aarch64: "aarch64", x64: "x64" };
  return { zuluOs: osMap[apiOs], zuluArch: archMap[apiArch] };
}

/**
 * Azul Zulu metadata API'sinden, verilen sürüm/OS/mimari için en güncel
 * (GA, CA) JRE indirme URL'ini çözer. JavaFX (`-fx-`) ve CRaC varyantları
 * elenir; düz JRE tercih edilir.
 */
async function resolveZuluUrl(version, apiOs, apiArch) {
  const { zuluOs, zuluArch } = zuluTerms(apiOs, apiArch);
  const archive = apiOs === "windows" ? "zip" : "tar.gz";
  const api =
    `https://api.azul.com/metadata/v1/zulu/packages/` +
    `?java_version=${version}&os=${zuluOs}&arch=${zuluArch}` +
    `&java_package_type=jre&archive_type=${archive}` +
    `&latest=true&release_status=ga&availability_types=CA&page=1&page_size=20`;
  const res = await fetch(api, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Azul Zulu metadata sorgusu başarısız (HTTP ${res.status})`);
  }
  const packages = await res.json();
  const candidate = packages.find(
    (p) => !/-fx-/.test(p.name) && !/crac/i.test(p.name),
  );
  if (!candidate?.download_url) {
    throw new Error(
      `Azul Zulu JRE ${version} bulunamadı: ${zuluOs}/${zuluArch}`,
    );
  }
  return candidate.download_url;
}

/** Adoptium "latest binary" yönlendirme URL'i. */
function downloadUrl(version, apiOs, apiArch) {
  // imageType=jre, jvmImpl=hotspot, GA (genel kullanıma açık).
  return (
    `https://api.adoptium.net/v3/binary/latest/${version}/ga/${apiOs}/${apiArch}` +
    `/jre/hotspot/normal/eclipse?project=jdk`
  );
}

/** Aday mimarileri sırayla dener; ilk yanıt veren arşivi indirir. */
async function downloadFirstAvailable(version, apiOs, candidates, dest) {
  for (const arch of candidates) {
    const url = downloadUrl(version, apiOs, arch);
    console.log(`↓ Deneniyor (JRE ${version} · ${apiOs}/${arch}): ${url}`);
    const res = await fetch(url, { redirect: "follow" });
    if (res.ok && res.body) {
      await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
      console.log(`✓ Arşiv kaydedildi (${arch}): ${dest}`);
      return arch;
    }
    console.log(`  · ${arch} mevcut değil (HTTP ${res.status})`);
  }
  throw new Error(
    `JRE ${version} indirilemedi: ${apiOs} için denenen mimariler [${candidates.join(", ")}] mevcut değil`,
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

/** Bir dizin gerçek bir JRE home mu? (`bin/java[.exe]` içeriyor mu) */
async function isJreHome(dir) {
  for (const exe of ["java", "java.exe"]) {
    try {
      if ((await stat(join(dir, "bin", exe))).isFile()) return true;
    } catch {
      /* yok — diğer adı dene */
    }
  }
  return false;
}

/**
 * JRE home'u bulur. Dağıtıma göre yapı değişir:
 *   • Adoptium macOS:  <root>/Contents/Home
 *   • Azul Zulu macOS: <root>/zulu-N.jre/Contents/Home
 *   • Linux/Windows:   <root>
 * `bin/java` içeren ilk dizini BFS ile arayarak tüm bu yapıları karşılar.
 */
async function resolveJreHome(extractedRoot) {
  const queue = [extractedRoot];
  while (queue.length > 0) {
    const dir = queue.shift();
    if (await isJreHome(dir)) return dir;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) queue.push(join(dir, entry.name));
    }
  }
  throw new Error(`JRE home bulunamadı (bin/java yok): ${extractedRoot}`);
}

/** Tek bir JRE sürümünü indirir, normalize eder ve `resources/<dir>`'e yerleştirir. */
async function fetchOne({ version, dir }, apiOs, apiArch) {
  const isZip = apiOs === "windows";
  const candidates = archCandidates(apiOs, apiArch);
  const dest = join(RESOURCES_DIR, dir);

  console.log(`» Hedef: ${apiOs}/${apiArch} (JRE ${version} → resources/${dir})`);

  const work = await mkdtempSafe();
  const archive = join(work, isZip ? "jre.zip" : "jre.tar.gz");

  try {
    if (usesZulu(version, apiOs, apiArch)) {
      const url = await resolveZuluUrl(version, apiOs, apiArch);
      console.log(`↓ Azul Zulu (native ${apiArch}, JRE ${version}): ${url}`);
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok || !res.body) {
        throw new Error(`Azul Zulu indirme başarısız (HTTP ${res.status})`);
      }
      await pipeline(Readable.fromWeb(res.body), createWriteStream(archive));
      console.log(`✓ Arşiv kaydedildi: ${archive}`);
    } else {
      await downloadFirstAvailable(version, apiOs, candidates, archive);
    }

    const extractDir = join(work, "extracted");
    await mkdir(extractDir, { recursive: true });
    extract(archive, extractDir, isZip);

    const root = await findExtractedRoot(extractDir);
    const home = await resolveJreHome(root);

    // Hedefi temizle (yalnızca .gitkeep kalsın), sonra JRE home içeriğini kopyala.
    await rm(dest, { recursive: true, force: true });
    await mkdir(dest, { recursive: true });
    // `dereference: true` ZORUNLU: Linux Temurin JRE'sinde modül-başına legal
    // dosyaları (ASSEMBLY_EXCEPTION, LICENSE...) `legal/java.base/`e işaret eden
    // göreli sembolik bağlardır. Node `fs.cp` varsayılanı (verbatim kapalı) bu
    // bağları, birazdan silinecek GEÇİCİ çıkarma dizinine ait MUTLAK yola yeniden
    // yazar; `work` temizlenince bağlar kırılır ve Tauri build script'inin kaynak
    // varlık (exists) kontrolü "resource path ... doesn't exist" ile patlar.
    // Sembolik bağları gerçek dosyalara çözerek tamamen kendi içinde tutarlı,
    // bağsız bir ağaç üretiriz (paketleyiciler için de en güvenli biçim).
    await cp(home, dest, { recursive: true, dereference: true });

    normalizePermissions(dest);

    // Dizinin git tarafından izlenmeye devam etmesi için .gitkeep'i geri yaz
    // (JRE içeriği .gitignore ile hariç tutulur; klasörün kendisi korunmalı).
    await writeFile(
      join(dest, ".gitkeep"),
      `Paketlenmiş JRE ${version} dizini. İçerik \`pnpm fetch-jre\` ile doldurulur ve\n` +
        ".gitignore ile sürüm kontrolünden hariç tutulur; yalnızca bu dosya izlenir.\n",
    );

    const javaBin = join(dest, "bin", apiOs === "windows" ? "java.exe" : "java");
    console.log(`✓ JRE ${version} normalize edildi → ${dest}`);
    console.log(`  Doğrulama: ${javaBin}`);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function main() {
  const override = parseArgs();
  const { apiOs, apiArch } = detectTarget(override);

  // `--version` verildiyse yalnız o sürümü, aksi hâlde tüm hedefleri indir.
  const targets = override.version
    ? JRE_TARGETS.filter((t) => t.version === override.version)
    : JRE_TARGETS;
  if (targets.length === 0) {
    throw new Error(
      `Bilinmeyen sürüm: ${override.version}. Geçerli: ${JRE_TARGETS.map((t) => t.version).join(", ")}`,
    );
  }

  for (const target of targets) {
    await fetchOne(target, apiOs, apiArch);
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
