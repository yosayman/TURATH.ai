'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

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

        cur.x = lerp(cur.x, tgt.x, 0.06);   // 0.06 = douceur du mouvement
        cur.y = lerp(cur.y, tgt.y, 0.06);

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
            el.style.transform =
                `translate3d(${tx}px,${ty}px,0) rotateY(${ry}deg) rotateX(${rx}deg)`;
        };

        applyLayer(bgRef.current,    2,  0.2);  // fond    — lent, peu de 3D
        applyLayer(midRef.current,   8, 0.8);  // milieu  — vitesse moyenne
        applyLayer(frontRef.current, 18, 1.5);  // devant  — rapide, fort 3D

        rafRef.current = requestAnimationFrame(tick);
    }, []);

    useEffect(() => {
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [tick]);

    // ─── Mouse / Touch handler ────────────────────────────────────
    const handleMove = useCallback((cx: number, cy: number) => {
        targetRef.current = {
            x: (window.innerWidth  / 2 - cx) / 120,
            y: (window.innerHeight / 2 - cy) / 120,
        };
    }, []);

    const onMouseMove = (e: React.MouseEvent) =>
        handleMove(e.clientX, e.clientY);

    const onTouchMove = (e: React.TouchEvent) =>
        handleMove(e.touches[0].clientX, e.touches[0].clientY);

    const onLeave = () => { targetRef.current = { x: 0, y: 0 }; };

    // ─── Shared layer style ───────────────────────────────────────
    const layerStyle: React.CSSProperties = {
        position: 'absolute',
        inset: '-15%',           // Increase negative inset to hide edges during rotation/translation
        width: '130%',
        height: '130%',
        willChange: 'transform',
        transformStyle: 'preserve-3d',
        transformOrigin: 'center center', // Ensure it scales and rotates from the exact center
        transition: undefined,  // ← plus de transition CSS, le RAF gère tout
        pointerEvents: 'none',
    };

    return (
        <div
            onMouseMove={onMouseMove}
            onMouseLeave={onLeave}
            onTouchMove={onTouchMove}
            onTouchEnd={onLeave}
            style={{ perspective: '1200px' }}   // donne la profondeur 3D au parent
            className="relative w-full h-screen overflow-hidden bg-[#3d1200]"
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

            {/* Dégradé bas pour les cards ajouté pour meilleure lecture */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                background: 'linear-gradient(to top, rgba(20,8,0,0.7) 0%, transparent 50%)',
                }}
            />

            {/* Slot UI (Chat, overlay…) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="pointer-events-auto w-full h-full">
                    {children}
                </div>
            </div>
        </div>
    );
}