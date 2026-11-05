import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import productRoutes from './product.routes.js';
import categoryRoutes from './category.routes.js';
import collectionRoutes from './collection.routes.js';
import searchRoutes from './search.routes.js';
import pricingRoutes from './pricing.routes.js';
import couponRoutes from './coupon.routes.js';
import flashSaleRoutes from './flashSale.routes.js';
import offerRoutes from './offer.routes.js';
import cartRoutes from './cart.routes.js';
import wishlistRoutes from './wishlist.routes.js';
import addressRoutes from './address.routes.js';
import reviewRoutes from './review.routes.js';
import engagementRoutes from './engagement.routes.js';
import inventoryRoutes from './inventory.routes.js';
import orderRoutes, { adminOrderRouter } from './order.routes.js';
import paymentRoutes from './payment.routes.js';
import cmsRoutes from './cms.routes.js';
import adminRoutes from './admin.routes.js';
import notificationRoutes from './notification.routes.js';
import apiResponse from '../utils/apiResponse.js';

const apiV1Router = Router();

// Base API v1 Metadata
apiV1Router.get('/', (req, res) => {
  return apiResponse.success(res, {
    message: 'FORME API Version 1.0 (RESTful Service)',
    data: {
      version: '1.0.0',
      tagline: 'Designed to Be Worn. Made to Be Remembered.',
      endpoints: {
        health: '/api/v1/health',
        auth: '/api/v1/auth',
        products: '/api/v1/products',
        categories: '/api/v1/categories',
        collections: '/api/v1/collections',
        search: '/api/v1/search',
        pricing: '/api/v1/pricing',
        coupons: '/api/v1/coupons',
        flashSales: '/api/v1/flash-sales',
        offers: '/api/v1/offers',
        cart: '/api/v1/cart',
        wishlist: '/api/v1/wishlist',
        addresses: '/api/v1/addresses',
        reviews: '/api/v1/reviews',
        engagement: '/api/v1/engagement',
        inventory: '/api/v1/inventory',
        orders: '/api/v1/orders',
        adminOrders: '/api/v1/admin/orders',
        payments: '/api/v1/payments',
        cms: '/api/v1/cms',
        notifications: '/api/v1/notifications',
        admin: '/api/v1/admin',
      },
    },
  });
});

// Mount Feature Routes
apiV1Router.use('/health', healthRoutes);
apiV1Router.use('/auth', authRoutes);
apiV1Router.use('/products', productRoutes);
apiV1Router.use('/categories', categoryRoutes);
apiV1Router.use('/collections', collectionRoutes);
apiV1Router.use('/search', searchRoutes);
apiV1Router.use('/pricing', pricingRoutes);
apiV1Router.use('/coupons', couponRoutes);
apiV1Router.use('/flash-sales', flashSaleRoutes);
apiV1Router.use('/offers', offerRoutes);
apiV1Router.use('/cart', cartRoutes);
apiV1Router.use('/wishlist', wishlistRoutes);
apiV1Router.use('/addresses', addressRoutes);
apiV1Router.use('/reviews', reviewRoutes);
apiV1Router.use('/engagement', engagementRoutes);
apiV1Router.use('/inventory', inventoryRoutes);
apiV1Router.use('/orders', orderRoutes);
apiV1Router.use('/admin/orders', adminOrderRouter);
apiV1Router.use('/admin', adminRoutes);
apiV1Router.use('/payments', paymentRoutes);
apiV1Router.use('/cms', cmsRoutes);
apiV1Router.use('/notifications', notificationRoutes);

export default apiV1Router;
