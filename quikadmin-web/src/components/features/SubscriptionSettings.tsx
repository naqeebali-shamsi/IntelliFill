import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, CreditCard, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

/**
 * Subscription management section for Settings page
 * Shows current status and link to Stripe Customer Portal
 */
export function SubscriptionSettings() {
  // Use individual selectors to ensure proper re-renders when state changes
  const isPro = useSubscriptionStore((state) => state.isPro);
  const status = useSubscriptionStore((state) => state.status);
  const currentPeriodEnd = useSubscriptionStore((state) => state.currentPeriodEnd);
  const loading = useSubscriptionStore((state) => state.loading);
  const error = useSubscriptionStore((state) => state.error);
  const fetchStatus = useSubscriptionStore((state) => state.fetchStatus);
  const redirectToPortal = useSubscriptionStore((state) => state.redirectToPortal);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Debug: log current state values
  console.log('[SubscriptionSettings] Render:', { isPro, status, loading, currentPeriodEnd });

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const getStatusBadge = () => {
    if (!status) return null;

    const statusStyles: Record<string, string> = {
      active: 'bg-status-success/10 text-status-success',
      trialing: 'bg-status-pending/10 text-status-pending',
      past_due: 'bg-status-warning/10 text-status-warning',
      canceled: 'bg-muted text-muted-foreground',
    };

    const style = statusStyles[status] || 'bg-muted text-muted-foreground';

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${style}`}>
        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </span>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Subscription
        </CardTitle>
        <CardDescription>Manage your IntelliFill PRO subscription</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        ) : isPro ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plan</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">PRO</span>
                {getStatusBadge()}
              </div>
            </div>

            {currentPeriodEnd && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {status === 'canceled' ? 'Access until' : 'Renews on'}
                </span>
                <span className="font-medium">{formatDate(currentPeriodEnd)}</span>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={redirectToPortal}
              disabled={loading}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Manage Billing
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Update payment method, view invoices, or cancel subscription
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plan</span>
              <span className="font-medium">Free</span>
            </div>

            <Button className="w-full mt-4" onClick={() => navigate('/pricing')}>
              Upgrade to PRO
            </Button>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
