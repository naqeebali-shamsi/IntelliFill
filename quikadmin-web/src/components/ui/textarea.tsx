import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-[var(--border-input)] placeholder:text-muted-foreground focus-visible:border-[var(--border-input-focus)] focus-visible:ring-[var(--border-focus-ring)] aria-invalid:ring-[var(--feedback-error)]/20 aria-invalid:border-[var(--feedback-error-border)] data-[valid=true]:border-[var(--feedback-success)] data-[valid=true]:ring-[var(--feedback-success)]/20 dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
