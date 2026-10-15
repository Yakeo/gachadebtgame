"use client";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { gameViewport } from "@/lib/viewport";

/** A scaled containing block also keeps fixed modals inside the game frame. */
export function GameViewport({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const { width, height } = element.getBoundingClientRect();
      setSize(previous => previous?.width === width && previous.height === height ? previous : { width, height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const frame = size ? gameViewport(size.width, size.height) : null;
  const style = frame ? {
    width: frame.width, height: frame.height,
    transform: `scale(${frame.scale})`,
    "--game-frame-height": `${frame.height}px`,
  } as CSSProperties : undefined;
  return <div className="game-viewport" ref={ref}><div className="game-frame" style={style}>{children}</div></div>;
}
