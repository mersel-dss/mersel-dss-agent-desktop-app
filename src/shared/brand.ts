/**
 * Marka kimliği — tek kaynak (single source of truth).
 *
 * Ürün **Mersel İmzamatik** adını taşır; geliştiren ve sahibi **Mersel**'dir.
 * Ürün adı, atıf metni ve bağlantılar yalnızca buradan beslenir; başka hiçbir
 * yerde hard-code edilmez ki marka değişiklikleri tek noktadan yönetilsin.
 */

export const BRAND = {
  /** Tam ürün adı (pencere başlığı, splash, mağaza vb.). */
  product: "Mersel İmzamatik",
  /** Kısa ürün adı (dar alanlar, rozet). */
  productShort: "İmzamatik",
  /** Ürünü geliştiren / sahibi olan şirket. */
  company: "Mersel",
  /** Kurumsal alan adı (görünen). */
  domain: "mersel.io",
  /** Kurumsal site (köprü). */
  website: "https://mersel.io",
  /** Açık kaynak deposu. */
  github: "https://github.com/mersel-dss",
  /** Kısa tanıtım sloganı. */
  tagline: "Yerli ve açık kaynak e-imza masaüstü",
  /** Alt çubukta görünen marka atıf cümlesi. */
  attribution: "Türkiye'nin e-imza süreçleri için mersel tarafından geliştirildi",
} as const;
