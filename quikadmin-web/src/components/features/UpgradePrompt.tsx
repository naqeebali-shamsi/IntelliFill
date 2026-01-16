import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

interface UpgradePromptProps {
  feature: string;
  description?: string;
  className?: string;
}

/**
 * Display when a free user tries to access a PRO feature
 * Redirects to /pricing page
 */
export function UpgradePrompt({ feature, description, className = '' }: UpgradePromptProps) {
  const navigate = useNavigate();

  return (
    <Card className={`border-primary/20 bg-primary/5 ${className}`}>
      <CardContent className="flex flex-col items-center text-center py-8 px-6">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{feature} is a PRO feature</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">
          {description || 'Upgrade to PRO to unlock this feature and more.'}
        </p>
        <Button onClick={() => navigate('/pricing')}>Upgrade to PRO</Button>
      </CardContent>
    </Card>
  );
}

/**
 * Hook to check PRO access and redirect if not
 * Use in page components that should be PRO-only
 */
export function useRequirePro(redirectPath = '/pricing') {
  const navigate = useNavigate();
  const { isPro, initialized } = useSubscriptionStore((state) => ({
    isPro: state.isPro,
    initialized: state.initialized,
  }));

  useEffect(() => {
    if (initialized && !isPro) {
      navigate(redirectPath);
    }
  }, [initialized, isPro, navigate, redirectPath]);

  return { isPro, loading: !initialized };
}
