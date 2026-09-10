"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";

/* Animated AI orb: layered gradients + orbiting particles */
export function AiOrb({ size = 56, className = "", animate = true }: { size?: number; className?: string; animate?: boolean }) {
  return (
    <span className={cn("ai-orb", !animate && "ai-orb-paused", className)} style={{ width: size, height: size }} aria-hidden>
      <span className="ai-orb-core">R</span>
      <span className="ai-orb-ring ai-orb-ring-1" />
      <span className="ai-orb-ring ai-orb-ring-2" />
      <span className="ai-orb-particle ai-orb-p1" />
      <span className="ai-orb-particle ai-orb-p2" />
      <span className="ai-orb-particle ai-orb-p3" />
    </span>
  );
}

/* Typewriter headline cycling through phrases */
export function Typewriter({ phrases, className = "", speed = 42, pause = 1600 }: { phrases: string[]; className?: string; speed?: number; pause?: number }) {
  const [text, setText] = useState("");
  const [pi, setPi] = useState(0);
  useEffect(() => {
    const full = phrases[pi % phrases.length];
    let ci = 0;
    let timeout: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      ci += 1;
      setText(full.slice(0, ci));
      if (ci < full.length) {
        timeout = setTimeout(step, speed + Math.random() * 40);
      } else {
        timeout = setTimeout(() => {
          if (cancelled) return;
          let d = full.length;
          const del = () => {
            if (cancelled) return;
            d -= 2;
            if (d <= 0) {
              setText("");
              setPi((p) => (p + 1) % phrases.length);
            } else {
              setText(full.slice(0, d));
              timeout = setTimeout(del, 18);
            }
          };
          timeout = setTimeout(del, pause);
        }, pause);
      }
    };
    timeout = setTimeout(step, 350);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [pi, phrases, speed, pause]);
  return (
    <span className={cn("ai-typewriter", className)}>
      {text}
      <span className="ai-caret" aria-hidden />
    </span>
  );
}

/* Scroll reveal wrapper */
export function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn("ai-reveal", seen && "ai-reveal-seen", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
/* Animated counter */
export function AnimatedNumber({ value, duration = 900 }: { value: number; duration?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className="tabular-nums">{n.toLocaleString()}</span>;
}

/* AI thinking pipeline with animated stages */
const THINK_STEPS = ["Understanding", "Classifying", "Reasoning", "Drafting answer"];

export function AiThinking({ compact = false }: { compact?: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % THINK_STEPS.length), 750);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-3 fade-in" role="status" aria-label="AI is thinking">
      <AiOrb size={compact ? 28 : 32} />
      <div className="min-w-0">
        <div className="flex gap-1 mb-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="ai-think-dot" style={{ animationDelay: `${i * 0.16}s` }} />
          ))}
        </div>
        <p className="text-xs text-muted">
          <span key={step} className="ai-think-label">{THINK_STEPS[step]}…</span>
        </p>
        <div className="ai-think-bar mt-1.5">
          <span key={`bar-${step}`} className="ai-think-bar-fill" />
        </div>
      </div>
    </div>
  );
}

/* Floating sparkle field (pure CSS particles) */
export function SparkleField({ count = 14, className = "" }: { count?: number; className?: string }) {
  const [seeds] = useState(() =>
    Array.from({ length: count }).map((_, i) => ({
      left: (i * 67 + 13) % 100,
      top: (i * 41 + 7) % 100,
      delay: (i % 7) * 0.7,
      dur: 4 + ((i * 13) % 5),
      size: 2 + ((i * 7) % 3),
    }))
  );
  return (
    <div className={cn("ai-sparkles", className)} aria-hidden>
      {seeds.map((s, i) => (
        <span
          key={i}
          className="ai-sparkle"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }}
        />
      ))}
    </div>
  );
}

/* Aurora page backdrop — layered living scene:
   mesh blobs + conic beam + shooting stars + rising orbs + twinkling
   star canvas + orbiting rings + mouse spotlight (parallax). */
