import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NotFoundPage() {
  return (
    <div
      data-testid="not-found-page"
      className={cn(
        'min-h-screen flex items-center justify-center',
        'bg-slate-900 text-white'
      )}
    >
      <div className="text-center px-6 max-w-md">
        {/* 404 Number */}
        <h1 className="text-9xl font-bold text-primary mb-4 tracking-tight">
          404
        </h1>

        {/* Message */}
        <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
        <p className="text-white/60 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link to="/">
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
