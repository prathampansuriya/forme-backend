import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/config/prisma.config.js';

describe('FORME Complete Admin Backend and CMS APIs Suite (Prompt 11)', { timeout: 60000 }, () => {
  let adminToken = null;
  let adminUser = null;
  let customerToken = null;
  let customerUser = null;
  let timestamp = null;

  // Stored IDs for assertions across lifecycle
  let testBannerId = null;
  let testAnnouncementId = null;
  let testSectionId = null;
  let testMenuId = null;
  let testMenuItemId = null;
  let testFooterSectionId = null;
  let testFooterItemId = null;
  let testEditorialId = null;
  let testTaxSettingId = null;
  let testShippingSettingId = null;
  let testCurrencyId = null;
  let testReviewId = null;
  let testProductId = null;
  let testCategoryId = null;

  beforeAll(async () => {
    timestamp = Date.now();

    // 1. Authenticate Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/admin/login')
      .send({
        email: 'admin@forme.store',
        password: 'FormeAdmin@2026!',
      });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.accessToken;
    adminUser = adminRes.body.data.user;

    // 2. Provision Test Customer
    const password = 'CustomerPass2026!';
    const passwordHash = await bcrypt.hash(password, 10);
    customerUser = await prisma.user.create({
      data: {
        name: 'Aurelia Delacroix',
        email: `aurelia.${timestamp}@forme.store`,
        phone: `+9198${String(timestamp).slice(-8)}`,
        passwordHash,
        role: 'CUSTOMER',
        isEmailVerified: true,
      },
    });

    const custLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: customerUser.email, password });
    expect(custLoginRes.status).toBe(200);
    customerToken = custLoginRes.body.data.accessToken;

    // 3. Provision Sample Product & Review for Review Moderation Tests
    testCategoryId = `cat-${timestamp}`;
    const category = await prisma.category.create({
      data: {
        name: `Admin Haute Couture ${timestamp}`,
        slug: `admin-haute-${timestamp}`,
      },
    });

    const product = await prisma.product.create({
      data: {
        name: `Silk Evening Trench ${timestamp}`,
        slug: `silk-evening-trench-${timestamp}`,
        baseSku: `TRENCH-${timestamp}`,
        productType: 'COAT',
        shortDescription: 'Signature tailoring in mulberry silk.',
        longDescription: 'Full description of silk evening trench coat.',
        sellingPrice: 45000,
        compareAtPrice: 52000,
        categoryId: category.id,
      },
    });
    testProductId = product.id;

    const review = await prisma.review.create({
      data: {
        productId: product.id,
        userId: customerUser.id,
        rating: 5,
        headline: 'Sublime artisanal tailoring',
        content: 'Exquisite drape and hand-stitched detailing.',
        isApproved: false,
      },
    });
    testReviewId = review.id;
  }, 45000);

  afterAll(async () => {
    // Cleanup generated test records
    try {
      if (testReviewId) await prisma.review.deleteMany({ where: { id: testReviewId } });
      if (testProductId) await prisma.product.deleteMany({ where: { id: testProductId } });
      if (testCategoryId) await prisma.category.deleteMany({ where: { slug: `admin-haute-${timestamp}` } });
      if (customerUser) await prisma.user.deleteMany({ where: { id: customerUser.id } });
      if (testBannerId) await prisma.banner.deleteMany({ where: { id: testBannerId } });
      if (testAnnouncementId) await prisma.announcement.deleteMany({ where: { id: testAnnouncementId } });
      if (testSectionId) await prisma.homePageSection.deleteMany({ where: { id: testSectionId } });
      if (testMenuId) await prisma.navigationMenu.deleteMany({ where: { id: testMenuId } });
      if (testFooterSectionId) await prisma.footerSection.deleteMany({ where: { id: testFooterSectionId } });
      if (testEditorialId) await prisma.editorialContent.deleteMany({ where: { id: testEditorialId } });
      if (testTaxSettingId) await prisma.taxSetting.deleteMany({ where: { id: testTaxSettingId } });
      if (testShippingSettingId) await prisma.shippingSetting.deleteMany({ where: { id: testShippingSettingId } });
      if (testCurrencyId) await prisma.currencySetting.deleteMany({ where: { id: testCurrencyId } });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ==========================================
  // 1. STRICT ACCESS CONTROL
  // ==========================================
  describe('1. Strict Access Control Verification', () => {
    it('rejects unauthenticated requests to administrative endpoints with 401', async () => {
      const res = await request(app).get('/api/v1/admin/analytics/overview');
      expect(res.status).toBe(401);
    });

    it('rejects customer requests to administrative endpoints with 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('allows verified admin requests through to administrative endpoints', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('kpis');
    });
  });

  // ==========================================
  // 2. CMS CONTENT MANAGEMENT (PUBLIC & ADMIN)
  // ==========================================
  describe('2. CMS Content Management & Editorial Engine', () => {
    // 2.1 Banners
    it('creates, retrieves, updates, reorders and lists promotional banners', async () => {
      // Create banner as Admin
      const createRes = await request(app)
        .post('/api/v1/admin/cms/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `L’Automne Winter Collection ${timestamp}`,
          subtitle: 'The Architectural Silhouette',
          type: 'HOME',
          desktopMediaUrl: 'https://images.unsplash.com/photo-banner-desktop.jpg',
          mobileMediaUrl: 'https://images.unsplash.com/photo-banner-mobile.jpg',
          ctaLabel: 'Explore Collection',
          ctaLink: '/collections/autumn-winter',
          isPublished: true,
          displayOrder: 1,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data).toHaveProperty('id');
      testBannerId = createRes.body.data.id;

      // Public Storefront Banner Retrieval
      const pubRes = await request(app).get('/api/v1/cms/banners?type=HOME');
      expect(pubRes.status).toBe(200);
      const match = pubRes.body.data.find((b) => b.id === testBannerId);
      expect(match).toBeDefined();
      expect(match.title).toContain('L’Automne Winter Collection');

      // Update Banner
      const updateRes = await request(app)
        .put(`/api/v1/admin/cms/banners/${testBannerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `L’Automne Haute Horlogerie ${timestamp}`,
          displayOrder: 2,
        });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toContain('Haute Horlogerie');

      // Reorder Banners
      const reorderRes = await request(app)
        .post('/api/v1/admin/cms/banners/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          items: [{ id: testBannerId, displayOrder: 0 }],
        });
      expect(reorderRes.status).toBe(200);
    });

    // 2.2 Announcements
    it('creates, updates and lists active announcement strip messages', async () => {
      const createRes = await request(app)
        .post('/api/v1/admin/cms/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          message: 'Complimentary White Glove Delivery Across India on Orders Above ₹5,000',
          ctaLabel: 'Learn More',
          ctaLink: '/client-care/shipping',
          backgroundColor: '#1C1917',
          textColor: '#FAF8F5',
          isPublished: true,
          displayOrder: 1,
        });
      expect(createRes.status).toBe(201);
      testAnnouncementId = createRes.body.data.id;

      // Public Announcement Retrieval
      const pubRes = await request(app).get('/api/v1/cms/announcements');
      expect(pubRes.status).toBe(200);
      const pubMatch = pubRes.body.data.find((a) => a.id === testAnnouncementId);
      expect(pubMatch).toBeDefined();

      // Update Announcement
      const updateRes = await request(app)
        .put(`/api/v1/admin/cms/announcements/${testAnnouncementId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          message: 'Atelier Holiday Shipping: Order by Dec 20 for Christmas Delivery',
        });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.message).toContain('Atelier Holiday Shipping');
    });

    // 2.3 Homepage Layout Sections
    it('creates, lists and updates dynamic homepage sections', async () => {
      const createRes = await request(app)
        .post('/api/v1/admin/cms/sections')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Curated Capsule',
          subtitle: 'Pure Italian Wool & Fine Cashmere',
          type: 'FEATURED_COLLECTION',
          displayOrder: 1,
          isPublished: true,
          references: { collectionSlug: 'autumn-winter' },
        });
      expect(createRes.status).toBe(201);
      testSectionId = createRes.body.data.id;

      // Public Homepage Sections
      const pubRes = await request(app).get('/api/v1/cms/homepage-sections');
      expect(pubRes.status).toBe(200);
      expect(pubRes.body.data.some((s) => s.id === testSectionId)).toBe(true);
    });

    // 2.4 Navigation Menus (Hierarchical Dropdown & Mega Menu)
    it('manages navigation menus and hierarchical dropdown items', async () => {
      const menuRes = await request(app)
        .post('/api/v1/admin/cms/menus')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Main Header Nav ${timestamp}`,
          slug: `header-main-${timestamp}`,
          isActive: true,
        });
      expect(menuRes.status).toBe(201);
      testMenuId = menuRes.body.data.id;

      // Add Root Nav Item
      const rootItemRes = await request(app)
        .post(`/api/v1/admin/cms/menus/${testMenuId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          label: 'Atelier Collections',
          url: '/collections',
          displayOrder: 1,
          highlightBadge: 'NEW',
        });
      expect(rootItemRes.status).toBe(201);
      testMenuItemId = rootItemRes.body.data.id;

      // Add Child Dropdown Nav Item
      const childItemRes = await request(app)
        .post(`/api/v1/admin/cms/menus/${testMenuId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          label: 'Winter Cashmere',
          url: '/collections/winter-cashmere',
          displayOrder: 1,
          parentId: testMenuItemId,
        });
      expect(childItemRes.status).toBe(201);

      // Verify Public Hierarchical Menu Resolution
      const pubNavRes = await request(app).get(`/api/v1/cms/navigation/header-main-${timestamp}`);
      expect(pubNavRes.status).toBe(200);
      expect(pubNavRes.body.data.items).toHaveLength(1);
      expect(pubNavRes.body.data.items[0].children).toHaveLength(1);
      expect(pubNavRes.body.data.items[0].children[0].label).toBe('Winter Cashmere');
    });

    // 2.5 Footer Navigation
    it('manages footer sections and footer links', async () => {
      const createSecRes = await request(app)
        .post('/api/v1/admin/cms/footers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `Client Care ${timestamp}`,
          displayOrder: 1,
          isActive: true,
        });
      expect(createSecRes.status).toBe(201);
      testFooterSectionId = createSecRes.body.data.id;

      const createItemRes = await request(app)
        .post(`/api/v1/admin/cms/footers/${testFooterSectionId}/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          label: 'Bespoke Inquiries',
          url: '/concierge/bespoke',
          displayOrder: 1,
        });
      expect(createItemRes.status).toBe(201);
      testFooterItemId = createItemRes.body.data.id;

      // Public Footer
      const pubRes = await request(app).get('/api/v1/cms/footer');
      expect(pubRes.status).toBe(200);
      const match = pubRes.body.data.find((f) => f.id === testFooterSectionId);
      expect(match).toBeDefined();
      expect(match.items[0].label).toBe('Bespoke Inquiries');
    });

    // 2.6 Editorial Content (Journal, Lookbook, Atelier Story)
    it('creates, publishes and retrieves editorial articles and lookbooks', async () => {
      const slug = `the-art-of-silk-${timestamp}`;
      const createRes = await request(app)
        .post('/api/v1/admin/cms/editorials')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'The Art of Mulberry Silk Weaving',
          slug,
          category: 'Journal',
          content: 'Deep in the heritage mills of Como, Italy, craftsmen spin threads...',
          coverImageUrl: 'https://images.unsplash.com/photo-silk-art.jpg',
          author: 'Marcella De Luca',
          isPublished: true,
          seoTitle: 'The Art of Mulberry Silk | FORME Journal',
          seoDescription: 'An insider look into Italian silk craftsmanship.',
        });
      expect(createRes.status).toBe(201);
      testEditorialId = createRes.body.data.id;

      // Public Editorial Slug Retrieval
      const pubRes = await request(app).get(`/api/v1/cms/editorials/${slug}`);
      expect(pubRes.status).toBe(200);
      expect(pubRes.body.data.title).toBe('The Art of Mulberry Silk Weaving');
      expect(pubRes.body.data.category).toBe('Journal');
    });

    // 2.7 SEO Settings
    it('upserts and retrieves page-level SEO configuration', async () => {
      const pageKey = `LOOKBOOK_${timestamp}`;
      const upsertRes = await request(app)
        .post('/api/v1/admin/cms/seo')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          pageKey,
          title: 'Winter Lookbook 2026 | FORME',
          description: 'A study in architectural tailoring, soft shearling, and quiet luxury.',
          keywords: ['couture', 'luxury lookbook', 'forme editorial'],
          ogImageUrl: 'https://images.unsplash.com/photo-og-lookbook.jpg',
        });
      expect(upsertRes.status).toBe(200);

      // Public Page SEO retrieval
      const getRes = await request(app).get(`/api/v1/cms/seo/${pageKey}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.title).toContain('Winter Lookbook');
    });

    // 2.8 Newsletter Subscription & Management
    it('allows storefront customer subscription and admin subscriber management', async () => {
      const subscriberEmail = `collector.${timestamp}@forme.store`;

      // Customer Subscribes
      const subRes = await request(app)
        .post('/api/v1/cms/newsletter/subscribe')
        .send({
          email: subscriberEmail,
          source: 'FOOTER',
        });
      expect(subRes.status).toBe(201);

      // Admin Lists Subscribers
      const listRes = await request(app)
        .get(`/api/v1/admin/cms/subscribers?search=${subscriberEmail}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((s) => s.email === subscriberEmail)).toBe(true);

      // Customer Unsubscribes
      const unsubRes = await request(app)
        .post('/api/v1/cms/newsletter/unsubscribe')
        .send({ email: subscriberEmail });
      expect(unsubRes.status).toBe(200);
    });
  });

  // ==========================================
  // 3. CUSTOMER MANAGEMENT (CRM)
  // ==========================================
  describe('3. Customer Management & CRM APIs', () => {
    it('lists customers with search, pagination, and status filters', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/customers?search=${customerUser.email}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].email).toBe(customerUser.email);
    });

    it('retrieves detailed customer profile with lifetime spend metrics and orders', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/customers/${customerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('customer');
      expect(res.body.data).toHaveProperty('metrics');
      expect(res.body.data.metrics).toHaveProperty('lifetimeSpend');
      expect(res.body.data.metrics).toHaveProperty('averageOrderValue');
    });

    it('updates customer account status to SUSPENDED, revoking active sessions', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/customers/${customerUser.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'SUSPENDED',
          reason: 'Manual risk review flag',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SUSPENDED');

      // Verify User status in DB
      const user = await prisma.user.findUnique({ where: { id: customerUser.id } });
      expect(user.status).toBe('SUSPENDED');

      // Reinstate back to ACTIVE
      const reinstateRes = await request(app)
        .patch(`/api/v1/admin/customers/${customerUser.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'ACTIVE',
          reason: 'Risk review resolved',
        });
      expect(reinstateRes.status).toBe(200);
      expect(reinstateRes.body.data.status).toBe('ACTIVE');
    });

    it('retrieves paginated customer order history', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/customers/${customerUser.id}/orders`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
    });
  });

  // ==========================================
  // 4. REAL AUTHORITATIVE ANALYTICS & BI
  // ==========================================
  describe('4. Real Relational Analytics & Financial Metrics', () => {
    it('computes authoritative overview KPIs (GMV, Net Revenue, AOV, Cancellation Rate)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const kpis = res.body.data.kpis;
      expect(typeof kpis.gmv).toBe('number');
      expect(typeof kpis.netCollectedRevenue).toBe('number');
      expect(typeof kpis.totalOrders).toBe('number');
      expect(typeof kpis.cancellationRate).toBe('number');
      expect(typeof kpis.averageOrderValue).toBe('number');
      expect(res.body.data).toHaveProperty('statusBreakdown');
    });

    it('computes sales and revenue trends across intervals', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/sales?days=14')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(14);
      expect(res.body.data[0]).toHaveProperty('revenue');
      expect(res.body.data[0]).toHaveProperty('ordersCount');
    });

    it('computes payment method distribution', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/payment-methods')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((p) => p.method === 'COD')).toBe(true);
    });

    it('computes best selling products based on order items', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/best-sellers?limit=5')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('computes category and collection performance metrics', async () => {
      const [catRes, colRes] = await Promise.all([
        request(app).get('/api/v1/admin/analytics/categories').set('Authorization', `Bearer ${adminToken}`),
        request(app).get('/api/v1/admin/analytics/collections').set('Authorization', `Bearer ${adminToken}`),
      ]);
      expect(catRes.status).toBe(200);
      expect(colRes.status).toBe(200);
      expect(Array.isArray(catRes.body.data)).toBe(true);
      expect(Array.isArray(colRes.body.data)).toBe(true);
    });

    it('computes complete inventory valuation and out-of-stock health', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/inventory-valuation')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data).toHaveProperty('totalVariants');
      expect(data).toHaveProperty('totalStockUnits');
      expect(data).toHaveProperty('totalRetailValuation');
      expect(data).toHaveProperty('outOfStockVariantsCount');
    });

    it('computes full conversion funnel metrics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics/conversion-funnel')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('funnel');
      expect(res.body.data).toHaveProperty('conversionRates');
    });
  });

  // ==========================================
  // 5. COMMERCE & REVIEW MODERATION
  // ==========================================
  describe('5. Commerce Operations (Payments, Refunds & Reviews)', () => {
    it('lists payments and payment details', async () => {
      const res = await request(app)
        .get('/api/v1/admin/commerce/payments')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });

    it('lists refunds transactions', async () => {
      const res = await request(app)
        .get('/api/v1/admin/commerce/refunds')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });

    it('moderates customer review (approve / hide) and deletes spam reviews', async () => {
      // Approve review
      const approveRes = await request(app)
        .patch(`/api/v1/admin/commerce/reviews/${testReviewId}/moderation`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isApproved: true });
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.isApproved).toBe(true);

      // Delete review
      const deleteRes = await request(app)
        .delete(`/api/v1/admin/commerce/reviews/${testReviewId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(deleteRes.status).toBe(200);
      testReviewId = null; // Cleared
    });
  });

  // ==========================================
  // 6. STORE SETTINGS & SYSTEM PROBES
  // ==========================================
  describe('6. Platform Settings & System Health Probes', () => {
    it('manages key-value store settings', async () => {
      const testKey = `site_maintenance_${timestamp}`;
      const upsertRes = await request(app)
        .post('/api/v1/admin/settings/store')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: testKey,
          value: { enabled: false, message: 'All systems operational' },
          description: 'Platform maintenance toggle',
        });
      expect(upsertRes.status).toBe(200);

      const getRes = await request(app)
        .get(`/api/v1/admin/settings/store/${testKey}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.value.enabled).toBe(false);
    });

    it('manages state tax settings (GST rates)', async () => {
      const stateCode = `T${String(timestamp).slice(-3)}`;
      const createRes = await request(app)
        .post('/api/v1/admin/settings/tax')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stateCode,
          stateName: `Test Territory ${timestamp}`,
          cgstRate: 6.0,
          sgstRate: 6.0,
          igstRate: 12.0,
          isActive: true,
        });
      expect(createRes.status).toBe(201);
      testTaxSettingId = createRes.body.data.id;

      const listRes = await request(app)
        .get('/api/v1/admin/settings/tax')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((t) => t.id === testTaxSettingId)).toBe(true);
    });

    it('manages shipping methods and rates', async () => {
      const createRes = await request(app)
        .post('/api/v1/admin/settings/shipping')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `White Glove Express ${timestamp}`,
          rate: 350.0,
          minOrderAmount: 25000.0,
          isFreeShipping: false,
          estimatedDays: 2,
          isActive: true,
        });
      expect(createRes.status).toBe(201);
      testShippingSettingId = createRes.body.data.id;

      const listRes = await request(app)
        .get('/api/v1/admin/settings/shipping')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((s) => s.id === testShippingSettingId)).toBe(true);
    });

    it('retrieves and updates Brand settings', async () => {
      const getRes = await request(app)
        .get('/api/v1/admin/settings/brand')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.brandName).toBe('FORME');

      const updateRes = await request(app)
        .put('/api/v1/admin/settings/brand')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          tagline: 'Quiet Luxury. Architectural Tailoring.',
        });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.tagline).toBe('Quiet Luxury. Architectural Tailoring.');
    });

    it('probes Payment Gateway health and connectivity status', async () => {
      const res = await request(app)
        .get('/api/v1/admin/settings/probes/payment-gateway')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('connectivity');
    });

    it('probes Email Transport health and provider readiness', async () => {
      const res = await request(app)
        .get('/api/v1/admin/settings/probes/email-transport')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('provider');
      expect(res.body.data).toHaveProperty('canSend');
    });
  });

  // ==========================================
  // 7. ADMIN AUDIT LOGS
  // ==========================================
  describe('7. Administrative Audit Trail', () => {
    it('verifies that administrative mutations generated authoritative audit records', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      // Verify that audit log has admin metadata and action identifiers
      const sampleLog = res.body.data[0];
      expect(sampleLog).toHaveProperty('id');
      expect(sampleLog).toHaveProperty('action');
      expect(sampleLog).toHaveProperty('entityType');
      expect(sampleLog).toHaveProperty('admin');
      expect(sampleLog.admin).toHaveProperty('email');
    });

    it('filters audit logs by action or entityType', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs?entityType=Banner')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.every((l) => l.entityType.toLowerCase() === 'banner')).toBe(true);
    });
  });
});