export function AuroraBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Twinkling starfield canvas (tiny, cheap, DPR-aware)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    type Star = { x: number; y: number; r: number; p: number; s: number; hue: number };
    let stars: Star[] = [];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function seed() {
      const count = Math.min(130, Math.floor((w * h) / 14000));
      stars = Array.from({ length: count }).map(() => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.6,
        p: Math.random() * Math.PI * 2,
        s: 0.008 + Math.random() * 0.03,
        hue: [0, 350, 8, 20][Math.floor(Math.random() * 4)],
      }));
    }
    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w * DPR;
      canvas!.height = h * DPR;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
      seed();
    }
    function draw() {
      ctx!.clearRect(0, 0, w, h);
      for (const st of stars) {
        st.p += st.s;
        const tw = 0.25 + 0.75 * Math.abs(Math.sin(st.p));
        ctx!.beginPath();
        ctx!.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx!.fillStyle = `hsla(${st.hue}, 90%, 75%, ${tw.toFixed(3)})`;
        ctx!.fill();
      }
      // occasional connecting shimmer between near stars
      ctx!.strokeStyle = "rgba(229,56,59,0.10)";
      ctx!.lineWidth = 1;
      for (let i = 0; i < stars.length; i += 7) {
        const a = stars[i];
        const b = stars[(i + 11) % stars.length];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        if (dx * dx + dy * dy < 130 * 130) {
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    }
    resize();
    if (reduced) {
      // static single frame for reduced motion
      draw();
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(draw);
    }
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Mouse parallax spotlight following the cursor (skipped on touch devices — saves battery)
  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;
    let tx = window.innerWidth / 2;
    let ty = 200;
    let x = tx;
    let y = ty;
    function onMove(e: MouseEvent) {
      tx = e.clientX;
      ty = e.clientY;
    }
    function loop() {
      x += (tx - x) * 0.06;
      y += (ty - y) * 0.06;
      root!.style.setProperty("--mx", `${x.toFixed(1)}px`);
      root!.style.setProperty("--my", `${y.toFixed(1)}px`);
      raf = requestAnimationFrame(loop);
    }
    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={rootRef} className="ai-aurora" aria-hidden>
      {/* base gradient wash */}
      <span className="ai-bg-wash" />
      {/* large drifting mesh blobs (6 hues) */}
      <span className="ai-mesh ai-mesh-1" />
      <span className="ai-mesh ai-mesh-2" />
      <span className="ai-mesh ai-mesh-3" />
      <span className="ai-mesh ai-mesh-4" />
      <span className="ai-mesh ai-mesh-5" />
      <span className="ai-mesh ai-mesh-6" />
      {/* rotating conic light beam */}
      <span className="ai-beam" />
      {/* twinkling star canvas */}
      <canvas ref={canvasRef} className="ai-stars" />
      {/* perspective grid floor */}
      <span className="ai-aurora-grid" />
      {/* dotted world-map style texture */}
      <span className="ai-dots" />
      {/* orbiting rings */}
      <span className="ai-orbit-field">
        <span className="ai-orbit ai-orbit-a" />
        <span className="ai-orbit ai-orbit-b" />
        <span className="ai-orbit ai-orbit-c" />
      </span>
      {/* rising glowing orbs */}
      <span className="ai-rise ai-rise-1" />
      <span className="ai-rise ai-rise-2" />
      <span className="ai-rise ai-rise-3" />
      <span className="ai-rise ai-rise-4" />
      <span className="ai-rise ai-rise-5" />
      <span className="ai-rise ai-rise-6" />
      <span className="ai-rise ai-rise-7" />
      <span className="ai-rise ai-rise-8" />
      {/* shooting stars */}
      <span className="ai-shoot ai-shoot-1" />
      <span className="ai-shoot ai-shoot-2" />
      <span className="ai-shoot ai-shoot-3" />
      {/* drifting fog banks */}
      <span className="ai-fog ai-fog-a" />
      <span className="ai-fog ai-fog-b" />
      {/* kinetic deadpool suit stripes */}
      <span className="ai-stripes" />
      {/* rotating comic halftone */}
      <span className="ai-halftone" />
      {/* laser scan sweeps */}
      <span className="ai-laser ai-laser-1" />
      <span className="ai-laser ai-laser-2" />
      {/* bokeh circles drifting across */}
      <span className="ai-bokeh ai-bokeh-1" />
      <span className="ai-bokeh ai-bokeh-2" />
      <span className="ai-bokeh ai-bokeh-3" />
      <span className="ai-bokeh ai-bokeh-4" />
      <span className="ai-bokeh ai-bokeh-5" />
      {/* meandering fireflies */}
      <span className="ai-fly ai-fly-1" />
      <span className="ai-fly ai-fly-2" />
      <span className="ai-fly ai-fly-3" />
      <span className="ai-fly ai-fly-4" />
      <span className="ai-fly ai-fly-5" />
      <span className="ai-fly ai-fly-6" />
      {/* rolling wave bands */}
      <span className="ai-wave-band ai-wave-a" />
      <span className="ai-wave-band ai-wave-b" />
      {/* mouse spotlight */}
      <span className="ai-spotlight" />
      {/* film grain */}
      <span className="ai-grain" />
      {/* vignette */}
      <span className="ai-vignette" />
    </div>
  );
}

/* 3D tilt wrapper (mouse-reactive, no deps) */
export function Tilt({ children, className = "", max = 7 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateY(-2px)`;
  }
  function onLeave() {
    const el = ref.current;
    if (el) el.style.transform = "";
  }
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={cn("ai-tilt", className)}>
      {children}
    </div>
  );
}

/* Click ripple wrapper: material-style ink burst on any click */
export function Ripple({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    const host = e.currentTarget;
    const r = host.getBoundingClientRect();
    const ink = document.createElement("span");
    ink.className = "ripple-ink";
    const size = Math.max(r.width, r.height);
    ink.style.width = `${size}px`;
    ink.style.height = `${size}px`;
    ink.style.left = `${e.clientX - r.left - size / 2}px`;
    ink.style.top = `${e.clientY - r.top - size / 2}px`;
    host.appendChild(ink);
    setTimeout(() => ink.remove(), 650);
  }
  return (
    <div onClick={onClick} className={cn("ripple-btn", className)}>
      {children}
    </div>
  );
}

/* Confetti burst: fires colorful pieces once when `fire` flips true */
export function Confetti({ fire, count = 22 }: { fire: boolean; count?: number }) {
  const [pieces, setPieces] = useState<Array<{ x: string; y: string; rot: string; color: string; delay: string }>>([]);
  useEffect(() => {
    if (!fire) return;
    const colors = ["#e5383b", "#b91c1c", "#1a1a1a", "#f87171", "#ffffff", "#fbbf24"];
    setPieces(
      Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 60 + Math.random() * 90;
        return {
          x: `${Math.cos(angle) * dist}px`,
          y: `${Math.sin(angle) * dist - 30}px`,
          rot: `${Math.random() * 540 - 270}deg`,
          color: colors[i % colors.length],
          delay: `${Math.random() * 0.15}s`,
        };
      })
    );
    const t = setTimeout(() => setPieces([]), 1400);
    return () => clearTimeout(t);
  }, [fire, count]);
  if (pieces.length === 0) return null;
  return (
    <span className="confetti-wrap" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{ ["--cx" as string]: p.x, ["--cy" as string]: p.y, ["--cr" as string]: p.rot, background: p.color, animationDelay: p.delay }}
        />
      ))}
    </span>
  );
}
