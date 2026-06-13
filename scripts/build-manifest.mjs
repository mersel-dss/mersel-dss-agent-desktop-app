#!/usr/bin/env node
/**
 * Servis sürüm manifesti üreticisi (SERVER tarafında çalışır — GitHub Actions).
 *
 * NEDEN: Kimliksiz `api.github.com` IP başına saatte yalnız 60 istek verir;
 * kurumsal NAT (tek genel IP arkasındaki onlarca kişi) bu limiti anında tüketip
 * 403 yer. Çözüm: istemci api.github.com'a HİÇ gitmesin. Bunun yerine bu betik
 * 4 servis reposunun son release'ini SUNUCUDA token'la (5000 istek/saat) çözer
 * ve istemcinin tek bir CDN URL'sinden (GitHub Pages, Fastly) okuyacağı statik
 * bir `manifest.json` üretir. Jar/asset indirmeleri zaten github.com release
 * CDN'inden yapılır (o da 60/saat API kotasına tabi değildir).
 *
 * Çıktı: `_site/manifest.json` (+ küçük bir index.html). Pages'e deploy edilir.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
const PAGES_URL =
  "https://mersel-dss.github.io/mersel-dss-agent-desktop-app/manifest.json";

// ── Cloudflare R2 aynası (opsiyonel) ───────────────────────────────────────
// Tanımlıysa servis asset'leri R2'ye aynalanır ve manifest'teki indirme URL'leri
// R2 tabanına yeniden yazılır (TR'den hızlı indirme, ücretsiz egress). Tanımlı
// değilse hiçbir şey yapılmaz; URL'ler GitHub'da kalır.
const R2 = {
  bucket: process.env.R2_BUCKET || "",
  base: (process.env.R2_PUBLIC_BASE || "").replace(/\/$/, ""),
  endpoint: process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : "",
};
R2.enabled = !!(
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  R2.bucket &&
  R2.base &&
  R2.endpoint
);

/** Asset adından kabaca content-type tahmini (cache/serve için). */
function guessContentType(name) {
  if (name.endsWith(".jar")) return "application/java-archive";
  if (name.endsWith(".zip")) return "application/zip";
  if (name.endsWith(".tar.gz") || name.endsWith(".tgz")) return "application/gzip";
  return "application/octet-stream";
}

/** R2 nesne anahtarı: services/<kind>/<tag>/<dosya>. */
function r2Key(kind, tag, name) {
  return `services/${kind}/${tag}/${name}`;
}

/**
 * Bu asset uygulamanın GERÇEKTEN indirdiği bir asset mi? Yalnız bunları aynalarız.
 * (src-tauri/src/config.rs'teki seçim mantığıyla uyumlu.) Servis repoları kendi
 * bağımsız kurulumlarını (.dmg/.AppImage/.exe), SBOM'ları, checksum'ları da
 * yayınlar; bunlar masaüstü uygulamasınca KULLANILMAZ — aynalamayız (boşa
 * depolama/işlem olmasın, ücretsiz katman korunsun).
 *   • agent/verifier/xslt (Java): yalnız `*.jar`
 *   • html-to-pdf (native): yalnız platform paketleri (win-x64.zip / osx-arm64.tar.gz / linux-x64.tar.gz)
 */
function shouldMirror(kind, name) {
  if (kind === "html-to-pdf") {
    return /-win-x64\.zip$|-osx-arm64\.tar\.gz$|-linux-x64\.tar\.gz$/.test(name);
  }
  // agent / verifier / xslt → Spring Boot fat-jar.
  return name.endsWith(".jar");
}

