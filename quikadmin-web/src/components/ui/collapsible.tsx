/**
 * Collapsible Component
 *
 * A simple passthrough wrapper for Radix UI's Collapsible primitives.
 * This component provides accessible collapse/expand functionality without additional styling.
 *
 * @example
 * ```tsx
 * <Collapsible>
 *   <CollapsibleTrigger>Toggle</CollapsibleTrigger>
 *   <CollapsibleContent>
 *     Content that can be collapsed
 *   </CollapsibleContent>
 * </Collapsible>
 * ```
 *
 * @see https://www.radix-ui.com/docs/primitives/components/collapsible
 *
 * Currently used in:
 * - SearchInterface component for filter panel expansion
 *
 * Design Decision: Kept as Radix passthrough to maintain flexibility.
 * Apply custom styles via className prop as needed per use case.
 */
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';

/**
 * Root collapsible container.
 * Controls the collapsed/expanded state of its content.
 */
const Collapsible = CollapsiblePrimitive.Root;

/**
 * Trigger button that toggles the collapsible state.
 * Automatically receives appropriate ARIA attributes from Radix.
 */
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

/**
 * Content section that animates in/out when triggered.
 * Hidden when collapsed, visible when expanded.
 */
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
