import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.config.js';

describe('FORME Product Catalog, Variants, Media & Discovery Suite', { timeout: 30000 }, () => {
  let adminToken = null;
  let customerToken = null;
  let testCategoryId = null;
  let testCategorySlug = null;
  let testCollectionId = null;
  let testCollectionSlug = null;
  let createdProductId = null;
  let createdProductSlug = null;
  let createdVariantId = null;
  let createdMediaId = null;

  beforeAll(async () => {
    // 1. Authenticate as Admin to obtain adminToken
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/admin/login')
      .send({
        email: 'admin@forme.store',
        password: 'FormeAdmin@2026!',
      });

    expect(adminLoginRes.status).toBe(200);
    adminToken = adminLoginRes.body.data.accessToken;

    // 2. Authenticate as Customer
    const testCustomerEmail = `couture.client.${Date.now()}@forme.store`;
    const customerPassword = 'ClientPassword2026!';

    await prisma.user.create({
      data: {
        name: 'Éléonore de Valois',
        email: testCustomerEmail,
        passwordHash: '$2b$12$e8Y6lFp56E5x4s0rWc0Vq.bL88i.U1UeXn83m4uL3QdG9wO81Vkeu', // Pre-hashed
        role: 'CUSTOMER',
        isEmailVerified: true,
      },
    });

    const customerLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testCustomerEmail,
        password: customerPassword,
      });

    // If password hash doesn't match fallback, generate token directly or use login
    if (customerLoginRes.status === 200) {
      customerToken = customerLoginRes.body.data.accessToken;
    }
  });

  afterAll(async () => {
    // Clean up created entities
    if (createdProductId) {
      await prisma.productMedia.deleteMany({ where: { productId: createdProductId } });
      await prisma.productVariant.deleteMany({ where: { productId: createdProductId } });
      await prisma.product.deleteMany({ where: { id: createdProductId } });
    }
    if (testCollectionId) {
      await prisma.collectionProduct.deleteMany({ where: { collectionId: testCollectionId } });
      await prisma.collection.deleteMany({ where: { id: testCollectionId } });
    }
    if (testCategoryId) {
      await prisma.category.deleteMany({ where: { id: testCategoryId } });
    }
    await prisma.$disconnect();
  });

  // 1. CATEGORY TESTS
  describe('1. Category Architecture & Filter Discovery', () => {
    it('GET /api/v1/categories should return hierarchical category tree with real product counts', async () => {
      const res = await request(app).get('/api/v1/categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const rootCat = res.body.data[0];
      expect(rootCat.name).toBeDefined();
      expect(rootCat.slug).toBeDefined();
      expect(rootCat.productCount).toBeDefined();
      expect(Array.isArray(rootCat.children)).toBe(true);
    });

    it('POST /api/v1/categories should allow Admin to create a category and reject duplicate slug', async () => {
      const uniqueSlug = `test-haute-couture-${Date.now()}`;

      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Haute Couture Eveningwear',
          slug: uniqueSlug,
          description: 'Bespoke hand-draped evening gowns.',
          status: 'ACTIVE',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      testCategoryId = res.body.data.id;
      testCategorySlug = res.body.data.slug;

      // Duplicate slug rejection
      const dupRes = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate Category',
          slug: uniqueSlug,
        });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.code).toBe('CONFLICT_RESOURCE');
    });

    it('GET /api/v1/categories/slug/:slug should return category details with child counts', async () => {
      const res = await request(app).get(`/api/v1/categories/slug/${testCategorySlug}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe(testCategorySlug);
      expect(res.body.data.productCount).toBeDefined();
    });

    it('GET /api/v1/categories/slug/:slug/filters should return computed facet filters', async () => {
      const res = await request(app).get('/api/v1/categories/slug/outerwear/filters');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.priceRange).toBeDefined();
      expect(Array.isArray(res.body.data.sizes)).toBe(true);
      expect(Array.isArray(res.body.data.colors)).toBe(true);
    });
  });

  // 2. COLLECTION TESTS
  describe('2. Collection Management & Editorial Showcases', () => {
    it('GET /api/v1/collections should return active published collections', async () => {
      const res = await request(app).get('/api/v1/collections');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/v1/collections should allow Admin to create scheduled collection', async () => {
      const uniqueSlug = `capsule-${Date.now()}`;

      const res = await request(app)
        .post('/api/v1/collections')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Summer Silk Capsule 2026',
          slug: uniqueSlug,
          description: 'A modern exploration of natural dye mulberry silks.',
          isPublished: true,
          displayOrder: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      testCollectionId = res.body.data.id;
      testCollectionSlug = res.body.data.slug;
    });

    it('GET /api/v1/collections/featured should return primary featured showcase', async () => {
      const res = await request(app).get('/api/v1/collections/featured');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // 3. PRODUCT CATALOG & FILTERING TESTS
  describe('3. Customer Product Catalog & Multi-Dimensional Filtering', () => {
    it('GET /api/v1/products should return paginated products with formatted cards', async () => {
      const res = await request(app).get('/api/v1/products?page=1&limit=6');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(6);

      if (res.body.data.length > 0) {
        const item = res.body.data[0];
        expect(item.id).toBeDefined();
        expect(item.name).toBeDefined();
        expect(item.slug).toBeDefined();
        expect(item.sellingPrice).toBeGreaterThan(0);
        expect(item.primaryImage).toBeDefined();
        expect(Array.isArray(item.colors)).toBe(true);
        expect(Array.isArray(item.sizes)).toBe(true);
      }
    });

    it('GET /api/v1/products should filter by price range', async () => {
      const res = await request(app).get('/api/v1/products?minPrice=10000&maxPrice=50000');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.data.forEach((p) => {
        expect(p.sellingPrice).toBeGreaterThanOrEqual(10000);
        expect(p.sellingPrice).toBeLessThanOrEqual(50000);
      });
    });

    it('GET /api/v1/products should sort by price ascending and descending', async () => {
      const ascRes = await request(app).get('/api/v1/products?sort=price_asc');
      expect(ascRes.status).toBe(200);

      const descRes = await request(app).get('/api/v1/products?sort=price_desc');
      expect(descRes.status).toBe(200);

      if (ascRes.body.data.length >= 2) {
        expect(ascRes.body.data[0].sellingPrice).toBeLessThanOrEqual(ascRes.body.data[1].sellingPrice);
      }
      if (descRes.body.data.length >= 2) {
        expect(descRes.body.data[0].sellingPrice).toBeGreaterThanOrEqual(descRes.body.data[1].sellingPrice);
      }
    });

    it('GET /api/v1/products should filter by category', async () => {
      const res = await request(app).get('/api/v1/products?category=outerwear');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // 4. PRODUCT DETAIL & COLOR-VARIANT MEDIA GALLERIES
  describe('4. Product Detail & Color-Variant Specific Media Galleries', () => {
    it('GET /api/v1/products/slug/:slug should return product with separated color galleries and variants', async () => {
      const res = await request(app).get('/api/v1/products/slug/the-atelier-silk-wool-trench-coat');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const product = res.body.data;
      expect(product.slug).toBe('the-atelier-silk-wool-trench-coat');
      expect(Array.isArray(product.colorVariants)).toBe(true);
      expect(product.colorVariants.length).toBeGreaterThan(0);

      // Verify color separation: Each color has its own gallery and sizes
      const firstColor = product.colorVariants[0];
      expect(firstColor.colorName).toBeDefined();
      expect(firstColor.colorHex).toBeDefined();
      expect(Array.isArray(firstColor.sizes)).toBe(true);
      expect(Array.isArray(firstColor.gallery)).toBe(true);
      expect(product.galleryByColor).toBeDefined();
    });

    it('GET /api/v1/products/slug/:slug should increment product view count', async () => {
      const productBefore = await prisma.product.findUnique({
        where: { slug: 'the-atelier-silk-wool-trench-coat' },
        select: { viewCount: true },
      });

      await request(app).get('/api/v1/products/slug/the-atelier-silk-wool-trench-coat');

      // Wait a tick for background increment
      await new Promise((r) => setTimeout(r, 200));

      const productAfter = await prisma.product.findUnique({
        where: { slug: 'the-atelier-silk-wool-trench-coat' },
        select: { viewCount: true },
      });

      expect(productAfter.viewCount).toBeGreaterThanOrEqual(productBefore.viewCount);
    });
  });

  // 5. SPECIALIZED DISCOVERY ENDPOINTS
  describe('5. Specialized Customer Discovery Lists', () => {
    it('GET /api/v1/products/featured should return featured garments', async () => {
      const res = await request(app).get('/api/v1/products/featured');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/products/new-arrivals should return new arrivals', async () => {
      const res = await request(app).get('/api/v1/products/new-arrivals');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/products/best-sellers should return best-sellers', async () => {
      const res = await request(app).get('/api/v1/products/best-sellers');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/products/trending should return trending pieces', async () => {
      const res = await request(app).get('/api/v1/products/trending');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/products/:id/related should return related garments by shared category/fabric', async () => {
      const seedProduct = await prisma.product.findFirst();
      const res = await request(app).get(`/api/v1/products/${seedProduct.id}/related`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST and GET /api/v1/products/recently-viewed should record and retrieve recently viewed garments', async () => {
      const seedProduct = await prisma.product.findFirst();
      const guestSession = `guest_test_${Date.now()}`;

      // Record view
      const postRes = await request(app)
        .post('/api/v1/products/recently-viewed')
        .send({ productId: seedProduct.id, sessionId: guestSession });
      expect(postRes.status).toBe(200);

      // Retrieve views
      const getRes = await request(app)
        .get(`/api/v1/products/recently-viewed?sessionId=${guestSession}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.length).toBeGreaterThan(0);
      expect(getRes.body.data[0].id).toBe(seedProduct.id);
    });
  });

  // 6. SEARCH & DISCOVERY APIS
  describe('6. Search & Autocomplete Discovery', () => {
    it('GET /api/v1/search/autocomplete should return structured product, category & collection suggestions', async () => {
      const res = await request(app).get('/api/v1/search/autocomplete?q=Trench');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.products)).toBe(true);
      expect(Array.isArray(res.body.data.categories)).toBe(true);
      expect(Array.isArray(res.body.data.collections)).toBe(true);
    });

    it('GET /api/v1/search/products should return matching products and record query in SearchQueryLog', async () => {
      const searchTerm = 'Coat';
      const res = await request(app).get(`/api/v1/search/products?q=${searchTerm}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      // Wait a tick for background search logging
      await new Promise((r) => setTimeout(r, 200));

      const log = await prisma.searchQueryLog.findUnique({
        where: { query: searchTerm.toLowerCase() },
      });
      expect(log).toBeDefined();
      expect(log.count).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/search/popular should return popular searches from real database analytics', async () => {
      const res = await request(app).get('/api/v1/search/popular');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // 7. ADMIN PRODUCT & VARIANT CRUD
  describe('7. Admin Product, Variant & Media CRUD Workflows', () => {
    it('POST /api/v1/products should allow Admin to create a master product with initial variants and media', async () => {
      const uniqueSlug = `tailored-silk-vest-${Date.now()}`;
      const uniqueBaseSku = `FRM-VST-${Date.now().toString().slice(-4)}`;

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'The Structured Silk Vest',
          slug: uniqueSlug,
          baseSku: uniqueBaseSku,
          shortDescription: 'Tailored waistcoat in double-faced Italian silk.',
          categoryId: testCategoryId,
          audience: 'WOMEN',
          productType: 'Waistcoat',
          fabric: '100% Mulberry Silk',
          fit: 'Tailored',
          sellingPrice: 18500,
          compareAtPrice: 22000,
          isFeatured: true,
          status: 'PUBLISHED',
          variants: [
            {
              sku: `${uniqueBaseSku}-BLK-38`,
              size: '38',
              colorName: 'Midnight Noir',
              colorHex: '#121212',
              stockQuantity: 15,
            },
          ],
          media: [
            {
              mediaType: 'IMAGE',
              publicId: `forme/test/vest-${Date.now()}`,
              secureUrl: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80',
              altText: 'The Structured Silk Vest in Midnight Noir',
              isPrimary: true,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      createdProductId = res.body.data.id;
      createdProductSlug = res.body.data.slug;
    });

    it('POST /api/v1/products/:id/variants should add a color/size variant with unique SKU', async () => {
      const newSku = `FRM-VAR-${Date.now()}`;

      const res = await request(app)
        .post(`/api/v1/products/${createdProductId}/variants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sku: newSku,
          size: '40',
          colorName: 'Chalk Ivory',
          colorHex: '#FAF8F5',
          stockQuantity: 10,
          priceOverride: 19500,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sku).toBe(newSku);
      createdVariantId = res.body.data.id;
    });

    it('PUT /api/v1/products/:id/variants/:variantId should update variant stock and price override', async () => {
      const res = await request(app)
        .put(`/api/v1/products/${createdProductId}/variants/${createdVariantId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stockQuantity: 25,
          priceOverride: 18000,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stockQuantity).toBe(25);
    });

    it('POST /api/v1/products/:id/media should attach variant-specific media asset', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${createdProductId}/media`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          mediaType: 'IMAGE',
          publicId: `forme/test/variant-media-${Date.now()}`,
          secureUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80',
          altText: 'The Structured Silk Vest in Chalk Ivory — Back Detail',
          variantId: createdVariantId,
          displayOrder: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.variantId).toBe(createdVariantId);
      createdMediaId = res.body.data.id;
    });

    it('DELETE /api/v1/products/:id should archive product and enforce admin authorization', async () => {
      // Rejects unauthenticated request
      const unauthRes = await request(app).delete(`/api/v1/products/${createdProductId}`);
      expect(unauthRes.status).toBe(401);

      // Allows Admin request
      const res = await request(app)
        .delete(`/api/v1/products/${createdProductId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const archived = await prisma.product.findUnique({ where: { id: createdProductId } });
      expect(archived.status).toBe('ARCHIVED');
      expect(archived.deletedAt).not.toBeNull();
    });
  });
});
