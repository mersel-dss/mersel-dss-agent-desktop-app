/// <reference types="vite/client" />

// `monaco-editor`'ın yalın ESM alt yolları için tip bildirimleri. Paket tipleri
// yalnızca üst düzey "monaco-editor" girişinde tanımlı; çekirdek editör API'sini
// (tüm dilleri paketlemeden) içe aktarabilmek için alt yolu buraya eşliyoruz.
declare module "monaco-editor/esm/vs/editor/editor.api" {
  export * from "monaco-editor";
}
declare module "monaco-editor/esm/vs/basic-languages/xml/xml.contribution";
