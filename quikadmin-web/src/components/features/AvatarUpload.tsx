import * as React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, X, User, AlertCircle } from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_EXTENSIONS = '.jpg, .jpeg, .png, .gif, .webp';

export interface AvatarUploadProps {
  /**
   * Current avatar URL to display
   */
  currentAvatarUrl?: string | null;
  /**
   * Callback when a new avatar file is selected
   */
  onAvatarChange: (file: File | null) => void;
  /**
   * Callback when avatar is removed
   */
  onAvatarRemove?: () => void;
  /**
   * Disable the upload functionality
   */
  disabled?: boolean;
  /**
   * Size variant for the avatar
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Additional CSS classes
   */
  className?: string;
}

const sizeClasses = {
  sm: 'size-16',
  md: 'size-24',
  lg: 'size-32',
} as const;

const iconSizeClasses = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
} as const;

const buttonSizeClasses = {
  sm: 'size-6',
  md: 'size-8',
  lg: 'size-10',
} as const;

/**
 * AvatarUpload component for uploading and managing user profile avatars.
 *
 * Features:
 * - Display current avatar or placeholder
 * - Click to upload new avatar
 * - Preview before save
 * - Remove button to clear avatar
 * - File type and size validation
 * - Drag and drop support
 *
 * @example
 * // Basic usage
 * <AvatarUpload
 *   currentAvatarUrl={user.avatarUrl}
 *   onAvatarChange={(file) => setAvatarFile(file)}
 *   onAvatarRemove={() => handleRemoveAvatar()}
 * />
 *
 * @example
 * // With size variant
 * <AvatarUpload
 *   currentAvatarUrl={user.avatarUrl}
 *   onAvatarChange={handleChange}
 *   size="lg"
 * />
 */
export function AvatarUpload({
  currentAvatarUrl,
  onAvatarChange,
  onAvatarRemove,
  disabled = false,
  size = 'md',
  className,
}: AvatarUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);

  // Determine what to display: preview > current avatar > placeholder
  const displayUrl = previewUrl || currentAvatarUrl;

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return `Invalid file type. Accepted types: ${ACCEPTED_EXTENSIONS}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File is too large. Maximum size is 5MB`;
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Create preview URL
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Notify parent
    onAvatarChange(file);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input to allow uploading the same file again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleRemove = () => {
    // Clean up preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setError(null);
    onAvatarChange(null);
    onAvatarRemove?.();
  };

  // Drag and drop handlers
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    if (disabled) return;

    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Keyboard accessibility
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleUploadClick();
    }
  };

  // Clean up preview URL on unmount
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div
      data-testid="avatar-upload"
      className={cn('flex flex-col items-center gap-3', className)}
    >
      {/* Avatar container with upload overlay */}
      <div
        className="relative group"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Avatar
          className={cn(
            sizeClasses[size],
            'ring-2 ring-border transition-all',
            isDragOver && 'ring-primary ring-offset-2',
            disabled && 'opacity-50'
          )}
        >
          {displayUrl ? (
            <AvatarImage
              data-testid="avatar-image"
              src={displayUrl}
              alt="Profile avatar"
              className="object-cover"
            />
          ) : null}
          <AvatarFallback
            data-testid="avatar-image"
            className="bg-muted"
          >
            <User className={cn(iconSizeClasses[size], 'text-muted-foreground')} />
          </AvatarFallback>
        </Avatar>

        {/* Upload overlay - visible on hover */}
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={handleUploadClick}
          onKeyDown={handleKeyDown}
          aria-label="Upload new avatar"
          className={cn(
            'absolute inset-0 flex items-center justify-center rounded-full transition-opacity cursor-pointer',
            'bg-black/50 opacity-0 group-hover:opacity-100 focus:opacity-100',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            disabled && 'cursor-not-allowed pointer-events-none'
          )}
        >
          <Camera className={cn(iconSizeClasses[size], 'text-white')} />
        </div>

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleInputChange}
          disabled={disabled}
          className="sr-only"
          aria-label="Upload avatar image"
          data-testid="avatar-upload-input"
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUploadClick}
          disabled={disabled}
          data-testid="avatar-upload-button"
        >
          <Camera className="size-4 mr-1" />
          {displayUrl ? 'Change' : 'Upload'}
        </Button>

        {(displayUrl || previewUrl) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            disabled={disabled}
            aria-label="Remove avatar"
            className={buttonSizeClasses[size]}
            data-testid="avatar-remove-button"
          >
            <X className={iconSizeClasses[size]} />
          </Button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div
          className="flex items-center gap-2 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Help text */}
      <p className="text-xs text-muted-foreground text-center">
        JPG, PNG, GIF, or WebP. Max 5MB.
      </p>
    </div>
  );
}

export default AvatarUpload;
