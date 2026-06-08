/**
 * Salt-okunur kod görüntüleyici (Monaco). Sözdizimi renklendirmeli, kopyalanabilir
 * ama düzenlenemez bir editör sunar; e-Belge XML kaynağını incelemek için kullanılır.
 *
 * Çevrimdışı/masaüstü kısıtı: `@monaco-editor/react` varsayılan olarak Monaco'yu
 * bir CDN'den (jsdelivr) yükler. Tauri uygulaması internetsiz de çalışmalı, bu
 * yüzden loader'ı **yerel olarak paketlenmiş** `monaco-editor` paketine yönlendirip
 * web worker'ı Vite `?worker` içe aktarımıyla sağlıyoruz.
 */

import { useRef } from "react";
import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
// Yalın içe aktarım: tüm `monaco-editor` paketi (onlarca dil) yerine sadece
// editör çekirdeği + XML sözdizimi katkısı. Bundle'ı önemli ölçüde küçültür.
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/basic-languages/xml/xml.contribution";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

// Monaco'yu CDN yerine bundle'lı paketten yükle ve worker'ı yerelden besle.
// Modül ilk kez içe aktarıldığında bir kez kurulur.
if (typeof self !== "undefined" && !(self as typeof self & { MonacoEnvironment?: unknown }).MonacoEnvironment) {
  (self as typeof self & { MonacoEnvironment?: monaco.Environment }).MonacoEnvironment = {
    getWorker: () => new EditorWorker(),
  };
  loader.config({ monaco });
}

export interface CodeViewerProps {
  /** Görüntülenecek kaynak metin. */
  value: string;
  /** Monaco dil kimliği (örn. `xml`, `json`). Varsayılan: `xml`. */
  language?: string;
  className?: string;
  /**
   * "Format Document" istendiğinde (sağ tık menüsü ya da Shift+Alt+F) çağrılır.
   * Editör salt-okunur olduğundan biçimlendirmeyi üst bileşen `value` üzerinden
   * uygular; bu geri çağrı yalnızca isteği iletir.
   */
  onFormat?: () => void;
}

export function CodeViewer({
  value,
  language = "xml",
  className,
  onFormat,
}: CodeViewerProps) {
  const { resolvedTheme } = useTheme();
  // En güncel onFormat'ı tut; eylem yalnızca mount'ta bir kez kaydedilir.
  const onFormatRef = useRef(onFormat);
  onFormatRef.current = onFormat;

  // Salt-okunur editörde Monaco'nun yerleşik "Format Document" eylemi
  // (precondition: !editorReadonly) devre dışıdır. Aynı kullanıcı deneyimini
  // korumak için aynı ad/kısayolla özel bir eylem kaydederiz; bu eylem üst
  // bileşene biçimlendirme isteğini iletir (read-only kısıtına takılmaz).
  const handleMount: OnMount = (editor, monacoApi) => {
    editor.addAction({
      id: "format-document-readonly",
      label: "Format Document",
      keybindings: [
        monacoApi.KeyMod.Shift | monacoApi.KeyMod.Alt | monacoApi.KeyCode.KeyF,
      ],
      contextMenuGroupId: "1_modification",
      contextMenuOrder: 1.5,
      run: () => {
        onFormatRef.current?.();
      },
    });
  };

  return (
    <Editor
      className={className}
      value={value}
      language={language}
      theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
      onMount={handleMount}
      loading={<Loader2 className="h-5 w-5 animate-spin text-fg-dim" />}
      options={{
        readOnly: true,
        domReadOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        wrappingIndent: "deepIndent",
        fontSize: 12.5,
        lineNumbers: "on",
        renderLineHighlight: "none",
        folding: true,
        tabSize: 2,
        smoothScrolling: true,
        contextmenu: true,
        scrollbar: { alwaysConsumeMouseWheel: false },
        automaticLayout: true,
      }}
    />
  );
}
