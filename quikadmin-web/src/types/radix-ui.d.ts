/**
 * Type augmentation for Radix UI components
 *
 * This file fixes a known issue where Radix UI types don't properly inherit
 * HTML element props in TypeScript 5.8+
 *
 * @see https://github.com/radix-ui/primitives/issues/2309
 * @see https://github.com/radix-ui/primitives/issues/2805
 */

/* eslint-disable @typescript-eslint/no-empty-object-type */

import * as React from 'react';

// Radix primitive prop that allows component composition
interface AsChildProp {
  asChild?: boolean;
}

declare module '@radix-ui/react-tabs' {
  interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, AsChildProp {}
  interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {}
}

declare module '@radix-ui/react-dialog' {
  interface DialogProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, AsChildProp {}
  interface DialogPortalProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface DialogOverlayProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}
  interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}
  interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, AsChildProp {}
}

declare module '@radix-ui/react-alert-dialog' {
  interface AlertDialogProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface AlertDialogTriggerProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>, AsChildProp {}
  interface AlertDialogPortalProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface AlertDialogOverlayProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface AlertDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface AlertDialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}
  interface AlertDialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}
  interface AlertDialogActionProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>, AsChildProp {}
  interface AlertDialogCancelProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>, AsChildProp {}
}

declare module '@radix-ui/react-dropdown-menu' {
  interface DropdownMenuProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface DropdownMenuTriggerProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>, AsChildProp {}
  interface DropdownMenuPortalProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface DropdownMenuCheckboxItemProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface DropdownMenuRadioItemProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface DropdownMenuLabelProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface DropdownMenuSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface DropdownMenuSubProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface DropdownMenuSubTriggerProps extends React.HTMLAttributes<HTMLDivElement>, AsChildProp {}
  interface DropdownMenuSubContentProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface DropdownMenuGroupProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface DropdownMenuRadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface DropdownMenuItemIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {}
}

declare module '@radix-ui/react-select' {
  interface SelectProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, AsChildProp {}
  interface SelectPortalProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface SelectLabelProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface SelectSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface SelectGroupProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {}
  interface SelectIconProps extends React.HTMLAttributes<HTMLSpanElement>, AsChildProp {}
  interface SelectScrollUpButtonProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface SelectScrollDownButtonProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface SelectViewportProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface SelectItemTextProps extends React.HTMLAttributes<HTMLSpanElement> {}
  interface SelectItemIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {}
}

declare module '@radix-ui/react-popover' {
  interface PopoverProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface PopoverTriggerProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>, AsChildProp {}
  interface PopoverPortalProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface PopoverAnchorProps extends React.HTMLAttributes<HTMLDivElement>, AsChildProp {}
  interface PopoverArrowProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface PopoverCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, AsChildProp {}
}

declare module '@radix-ui/react-tooltip' {
  interface TooltipProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface TooltipTriggerProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>, AsChildProp {}
  interface TooltipPortalProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface TooltipProviderProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface TooltipArrowProps extends React.HTMLAttributes<HTMLDivElement> {}
}

declare module '@radix-ui/react-checkbox' {
  interface CheckboxProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}
  interface CheckboxIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {}
}

declare module '@radix-ui/react-switch' {
  interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}
  interface SwitchThumbProps extends React.HTMLAttributes<HTMLSpanElement> {}
}

declare module '@radix-ui/react-scroll-area' {
  interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface ScrollAreaViewportProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface ScrollAreaScrollbarProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface ScrollAreaThumbProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface ScrollAreaCornerProps extends React.HTMLAttributes<HTMLDivElement> {}
}

declare module '@radix-ui/react-avatar' {
  interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {}
  interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {}
  interface AvatarFallbackProps extends React.HTMLAttributes<HTMLSpanElement> {}
}

declare module '@radix-ui/react-progress' {
  interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface ProgressIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {}
}

declare module '@radix-ui/react-slider' {
  interface SliderProps extends React.HTMLAttributes<HTMLSpanElement> {}
  interface SliderTrackProps extends React.HTMLAttributes<HTMLSpanElement> {}
  interface SliderRangeProps extends React.HTMLAttributes<HTMLSpanElement> {}
  interface SliderThumbProps extends React.HTMLAttributes<HTMLSpanElement> {}
}

declare module '@radix-ui/react-label' {
  interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement>, AsChildProp {}
}

declare module '@radix-ui/react-radio-group' {
  interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface RadioGroupItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}
  interface RadioGroupIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {}
}

declare module '@radix-ui/react-separator' {
  interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {}
}

declare module '@radix-ui/react-collapsible' {
  interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {}
  interface CollapsibleTriggerProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>, AsChildProp {}
  interface CollapsibleContentProps extends React.HTMLAttributes<HTMLDivElement> {}
}
