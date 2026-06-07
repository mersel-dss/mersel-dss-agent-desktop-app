/**
 * Bilinmeyen bir hatadan kullanıcıya gösterilebilir metin çıkarır.
 * `catch (e)` blokları ve react-query `onError` geri çağrıları için ortak nokta;
 * `(e as Error).message` tekrarını ortadan kaldırır ve string/null hataları da güvenle ele alır.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Beklenmeyen bir hata oluştu.";
}
