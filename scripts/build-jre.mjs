#!/usr/bin/env node
/**
 * `jlink` ile MİNİMAL bir Java 21 runtime üretir ve `src-tauri/resources/jre21`
 * altına yerleştirir. Eskiden tam Temurin JRE (~151MB) gömülüyordu; bu script
 * yalnızca servislerin (agent/verifier/xslt) gerçekten kullandığı modülleri
 * içeren ~57MB'lik özel bir runtime üretir (~2.6 kat küçük, platform başına
 * ~94MB kazanç).
 *
 * jlink PLATFORMA ÖZGÜDÜR: host platformun JDK'sıyla yalnız o platform için
 * runtime üretir. Bu yüzden CI matrisinde her runner kendi `jre21`'ini kurar
 * (macOS arm64 / Linux x64 / Windows x64).
 *
 * JDK kaynağı (öncelik sırası):
 *   1. `--jdk <home>` argümanı
 *   2. `JAVA_HOME` (CI'da `actions/setup-java` Temurin 21 → jmods + jlink hazır)
 *   3. PATH'teki `jlink`
 *   4. Hiçbiri yoksa: Adoptium Temurin JDK 21 indirilir (Azul Zulu yedeği ile).
 *
 * Modül seti `jdeps` ile servis jar'larından çıkarıldı; ÜSTÜNE reflection ile
 * yüklenen ve jdeps'in göremediği modüller elle eklendi (PKCS#11, EC, Türkçe
 * locale/charset, JAAS, ZIP FS). Detay aşağıdaki MODULES sabitinde.
 *
 * Kullanım:
 *   pnpm build-jre                         # host platform için
 *   pnpm build-jre --jdk /path/to/jdk21    # belirli bir JDK ile
 *   pnpm build-jre --os windows --arch x64 # indirme hedefini zorla (JDK yoksa)
 *
 * Bağımlılık yok (Node 18+ yerleşik fetch + sistem tar/unzip).
 */

