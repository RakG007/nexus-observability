import React, { useEffect, useRef } from 'react';

/**
 * Rimac-inspired kinetic telemetry backdrop:
 * Matte carbon obsidian base + perspective velocity grid + swept electric cyan light conduits.
 * Automatically pauses when tab is hidden and honors prefers-reduced-motion.
 */
export default function DynamicGlassBackdrop({ threatAlert = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let animId = null;
    let width = 0;
    let height = 0;
    let phase = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const drawFrame = (t) => {
      ctx.clearRect(0, 0, width, height);

      // Horizon & vanishing point
      const horizonY = height * 0.42;
      const centerX = width * 0.54;

      // 1. Subtle volumetric ambient spotlight at horizon
      const horizonGlow = ctx.createRadialGradient(
        centerX,
        horizonY,
        10,
        centerX,
        horizonY,
        Math.max(width, height) * 0.55
      );
      horizonGlow.addColorStop(
        0,
        threatAlert ? 'rgba(244, 63, 94, 0.14)' : 'rgba(0, 229, 255, 0.14)'
      );
      horizonGlow.addColorStop(0.45, 'rgba(14, 165, 233, 0.05)');
      horizonGlow.addColorStop(1, 'rgba(4, 6, 10, 0)');
      ctx.fillStyle = horizonGlow;
      ctx.fillRect(0, 0, width, height);

      // 2. Perspective velocity grid rays below horizon (Rimac-style CAD depth)
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, horizonY, width, height - horizonY);
      ctx.clip();

      const rayCount = 18;
      for (let i = -rayCount; i <= rayCount; i += 1) {
        const spread = i / rayCount;
        const bottomX = centerX + spread * width * 1.45;
        const grad = ctx.createLinearGradient(centerX, horizonY, bottomX, height);
        grad.addColorStop(0, 'rgba(0, 229, 255, 0.02)');
        grad.addColorStop(0.5, 'rgba(0, 229, 255, 0.09)');
        grad.addColorStop(1, 'rgba(0, 229, 255, 0.18)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX + spread * 40, horizonY);
        ctx.lineTo(bottomX, height);
        ctx.stroke();
      }

      // Exponential depth horizontal cadence lines moving toward viewer
      const horizontalLines = 11;
      for (let j = 0; j < horizontalLines; j += 1) {
        const progress = ((j / horizontalLines) + (t * 0.14)) % 1;
        const eased = progress * progress; // perspective acceleration
        const y = horizonY + eased * (height - horizonY);
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.03 + eased * 0.16})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();

      // 3. Swept Hypercar Telemetry Light Ribbons across upper canvas
      const ribbonCount = 3;
      for (let r = 0; r < ribbonCount; r += 1) {
        const offset = r * 0.28;
        const yBase = height * (0.18 + r * 0.11);
        const amp = 28 + r * 14;

        ctx.beginPath();
        for (let x = 0; x <= width; x += 24) {
          const normX = x / Math.max(width, 1);
          const y =
            yBase +
            Math.sin(normX * 4.2 + t * 1.2 + offset * 6) * amp +
            Math.cos(normX * 2.1 - t * 0.7) * 14;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        const ribbonGrad = ctx.createLinearGradient(0, yBase, width, yBase);
        const primary =
          threatAlert && r === 2 ? 'rgba(244, 63, 94, 0.34)' : 'rgba(0, 240, 255, 0.28)';
        ribbonGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
        ribbonGrad.addColorStop(0.35, primary);
        ribbonGrad.addColorStop(0.7, 'rgba(226, 232, 240, 0.16)');
        ribbonGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');

        ctx.strokeStyle = ribbonGrad;
        ctx.lineWidth = r === 0 ? 1.8 : 1.1;
        ctx.stroke();
      }

      // 4. Precision horizon laser line
      const laser = ctx.createLinearGradient(0, horizonY, width, horizonY);
      laser.addColorStop(0, 'rgba(0, 240, 255, 0)');
      laser.addColorStop(0.5, threatAlert ? 'rgba(244, 63, 94, 0.45)' : 'rgba(0, 240, 255, 0.45)');
      laser.addColorStop(1, 'rgba(0, 240, 255, 0)');
      ctx.strokeStyle = laser;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(width, horizonY);
      ctx.stroke();
    };

    if (prefersReduced) {
      drawFrame(0.35);
      return () => window.removeEventListener('resize', resize);
    }

    let lastTime = performance.now();
    const tick = (now) => {
      if (!document.hidden) {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        phase += dt;
        drawFrame(phase);
      }
      lastTime = now;
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [threatAlert]);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#04060A]">
      {/* Subtle diagonal carbon-fiber micro-weave */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 6px)',
        }}
      />

      {/* Live 60fps Canvas Telemetry Horizon & Light Conduits */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Top edge Rimac electric cyan hairline */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#00E5FF]/55 to-transparent" />
    </div>
  );
}
