"use client";

import { useEffect, useState } from "react";

/**
 * Tracks the md breakpoint (768px) used by the chat layout. Menus that
 * render as popovers on desktop render as bottom sheets below it.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}
