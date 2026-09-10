"use client";

import { useEffect, useState } from "react";

/** How long the splash stays visible (ms). */
const DURATION = 2_400;
/** Fade-out animation length (ms). */
const FADE = 500;

/**
 * Full-screen branded preloader shown for ~10 seconds whenever the website is
 * opened or reloaded (full page load). Fades out smoothly, then unmounts so it
 * never reappears during client-side navigation.
 */
export function SplashScreen() {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const p = Math.min(100, ((Date.now() - start) / DURATION) * 100);
      setProgress(p);
      if (p >= 100) clearInterval(tick);
    }, 50);
    const fadeT = setTimeout(() => setFading(true), DURATION);
    const goneT = setTimeout(() => setGone(true), DURATION + FADE);
    return () => {
      clearInterval(tick);
      clearTimeout(fadeT);
      clearTimeout(goneT);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center splash-bg transition-opacity duration-500"
      style={{ opacity: fading ? 0 : 1, pointerEvents: fading ? "none" : "auto" }}
    >
      {/* Soft moving glows */}
      <div className="splash-glow splash-glow-a" />
      <div className="splash-glow splash-glow-b" />

      {/* Logo mark with pulse rings */}
      <div className="relative mb-6 animate-float">
        <span className="absolute inset-0 rounded-2xl bg-red-500/40 splash-ring" />
        <span className="absolute inset-0 rounded-2xl bg-rose-500/30 splash-ring splash-ring-delay" />
        <div className="neon-ring relative h-16 w-16 rounded-2xl btn-gradient flex items-center justify-center text-white text-2xl font-bold shadow-2xl">
          R
        </div>
      </div>

      {/* Brand */}
      <h1 className="text-3xl font-bold tracking-tight text-white pop-in">
        Resolve<span className="gradient-shift">AI</span>
      </h1>
      <div className="ai-wave mt-4" aria-hidden><span /><span /><span /><span /><span /></div>
      <p className="mt-2 text-sm text-red-200/80">
        AI-Powered Complaint Classification &amp; Resolution
      </p>

      {/* Progress bar + percentage */}
      <div className="mt-8 w-64">
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden progress-shimmer">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-500 via-red-700 to-black transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-red-200/70">
          <span className="splash-typing">Preparing your workspace</span>
          <span className="tabular-nums">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Loading dots */}
      <div className="mt-6 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-red-300 splash-dot"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
    </div>
  );
}