import { createWriteStream } from "node:fs";
import { mkdir, rm, readdir, stat, cp, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const RESOURCES_DIR = join(PROJECT_ROOT, "src-tauri", "resources");
const DEST_DIR = join(RESOURCES_DIR, "jre21");
const JDK_VERSION = "21";

/**
 * Custom runtime'a alınacak JDK modülleri.
 *
 * Taban (jdeps): agent/verifier/xslt fat-jar'larının BOOT-INF içeriğine
 * `jdeps --multi-release 21 -verbose:class` çalıştırılarak STATİK olarak
 * tespit edilen modüller.
 *
 * Elle eklenenler (jdeps GÖREMEZ — runtime'da Security provider / SPI / isim
 * ile yüklenir, statik referans yoktur):
 *   • jdk.crypto.cryptoki → PKCS#11 (SunPKCS11): mali mühür / akıllı kart imzası
 *   • jdk.crypto.ec       → SunEC: EC anahtar/sertifika ve TLS eğrileri
 *   • jdk.localedata      → tr_TR locale (tarih/sayı/ay adları)
 *   • jdk.charsets        → windows-1254 / ISO-8859-9 (Türkçe kodlamalar)
 *   • jdk.security.auth   → JAAS login modülleri (PKCS#11 KeyStore login)
 *   • jdk.zipfs           → ZIP FileSystem sağlayıcısı (jar/zip Path erişimi)
 *
 * NOT: Bu set bir minimal runtime'da imza+doğrulama+XSLT+Türkçe biçimlendirmenin
 * çalıştığı fiilen test edilerek doğrulandı. Modül eklerken/çıkarırken servisleri
 * (özellikle PKCS#11 imzasını) tekrar test et.
 */
const MODULES = [
  // jdeps tabanı:
  "java.base",
  "java.compiler",
  "java.datatransfer",
  "java.desktop", // PDFBox/AWT geometrisi
  "java.instrument", // Spring (agent/aspectj)
  "java.logging",
  "java.management",
  "java.naming",
  "java.net.http",
  "java.prefs",
  "java.rmi",
  "java.scripting",
  "java.security.jgss",
  "java.smartcardio",
  "java.sql",
  "java.xml",
  "java.xml.crypto", // XAdES / XML imza
  "jdk.httpserver",
  "jdk.jfr",
  "jdk.management",
  "jdk.unsupported", // sun.misc.Unsafe (Netty vb.)
  // Reflection/SPI ile yüklenen — elle eklendi:
  "jdk.crypto.cryptoki",
  "jdk.crypto.ec",
  "jdk.localedata",
  "jdk.charsets",
  "jdk.security.auth",
  "jdk.zipfs",
];

/** Runtime'da paketlenecek locale'ler (jdk.localedata'yı kırparak boyutu düşürür). */
const INCLUDE_LOCALES = "en,tr";

/** CLI argümanlarını ayrıştırır (--os, --arch, --jdk). */
function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--os") out.os = args[++i];
    else if (args[i] === "--arch") out.arch = args[++i];
    else if (args[i] === "--jdk") out.jdk = args[++i];
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

const exe = (name) => (process.platform === "win32" ? `${name}.exe` : name);

/** Bir dizin, jlink yapabilen geçerli bir JDK 21 home mu? (bin/jlink + jmods + sürüm) */
async function isUsableJdk(home) {
  if (!home) return false;
  const jlink = join(home, "bin", exe("jlink"));
  const jmods = join(home, "jmods");
  if (!existsSync(jlink) || !existsSync(jmods)) return false;
  // Sürümü `release` dosyasından doğrula (java süreci başlatmadan).
  try {
    const release = await readFile(join(home, "release"), "utf8");
    const m = release.match(/JAVA_VERSION="?(\d+)/);
    if (m && m[1] === JDK_VERSION) return true;
  } catch {
    /* release okunamadı; java -version'a düş */
  }
  try {
    const out = execFileSync(join(home, "bin", exe("java")), ["-version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return new RegExp(`"?${JDK_VERSION}[.\\"]`).test(out);
  } catch {
    return false;
  }
}

/**
 * Verilen JDK home'dan jlink/jmods'a sahip ALT dizini bulur (macOS Adoptium'da
 * `Contents/Home`). bin/jlink içeren ilk dizini BFS ile arar.
 */
async function resolveJdkHome(root) {
  const queue = [root];
  while (queue.length > 0) {
    const dir = queue.shift();
    if (await isUsableJdk(dir)) return dir;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) queue.push(join(dir, entry.name));
    }
  }
  return null;
}

/** Kullanılabilir bir JDK 21 bulur: --jdk → JAVA_HOME → PATH → null. */
async function findExistingJdk(override) {
  if (override.jdk) {
    const home = (await resolveJdkHome(override.jdk)) ?? null;
    if (home) return home;
    throw new Error(`--jdk geçerli bir JDK ${JDK_VERSION} değil: ${override.jdk}`);
  }
  if (process.env.JAVA_HOME && (await isUsableJdk(process.env.JAVA_HOME))) {
    return process.env.JAVA_HOME;
  }
  // PATH'te jlink var mı? (where/which)
  try {
    const finder = process.platform === "win32" ? "where" : "which";
    const found = execFileSync(finder, ["jlink"], { encoding: "utf8" })
      .split(/\r?\n/)[0]
      .trim();
    if (found) {
      const home = dirname(dirname(found)); // <home>/bin/jlink
      if (await isUsableJdk(home)) return home;
    }
  } catch {
    /* PATH'te jlink yok */
  }
  return null;
}

/** Adoptium "latest binary" JDK yönlendirme URL'i. */
function adoptiumUrl(apiOs, apiArch) {
  return (
    `https://api.adoptium.net/v3/binary/latest/${JDK_VERSION}/ga/${apiOs}/${apiArch}` +
    `/jdk/hotspot/normal/eclipse?project=jdk`
  );
}

/** Azul Zulu metadata API'sinden JDK indirme URL'i çözer (Adoptium yedeği). */
async function zuluUrl(apiOs, apiArch) {
  const osMap = { mac: "macos", linux: "linux", windows: "windows" };
  const archive = apiOs === "windows" ? "zip" : "tar.gz";
  const api =
    `https://api.azul.com/metadata/v1/zulu/packages/` +
    `?java_version=${JDK_VERSION}&os=${osMap[apiOs]}&arch=${apiArch}` +
    `&java_package_type=jdk&archive_type=${archive}` +
    `&latest=true&release_status=ga&availability_types=CA&page=1&page_size=20`;
  const res = await fetch(api, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Azul metadata sorgusu başarısız (HTTP ${res.status})`);
  const packages = await res.json();
  const candidate = packages.find(
    (p) => !/-fx-/.test(p.name) && !/crac/i.test(p.name),
  );
  if (!candidate?.download_url) {
    throw new Error(`Azul Zulu JDK ${JDK_VERSION} bulunamadı: ${apiOs}/${apiArch}`);
  }
  return candidate.download_url;
}

/** URL'i hedefe indirir. */
async function download(url, dest) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`İndirme başarısız (HTTP ${res.status}): ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

/** Arşivi açar (.zip Windows'ta PowerShell, aksi halde tar). */
function extract(archivePath, intoDir, isZip) {
  if (isZip && process.platform === "win32") {
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
    execFileSync("tar", ["-xf", archivePath, "-C", intoDir], { stdio: "inherit" });
  }
}

/** JDK yoksa indirir, açar ve home yolunu döner. */
async function downloadJdk(apiOs, apiArch, work) {
  const isZip = apiOs === "windows";
  const archive = join(work, isZip ? "jdk.zip" : "jdk.tar.gz");

  let url;
  try {
    url = adoptiumUrl(apiOs, apiArch);
    console.log(`↓ Adoptium JDK ${JDK_VERSION} (${apiOs}/${apiArch}): ${url}`);
    await download(url, archive);
  } catch (err) {
    console.log(`  · Adoptium başarısız (${err.message}); Azul Zulu deneniyor…`);
    url = await zuluUrl(apiOs, apiArch);
    console.log(`↓ Azul Zulu JDK ${JDK_VERSION}: ${url}`);
    await download(url, archive);
  }

  const extractDir = join(work, "jdk-extracted");
  await mkdir(extractDir, { recursive: true });
  extract(archive, extractDir, isZip);

  const home = await resolveJdkHome(extractDir);
  if (!home) throw new Error("İndirilen arşivde kullanılabilir JDK home bulunamadı");
  return home;
}

/** Dosya izinlerini normalize eder (salt-okunur + macOS karantina). */
function normalizePermissions(dir) {
  if (process.platform === "win32") return;
  try {
    execFileSync("chmod", ["-R", "u+w", dir], { stdio: "ignore" });
  } catch {
    /* kritik değil */
  }
  if (process.platform === "darwin") {
    try {
      execFileSync("xattr", ["-cr", dir], { stdio: "ignore" });
    } catch {
      /* kritik değil */
    }
  }
}

/** jlink ile minimal runtime üretir → resources/jre21. */
async function runJlink(jdkHome, work) {
  const jlink = join(jdkHome, "bin", exe("jlink"));
  const modulePath = join(jdkHome, "jmods");
  // jlink çıktı dizini ÖNCEDEN var olmamalı; önce temp'e üret, sonra yerleştir.
  const out = join(work, "jre21-out");

  const args = [
    "--module-path",
    modulePath,
    "--add-modules",
    MODULES.join(","),
    "--include-locales=" + INCLUDE_LOCALES,
    "--strip-debug",
    "--no-man-pages",
    "--no-header-files",
    "--compress=zip-6",
    "--output",
    out,
  ];
  console.log(`» jlink (${MODULES.length} modül, locales=${INCLUDE_LOCALES})`);
  execFileSync(jlink, args, { stdio: "inherit" });

  // Hedefi temizle (yalnız .gitkeep kalacak), sonra çıktıyı kopyala.
  await rm(DEST_DIR, { recursive: true, force: true });
  await mkdir(DEST_DIR, { recursive: true });
  await cp(out, DEST_DIR, { recursive: true, dereference: true });
  normalizePermissions(DEST_DIR);

  await writeFile(
    join(DEST_DIR, ".gitkeep"),
    `jlink ile üretilen minimal Java ${JDK_VERSION} runtime dizini. İçerik\n` +
      "`pnpm build-jre` ile doldurulur ve .gitignore ile hariç tutulur; yalnız bu\n" +
      "dosya izlenir.\n",
  );

  const javaBin = join(DEST_DIR, "bin", exe("java"));
  console.log(`✓ Minimal runtime üretildi → ${DEST_DIR}`);
  console.log(`  Doğrulama: ${javaBin}`);
}

/** Geçici çalışma dizini. */
async function mkdtempSafe() {
  const dir = join(tmpdir(), `mersel-buildjre-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function main() {
  const override = parseArgs();
  const { apiOs, apiArch } = detectTarget(override);

  const work = await mkdtempSafe();
  try {
    let jdkHome = await findExistingJdk(override);
    if (jdkHome) {
      console.log(`✓ Mevcut JDK ${JDK_VERSION} kullanılıyor: ${jdkHome}`);
    } else {
      console.log(`· Kullanılabilir JDK ${JDK_VERSION} bulunamadı; indiriliyor…`);
      jdkHome = await downloadJdk(apiOs, apiArch, work);
      console.log(`✓ JDK indirildi: ${jdkHome}`);
    }
    await runJlink(jdkHome, work);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
