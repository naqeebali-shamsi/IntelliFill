import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useBackendAuthStore } from '@/stores/backendAuthStore';
import api from '@/services/api';

interface DeleteAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountModal({ open, onOpenChange }: DeleteAccountModalProps) {
  const navigate = useNavigate();
  const { logout } = useBackendAuthStore();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setPassword('');
    setShowPassword(false);
    setConfirmed(false);
    setError(null);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!password || !confirmed) return;

    setError(null);
    setIsDeleting(true);

    try {
      await api.delete('/users/me', { data: { password } });
      await logout();
      toast.success('Account deleted', {
        description: 'Your account and all data have been permanently deleted.',
      });
      navigate('/login');
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: string } } };
      const message =
        apiError?.response?.data?.error ||
        'Failed to delete account. Please check your password and try again.';
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const canDelete = password.length > 0 && confirmed && !isDeleting;

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Account
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            This will permanently delete your account, all documents, profiles, and data.{' '}
            <span className="font-semibold text-destructive">This cannot be undone.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="delete-password">Enter your password to confirm</Label>
            <div className="relative">
              <Input
                id="delete-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isDeleting}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="confirm-delete"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
              disabled={isDeleting}
            />
            <Label
              htmlFor="confirm-delete"
              className="text-sm leading-tight cursor-pointer text-muted-foreground"
            >
              I understand this action is irreversible and all my data will be permanently deleted
            </Label>
          </div>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!canDelete}>
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Account'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
