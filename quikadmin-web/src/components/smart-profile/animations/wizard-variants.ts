/**
 * Wizard Animation Variants
 *
 * Direction-aware step transitions with accessibility support.
 * Provides smooth, consistent animations that respect motion preferences.
 *
 * @module components/smart-profile/animations/wizard-variants
 */

import type { Variants, Transition } from 'framer-motion';

// ============================================================================
// Direction-Aware Step Transitions
// ============================================================================

/**
 * Direction-aware step transitions for wizard navigation.
 * Steps slide in from the direction of travel (left/right).
 *
 * @example
 * ```tsx
 * <AnimatePresence mode="wait" custom={direction}>
 *   <motion.div
 *     key={currentStep}
 *     custom={direction}
 *     variants={stepVariants}
 *     initial="enter"
 *     animate="center"
 *     exit="exit"
 *   >
 *     {content}
 *   </motion.div>
 * </AnimatePresence>
 * ```
 */
export const stepVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 50 : -50,
    opacity: 0,
  }),
};

// ============================================================================
// Reduced Motion Fallback
// ============================================================================

/**
 * Reduced motion fallback (opacity only, no sliding).
 * Use when user has prefers-reduced-motion enabled.
 *
 * @example
 * ```tsx
 * const shouldReduceMotion = useReducedMotion();
 * <motion.div variants={shouldReduceMotion ? fadeStepVariants : stepVariants} />
 * ```
 */
export const fadeStepVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

// ============================================================================
// Transition Configurations
// ============================================================================

/**
 * Spring-based transition for step animations.
 * Snappy but smooth feel for directional slides.
 */
export const stepTransition: Transition = {
  x: { type: 'spring', stiffness: 300, damping: 30 },
  opacity: { duration: 0.2 },
};

/**
 * Simple transition for reduced motion.
 * Quick fade for accessibility compliance.
 */
export const reducedMotionTransition: Transition = {
  duration: 0.15,
};

// ============================================================================
// Exports
// ============================================================================

export default {
  stepVariants,
  fadeStepVariants,
  stepTransition,
  reducedMotionTransition,
};
