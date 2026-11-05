import prisma from '../config/prisma.config.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

class NotificationController {
  /**
   * 1. Get in-app notifications for authenticated customer
   * GET /api/v1/notifications
   */
  listNotifications = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { isRead, limit = 20 } = req.query;

    const where = { userId };
    if (isRead !== undefined) {
      where.isRead = isRead === 'true';
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return apiResponse.success(res, {
      message: 'Notifications retrieved successfully.',
      data: {
        notifications,
        unreadCount,
      },
    });
  });

  /**
   * 2. Mark single notification as read
   * PATCH /api/v1/notifications/:id/read
   */
  markAsRead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      return apiResponse.notFound(res, { message: 'Notification not found' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return apiResponse.success(res, {
      message: 'Notification marked as read.',
      data: updated,
    });
  });

  /**
   * 3. Mark all notifications as read
   * PATCH /api/v1/notifications/read-all
   */
  markAllAsRead = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return apiResponse.success(res, {
      message: 'All notifications marked as read.',
    });
  });

  /**
   * 4. Get Notification Preferences
   * GET /api/v1/notifications/preferences
   */
  getPreferences = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: {
          userId,
          emailOrderUpdates: true,
          emailPromotions: true,
          emailStockAlerts: true,
        },
      });
    }

    return apiResponse.success(res, {
      message: 'Notification preferences retrieved.',
      data: prefs,
    });
  });

  /**
   * 5. Update Notification Preferences
   * PATCH /api/v1/notifications/preferences
   */
  updatePreferences = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { emailOrderUpdates, emailPromotions, emailStockAlerts } = req.body;

    const updated = await prisma.notificationPreference.upsert({
      where: { userId },
      update: {
        ...(emailOrderUpdates !== undefined && { emailOrderUpdates: Boolean(emailOrderUpdates) }),
        ...(emailPromotions !== undefined && { emailPromotions: Boolean(emailPromotions) }),
        ...(emailStockAlerts !== undefined && { emailStockAlerts: Boolean(emailStockAlerts) }),
      },
      create: {
        userId,
        emailOrderUpdates: emailOrderUpdates !== undefined ? Boolean(emailOrderUpdates) : true,
        emailPromotions: emailPromotions !== undefined ? Boolean(emailPromotions) : true,
        emailStockAlerts: emailStockAlerts !== undefined ? Boolean(emailStockAlerts) : true,
      },
    });

    return apiResponse.success(res, {
      message: 'Notification preferences updated.',
      data: updated,
    });
  });
}

export const notificationController = new NotificationController();
export default notificationController;
