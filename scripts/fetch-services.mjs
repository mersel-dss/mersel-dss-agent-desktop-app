#!/usr/bin/env node
/**
 * Java servislerinin EN GÜNCEL jar'larını indirir ve `src-tauri/resources/services/`
 * altına GÖMÜLECEK biçimde yerleştirir. Böylece servisler installer'a paketlenir;
 * son kullanıcı makinesinde çalışma anında GitHub'dan indirme gerekmez (kurumsal
 * proxy/NAT arkasında bile çalışır) ve sürüm DESKTOP UYGULAMASINA KİLİTLENİR.
 *
 * Sürüm modeli:
 *   • Bu script SADECE bu workflow/build çalıştığında koşar (release.yml).
 *   • O an servislerin son sürümlerini çeker ve `services.lock.json`'a yazar.
 *   • Tekrar build alınana kadar gömülü sürümler DONMUŞ kalır.
 *   • Çalışma anında Rust tarafı önce gömülü artifact'ı kullanır; gömülü yoksa
 *     (örn. dev modunda fetch-services koşulmadıysa) eski runtime-indirme yoluna düşer.
 *
 * Kapsam: yalnız 3 Java servisi (agent / verifier / xslt). `.NET html-to-pdf`
 * servisi (Playwright/Chromium taşıdığı için ~yüzlerce MB) bilinçli olarak
 * gömülmez; gömülü artifact'ı bulunmadığından Rust tarafı onu runtime'da indirir.
 *
 * Sürüm çözümü: ÖNCE statik CDN manifesti (api.github.com'a dokunmaz, rate-limit
 * yemez), erişilemezse GitHub API'ye düşülür (token varsa `GITHUB_TOKEN`).
 *
 * Kullanım:
 *   pnpm fetch-services
 *
 * Bağımlılık yok (Node 18+ yerleşik fetch).
 */

