/**
 * ModeToggle - Wizard mode preference toggle
 *
 * Allows users to switch between Assisted and Express modes.
 * - Assisted: More guidance, lower auto-skip threshold (85%)
 * - Express: Less guidance, higher auto-skip threshold (90%)
 *
 * Persists to localStorage via userPreferencesStore.
 */

import * as React from 'react';

import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useUserPreferencesStore, type WizardMode } from '@/stores/userPreferencesStore';

export interface ModeToggleProps {
  /** Additional class name for styling */
  className?: string;
}

const MODE_DESCRIPTIONS: Record<WizardMode, string> = {
  assisted: 'Review each step for accuracy',
  express: 'Auto-skip high-confidence steps',
};

/**
 * ModeToggle component for switching between Assisted and Express wizard modes.
 * Reads and writes directly to userPreferencesStore.
 */
export function ModeToggle({ className }: ModeToggleProps) {
  const wizardMode = useUserPreferencesStore((s) => s.wizardMode);
  const setWizardMode = useUserPreferencesStore((s) => s.setWizardMode);

  const isExpress = wizardMode === 'express';

  const handleToggle = (checked: boolean) => {
    setWizardMode(checked ? 'express' : 'assisted');
  };

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-2', className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'cursor-default text-sm transition-colors',
                !isExpress ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}
            >
              Assisted
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{MODE_DESCRIPTIONS.assisted}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Switch
                checked={isExpress}
                onCheckedChange={handleToggle}
                aria-label={`Switch between Assisted and Express mode. Currently ${wizardMode}`}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{isExpress ? MODE_DESCRIPTIONS.express : MODE_DESCRIPTIONS.assisted}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'cursor-default text-sm transition-colors',
                isExpress ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}
            >
              Express
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{MODE_DESCRIPTIONS.express}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export default ModeToggle;
