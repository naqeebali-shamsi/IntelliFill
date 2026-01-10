/**
 * NotificationCenter - Notification list with actions
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { NotificationItem } from './NotificationItem';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteReadNotifications,
} from '@/services/notificationService';

interface NotificationCenterProps {
  onClose?: () => void;
}

export function NotificationCenter({ onClose }: NotificationCenterProps) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: () => getNotifications({ limit: 50 }),
    staleTime: 30 * 1000,
  });

  const invalidateNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markAsReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: invalidateNotifications,
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: invalidateNotifications,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: invalidateNotifications,
  });

  const deleteReadMutation = useMutation({
    mutationFn: deleteReadNotifications,
    onSuccess: invalidateNotifications,
  });

  const hasUnread = (data?.unreadCount ?? 0) > 0;
  const hasRead = data?.notifications.some((n) => n.read) ?? false;

  function renderContent(): React.ReactNode {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <p className="text-sm text-destructive">Failed to load notifications</p>
        </div>
      );
    }

    if (!data?.notifications.length) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <Bell className="h-10 w-10 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No notifications</p>
          <p className="text-xs text-muted-foreground/70 mt-1">You're all caught up!</p>
        </div>
      );
    }

    return (
      <ScrollArea className="flex-1">
        <div className="divide-y">
          {data.notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRead={markAsReadMutation.mutate}
              onDelete={deleteMutation.mutate}
            />
          ))}
        </div>
      </ScrollArea>
    );
  }

  return (
    <div className="flex flex-col max-h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <span className="font-semibold text-sm">Notifications</span>
        <div className="flex items-center gap-1">
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              {markAllReadMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <CheckCheck className="h-3 w-3 mr-1" />
              )}
              Mark all read
            </Button>
          )}
          {hasRead && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => deleteReadMutation.mutate()}
              disabled={deleteReadMutation.isPending}
            >
              {deleteReadMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-3 w-3 mr-1" />
              )}
              Clear read
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {renderContent()}

      {/* Footer */}
      {data && data.notifications.length > 0 && (
        <>
          <Separator />
          <div className="p-2">
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onClose}>
              View all notifications
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
