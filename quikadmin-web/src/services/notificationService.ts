/**
 * Notification Service
 * API functions for managing user notifications
 */

import api from './api';

export type NotificationType =
  | 'PROCESSING_COMPLETE'
  | 'PROCESSING_FAILED'
  | 'ORG_INVITE'
  | 'ORG_MEMBER_JOINED'
  | 'DOCUMENT_SHARED'
  | 'SYSTEM_ALERT';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string | null;
  data: Record<string, unknown>;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  success: boolean;
  data: {
    notifications: Notification[];
    unreadCount: number;
  };
}

interface NotificationResponse {
  success: boolean;
  data: Notification;
}

interface MarkAllReadResponse {
  success: boolean;
  data: {
    updatedCount: number;
  };
}

interface DeleteReadResponse {
  success: boolean;
  data: {
    deletedCount: number;
  };
}

/**
 * Get notifications for the current user
 */
export async function getNotifications(
  options: {
    limit?: number;
    unreadOnly?: boolean;
  } = {}
): Promise<NotificationsResponse['data']> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.unreadOnly) params.set('unreadOnly', 'true');

  const queryString = params.toString();
  const url = `/notifications${queryString ? `?${queryString}` : ''}`;

  const response = await api.get<NotificationsResponse>(url);
  return response.data.data;
}

/**
 * Get a single notification by ID
 */
export async function getNotification(id: string): Promise<Notification> {
  const response = await api.get<NotificationResponse>(`/notifications/${id}`);
  return response.data.data;
}

/**
 * Mark a notification as read
 */
export async function markAsRead(id: string): Promise<Notification> {
  const response = await api.patch<NotificationResponse>(`/notifications/${id}/read`);
  return response.data.data;
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(): Promise<number> {
  const response = await api.post<MarkAllReadResponse>('/notifications/mark-all-read');
  return response.data.data.updatedCount;
}

/**
 * Delete a notification
 */
export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`);
}

/**
 * Delete all read notifications
 */
export async function deleteReadNotifications(): Promise<number> {
  const response = await api.delete<DeleteReadResponse>('/notifications');
  return response.data.data.deletedCount;
}
