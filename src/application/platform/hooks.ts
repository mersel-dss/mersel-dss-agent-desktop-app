/**
 * Platform (dosya diyalogları) use-case hook'u.
 */

import { useMemo } from "react";
import { container } from "@/app/container";

export function useFiles() {
  return useMemo(() => container.files, []);
}
