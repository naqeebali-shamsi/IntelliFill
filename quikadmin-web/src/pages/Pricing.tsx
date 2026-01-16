import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSubscriptionStore, useIsPro } from '@/stores/subscriptionStore';
import { useAuthStore } from '@/stores/backendAuthStore';
import { toast } from '@/lib/toast';

const PRO_FEATURES = [
  'Unlimited document processing',
  'Client library with search',
  'Form usage analytics',
  'Priority support',
  'API access',
  'Batch processing',
];

export default function Pricing() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isPro = useIsPro();
  const { loading, error, redirectToCheckout, fetchStatus } = useSubscriptionStore();

  // Handle success/cancel redirects from Stripe
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Welcome to PRO! Your subscription is now active.');
      // Refresh subscription status
      fetchStatus();
      // Clear query params
      navigate('/pricing', { replace: true });
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Checkout canceled. No charges were made.');
      navigate('/pricing', { replace: true });
    }
  }, [searchParams, fetchStatus, navigate]);

  // Fetch status on mount if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchStatus();
    }
  }, [isAuthenticated, fetchStatus]);

  const handleSubscribe = () => {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      navigate('/login?redirect=/pricing');
      return;
    }
    redirectToCheckout();
  };

  return (
    <div className="container max-w-4xl py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Simple, transparent pricing</h1>
        <p className="text-lg text-muted-foreground">
          Unlock the full power of IntelliFill with PRO
        </p>
      </div>

      <div className="flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">PRO</CardTitle>
            <CardDescription>For professionals and teams</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-center mb-6">
              <span className="text-4xl font-bold">$19</span>
              <span className="text-muted-foreground">/month</span>
            </div>

            <ul className="space-y-3 mb-8">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {isPro ? (
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full mb-4">
                  <Check className="h-4 w-4" />
                  <span className="font-medium">You're subscribed to PRO</span>
                </div>
                <Button variant="outline" className="w-full" onClick={() => navigate('/settings')}>
                  Manage Subscription
                </Button>
              </div>
            ) : (
              <Button className="w-full" size="lg" onClick={handleSubscribe} disabled={loading}>
                {loading ? 'Loading...' : 'Subscribe to PRO'}
              </Button>
            )}

            {error && <p className="text-sm text-destructive text-center mt-4">{error}</p>}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-sm text-muted-foreground mt-8">
        Cancel anytime. Powered by Stripe for secure payments.
      </p>
    </div>
  );
}
