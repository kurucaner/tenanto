"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef } from "react";

type Win = {
  x: number
  y: number
  w: number
  h: number
  lit: boolean
  warm: boolean
  nextFlip: number
}

type Building = {
  x: number
  y: number
  w: number
  h: number
  shade: string
  windows: Win[]
}

function buildSkyline(width: number, height: number, layer: 'back' | 'front') {
  const buildings: Building[] = []
  const isBack = layer === 'back'
  const baseY = height
  let x = -40

  while (x < width + 40) {
    const w = 60 + Math.random() * (isBack ? 90 : 130)
    const h = height * (isBack ? 0.25 + Math.random() * 0.3 : 0.35 + Math.random() * 0.45)
    const b: Building = {
      x,
      y: baseY - h,
      w,
      h,
      shade: isBack ? '#0a0c15' : '#0e1120',
      windows: [],
    }
    if (!isBack) {
      const cols = Math.max(2, Math.floor(w / 18))
      const rows = Math.max(3, Math.floor(h / 24))
      const cellW = w / cols
      const cellH = h / rows
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (Math.random() < 0.55) continue
          b.windows.push({
            x: b.x + c * cellW + cellW * 0.25,
            y: b.y + r * cellH + cellH * 0.3,
            w: cellW * 0.5,
            h: cellH * 0.45,
            lit: Math.random() < 0.35,
            warm: Math.random() < 0.75,
            nextFlip: performance.now() + 2000 + Math.random() * 14000,
          })
        }
      }
    }
    buildings.push(b)
    x += w + (isBack ? 4 : 8)
  }
  return buildings
}

/** Animated night-skyline canvas: buildings whose windows flicker to life. */
function SkylineCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let back: Building[] = []
    let front: Building[] = []
    let stars: { x: number; y: number; r: number; p: number }[] = []
    let width = 0
    let height = 0

    const setup = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      back = buildSkyline(width, height * 0.92, 'back')
      front = buildSkyline(width, height, 'front')
      stars = Array.from({ length: 90 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height * 0.55,
        r: Math.random() * 1.3 + 0.3,
        p: Math.random() * Math.PI * 2,
      }))
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let rafId = 0
    let last = 0

    const draw = (now: number) => {
      rafId = requestAnimationFrame(draw)
      if (now - last < 33) return // ~30fps is plenty for ambience
      last = now

      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, height)
      sky.addColorStop(0, '#05060b')
      sky.addColorStop(0.55, '#0a0c1a')
      sky.addColorStop(1, '#141127')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, width, height)

      // stars
      for (const s of stars) {
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(now * 0.0006 + s.p))
        ctx.fillStyle = `rgba(220, 228, 255, ${0.35 * tw})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // back layer
      for (const b of back) {
        ctx.fillStyle = b.shade
        ctx.fillRect(b.x, b.y, b.w, b.h)
      }

      // front layer + windows
      for (const b of front) {
        ctx.fillStyle = b.shade
        ctx.fillRect(b.x, b.y, b.w, b.h)
        for (const win of b.windows) {
          if (!reduced && now > win.nextFlip) {
            win.lit = !win.lit
            win.nextFlip = now + 3000 + Math.random() * 16000
          }
          if (win.lit) {
            ctx.fillStyle = win.warm
              ? 'rgba(255, 190, 110, 0.92)'
              : 'rgba(150, 170, 255, 0.85)'
            ctx.fillRect(win.x, win.y, win.w, win.h)
          } else {
            ctx.fillStyle = 'rgba(35, 40, 66, 0.6)'
            ctx.fillRect(win.x, win.y, win.w, win.h)
          }
        }
      }

      // ground glow
      const glow = ctx.createLinearGradient(0, height - 120, 0, height)
      glow.addColorStop(0, 'rgba(124, 140, 255, 0)')
      glow.addColorStop(1, 'rgba(124, 140, 255, 0.14)')
      ctx.fillStyle = glow
      ctx.fillRect(0, height - 120, width, 120)
    }

    setup()
    rafId = requestAnimationFrame(draw)

    const onResize = () => setup()
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
}

const HEADLINE_TOP = 'Every building.'
const HEADLINE_BOTTOM = 'One heartbeat.'

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '55%'])
  const textOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])
  const skyScale = useTransform(scrollYProgress, [0, 1], [1, 1.18])

  const word = {
    hidden: { y: '110%', rotate: 4 },
    show: (i: number) => ({
      y: '0%',
      rotate: 0,
      transition: { duration: 1, delay: 0.25 + i * 0.09, ease: [0.22, 1, 0.36, 1] as const },
    }),
  }

  return (
    <section ref={sectionRef} className="relative h-[90vh] overflow-hidden">
      <motion.div style={{ scale: skyScale }} className="absolute inset-0 will-change-transform">
        <SkylineCanvas />
      </motion.div>

      {/* aurora accents */}
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[42rem] w-[42rem] rounded-full bg-glow/15 blur-[140px] animate-aurora" />
      <div className="pointer-events-none absolute top-1/3 -right-40 h-[36rem] w-[36rem] rounded-full bg-ember/10 blur-[120px] animate-aurora [animation-delay:-7s]" />

      {/* vignette for copy legibility over the lit windows */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_45%,rgba(6,7,12,0.65),transparent_70%)]" />

      <motion.div
        style={{ y: textY, opacity: textOpacity }}
        className="relative z-10 flex h-screen flex-col items-center justify-center px-6 text-center will-change-transform"
      >
        <p className="mb-6 rounded-full border border-mist/15 px-5 py-2 text-xs font-medium tracking-[0.25em] uppercase text-mist/70">
          Residence management, reimagined
        </p>

        <h2 className="font-display text-[clamp(2.8rem,9vw,7.5rem)] leading-[0.95] font-700 tracking-tight">
          {[HEADLINE_TOP, HEADLINE_BOTTOM].map((line, li) => (
            <span key={line} className="block overflow-hidden pb-[0.08em]">
              <motion.span
                custom={li}
                variants={word}
                initial="hidden"
                animate="show"
                className={
                  'inline-block will-change-transform ' +
                  (li === 1
                    ? 'bg-gradient-to-r from-ember via-[#ff9d6b] to-glow bg-clip-text text-transparent'
                    : '')
                }
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h2>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9, ease: 'easeOut' }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <a
            href="#cta"
            className="group rounded-full bg-mist px-8 py-4 font-display text-sm font-semibold text-ink transition-transform duration-300 hover:scale-105"
          >
            Book a live demo
            <span className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </a>
          <a
            href="#platform"
            className="rounded-full border border-mist/20 px-8 py-4 font-display text-sm font-semibold text-mist/80 transition-colors duration-300 hover:border-mist/50 hover:text-mist"
          >
            Watch the film
          </a>
        </motion.div>
      </motion.div>

      {/* scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 1 }}
        className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2"
      >
        <div className="flex h-12 w-7 items-start justify-center rounded-full border border-mist/25 p-1.5">
          <motion.div
            animate={{ y: [0, 14, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="h-2.5 w-2.5 rounded-full bg-ember"
          />
        </div>
      </motion.div>

      {/* fade into next section */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-ink" />
    </section>
  )
}