import { createWriteStream } from "node:fs";
import { mkdir, rm, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const SERVICES_DIR = join(PROJECT_ROOT, "src-tauri", "resources", "services");

/** İstemcinin (ve Rust tarafının) sürüm okuduğu statik CDN manifesti. */
const MANIFEST_URL =
  "https://mersel-dss.github.io/mersel-dss-agent-desktop-app/manifest.json";

/**
 * Gömülecek Java servisleri. `config.rs`'teki descriptor'larla BİREBİR tutarlı
 * olmalıdır: `kind` → ServiceKind.as_str(), `jarPrefix` → jar_prefix.
 */
const SERVICES = [
  {
    kind: "agent",
    owner: "mersel-dss",
    repo: "mersel-dss-agent-signer-java",
    jarPrefix: "mersel-dss-agent-signer-api",
  },
  {
    kind: "verifier",
    owner: "mersel-dss",
    repo: "mersel-dss-verifier-api-java",
    jarPrefix: "mersel-dss-verify-api",
  },
  {
    kind: "xslt",
    owner: "mersel-os",
    repo: "ebelge-xslt-service",
    jarPrefix: "mersel-xslt-service",
  },
];

/** İsteğe bağlı GitHub token'ı (CI'da rate-limit'i 60→5000'e çıkarır). */
function authHeaders() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const headers = { "user-agent": "mersel-dss-agent-desktop" };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

/** Verilen asset listesinde jar prefix'ine uyan ilk `.jar`'ı seçer. */
function pickJarAsset(assets, jarPrefix) {
  if (!Array.isArray(assets)) return null;
  return (
    assets.find(
      (a) =>
        typeof a?.name === "string" &&
        a.name.startsWith(jarPrefix) &&
        a.name.endsWith(".jar"),
    ) ?? null
  );
}

/**
 * Bir servisin en güncel release'ini ve jar asset'ini çözer.
 * Önce CDN manifesti, sonra GitHub API (latest → tüm liste) denenir.
 * Dönüş: `{ tag, asset: { name, url, size } }`.
 */
async function resolveRelease(svc) {
  // 1) CDN manifesti (api.github.com'a dokunmaz).
  try {
    const res = await fetch(MANIFEST_URL, { headers: authHeaders() });
    if (res.ok) {
      const json = await res.json();
      const entry = json?.services?.[svc.kind];
      const asset = pickJarAsset(entry?.assets, svc.jarPrefix);
      if (entry?.tag_name && asset?.browser_download_url) {
        return {
          tag: entry.tag_name,
          asset: {
            name: asset.name,
            url: asset.browser_download_url,
            size: asset.size ?? 0,
          },
        };
      }
    }
  } catch {
    /* manifest erişilemedi → API'ye düş */
  }

  // 2) GitHub API: önce /releases/latest, 404 ise tüm liste (prerelease dahil).
  const base = `https://api.github.com/repos/${svc.owner}/${svc.repo}`;
  let release = null;
  const latest = await fetch(`${base}/releases/latest`, {
    headers: authHeaders(),
  });
  if (latest.ok) {
    release = await latest.json();
  } else if (latest.status === 404) {
    const list = await fetch(`${base}/releases?per_page=10`, {
      headers: authHeaders(),
    });
    if (list.ok) {
      const arr = await list.json();
      release = Array.isArray(arr) ? arr.find((r) => !r.draft) : null;
    }
  } else if (latest.status === 403 || latest.status === 429) {
    throw new Error(
      `${svc.kind}: GitHub API hız sınırı (${latest.status}). GITHUB_TOKEN tanımlayın.`,
    );
  }

  if (!release) {
    throw new Error(`${svc.kind}: yayınlanmış release bulunamadı (${svc.repo})`);
  }
  const asset = pickJarAsset(release.assets, svc.jarPrefix);
  if (!asset?.browser_download_url) {
    throw new Error(
      `${svc.kind}: '${svc.jarPrefix}*.jar' asset'i release'de yok (${release.tag_name})`,
    );
  }
  return {
    tag: release.tag_name,
    asset: {
      name: asset.name,
      url: asset.browser_download_url,
      size: asset.size ?? 0,
    },
  };
}

/** Bir asset'i hedef dosyaya stream eder. */
async function downloadTo(url, dest) {
  const res = await fetch(url, { headers: authHeaders(), redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`İndirme başarısız (HTTP ${res.status}): ${url}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

/** Bir servisin dizinindeki eski jar'ları (yeni indirilen hariç) temizler. */
async function cleanupOldJars(dir, keepName) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name !== keepName && name.endsWith(".jar")) {
      await rm(join(dir, name), { force: true });
    }
  }
}

/** Tek bir servisi indirir ve `resources/services/<kind>/`'e yerleştirir. */
async function fetchOne(svc, lock) {
  console.log(`» ${svc.kind} (${svc.repo}) çözümleniyor…`);
  const { tag, asset } = await resolveRelease(svc);

  const dir = join(SERVICES_DIR, svc.kind);
  await mkdir(dir, { recursive: true });
  const dest = join(dir, asset.name);

  console.log(`↓ ${svc.kind} ${tag} → ${asset.name} (${asset.size} B)`);
  await downloadTo(asset.url, dest);
  await cleanupOldJars(dir, asset.name);

  // .gitkeep: dizin git tarafından izlensin (içerik .gitignore'da).
  await writeFile(
    join(dir, ".gitkeep"),
    `Gömülü ${svc.kind} servisi. İçerik \`pnpm fetch-services\` ile doldurulur.\n`,
  );

  lock.services[svc.kind] = {
    repo: `${svc.owner}/${svc.repo}`,
    tag,
    asset: asset.name,
  };
  console.log(`✓ ${svc.kind} gömüldü → ${dest}`);
}

async function main() {
  await mkdir(SERVICES_DIR, { recursive: true });
  const lock = { generatedAt: new Date().toISOString(), services: {} };

  for (const svc of SERVICES) {
    await fetchOne(svc, lock);
  }

  const lockPath = join(SERVICES_DIR, "services.lock.json");
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`✓ Sürüm kilidi yazıldı → ${lockPath}`);
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
