"use client";

import { motion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { APP_NAME } from "@/packages/shared";

const HEADLINE_TOP = "Every door.";
const HEADLINE_BOTTOM = "One financial truth.";

type Win = {
  lit: boolean;
  nextFlip: number;
  warm: boolean;
  w: number;
  x: number;
  y: number;
  h: number;
};

type Building = {
  h: number;
  shade: string;
  w: number;
  windows: Win[];
  x: number;
  y: number;
};

function buildSkyline(width: number, height: number, layer: "back" | "front") {
  const buildings: Building[] = [];
  const isBack = layer === "back";
  const baseY = height;
  let x = -40;

  while (x < width + 40) {
    const w = 60 + Math.random() * (isBack ? 90 : 130);
    const h = height * (isBack ? 0.25 + Math.random() * 0.3 : 0.35 + Math.random() * 0.45);
    const b: Building = {
      h,
      shade: isBack ? "#0e1018" : "#141824",
      w,
      windows: [],
      x,
      y: baseY - h,
    };

    const cols = Math.max(2, Math.floor(w / 22));
    const rows = Math.max(3, Math.floor(h / 28));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        b.windows.push({
          h: 8,
          lit: Math.random() > 0.55,
          nextFlip: Math.random() * 120,
          w: 10,
          warm: Math.random() > 0.7,
          x: 8 + c * (w / cols),
          y: 10 + r * (h / rows),
        });
      }
    }
    buildings.push(b);
    x += w + (isBack ? 12 : 8);
  }
  return buildings;
}

function SkylineCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let frame = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const w = () => canvas.getBoundingClientRect().width;
    const h = () => canvas.getBoundingClientRect().height;
    let back = buildSkyline(w(), h(), "back");
    let front = buildSkyline(w(), h(), "front");

    const onResize = () => {
      resize();
      back = buildSkyline(w(), h(), "back");
      front = buildSkyline(w(), h(), "front");
    };
    window.addEventListener("resize", onResize);

    const drawLayer = (buildings: Building[]) => {
      for (const b of buildings) {
        ctx.fillStyle = b.shade;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        for (const win of b.windows) {
          if (frame % 30 === 0) {
            win.nextFlip -= 1;
            if (win.nextFlip <= 0) {
              win.lit = !win.lit;
              win.nextFlip = 40 + Math.random() * 100;
            }
          }
          if (!win.lit) continue;
          ctx.fillStyle = win.warm ? "rgba(255,180,80,0.85)" : "rgba(180,200,255,0.7)";
          ctx.fillRect(b.x + win.x, b.y + win.y, win.w, win.h);
        }
      }
    };

    const loop = () => {
      frame++;
      if (frame % 2 === 0) {
        ctx.clearRect(0, 0, w(), h());
        const grd = ctx.createLinearGradient(0, 0, 0, h());
        grd.addColorStop(0, "#06070c");
        grd.addColorStop(1, "#0b0d16");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w(), h());
        drawLayer(back);
        drawLayer(front);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas className="absolute inset-0 h-full w-full" ref={canvasRef} />;
}

const word = {
  hidden: { y: "110%" },
  show: (i: number) => ({
    transition: { delay: 0.15 + i * 0.12, duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
    y: "0%",
  }),
};

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef });
  const textY = useTransform(scrollYProgress, [0, 0.5], [0, -80]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.35], [1, 0]);
  const skyScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);

  return (
    <section className="relative h-[110vh] overflow-hidden" ref={sectionRef}>
      <motion.div className="absolute inset-0 will-change-transform" style={{ scale: skyScale }}>
        <SkylineCanvas />
      </motion.div>

      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/4 h-[42rem] w-[42rem] animate-aurora rounded-full bg-glow/15 blur-[140px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -right-40 h-[36rem] w-[36rem] animate-aurora rounded-full bg-ember/10 blur-[120px] [animation-delay:-7s]"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_45%,rgba(6,7,12,0.65),transparent_70%)]"
      />

      <motion.div
        className="relative z-10 flex h-screen flex-col items-center justify-center px-6 text-center will-change-transform"
        style={{ opacity: textOpacity, y: textY }}
      >
        <motion.p
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-full border border-mist/15 px-5 py-2 text-mist/70 text-xs font-medium tracking-[0.25em] uppercase"
          initial={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          Property accounting, reimagined
        </motion.p>

        <h1 className="font-display text-[clamp(2.8rem,9vw,7.5rem)] leading-[0.95] font-700 tracking-tight">
          {[HEADLINE_TOP, HEADLINE_BOTTOM].map((line, li) => (
            <span className="block overflow-hidden pb-[0.08em]" key={line}>
              <motion.span
                animate="show"
                className={
                  "inline-block will-change-transform " +
                  (li === 1
                    ? "bg-gradient-to-r from-ember via-[#ff9d6b] to-glow bg-clip-text text-transparent"
                    : "")
                }
                custom={li}
                initial="hidden"
                variants={word}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 max-w-xl text-base text-mist/60 md:text-lg"
          initial={{ opacity: 0, y: 24 }}
          transition={{ delay: 0.7, duration: 0.8, ease: "easeOut" }}
        >
          {APP_NAME} unifies short-term stays, long-term leases, amenity income, and expenses into
          portfolio reports operators actually trust.
        </motion.p>

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
          initial={{ opacity: 0, y: 24 }}
          transition={{ delay: 0.9, duration: 0.8, ease: "easeOut" }}
        >
          <Link
            className="group rounded-full bg-mist px-8 py-4 font-display text-ink text-sm font-semibold transition-transform duration-300 hover:scale-105"
            href="/contact"
          >
            Book a live demo
            <span className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
          <Link
            className="rounded-full border border-mist/20 px-8 py-4 font-display text-mist/80 text-sm font-semibold transition-colors duration-300 hover:border-mist/50 hover:text-mist"
            href="/platform"
          >
            Explore platform
          </Link>
        </motion.div>
      </motion.div>

      <motion.div
        animate={{ opacity: 1 }}
        className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2"
        initial={{ opacity: 0 }}
        transition={{ delay: 1.6, duration: 1 }}
      >
        <div className="flex h-12 w-7 items-start justify-center rounded-full border border-mist/25 p-1.5">
          <motion.div
            animate={{ y: [0, 14, 0] }}
            className="h-2.5 w-2.5 rounded-full bg-ember"
            transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity }}
          />
        </div>
      </motion.div>

      <div className="absolute right-0 bottom-0 left-0 h-40 bg-gradient-to-b from-transparent to-ink" />
    </section>
  );
}
