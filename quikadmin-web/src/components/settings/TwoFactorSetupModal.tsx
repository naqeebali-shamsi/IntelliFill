import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import {
  Smartphone,
  Loader2,
  Shield,
  Copy,
  Download,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import api from '@/services/api';

type Step = 'intro' | 'qr' | 'verify' | 'backup';

interface EnrollData {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
}

interface TwoFactorSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TwoFactorSetupModal({ open, onOpenChange, onSuccess }: TwoFactorSetupModalProps) {
  const [step, setStep] = useState<Step>('intro');
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totpDigits, setTotpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [copied, setCopied] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when modal closes
  const handleClose = () => {
    setStep('intro');
    setEnrollData(null);
    setBackupCodes([]);
    setError(null);
    setTotpDigits(['', '', '', '', '', '']);
    setCopied(false);
    onOpenChange(false);
  };

  // Start enrollment when entering QR step
  const handleStartEnroll = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{
        factorId: string;
        qrCode: string;
        secret: string;
        uri: string;
      }>('/auth/v2/mfa/enroll');
      setEnrollData({
        factorId: response.data.factorId,
        qrCode: response.data.qrCode,
        secret: response.data.secret,
        uri: response.data.uri,
      });
      setStep('qr');
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: string; code?: string } } };
      const message = apiError?.response?.data?.error || 'Failed to start 2FA setup';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Verify TOTP code
  const handleVerify = async () => {
    const code = totpDigits.join('');
    if (code.length !== 6 || !enrollData?.factorId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ backupCodes: string[] }>('/auth/v2/mfa/verify', {
        factorId: enrollData.factorId,
        code,
      });
      setBackupCodes(response.data.backupCodes);
      setStep('backup');
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: string } } };
      const message = apiError?.response?.data?.error || 'Invalid verification code';
      setError(message);
      // Clear the inputs on error
      setTotpDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  // Handle digit input
  const handleDigitChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...totpDigits];
    newDigits[index] = digit;
    setTotpDigits(newDigits);

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace
  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !totpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData) {
      const newDigits = [...totpDigits];
      for (let i = 0; i < pastedData.length; i++) {
        newDigits[i] = pastedData[i];
      }
      setTotpDigits(newDigits);
      // Focus last filled input or last input
      const lastIndex = Math.min(pastedData.length, 5);
      inputRefs.current[lastIndex]?.focus();
    }
  };

  // Copy secret to clipboard
  const handleCopySecret = async () => {
    if (enrollData?.secret) {
      await navigator.clipboard.writeText(enrollData.secret);
      toast.success('Secret key copied to clipboard');
    }
  };

  // Copy backup codes
  const handleCopyBackupCodes = async () => {
    const codesText = backupCodes.join('\n');
    await navigator.clipboard.writeText(codesText);
    setCopied(true);
    toast.success('Backup codes copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // Download backup codes
  const handleDownloadBackupCodes = () => {
    const content = [
      'IntelliFill - Two-Factor Authentication Backup Codes',
      '='.repeat(50),
      '',
      'Save these codes in a safe place. Each code can only be used once.',
      '',
      ...backupCodes.map((code, i) => `${i + 1}. ${code}`),
      '',
      `Generated: ${new Date().toISOString()}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'intellifill-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Backup codes downloaded');
  };

  // Complete setup
  const handleComplete = () => {
    onSuccess?.();
    handleClose();
    toast.success('Two-factor authentication enabled', {
      description: 'Your account is now more secure.',
    });
  };

  // Auto-verify when all digits are entered
  useEffect(() => {
    const code = totpDigits.join('');
    if (code.length === 6 && step === 'verify' && !isLoading && enrollData?.factorId) {
      const timer = setTimeout(() => {
        handleVerify();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [totpDigits, step, isLoading, enrollData?.factorId]);

  const canVerify = totpDigits.every((d) => d !== '') && !isLoading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="sm" className="sm:max-w-md">
        {/* Step 1: Introduction */}
        {step === 'intro' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Set Up Two-Factor Authentication
              </DialogTitle>
              <DialogDescription>
                Add an extra layer of security to your account by requiring a verification code in
                addition to your password.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <Smartphone className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">You'll need an authenticator app</p>
                  <p className="text-muted-foreground mt-1">
                    Use apps like Google Authenticator, Authy, or 1Password to generate verification
                    codes.
                  </p>
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleStartEnroll} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  'Get Started'
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: QR Code */}
        {step === 'qr' && enrollData && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                Scan QR Code
              </DialogTitle>
              <DialogDescription>
                Open your authenticator app and scan this QR code to add your account.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg">
                  <img src={enrollData.qrCode} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              </div>

              {/* Manual entry fallback */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Can't scan? Enter this key manually:
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all select-all">
                    {enrollData.secret}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopySecret}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('intro')}>
                Back
              </Button>
              <Button onClick={() => setStep('verify')}>Continue</Button>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Verify */}
        {step === 'verify' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Verify Setup
              </DialogTitle>
              <DialogDescription>
                Enter the 6-digit code from your authenticator app to verify the setup.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* 6-digit input */}
              <div className="space-y-2">
                <Label htmlFor="totp-0">Verification Code</Label>
                <div className="flex justify-center gap-2">
                  {totpDigits.map((digit, index) => (
                    <Input
                      key={index}
                      id={`totp-${index}`}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      disabled={isLoading}
                      className={cn(
                        'w-12 h-14 text-center text-2xl font-mono',
                        error && 'border-destructive'
                      )}
                      autoComplete="one-time-code"
                    />
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('qr')} disabled={isLoading}>
                Back
              </Button>
              <Button onClick={handleVerify} disabled={!canVerify}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify'
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 4: Backup Codes */}
        {step === 'backup' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-status-success" />
                Save Your Backup Codes
              </DialogTitle>
              <DialogDescription>
                Store these codes safely. You can use them to access your account if you lose your
                authenticator device.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Warning */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-status-warning/10 border border-status-warning/20">
                <AlertTriangle className="h-5 w-5 text-status-warning mt-0.5 shrink-0" />
                <p className="text-sm text-status-warning-foreground">
                  <strong>Important:</strong> These codes will not be shown again. Save them in a
                  secure location now.
                </p>
              </div>

              {/* Backup codes grid */}
              <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg">
                {backupCodes.map((code, index) => (
                  <code
                    key={index}
                    className="text-sm font-mono p-2 bg-background rounded text-center"
                  >
                    {code}
                  </code>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleCopyBackupCodes}>
                  {copied ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Codes
                    </>
                  )}
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleDownloadBackupCodes}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleComplete} className="w-full">
                I've Saved My Codes
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
