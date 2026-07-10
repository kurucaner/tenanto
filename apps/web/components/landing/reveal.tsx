"use client";

import { motion } from "motion/react";
import { type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
};

/** Fade-and-rise scroll reveal. Transform + opacity only — GPU friendly. */
export function Reveal({ children, className, delay = 0, y = 48 }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      transition={{ delay, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ margin: "-80px", once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}
