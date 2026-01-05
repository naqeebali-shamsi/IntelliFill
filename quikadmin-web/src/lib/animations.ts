/**
 * Centralized Framer Motion Animation Variants
 *
 * Shared animation configurations used across the application
 * for consistent motion design and reduced code duplication.
 */

import type { Variants } from 'framer-motion';

/**
 * Container variant with staggered children animation
 * Perfect for lists and grids that animate in sequence
 *
 * @example
 * ```tsx
 * <motion.div variants={staggerContainer} initial="hidden" animate="show">
 *   {items.map(item => <motion.div key={item.id} variants={fadeInUp} />)}
 * </motion.div>
 * ```
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

/**
 * Fast stagger container (0.05s delay between children)
 * Use for large lists where slower stagger feels sluggish
 */
export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

/**
 * Slow stagger container (0.2s delay between children)
 * Use for hero sections or emphasis on fewer items
 */
export const staggerContainerSlow: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

/**
 * Fade in with upward motion
 * Classic entrance animation for cards and content blocks
 *
 * @example
 * ```tsx
 * <motion.div variants={fadeInUp}>Content</motion.div>
 * ```
 */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

/**
 * Subtle fade in with slight upward motion
 * Use for table rows or compact list items
 */
export const fadeInUpSubtle: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

/**
 * Slide in from left
 * Good for sidebar content or progressive reveals
 *
 * @example
 * ```tsx
 * <motion.div variants={slideInLeft}>Sidebar</motion.div>
 * ```
 */
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0 },
};

/**
 * Slide in from right
 * Mirror of slideInLeft for right-side content
 */
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  show: { opacity: 1, x: 0 },
};

/**
 * Scale and fade in
 * Attention-grabbing entrance for modals or important elements
 */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1 },
};

/**
 * Item variants for use with staggerContainer
 * Alias for fadeInUp for semantic clarity
 */
export const itemVariants = fadeInUp;

/**
 * Subtle item variants for dense lists
 * Alias for fadeInUpSubtle
 */
export const itemVariantsSubtle = fadeInUpSubtle;

/**
 * Common transition configurations
 */
export const transitions = {
  /** Default spring transition - smooth and natural */
  spring: {
    type: 'spring' as const,
    stiffness: 260,
    damping: 20,
  },

  /** Fast spring - snappier feel */
  springFast: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 25,
  },

  /** Ease out - smooth deceleration */
  easeOut: {
    duration: 0.3,
    ease: [0, 0, 0.2, 1],
  },

  /** Quick transition for subtle changes */
  quick: {
    duration: 0.2,
  },
} as const;

/**
 * Page transition variants
 * Use with AnimatePresence for route changes
 */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};
