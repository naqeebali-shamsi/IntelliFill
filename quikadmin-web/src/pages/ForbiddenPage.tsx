import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, ShieldX } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ForbiddenPage() {
  return (
    <div
      data-testid="forbidden-page"
      className={cn(
        'min-h-screen flex items-center justify-center',
        'bg-slate-900 text-white'
      )}
    >
      <div className="text-center px-6 max-w-md">
        {/* Shield Icon */}
        <div className="flex justify-center mb-6">
          <ShieldX className="h-24 w-24 text-primary opacity-80" />
        </div>

        {/* 403 Number */}
        <h1
          data-testid="forbidden-title"
          className="text-8xl font-bold text-primary mb-4 tracking-tight"
        >
          403
        </h1>

        {/* Message */}
        <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
        <p data-testid="forbidden-message" className="text-white/60 mb-8">
          You don't have permission to access this page. Please contact your
          administrator if you believe this is an error.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild data-testid="forbidden-home-button">
            <Link to="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="#" onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
