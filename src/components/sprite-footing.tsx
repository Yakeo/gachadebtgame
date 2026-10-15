"use client";
import { useEffect, useRef } from "react";
import { Chibi } from "./ui";

// Measure transparent padding, not the character's design. Original art files
// are never changed. Cached per image; ResizeObserver reapplies at phone sizes.
const footprints = new Map<string, { aspect: number; bottom: number }>();
export function SpriteFooting({ id, label }: { id: string; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const art = host.querySelector("img,svg");
    if (!art) return;
    const align = () => {
      let aspect = 1, bottom = 0;
      if (art instanceof HTMLImageElement) {
        if (!art.complete || !art.naturalWidth) return;
        let footprint = footprints.get(art.currentSrc || art.src);
        if (!footprint) {
          const canvas = document.createElement("canvas");
          canvas.height = 160;
          canvas.width = Math.max(1, Math.round(160 * art.naturalWidth / art.naturalHeight));
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) return;
          try {
            context.drawImage(art, 0, 0, canvas.width, canvas.height);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            let foot = canvas.height;
            scan: for (let y = canvas.height - 1; y >= 0; y--) {
              for (let x = 0; x < canvas.width; x++) {
                if (pixels[(y * canvas.width + x) * 4 + 3] > 48) { foot = y + 1; break scan; }
              }
            }
            footprint = { aspect: art.naturalWidth / art.naturalHeight, bottom: (canvas.height - foot) / canvas.height };
            footprints.set(art.currentSrc || art.src, footprint);
          } catch { return; } // External art without CORS keeps its default footing.
        }
        ({ aspect, bottom } = footprint);
      } else if (art instanceof SVGSVGElement) {
        const view = art.viewBox.baseVal;
        const box = art.getBBox();
        if (!view.height || !view.width) return;
        art.setAttribute("preserveAspectRatio", "xMidYMax meet");
        aspect = view.width / view.height;
        bottom = Math.max(0, (view.y + view.height - box.y - box.height) / view.height);
      }
      const displayedHeight = Math.min(host.clientHeight, host.clientWidth / aspect);
      host.style.setProperty("--feet-offset", `${displayedHeight * bottom}px`);
    };
    art.addEventListener("load", align);
    const observer = new ResizeObserver(align);
    observer.observe(host);
    align();
    return () => { observer.disconnect(); art.removeEventListener("load", align); };
  }, [id]);
  return <div className="sprite-footing" ref={ref}><Chibi id={id} label={label} className="sprite-art" /></div>;
}
