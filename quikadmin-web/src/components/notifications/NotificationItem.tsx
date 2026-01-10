/**
 * NotificationItem - Individual notification display
 */

import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, AlertCircle, Mail, Users, FileText, Bell, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/services/notificationService';

interface NotificationItemProps {
  notification: Notification;
  onRead?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const typeIcons: Record<NotificationType, typeof CheckCircle2> = {
  PROCESSING_COMPLETE: CheckCircle2,
  PROCESSING_FAILED: AlertCircle,
  ORG_INVITE: Mail,
  ORG_MEMBER_JOINED: Users,
  DOCUMENT_SHARED: FileText,
  SYSTEM_ALERT: Bell,
};

const typeColors: Record<NotificationType, string> = {
  PROCESSING_COMPLETE: 'text-status-success',
  PROCESSING_FAILED: 'text-status-error',
  ORG_INVITE: 'text-primary',
  ORG_MEMBER_JOINED: 'text-primary',
  DOCUMENT_SHARED: 'text-primary',
  SYSTEM_ALERT: 'text-status-warning',
};

export function NotificationItem({ notification, onRead, onDelete }: NotificationItemProps) {
  const Icon = typeIcons[notification.type] || Bell;
  const iconColor = typeColors[notification.type] || 'text-muted-foreground';

  const handleClick = () => {
    if (!notification.read && onRead) {
      onRead(notification.id);
    }
  };

  return (
    <div
      className={cn(
        'flex gap-3 p-3 hover:bg-accent/50 transition-colors cursor-pointer relative group',
        !notification.read && 'bg-primary/5'
      )}
      onClick={handleClick}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
      )}

      {/* Icon */}
      <div className={cn('flex-shrink-0 mt-0.5', iconColor)}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm', !notification.read && 'font-medium')}>{notification.title}</p>
        {notification.message && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {notification.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>

      {/* Delete button */}
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