/** Nesne R2'de zaten var mı? (head-object — yetkili, cache'siz kontrol) */
function existsOnR2(key) {
  try {
    execFileSync(
      "aws",
      ["s3api", "head-object", "--bucket", R2.bucket, "--key", key, "--endpoint-url", R2.endpoint],
      { stdio: "ignore" },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Bir servisin asset'lerini R2'ye aynalar (idempotent) ve manifest girdisindeki
 * `browser_download_url`'leri R2 public URL'ine yeniden yazar. En iyi çabayla:
 * bir asset aynalanamazsa o asset'in GitHub URL'i korunur (kırılmaz).
 */
function mirrorToR2(kind, entry) {
  if (!R2.enabled || !entry?.assets?.length) return;
  const tag = entry.tag_name || "untagged";
  for (const asset of entry.assets) {
    if (!shouldMirror(kind, asset.name)) continue; // uygulamanın indirmediği asset'i aynalama
    const key = r2Key(kind, tag, asset.name);
    const publicUrl = `${R2.base}/${key}`;
    try {
      if (!existsOnR2(key)) {
        const tmp = join(tmpdir(), `r2-${Date.now()}-${asset.name}`);
        // GitHub asset CDN'i (objects.githubusercontent.com) imzalı yönlendirir;
        // ekstra Authorization başlığı imzayı bozabileceğinden kimliksiz indiririz
        // (public repolar için yeterli).
        execFileSync("curl", ["-fSL", "-o", tmp, asset.browser_download_url], {
          stdio: "inherit",
        });
        execFileSync(
          "aws",
          [
            "s3",
            "cp",
            tmp,
            `s3://${R2.bucket}/${key}`,
            "--endpoint-url",
            R2.endpoint,
            "--cache-control",
            "public, max-age=31536000, immutable",
            "--content-type",
            guessContentType(asset.name),
          ],
          { stdio: "inherit" },
        );
        rmSync(tmp, { force: true });
        console.log(`    ⇪ R2'ye aynalandı: ${key}`);
      } else {
        console.log(`    = R2'de mevcut: ${key}`);
      }
      asset.browser_download_url = publicUrl; // manifest'i R2'ye çevir
    } catch (e) {
      console.warn(
        `    ! R2 ayna başarısız (${key}): ${String(e?.message ?? e)} → GitHub URL korunuyor`,
      );
    }
  }
}

// kind -> owner/repo (src-tauri/src/config.rs ile birebir aynı olmalı)
const SERVICES = {
  agent: "mersel-dss/mersel-dss-agent-signer-java",
  verifier: "mersel-dss/mersel-dss-verifier-api-java",
  xslt: "mersel-os/ebelge-xslt-service",
  "html-to-pdf": "mersel-os/html-to-pdf",
};

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "mersel-manifest-builder",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

const gh = (path) => fetch(`https://api.github.com${path}`, { headers });

/** Bir release JSON'unu istemcinin beklediği sade biçime indirger.
 *  Anahtarlar Rust `parse_release` ile birebir eşleşir (tag_name, name,
 *  published_at, assets[].name/browser_download_url/size). */
function pick(release) {
  return {
    tag_name: release.tag_name ?? "",
    name: release.name ?? null,
    published_at: release.published_at ?? null,
    prerelease: !!release.prerelease,
    assets: (release.assets ?? []).map((a) => ({
      name: a.name,
      browser_download_url: a.browser_download_url,
      size: a.size ?? 0,
    })),
  };
}

/** Bir reponun son release'ini çözer. `/releases/latest` TASLAK + PRERELEASE'i
 *  dışladığından 404'te tüm listeden en yeni taslak-olmayanı seçer. */
async function resolve(repo) {
  let res = await gh(`/repos/${repo}/releases/latest`);
  if (res.ok) return pick(await res.json());
  if (res.status === 403 || res.status === 429) {
    throw new Error(`hız sınırı (HTTP ${res.status}) — token gerekli`);
  }
  if (res.status === 404) {
    res = await gh(`/repos/${repo}/releases?per_page=10`);
    if (res.ok) {
      const rel = (await res.json()).find((r) => !r.draft);
      if (rel) return pick(rel);
    }
    throw new Error("yayınlanmış release yok");
  }
  throw new Error(`çözülemedi (HTTP ${res.status})`);
}

// Yayındaki mevcut manifesti çek; bir servis bu çalışmada çözülemezse eski
// (sağlam) girdisini koru — kısmi/regresyonlu manifest yayınlamayalım.
let previous = {};
try {
  const r = await fetch(PAGES_URL, { headers: { "User-Agent": headers["User-Agent"] } });
  if (r.ok) previous = (await r.json()).services ?? {};
} catch {
  // ilk çalıştırma / Pages henüz yok — sorun değil.
}

const services = {};
const errors = {};
for (const [kind, repo] of Object.entries(SERVICES)) {
  try {
    services[kind] = await resolve(repo);
    console.log(
      `✓ ${kind} → ${services[kind].tag_name} (${services[kind].assets.length} asset)`,
    );
    // Asset'leri R2'ye aynala + manifest URL'lerini R2'ye yaz (R2 tanımlıysa).
    mirrorToR2(kind, services[kind]);
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (previous[kind]) {
      services[kind] = previous[kind];
      console.warn(`! ${kind}: ${msg} → önceki manifest girdisi korundu`);
    } else {
      errors[kind] = msg;
      console.error(`✗ ${kind}: ${msg}`);
    }
  }
}

const manifest = {
  schema: 1,
  generatedAt: new Date().toISOString(),
  services,
  ...(Object.keys(errors).length ? { errors } : {}),
};

await mkdir("_site", { recursive: true });
await writeFile("_site/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
await writeFile(
  "_site/index.html",
  '<!doctype html><meta charset="utf-8"><title>İmzamatik servis manifesti</title>' +
    "<p>İmzamatik servislerinin sürüm manifesti: " +
    '<a href="manifest.json">manifest.json</a></p>\n',
);

console.log(`\nmanifest.json yazıldı (${Object.keys(services).length} servis).`);
// Hiçbir servis çözülemediyse (ve önceki manifest de yoksa) hata ile çık ki
// boş bir manifest yayınlanmasın.
if (Object.keys(services).length === 0) {
  console.error("HİÇBİR servis çözülemedi — manifest yayınlanmayacak.");
  process.exit(1);
}
