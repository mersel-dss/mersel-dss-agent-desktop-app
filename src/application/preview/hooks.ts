/**
 * Önizleme use-case hook'ları (react-query).
 */

import { useQuery } from "@tanstack/react-query";
import { container } from "@/app/container";

export const previewKeys = {
  outline: (path: string) => ["preview-outline", path] as const,
  document: (path: string, index: number, useEmbedded: boolean) =>
    ["preview-document", path, index, useEmbedded] as const,
  source: (path: string, index: number) =>
    ["preview-source", path, index] as const,
  bytes: (path: string) => ["preview-bytes", path] as const,
};

/** Dosyadaki önizlenebilir belgelerin başlıklarını çözer (dönüşüm yapmaz). */
export function usePreviewOutline(signedPath: string | null) {
  return useQuery({
    queryKey: previewKeys.outline(signedPath ?? ""),
    queryFn: () => container.preview.listDocuments(signedPath!),
    enabled: !!signedPath,
    staleTime: 60_000,
  });
}

/** Seçili belgeyi XSLT servisi ile HTML'e dönüştürür (tembel/lazy). */
export function usePreviewDocument(
  signedPath: string | null,
  index: number,
  useEmbeddedXslt: boolean,
  enabled: boolean,
) {
  return useQuery({
    queryKey: previewKeys.document(signedPath ?? "", index, useEmbeddedXslt),
    queryFn: () =>
      container.preview.previewDocument({
        signedPath: signedPath!,
        index,
        useEmbeddedXslt,
      }),
    enabled: enabled && !!signedPath,
    staleTime: 60_000,
  });
}

/**
 * Dosyanın ham baytlarını döner — PAdES/PDF gibi ikili belgeleri gömülü PDF
 * görüntüleyiciyle önizlemek için. Bayt dizisinden bir `Blob` URL'i kurulur.
 */
export function usePreviewFileBytes(
  signedPath: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: previewKeys.bytes(signedPath ?? ""),
    queryFn: () => container.preview.readFileBytes(signedPath!),
    enabled: enabled && !!signedPath,
    staleTime: 60_000,
  });
}

/** Seçili belgenin ham XML kaynağını döner (salt-okunur görüntüleyici için). */
export function useDocumentSource(
  signedPath: string | null,
  index: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: previewKeys.source(signedPath ?? "", index),
    queryFn: () => container.preview.readDocumentSource(signedPath!, index),
    enabled: enabled && !!signedPath,
    staleTime: 60_000,
  });
}
