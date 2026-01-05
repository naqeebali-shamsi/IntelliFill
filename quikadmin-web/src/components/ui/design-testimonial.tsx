'use client';

import type React from 'react';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';

const testimonials = [
  {
    quote: 'IntelliFill saves us 4+ hours daily on document processing.',
    author: 'Ahmed Al-Rashid',
    role: 'Operations Manager',
    company: 'PRO Express Dubai',
  },
  {
    quote: 'The accuracy is incredible. Zero errors on visa applications now.',
    author: 'Sarah Chen',
    role: 'Senior PRO Agent',
    company: 'Gulf Services LLC',
  },
  {
    quote: 'Our team processes 3x more documents since switching to IntelliFill.',
    author: 'Mohammed Hassan',
    role: 'PRO Agency Owner',
    company: 'Emirates Docs Pro',
  },
];

export function Testimonial() {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse position for magnetic effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 200 };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);

  // Transform for parallax on the large number
  const numberX = useTransform(x, [-200, 200], [-20, 20]);
  const numberY = useTransform(y, [-200, 200], [-10, 10]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      mouseX.set(e.clientX - centerX);
      mouseY.set(e.clientY - centerY);
    }
  };

  const goNext = () => setActiveIndex((prev) => (prev + 1) % testimonials.length);
  const goPrev = () =>
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);

  useEffect(() => {
    const timer = setInterval(goNext, 6000);
    return () => clearInterval(timer);
  }, []);

  const current = testimonials[activeIndex];

  return (
    <div className="flex items-center justify-center w-full h-full overflow-hidden">
      <div
        ref={containerRef}
        className="relative w-full max-w-2xl px-8"
        onMouseMove={handleMouseMove}
      >
        {/* Oversized index number - positioned to bleed off left edge */}
        <motion.div
          className="absolute -left-4 top-1/2 -translate-y-1/2 text-[16rem] font-bold text-white/[0.08] select-none pointer-events-none leading-none tracking-tighter"
          style={{ x: numberX, y: numberY }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={activeIndex}
              initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="block"
            >
              {String(activeIndex + 1).padStart(2, '0')}
            </motion.span>
          </AnimatePresence>
        </motion.div>

        {/* Main content */}
        <div className="relative flex">
          {/* Left column - vertical text */}
          <div className="flex flex-col items-center justify-center pr-8 border-r border-white/20">
            <motion.span
              className="text-xs font-mono text-white/60 tracking-widest uppercase"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Testimonials
            </motion.span>

            {/* Vertical progress line */}
            <div className="relative h-24 w-px bg-white/20 mt-6">
              <motion.div
                className="absolute top-0 left-0 w-full bg-white origin-top"
                animate={{
                  height: `${((activeIndex + 1) / testimonials.length) * 100}%`,
                }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>

          {/* Center - main content */}
          <div className="flex-1 pl-8 py-8">
            {/* Company badge */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.4 }}
                className="mb-6"
              >
                <span className="inline-flex items-center gap-2 text-xs font-mono text-white/70 border border-white/30 rounded-full px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                  {current.company}
                </span>
              </motion.div>
            </AnimatePresence>

            {/* Quote with word reveal */}
            <div className="relative mb-8 min-h-[100px]">
              <AnimatePresence mode="wait">
                <motion.blockquote
                  key={activeIndex}
                  className="text-2xl xl:text-3xl font-light text-white leading-[1.2] tracking-tight"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  {current.quote.split(' ').map((word, i) => (
                    <motion.span
                      key={i}
                      className="inline-block mr-[0.3em]"
                      variants={{
                        hidden: { opacity: 0, y: 20, rotateX: 90 },
                        visible: {
                          opacity: 1,
                          y: 0,
                          rotateX: 0,
                          transition: {
                            duration: 0.5,
                            delay: i * 0.05,
                            ease: [0.22, 1, 0.36, 1],
                          },
                        },
                        exit: {
                          opacity: 0,
                          y: -10,
                          transition: { duration: 0.2, delay: i * 0.02 },
                        },
                      }}
                    >
                      {word}
                    </motion.span>
                  ))}
                </motion.blockquote>
              </AnimatePresence>
            </div>

            {/* Author row */}
            <div className="flex items-end justify-between">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="flex items-center gap-3"
                >
                  {/* Animated line before name */}
                  <motion.div
                    className="w-6 h-px bg-white"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    style={{ originX: 0 }}
                  />
                  <div>
                    <p className="text-sm font-medium text-white">{current.author}</p>
                    <p className="text-xs text-white/60">{current.role}</p>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex items-center gap-3">
                <motion.button
                  onClick={goPrev}
                  className="group relative w-10 h-10 rounded-full border border-white/30 flex items-center justify-center overflow-hidden hover:border-white/60 transition-colors"
                  whileTap={{ scale: 0.95 }}
                  type="button"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="relative z-10 text-white/80 group-hover:text-white transition-colors"
                  >
                    <path
                      d="M10 12L6 8L10 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.button>

                <motion.button
                  onClick={goNext}
                  className="group relative w-10 h-10 rounded-full border border-white/30 flex items-center justify-center overflow-hidden hover:border-white/60 transition-colors"
                  whileTap={{ scale: 0.95 }}
                  type="button"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="relative z-10 text-white/80 group-hover:text-white transition-colors"
                  >
                    <path
                      d="M6 4L10 8L6 12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom ticker - subtle repeating company names */}
        <div className="absolute -bottom-12 left-0 right-0 overflow-hidden opacity-[0.06] pointer-events-none">
          <motion.div
            className="flex whitespace-nowrap text-4xl font-bold tracking-tight text-white"
            animate={{ x: [0, -800] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            {[...Array(10)].map((_, i) => (
              <span key={i} className="mx-6">
                {testimonials.map((t) => t.company).join(' • ')} •
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
