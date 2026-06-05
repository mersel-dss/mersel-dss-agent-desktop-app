/**
 * Platform/OS port arayüzleri — dosya seçme/kaydetme diyalogları.
 */

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface OpenFileOptions {
  title?: string;
  filters?: FileFilter[];
}

export interface SaveFileOptions {
  title?: string;
  defaultPath?: string;
  filters?: FileFilter[];
}

export interface FileGateway {
  /** Tek dosya seçtirir; iptal edilirse null döner. */
  pickFile(options?: OpenFileOptions): Promise<string | null>;
  /** Kaydetme yolu seçtirir; iptal edilirse null döner. */
  pickSavePath(options?: SaveFileOptions): Promise<string | null>;
  /** Verilen metni dosyaya UTF-8 olarak yazar; yazılan yolu döner. */
  saveTextFile(path: string, contents: string): Promise<string>;
  /** Dosyayı `from`'dan `to`'ya taşır (imza çıktısını kalıcılaştırmak için). */
  moveFile(from: string, to: string): Promise<string>;
}
