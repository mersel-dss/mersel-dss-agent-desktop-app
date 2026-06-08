/**
 * Hafif, bağımlılıksız XML "pretty-print" (biçimlendirme) yardımcıları.
 *
 * Amaç: salt-okunur kaynak görüntüleyicide (Monaco) tek-satırlık/minified e-Belge
 * XML'lerini insan-okunur, girintili biçime çevirmek. Bilinçli olarak metni
 * YENİDEN AYRIŞTIRMAZ (DOMParser/serialize yapmaz); böylece namespace sırası,
 * öznitelik biçimi ve içerik bayt düzeyinde olabildiğince korunur — yalnızca
 * etiketler arası boşluk ve girinti düzenlenir. Bu bir görüntüleme kolaylığıdır;
 * imzalı belgenin kanonik baytları için her zaman "Ham" görünüm esastır.
 */

const INDENT = "  ";

/** Bir satırın `<tag ...>...</tag>` gibi tek satırda açılıp kapanıp kapanmadığı. */
function isSelfContained(line: string): boolean {
  // <a/>  ·  <a>text</a>  ·  <a><b/></a>
  if (/\/>\s*$/.test(line)) return true;
  const open = (line.match(/<[^/!?][^>]*?[^/]?>/g) ?? []).length;
  const close = (line.match(/<\/[^>]+>/g) ?? []).length;
  return open > 0 && open === close;
}

/**
 * XML metnini girintili biçime çevirir. Geçersiz/boş girdide metni olduğu gibi
 * döndürür (asla hata fırlatmaz).
 */
export function formatXml(xml: string): string {
  if (!xml || !xml.trim()) return xml;

  // Etiketler arasındaki saf boşluğu kaldır, ardından her etiketi yeni satıra al.
  // `>metin<` gibi gerçek metin içerikleri korunur (yalnızca `>\s*<` daraltılır).
  const normalized = xml
    .replace(/\r\n?/g, "\n")
    .replace(/>\s+</g, "><")
    .replace(/></g, ">\n<");

  const lines = normalized.split("\n");
  const out: string[] = [];
  let pad = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const isMeta = line.startsWith("<?") || line.startsWith("<!"); // bildirim/yorum/DOCTYPE
    const isClosing = /^<\//.test(line);
    const opensBlock =
      !isMeta && !isClosing && /^<[^/!?]/.test(line) && !isSelfContained(line);

    if (isClosing) pad = Math.max(pad - 1, 0);
    out.push(INDENT.repeat(pad) + line);
    if (opensBlock) pad += 1;
  }

  return out.join("\n");
}
