/**
 * Webview üzerinden basit platform tespiti. Pencere "chrome" kararları için
 * (örn. Windows'ta özel başlık çubuğu kontrolleri, macOS'ta trafik-ışığı
 * boşluğu) yeterlidir; native bir izin/işlev gerektirmez.
 */

const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";

/** Windows (WebView2) üzerinde mi çalışıyoruz? */
export const IS_WINDOWS = /Windows/i.test(ua);

/** macOS (WKWebView) üzerinde mi çalışıyoruz? */
export const IS_MACOS = /Macintosh|Mac OS X/i.test(ua);
