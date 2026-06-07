/**
 * Tauri native sürükle-bırak köprüsü. Webview tüm pencere için tek bir
 * `onDragDropEvent` yayar; bu hook her dropzone'u bir kayıt defterine ekler ve
 * bırakma konumunu (physical px → CSS px) dropzone'ların bounding rect'leriyle
 * eşleştirerek doğru alana yönlendirir. Birden çok dropzone aynı anda çalışır.
 */

import { useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

interface Zone {
  el: HTMLElement;
  onDrop: (paths: string[]) => void;
  setOver: (over: boolean) => void;
}

const zones = new Set<Zone>();
let started = false;
let unlisten: (() => void) | null = null;

function zoneAt(physX: number, physY: number): Zone | null {
  const dpr = window.devicePixelRatio || 1;
  const x = physX / dpr;
  const y = physY / dpr;
  let hit: Zone | null = null;
  // Sonra eklenen / üstte olan kazanır (basit z-order yaklaşımı).
  for (const z of zones) {
    const r = z.el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) hit = z;
  }
  return hit;
}

function clearHover() {
  zones.forEach((z) => z.setOver(false));
}

async function ensureListening() {
  if (started) return;
  started = true;
  try {
    unlisten = await getCurrentWebview().onDragDropEvent((event) => {
      const payload = event.payload as {
        type: "enter" | "over" | "drop" | "leave";
        position?: { x: number; y: number };
        paths?: string[];
      };

      if (payload.type === "leave") {
        clearHover();
        return;
      }
      if (!payload.position) return;

      const target = zoneAt(payload.position.x, payload.position.y);

      if (payload.type === "drop") {
        clearHover();
        if (target && payload.paths && payload.paths.length > 0) {
          target.onDrop(payload.paths);
        }
        return;
      }

      // enter / over → hover geri bildirimi.
      zones.forEach((z) => z.setOver(z === target));
    });
  } catch {
    // Tauri dışı ortam (örn. düz tarayıcı) — sürükle-bırak yok say.
    started = false;
  }
}

function maybeStop() {
  if (zones.size === 0 && unlisten) {
    unlisten();
    unlisten = null;
    started = false;
  }
}

/**
 * Bir dropzone'u kaydeder. Dönen `ref`'i hedef elemana, `isOver`'ı da görsel
 * vurgulama için kullanın.
 */
export function useFileDrop(onDrop: (paths: string[]) => void) {
  const ref = useRef<HTMLElement | null>(null);
  const [isOver, setIsOver] = useState(false);
  const cbRef = useRef(onDrop);
  cbRef.current = onDrop;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const zone: Zone = {
      el,
      onDrop: (paths) => cbRef.current(paths),
      setOver: setIsOver,
    };
    zones.add(zone);
    void ensureListening();
    return () => {
      zones.delete(zone);
      maybeStop();
    };
  }, []);

  return { ref, isOver };
}
