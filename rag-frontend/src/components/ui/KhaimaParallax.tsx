'use client';
import { useEffect, useRef, useCallback } from 'react';

export default function KhaimaParallax({ children }: { children?: React.ReactNode }) {
    const rafRef    = useRef<number>(0);
    const targetRef = useRef({ x: 0, y: 0 });
    const currentRef = useRef({ x: 0, y: 0 });

    const bgRef    = useRef<HTMLDivElement>(null);
    const midRef   = useRef<HTMLDivElement>(null);
    const frontRef = useRef<HTMLDivElement>(null);

    // ─── Lerp smooth interpolation ───────────────────────────────
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    // ─── RAF loop — 1 seule boucle, jamais relancée ──────────────
    const tick = useCallback(() => {
        const cur = currentRef.current;
        const tgt = targetRef.current;

        cur.x = lerp(cur.x, tgt.x, 0.02);   // 0.02 = very heavy friction (cinematic)
        cur.y = lerp(cur.y, tgt.y, 0.02);

        // Parallax en translate3d (GPU) + rotateX/Y (effet 3D)
        const applyLayer = (
            el: HTMLDivElement | null,
            depthT: number,   // amplitude translation
            depthR: number    // amplitude rotation
        ) => {
            if (!el) return;
            const tx =  cur.x * depthT;
            const ty =  cur.y * depthT;
            const ry = -cur.x * depthR;   // rotation horizontale
            const rx =  cur.y * depthR;   // rotation verticale
            
            // Constrain movement so we don't bleed past the 2% inset
            const limitX = window.innerWidth * 0.015;
            const limitY = window.innerHeight * 0.015;
            const clampedTx = Math.max(-limitX, Math.min(limitX, tx));
            const clampedTy = Math.max(-limitY, Math.min(limitY, ty));
            
            el.style.transform =
                `translate3d(${clampedTx}px,${clampedTy}px,0) rotateY(${ry}deg) rotateX(${rx}deg)`;
        };

        applyLayer(bgRef.current,    0.5, 0.05);  // fond    — barely moves
        applyLayer(midRef.current,   2,   0.2);   // milieu  — slight movement
        applyLayer(frontRef.current, 5,   0.5);   // devant  — noticeable but heavy

        rafRef.current = requestAnimationFrame(tick);
    }, []);

    useEffect(() => {
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [tick]);

    // ─── Global Mouse / Touch handler ─────────────────────────────
    const handleMove = useCallback((cx: number, cy: number) => {
        targetRef.current = {
            x: (window.innerWidth  / 2 - cx) / 120,
            y: (window.innerHeight / 2 - cy) / 120,
        };
    }, []);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            handleMove(e.clientX, e.clientY);
        };

        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length > 0) {
                handleMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        };

        const onMouseLeave = () => {
            targetRef.current = { x: 0, y: 0 };
        };

        // Listen globally on window to bypass pointer-events blocking
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('touchmove', onTouchMove, { passive: true });
        document.addEventListener('mouseleave', onMouseLeave);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('mouseleave', onMouseLeave);
        };
    }, [handleMove]);

    // ─── Shared layer style ───────────────────────────────────────
    const layerStyle: React.CSSProperties = {
        position: 'absolute',
        inset: '-2%',           // Global Minimal Bleed
        width: '104%',
        height: '104%',
        willChange: 'transform',
        transformStyle: 'preserve-3d',
        transformOrigin: 'center center', // Ensure it scales and rotates from the exact center
        transition: undefined,  // ← plus de transition CSS, le RAF gère tout
        pointerEvents: 'none',
    };

    return (
        <>
            {/* ═══════════════════════════════════════════════════════════
                BACKGROUND LAYER — Fixed to viewport, independent of content
                ══════════════════════════════════════════════════════════ */}
            <div
                style={{ perspective: '1200px' }}
                className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#3d1200] -z-10"
            >
                {/* Couche 1 — bg-desert.png — la plus lente */}
                <div ref={bgRef} style={layerStyle}>
                    <img
                        src="/bg-desert.png"
                        alt="Sahara"
                        className="w-full h-full object-cover object-center"
                        loading="eager"
                        draggable={false}
                    />
                </div>

                {/* Couche 2 — mid-tent.png */}
                <div ref={midRef} style={layerStyle}>
                    <img
                        src="/mid-tent.png"
                        alt="Khaima"
                        className="w-full h-full object-cover object-center"
                        loading="eager"
                        draggable={false}
                    />
                </div>

                {/* Couche 3 — front-tea.png — la plus rapide */}
                <div ref={frontRef} style={layerStyle}>
                    <img
                        src="/front-tea.png"
                        alt="Atay"
                        className="w-full h-full object-cover object-center"
                        loading="eager"
                        draggable={false}
                    />
                </div>

                {/* Global Cinematic Vignette to cleanly mask extreme edges */}
                <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_120px_rgba(0,0,0,0.85)]" />

                {/* Dégradé bas pour les cards ajouté pour meilleure lecture */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: 'linear-gradient(to top, rgba(20,8,0,0.7) 0%, transparent 50%)',
                    }}
                />
            </div>

            {/* ═══════════════════════════════════════════════════════════
                CONTENT LAYER — Completely independent overlay
                ══════════════════════════════════════════════════════════ */}
            <div className="fixed inset-0 z-10 w-screen h-screen overflow-hidden pointer-events-none">
                <div className="pointer-events-auto w-full h-full">
                    {children}
                </div>
            </div>
        </>
    );
}