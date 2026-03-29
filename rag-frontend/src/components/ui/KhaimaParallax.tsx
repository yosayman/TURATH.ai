"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

const PARALLAX_IDLE_THRESHOLD = 0.015;
const PARALLAX_EASING = 0.07;
const POINTER_QUERY = "(pointer: fine)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type LayerConfig = {
  depthT: number;
  depthR: number;
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function KhaimaParallax({
  children,
}: {
  children?: React.ReactNode;
}) {
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const isEnabledRef = useRef(false);

  const bgRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function stopAnimation() {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }

    function applyLayer(
      element: HTMLDivElement | null,
      values: { x: number; y: number },
      { depthT, depthR }: LayerConfig
    ) {
      if (!element) {
        return;
      }

      const tx = values.x * depthT;
      const ty = values.y * depthT;
      const ry = -values.x * depthR;
      const rx = values.y * depthR;

      const limitX = window.innerWidth * 0.015;
      const limitY = window.innerHeight * 0.015;
      const clampedTx = Math.max(-limitX, Math.min(limitX, tx));
      const clampedTy = Math.max(-limitY, Math.min(limitY, ty));

      element.style.transform = `translate3d(${clampedTx}px, ${clampedTy}px, 0) rotateY(${ry}deg) rotateX(${rx}deg)`;
    }

    function resetLayers() {
      applyLayer(bgRef.current, { x: 0, y: 0 }, { depthT: 0.5, depthR: 0.05 });
      applyLayer(midRef.current, { x: 0, y: 0 }, { depthT: 2, depthR: 0.2 });
      applyLayer(frontRef.current, { x: 0, y: 0 }, { depthT: 5, depthR: 0.5 });
    }

    function tick() {
      if (!isEnabledRef.current || document.hidden) {
        stopAnimation();
        resetLayers();
        return;
      }

      const current = currentRef.current;
      const target = targetRef.current;

      current.x = lerp(current.x, target.x, PARALLAX_EASING);
      current.y = lerp(current.y, target.y, PARALLAX_EASING);

      applyLayer(bgRef.current, current, { depthT: 0.5, depthR: 0.05 });
      applyLayer(midRef.current, current, { depthT: 2, depthR: 0.2 });
      applyLayer(frontRef.current, current, { depthT: 5, depthR: 0.5 });

      const isSettled =
        Math.abs(current.x - target.x) < PARALLAX_IDLE_THRESHOLD &&
        Math.abs(current.y - target.y) < PARALLAX_IDLE_THRESHOLD &&
        Math.abs(target.x) < PARALLAX_IDLE_THRESHOLD &&
        Math.abs(target.y) < PARALLAX_IDLE_THRESHOLD;

      if (isSettled) {
        currentRef.current = { x: 0, y: 0 };
        targetRef.current = { x: 0, y: 0 };
        resetLayers();
        stopAnimation();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    function startAnimation() {
      if (!isEnabledRef.current || document.hidden || rafRef.current !== null) {
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const finePointer = window.matchMedia(POINTER_QUERY);

    const syncMode = () => {
      isEnabledRef.current = finePointer.matches && !reducedMotion.matches;

      if (!isEnabledRef.current) {
        currentRef.current = { x: 0, y: 0 };
        targetRef.current = { x: 0, y: 0 };
        stopAnimation();
        resetLayers();
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isEnabledRef.current || event.pointerType !== "mouse") {
        return;
      }

      targetRef.current = {
        x: (window.innerWidth / 2 - event.clientX) / 120,
        y: (window.innerHeight / 2 - event.clientY) / 120,
      };

      startAnimation();
    };

    const onPointerLeave = () => {
      targetRef.current = { x: 0, y: 0 };
      startAnimation();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopAnimation();
        return;
      }

      if (isEnabledRef.current) {
        startAnimation();
      }
    };

    syncMode();

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("mouseleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);
    reducedMotion.addEventListener("change", syncMode);
    finePointer.addEventListener("change", syncMode);

    return () => {
      stopAnimation();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("mouseleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotion.removeEventListener("change", syncMode);
      finePointer.removeEventListener("change", syncMode);
    };
  }, []);

  const layerStyle: React.CSSProperties = {
    position: "absolute",
    inset: "-2%",
    width: "104%",
    height: "104%",
    willChange: "transform",
    transformStyle: "preserve-3d",
    transformOrigin: "center center",
    pointerEvents: "none",
  };

  return (
    <>
      <div
        style={{ perspective: "1200px" }}
        className="fixed inset-0 -z-10 h-screen w-screen overflow-hidden bg-[#3d1200]"
      >
        <div ref={bgRef} style={layerStyle}>
          <Image
            src="/bg-desert.png"
            alt=""
            fill
            preload
            quality={75}
            sizes="100vw"
            className="object-cover object-center select-none"
            draggable={false}
          />
        </div>

        <div ref={midRef} style={layerStyle}>
          <Image
            src="/mid-tent.png"
            alt=""
            fill
            quality={70}
            sizes="100vw"
            className="object-cover object-center select-none"
            draggable={false}
          />
        </div>

        <div ref={frontRef} style={layerStyle}>
          <Image
            src="/front-tea.png"
            alt=""
            fill
            quality={70}
            sizes="100vw"
            className="object-cover object-center select-none"
            draggable={false}
          />
        </div>

        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.85)]" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(20, 8, 0, 0.7) 0%, transparent 50%)",
          }}
        />
      </div>

      <div className="fixed inset-0 z-10 h-screen w-screen overflow-hidden pointer-events-none">
        <div className="pointer-events-auto h-full w-full">{children}</div>
      </div>
    </>
  );
}
