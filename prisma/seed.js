// ============================================================================
// FORME Contemporary Fashion House — Authoritative Master Seed System
// "Designed to Be Worn. Made to Be Remembered."
// ============================================================================

import {
  PrismaClient,
  Prisma,
  Role,
  UserStatus,
  AuthProvider,
  AddressType,
  BannerType,
  MediaType,
  CategoryStatus,
  CollectionStatus,
  ProductStatus,
  Audience,
  VariantStatus,
  DiscountType,
  FlashSaleStatus,
  HomePageSectionType,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  RefundStatus,
  ShipmentStatus,
  StockMovementType,
  EmailDeliveryStatus,
  ReservationStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

const Decimal = Prisma.Decimal;

// Decimal helper utilities
const toDec = (v) => (v instanceof Decimal ? v : new Decimal(v ?? 0));
const round2 = (v) => toDec(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
const calcPct = (amount, rate) => round2(toDec(amount).times(toDec(rate)).dividedBy(100));
const add = (...args) => args.reduce((acc, v) => toDec(acc).plus(toDec(v)), new Decimal(0));
const sub = (a, b) => toDec(a).minus(toDec(b));
const mul = (a, b) => toDec(a).times(toDec(b));
const div = (a, b) => (toDec(b).isZero() ? new Decimal(0) : toDec(a).dividedBy(toDec(b)));

// ============================================================================
// 1. DATABASE RESET & SAFETY CHECK
// ============================================================================
export async function clearDatabase(client = prisma) {
  console.log('\n[FORME RESET] Performing safety check on active database connection...');

  const dbUrl = process.env.DATABASE_URL || '';
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (nodeEnv !== 'development' && !dbUrl.includes('pooled.db.prisma.io') && !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1')) {
    throw new Error(`[SAFETY HALT] Detected non-development environment "${nodeEnv}". Aborting database reset.`);
  }

  console.log('[FORME RESET] Confirmed development environment. Deleting all records in reverse dependency order...');

  // Reverse dependency order to avoid foreign key violations
  await client.adminAuditLog.deleteMany();
  await client.emailDeliveryLog.deleteMany();
  await client.notification.deleteMany();
  await client.notificationPreference.deleteMany();
  await client.promotionUsage.deleteMany();
  await client.stockMovement.deleteMany();
  await client.inventoryLog.deleteMany();
  await client.inventoryReservation.deleteMany();
  await client.shipment.deleteMany();
  await client.refund.deleteMany();
  await client.payment.deleteMany();
  await client.orderStatusHistory.deleteMany();
  await client.orderAddressSnapshot.deleteMany();
  await client.orderItem.deleteMany();
  await client.order.deleteMany();
  await client.reviewMedia.deleteMany();
  await client.review.deleteMany();
  await client.cartItem.deleteMany();
  await client.cart.deleteMany();
  await client.wishlistItem.deleteMany();
  await client.wishlist.deleteMany();
  await client.recentlyViewedProduct.deleteMany();
  await client.searchQueryLog.deleteMany();
  await client.productAttributeMapping.deleteMany();
  await client.productAttributeValue.deleteMany();
  await client.productAttribute.deleteMany();
  await client.productMedia.deleteMany();
  await client.flashSaleProduct.deleteMany();
  await client.flashSale.deleteMany();
  await client.couponProduct.deleteMany();
  await client.couponCategory.deleteMany();
  await client.couponCollection.deleteMany();
  await client.coupon.deleteMany();
  await client.offerProduct.deleteMany();
  await client.offerCategory.deleteMany();
  await client.offerCollection.deleteMany();
  await client.offer.deleteMany();
  await client.collectionProduct.deleteMany();
  await client.collection.deleteMany();
  await client.productVariant.deleteMany();
  await client.product.deleteMany();
  await client.category.deleteMany();
  await client.homePageSection.deleteMany();
  await client.announcement.deleteMany();
  await client.banner.deleteMany();
  await client.navigationMenuItem.deleteMany();
  await client.navigationMenu.deleteMany();
  await client.footerMenuItem.deleteMany();
  await client.footerSection.deleteMany();
  await client.editorialContent.deleteMany();
  await client.newsletterSubscription.deleteMany();
  await client.inventoryLocation.deleteMany();
  await client.storeSetting.deleteMany();
  await client.taxSetting.deleteMany();
  await client.shippingSetting.deleteMany();
  await client.currencySetting.deleteMany();
  await client.sEOSetting.deleteMany();
  await client.brandSettings.deleteMany();
  await client.emailTemplate.deleteMany();
  await client.refreshToken.deleteMany();
  await client.passwordResetToken.deleteMany();
  await client.emailOTP.deleteMany();
  await client.oAuthAccount.deleteMany();
  await client.address.deleteMany();
  await client.user.deleteMany();

  console.log('[FORME RESET] Database cleared successfully. Zero records remaining.');
}

// ============================================================================
// 2. CONFIGURATION & PLATFORM SETTINGS
// ============================================================================
async function seedConfiguration(client = prisma) {
  console.log('\n[FORME SEED] 1/12 Seeding Brand, Financial, Tax & Platform Settings...');

  await client.brandSettings.create({
    data: {
      brandName: 'FORME',
      tagline: 'Designed to Be Worn. Made to Be Remembered.',
      logoUrl: '/logo.png',
      faviconUrl: '/favicon.png',
      supportEmail: 'concierge@forme-atelier.com',
      supportPhone: '+91 (0) 22 4589 1920',
      socialLinks: {
        instagram: 'https://instagram.com/forme.atelier',
        pinterest: 'https://pinterest.com/forme_fashion',
        journal: 'https://forme-atelier.com/journal',
      },
    },
  });

  await client.currencySetting.createMany({
    data: [
      { code: 'INR', symbol: '₹', exchangeRate: toDec(1.0), isDefault: true, decimalPlaces: 2 },
      { code: 'USD', symbol: '$', exchangeRate: toDec(0.012), isDefault: false, decimalPlaces: 2 },
      { code: 'EUR', symbol: '€', exchangeRate: toDec(0.011), isDefault: false, decimalPlaces: 2 },
      { code: 'GBP', symbol: '£', exchangeRate: toDec(0.0095), isDefault: false, decimalPlaces: 2 },
    ],
  });

  await client.taxSetting.createMany({
    data: [
      { stateCode: 'MH', stateName: 'Maharashtra', cgstRate: toDec(6.0), sgstRate: toDec(6.0), igstRate: toDec(12.0), isActive: true },
      { stateCode: 'DL', stateName: 'Delhi', cgstRate: toDec(6.0), sgstRate: toDec(6.0), igstRate: toDec(12.0), isActive: true },
      { stateCode: 'KA', stateName: 'Karnataka', cgstRate: toDec(6.0), sgstRate: toDec(6.0), igstRate: toDec(12.0), isActive: true },
      { stateCode: 'TN', stateName: 'Tamil Nadu', cgstRate: toDec(6.0), sgstRate: toDec(6.0), igstRate: toDec(12.0), isActive: true },
      { stateCode: 'GJ', stateName: 'Gujarat', cgstRate: toDec(6.0), sgstRate: toDec(6.0), igstRate: toDec(12.0), isActive: true },
      { stateCode: 'HR', stateName: 'Haryana', cgstRate: toDec(6.0), sgstRate: toDec(6.0), igstRate: toDec(12.0), isActive: true },
      { stateCode: 'UP', stateName: 'Uttar Pradesh', cgstRate: toDec(6.0), sgstRate: toDec(6.0), igstRate: toDec(12.0), isActive: true },
      { stateCode: 'WB', stateName: 'West Bengal', cgstRate: toDec(6.0), sgstRate: toDec(6.0), igstRate: toDec(12.0), isActive: true },
      { stateCode: 'RJ', stateName: 'Rajasthan', cgstRate: toDec(6.0), sgstRate: toDec(6.0), igstRate: toDec(12.0), isActive: true },
      { stateCode: 'KL', stateName: 'Kerala', cgstRate: toDec(6.0), sgstRate: toDec(6.0), igstRate: toDec(12.0), isActive: true },
    ],
  });

  await client.shippingSetting.createMany({
    data: [
      { name: 'Standard Express Courier', minOrderAmount: toDec(0), rate: toDec(250), isFreeShipping: false, estimatedDays: 3, isActive: true },
      { name: 'White Glove Complimentary Delivery', minOrderAmount: toDec(5000), rate: toDec(0), isFreeShipping: true, estimatedDays: 2, isActive: true },
      { name: 'Priority Same-Day Atelier Dispatch', minOrderAmount: toDec(15000), rate: toDec(0), isFreeShipping: true, estimatedDays: 1, isActive: true },
    ],
  });

  await client.storeSetting.createMany({
    data: [
      { key: 'store_name', value: { value: 'FORME Contemporary Fashion House' }, description: 'Official store commercial title' },
      { key: 'store_tagline', value: { value: 'Designed to Be Worn. Made to Be Remembered.' }, description: 'Atelier brand motto' },
      { key: 'support_email', value: { value: 'concierge@forme-atelier.com' }, description: 'Primary customer support inbox' },
      { key: 'support_phone', value: { value: '+91 (0) 22 4589 1920' }, description: 'Direct concierge telephone line' },
      { key: 'timezone', value: { value: 'Asia/Kolkata' }, description: 'Store operating timezone' },
      { key: 'free_shipping_threshold', value: { amount: 5000 }, description: 'Complimentary shipping qualification limit in INR' },
      { key: 'return_window_days', value: { days: 14 }, description: 'Archival consideration window in calendar days' },
      { key: 'currency', value: { default: 'INR', symbol: '₹' }, description: 'Base transactional currency' },
      { key: 'tax_exclusive_pricing', value: { inclusive: true }, description: 'Whether storefront prices include 12% GST' },
      { key: 'security_tamper_seal', value: { enforced: true }, description: 'Requires intact ribbon for returns' },
      { key: 'newsletter_welcome_discount', value: { coupon: 'WELCOME10', discountPct: 10 }, description: 'Default signup incentive' },
      { key: 'concierge_salons', value: { salons: ['Mumbai Flagship', 'Milan Studio'] }, description: 'Physical appointment locations' },
    ],
  });

  await client.sEOSetting.createMany({
    data: [
      {
        pageKey: 'HOME',
        title: 'FORME — Designed to Be Worn. Made to Be Remembered.',
        description: 'Contemporary haute couture and luxury garments crafted with architectural minimalism and natural silk-wool fabrics.',
        keywords: ['luxury fashion', 'haute couture', 'contemporary womenswear', 'silk coat', 'tailored blazers'],
        ogImageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80',
      },
      {
        pageKey: 'SHOP',
        title: 'Runway Silhouettes & Permanent Collection — FORME',
        description: 'Explore the full runway catalog of tailored coats, silk slip dresses, and fine cashmere knits.',
        keywords: ['forme catalog', 'designer dresses', 'luxury outerwear', 'winter atelier'],
        ogImageUrl: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1200&q=80',
      },
      {
        pageKey: 'COLLECTIONS',
        title: 'Curated Seasonal Capsules & Edits — FORME',
        description: 'Discover limited-edition seasonal edits and permanent capsule foundations.',
        keywords: ['fashion edits', 'minimalist capsules', 'monochrome collection'],
        ogImageUrl: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1200&q=80',
      },
      {
        pageKey: 'CATEGORIES',
        title: 'Shop by Garment Category — FORME Atelier',
        description: 'Dresses, blazers, trousers, knitwear, and sartorial leather accessories.',
        keywords: ['garment categories', 'womens apparel', 'mens tailoring'],
        ogImageUrl: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=1200&q=80',
      },
      {
        pageKey: 'NEW_ARRIVALS',
        title: 'Fresh Runway Arrivals — FORME Private Previews',
        description: 'Newly unveiled garments freshly tailored and dispatched from our ateliers.',
        keywords: ['new arrivals', 'latest drop', 'new fashion drop'],
        ogImageUrl: 'https://images.unsplash.com/photo-1539533018447-63fcce667823?auto=format&fit=crop&w=1200&q=80',
      },
      {
        pageKey: 'BEST_SELLERS',
        title: 'Most Acquired Wardrobe Foundations — FORME',
        description: 'Our most sought-after silhouettes in pure Biella wool and Como silk.',
        keywords: ['best sellers', 'iconic blazers', 'silk dresses'],
        ogImageUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=80',
      },
      {
        pageKey: 'SALE',
        title: 'Archival Private Sale & Privileges — FORME',
        description: 'Exceptional private sale privileges on archival silhouettes.',
        keywords: ['archive sale', 'designer sale', 'luxury fashion discount'],
        ogImageUrl: 'https://images.unsplash.com/photo-1479064555552-3ef4979f8908?auto=format&fit=crop&w=1200&q=80',
      },
      {
        pageKey: 'LOOKBOOK',
        title: 'Seasonal Runway Film & Lookbook — FORME',
        description: 'Experience our visual narrative exploring architectural light and textile drape.',
        keywords: ['fashion lookbook', 'campaign film', 'runway lookbook'],
        ogImageUrl: 'https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?auto=format&fit=crop&w=1200&q=80',
      },
      {
        pageKey: 'ABOUT',
        title: 'The House of FORME — Atelier Manifesto & Noble Fibers',
        description: 'Dedicated to architectural silhouettes, uncompromised natural fibers, and the enduring dignity of tailoring.',
        keywords: ['about forme', 'atelier manifesto', 'biella wool', 'como silk'],
        ogImageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
      },
      {
        pageKey: 'CONTACT',
        title: 'Client Concierge & Private Appointments — FORME',
        description: 'Connect with our dedicated sartorial advisors for sizing guidance and VIP salon appointments.',
        keywords: ['concierge', 'customer care', 'bespoke appointment', 'forme contact'],
        ogImageUrl: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80',
      },
    ],
  });

  // 16 Required Transactional Email Templates
  const templateSlugs = [
    { slug: 'registration-otp', name: 'Identity Verification OTP', subject: 'Your FORME Atelier Verification Code', vars: ['recipientName', 'otpCode', 'expiryMinutes'] },
    { slug: 'welcome', name: 'Welcome to the House of FORME', subject: 'Bienvenue to the House of FORME', vars: ['recipientName', 'loginUrl', 'curatedCollectionUrl'] },
    { slug: 'password-reset', name: 'Security Password Reset', subject: 'Reset Your Master Atelier Password', vars: ['recipientName', 'resetUrl', 'expiryHours'] },
    { slug: 'password-changed', name: 'Password Update Confirmation', subject: 'Security Notice: Atelier Password Changed', vars: ['recipientName', 'timestamp', 'supportEmail'] },
    { slug: 'order-placed', name: 'Order Placement Acknowledgement', subject: 'Order Received — {{orderNumber}}', vars: ['recipientName', 'orderNumber', 'orderTotal', 'trackUrl'] },
    { slug: 'order-confirmation', name: 'Order Artisan Confirmation', subject: 'Confirmed: Order {{orderNumber}} in Production', vars: ['recipientName', 'orderNumber', 'itemsList', 'totalAmount', 'shippingAddress'] },
    { slug: 'payment-success', name: 'Payment Transaction Receipt', subject: 'Payment Verified for Order {{orderNumber}}', vars: ['recipientName', 'orderNumber', 'amountPaid', 'paymentMethod', 'gatewayRef'] },
    { slug: 'payment-failed', name: 'Payment Transaction Decline', subject: 'Payment Unsuccessful — Order {{orderNumber}}', vars: ['recipientName', 'orderNumber', 'failureReason', 'retryUrl'] },
    { slug: 'order-processing', name: 'Garment Finishing & Quality Check', subject: 'Quality Inspection Underway — {{orderNumber}}', vars: ['recipientName', 'orderNumber', 'estimatedDispatchDate'] },
    { slug: 'order-shipped', name: 'White-Glove Consignment Dispatched', subject: 'Consignment Dispatched — Tracking {{trackingNumber}}', vars: ['recipientName', 'orderNumber', 'carrier', 'trackingNumber', 'trackUrl', 'estimatedDelivery'] },
    { slug: 'order-delivered', name: 'Delivery Handover Notice', subject: 'Delivered: Your Sartorial Acquisition {{orderNumber}}', vars: ['recipientName', 'orderNumber', 'deliveryDate', 'invoiceUrl', 'reviewUrl'] },
    { slug: 'order-cancelled', name: 'Order Cancellation & Refund Notice', subject: 'Order Cancelled — {{orderNumber}}', vars: ['recipientName', 'orderNumber', 'refundAmount', 'reason'] },
    { slug: 'refund-initiated', name: 'Electronic Refund Initiated', subject: 'Refund Initiated for Order {{orderNumber}}', vars: ['recipientName', 'orderNumber', 'refundAmount', 'bankingDays'] },
    { slug: 'refund-completed', name: 'Refund Transaction Settled', subject: 'Refund Settled for Order {{orderNumber}}', vars: ['recipientName', 'orderNumber', 'refundAmount', 'transactionId'] },
    { slug: 'newsletter-welcome', name: 'Gazette Subscription Confirmation', subject: 'Welcome to the FORME Gazette & Private Previews', vars: ['recipientEmail', 'voucherCode', 'curatedUrl'] },
    { slug: 'low-stock-alert', name: 'Waitlist Silhouette Back in Stock', subject: 'Your Reserved Silhouette is Back in Stock', vars: ['recipientName', 'productName', 'variantDetails', 'productUrl'] },
  ];

  for (const t of templateSlugs) {
    await client.emailTemplate.create({
      data: {
        slug: t.slug,
        name: t.name,
        subject: t.subject,
        htmlBody: `<div style="font-family:'Georgia',serif;background:#FAF8F5;color:#1C1917;padding:40px;"><div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E7E5E4;padding:32px;"><h1 style="font-size:24px;font-weight:normal;letter-spacing:1px;text-transform:uppercase;color:#1C1917;margin-bottom:16px;">FORME</h1><p style="font-size:14px;line-height:1.6;color:#78716C;">${t.subject}</p><div style="margin:24px 0;padding:16px;background:#F3EFEA;font-size:13px;">This is an official transactional transmission from the FORME House of Sartorial Excellence.</div><p style="font-size:11px;color:#A8A29E;text-transform:uppercase;letter-spacing:1px;">Designed to Be Worn. Made to Be Remembered.</p></div></div>`,
        textBody: `FORME ATELIER\n\n${t.subject}\n\nDesigned to Be Worn. Made to Be Remembered.\nconcierge@forme-atelier.com`,
        variables: t.vars,
        isActive: true,
      },
    });
  }
}

// ============================================================================
// 3. USERS, ADDRESSES & AUTH RECORDS
// ============================================================================
async function seedUsersAndAddresses(client = prisma) {
  console.log('\n[FORME SEED] 2/12 Seeding 1 Admin and 10 Customers with 20 Addresses...');

  const salt = await bcrypt.genSalt(12);
  const adminPasswordHash = await bcrypt.hash('FormeAdmin@2026!', salt);
  const patronPasswordHash = await bcrypt.hash('PatronForme@2026!', salt);

  // 1 Admin
  const admin = await client.user.create({
    data: {
      name: 'Atelier Director Marcus Sterling',
      email: 'admin@forme.store',
      phone: '+919820000001',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      isEmailVerified: true,
      authProvider: AuthProvider.LOCAL,
      status: UserStatus.ACTIVE,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
      lastLoginAt: new Date(Date.now() - 1000 * 60 * 30),
      notificationPreferences: {
        create: {
          emailOrderUpdates: true,
          emailPromotions: false,
          emailStockAlerts: true,
        },
      },
    },
  });

  // 10 Customers
  const customerSpecs = [
    { name: 'Lady Genevieve Vance', email: 'genevieve.vance@forme-patron.com', phone: '+919820100001', city: 'Mumbai', state: 'Maharashtra', code: '400026', street: '14 Altamount Road, Penthouse B', workStreet: 'Floor 18, Maker Maxity, BKC' },
    { name: 'Aarav Singhania', email: 'aarav.singhania@forme-patron.com', phone: '+919820100002', city: 'New Delhi', state: 'Delhi', code: '110003', street: '7 Amrita Shergill Marg', workStreet: 'Tower A, DLF Cyber City, Phase II' },
    { name: 'Priya Sharma', email: 'priya.sharma@forme-patron.com', phone: '+919820100003', city: 'Bengaluru', state: 'Karnataka', code: '560001', street: '22 Lavelle Road, Richmond Town', workStreet: 'Embassy GolfLinks Business Park' },
    { name: 'Rohan Mehta', email: 'rohan.mehta@forme-patron.com', phone: '+919820100004', city: 'Ahmedabad', state: 'Gujarat', code: '380015', street: '44 Judges Bungalow Road, Bodakdev', workStreet: 'One World West, Iscon-Ambli Road' },
    { name: 'Ananya Iyer', email: 'ananya.iyer@forme-patron.com', phone: '+919820100005', city: 'Chennai', state: 'Tamil Nadu', code: '600028', street: '9 Boat Club Road, Raja Annamalaipuram', workStreet: 'Tidel Park, Rajiv Gandhi Salai' },
    { name: 'Vikramaditya Rao', email: 'vikram.rao@forme-patron.com', phone: '+919820100006', city: 'Hyderabad', state: 'Telangana', code: '500034', street: 'Road No. 36, Jubilee Hills', workStreet: 'Mindspace IT Park, HITEC City' },
    { name: 'Meera Kapoor', email: 'meera.kapoor@forme-patron.com', phone: '+919820100007', city: 'Kolkata', state: 'West Bengal', code: '700019', street: '12 Ballygunge Park Road', workStreet: 'Ecospace Business Park, New Town' },
    { name: 'Kabir Nair', email: 'kabir.nair@forme-patron.com', phone: '+919820100008', city: 'Pune', state: 'Maharashtra', code: '411006', street: '18 Koregaon Park, Lane 5', workStreet: 'Panchshil Business Park, Baner' },
    { name: 'Ishaan Malhotra', email: 'ishaan.malhotra@forme-patron.com', phone: '+919820100009', city: 'Gurugram', state: 'Haryana', code: '122002', street: 'The Magnolias, Golf Course Road', workStreet: 'Horizon Center, Golf Course Road' },
    { name: 'Tara Sen', email: 'tara.sen@forme-patron.com', phone: '+919820100010', city: 'Jaipur', state: 'Rajasthan', code: '302001', street: '15 Civil Lines, Raj Bhavan Enclave', workStreet: 'World Trade Park, Malviya Nagar' },
  ];

  const customers = [];
  const addresses = [];

  for (let i = 0; i < customerSpecs.length; i++) {
    const s = customerSpecs[i];
    const customer = await client.user.create({
      data: {
        name: s.name,
        email: s.email,
        phone: s.phone,
        passwordHash: patronPasswordHash,
        role: Role.CUSTOMER,
        isEmailVerified: true,
        authProvider: AuthProvider.LOCAL,
        status: UserStatus.ACTIVE,
        avatarUrl: `https://images.unsplash.com/photo-${1534528741775 + i}?auto=format&fit=crop&w=256&q=80`,
        lastLoginAt: new Date(Date.now() - 1000 * 60 * 60 * (i * 12 + 2)),
        notificationPreferences: {
          create: {
            emailOrderUpdates: true,
            emailPromotions: i % 2 === 0,
            emailStockAlerts: true,
          },
        },
      },
    });

    customers.push(customer);

    // Address 1: Home (Default Shipping & Billing)
    const addrHome = await client.address.create({
      data: {
        userId: customer.id,
        recipientName: s.name,
        phone: s.phone,
        addressLine1: s.street,
        landmark: 'Near Central Promenade',
        city: s.city,
        state: s.state,
        postalCode: s.code,
        country: 'India',
        addressType: AddressType.HOME,
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
    });

    // Address 2: Work
    const addrWork = await client.address.create({
      data: {
        userId: customer.id,
        recipientName: s.name,
        phone: s.phone,
        addressLine1: s.workStreet,
        landmark: 'Executive Suite Level',
        city: s.city,
        state: s.state,
        postalCode: s.code,
        country: 'India',
        addressType: AddressType.WORK,
        isDefaultShipping: false,
        isDefaultBilling: false,
      },
    });

    addresses.push(addrHome, addrWork);
  }

  // Auth support records (EmailOTP, PasswordResetToken, RefreshToken)
  const hashedOtp = await bcrypt.hash('458920', 10);
  await client.emailOTP.createMany({
    data: [
      { email: 'genevieve.vance@forme-patron.com', otpHash: hashedOtp, purpose: 'REGISTRATION', expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24), isUsed: true, attempts: 1 },
      { email: 'aarav.singhania@forme-patron.com', otpHash: hashedOtp, purpose: 'LOGIN', expiresAt: new Date(Date.now() + 1000 * 60 * 15), isUsed: false, attempts: 0 },
      { email: 'priya.sharma@forme-patron.com', otpHash: hashedOtp, purpose: 'PASSWORD_RESET', expiresAt: new Date(Date.now() - 1000 * 60 * 60), isUsed: true, attempts: 1 },
      { email: 'tara.sen@forme-patron.com', otpHash: hashedOtp, purpose: 'LOGIN', expiresAt: new Date(Date.now() + 1000 * 60 * 10), isUsed: false, attempts: 0 },
    ],
  });

  const hashedResetToken = await bcrypt.hash('reset-sample-token-1234', 10);
  await client.passwordResetToken.createMany({
    data: [
      { userId: customers[0].id, tokenHash: hashedResetToken + '-1', expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 48), isUsed: true },
      { userId: customers[2].id, tokenHash: hashedResetToken + '-2', expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), isUsed: false },
    ],
  });

  const allUsers = [admin, ...customers];
  for (let idx = 0; idx < allUsers.length; idx++) {
    const u = allUsers[idx];
    const hashedRefresh = await bcrypt.hash(`refresh-token-session-${u.id}`, 10);
    await client.refreshToken.create({
      data: {
        userId: u.id,
        tokenHash: hashedRefresh,
        deviceInfo: idx === 0 ? 'macOS Safari / Atelier Director Suite' : 'iOS Mobile Safari / iPhone 16 Pro',
        ipAddress: `103.21.244.${10 + idx}`,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        isRevoked: false,
      },
    });
  }

  return { admin, customers, addresses };
}

// ============================================================================
// 4. CATEGORIES (EXACTLY 10) & COLLECTIONS (EXACTLY 10)
// ============================================================================
async function seedCatalog(client = prisma) {
  console.log('\n[FORME SEED] 3/12 Seeding Exactly 10 Categories and 10 Collections...');

  const categorySpecs = [
    { name: 'Dresses', slug: 'dresses', desc: 'Mulberry silk slip dresses, sculpted gowns, and architectural fluid silhouettes.', img: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=80', banner: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1600&q=80' },
    { name: 'Tops & Shirts', slug: 'tops-shirts', desc: 'Crisp organic cotton poplin button-downs and draped silk georgette blouses.', img: 'https://images.unsplash.com/photo-1534126511673-b6899657816a?auto=format&fit=crop&w=800&q=80', banner: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1600&q=80' },
    { name: 'T-Shirts', slug: 't-shirts', desc: 'Heavyweight Egyptian cotton tees engineered with architectural dropped shoulders.', img: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80', banner: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1600&q=80' },
    { name: 'Trousers & Pants', slug: 'trousers-pants', desc: 'High-waisted tailored wool trousers with precise front pleats and fluid wide legs.', img: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80', banner: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=1600&q=80' },
    { name: 'Denim', slug: 'denim', desc: '14oz Japanese selvedge denim in sculptural straight and relaxed ecru cuts.', img: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=80', banner: 'https://images.unsplash.com/photo-1565084888279-aca607ecce0c?auto=format&fit=crop&w=1600&q=80' },
    { name: 'Jackets & Outerwear', slug: 'jackets-outerwear', desc: 'Double-breasted Biella wool blazers and storm-proof gabardine cocoon trench coats.', img: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?auto=format&fit=crop&w=800&q=80', banner: 'https://images.unsplash.com/photo-1539533018447-63fcce667823?auto=format&fit=crop&w=1600&q=80' },
    { name: 'Co-Ord Sets', slug: 'co-ord-sets', desc: 'Monochromatic silk and tailored wool two-piece ensembles for modern occasions.', img: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80', banner: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80' },
    { name: 'Skirts', slug: 'skirts', desc: 'Bias-cut silk charmeuse and structured pleated wool wrap midi skirts.', img: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=800&q=80', banner: 'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=1600&q=80' },
    { name: 'Knitwear', slug: 'knitwear', desc: 'Fine-gauge Mongolian cashmere turtlenecks and seamless silk-cotton cardigans.', img: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80', banner: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=1600&q=80' },
    { name: 'Accessories', slug: 'accessories', desc: 'Hand-rolled Como silk scarves, calfskin atelier totes, and sculpted brass hardware.', img: 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=800&q=80', banner: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1600&q=80' },
  ];

  const categories = [];
  for (let i = 0; i < categorySpecs.length; i++) {
    const c = categorySpecs[i];
    const cat = await client.category.create({
      data: {
        name: c.name,
        slug: c.slug,
        description: c.desc,
        thumbnailUrl: c.img,
        bannerUrl: c.banner,
        seoTitle: `${c.name} — FORME Permanent Collection`,
        seoDescription: c.desc,
        status: CategoryStatus.ACTIVE,
        displayOrder: i + 1,
        parentId: null,
      },
    });
    categories.push(cat);
  }

  const collectionSpecs = [
    { name: 'The Essentials', slug: 'the-essentials', desc: 'Permanent minimalist wardrobe foundations crafted in noble natural fibers.' },
    { name: 'Modern Minimalism', slug: 'modern-minimalism', desc: 'Architectural lines and refined restraint designed for contemporary cosmopolitan life.' },
    { name: 'Urban Form', slug: 'urban-form', desc: 'Structured tailoring and utilitarian comfort reimagined through couture sensibilities.' },
    { name: 'Everyday Icons', slug: 'everyday-icons', desc: 'Signature trench coats, silk slip dresses, and bespoke wool trousers.' },
    { name: 'Summer Edit', slug: 'summer-edit', desc: 'Breezy linen-silk blends, column silhouettes, and alabaster stone tones.' },
    { name: 'Monochrome Stories', slug: 'monochrome-stories', desc: 'A curated exploration of obsidian charcoal, alabaster ivory, and slate grey.' },
    { name: 'Weekend Uniform', slug: 'weekend-uniform', desc: 'Effortless cashmere knitwear, relaxed trousers, and heavyweight cotton tees.' },
    { name: 'Contemporary Classics', slug: 'contemporary-classics', desc: 'Time-honored double-breasted blazers and tailored trousers made in Italy.' },
    { name: 'Festive Edit', slug: 'festive-edit', desc: 'Opulent silk velvet ensembles, burgundy accents, and hand-rolled twill accessories.' },
    { name: 'The Signature Collection', slug: 'the-signature-collection', desc: 'The defining expressions of the House of FORME haute couture atelier.' },
  ];

  const collections = [];
  for (let i = 0; i < collectionSpecs.length; i++) {
    const col = collectionSpecs[i];
    const createdCol = await client.collection.create({
      data: {
        name: col.name,
        slug: col.slug,
        description: col.desc,
        desktopBannerUrl: `https://images.unsplash.com/photo-${1515886657613 + i}?auto=format&fit=crop&w=1920&q=80`,
        mobileBannerUrl: `https://images.unsplash.com/photo-${1515886657613 + i}?auto=format&fit=crop&w=800&q=80`,
        thumbnailUrl: `https://images.unsplash.com/photo-${1515886657613 + i}?auto=format&fit=crop&w=600&q=80`,
        desktopMediaType: i === 0 ? MediaType.VIDEO : MediaType.IMAGE,
        mobileMediaType: MediaType.IMAGE,
        seoTitle: `${col.name} — FORME Capsule Edit`,
        seoDescription: col.desc,
        isPublished: true,
        displayOrder: i + 1,
      },
    });
    collections.push(createdCol);
  }

  return { categories, collections };
}

// ============================================================================
// 5. PRODUCT ATTRIBUTES & REUSABLE VALUES
// ============================================================================
async function seedAttributes(client = prisma) {
  console.log('\n[FORME SEED] 4/12 Seeding 8 Product Attributes and Reusable Values...');

  const attrData = [
    { name: 'Silhouette', slug: 'silhouette', values: ['A-Line', 'Column', 'Relaxed Draped', 'Tailored Structured', 'Oversized'] },
    { name: 'Season', slug: 'season', values: ['Permanent Archive', 'Autumn/Winter 2026', 'Spring/Summer 2026', 'Resort Collection'] },
    { name: 'Pattern', slug: 'pattern', values: ['Solid Monochromatic', 'Fine Pinstripe', 'Subtle Herringbone', 'Artisanal Botanical'] },
    { name: 'Neckline', slug: 'neckline', values: ['Peak Lapel', 'Deep V-Neck', 'High Stand Collar', 'Crewneck', 'Halterneck'] },
    { name: 'Sleeve Type', slug: 'sleeve-type', values: ['Long Sleeve with Mitered Cuffs', 'Sleeveless', 'Raglan Cut', 'Dolman Sleeve'] },
    { name: 'Occasion', slug: 'occasion', values: ['Prêt-à-Porter', 'Evening Gala', 'Atelier Salon Appointment', 'Executive Suite'] },
    { name: 'Length', slug: 'length', values: ['Midi', 'Maxi Floor-Length', 'Full Inseam', 'Cropped Waist'] },
    { name: 'Style', slug: 'style', values: ['Architectural Minimalism', 'Contemporary Tailoring', 'Effortless Luxury', 'Fluid Draping'] },
  ];

  const attributeMap = {};

  for (let i = 0; i < attrData.length; i++) {
    const item = attrData[i];
    const attr = await client.productAttribute.create({
      data: {
        name: item.name,
        slug: item.slug,
        displayOrder: i + 1,
      },
    });

    const values = [];
    for (const v of item.values) {
      const valSlug = v.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const valRecord = await client.productAttributeValue.create({
        data: {
          attributeId: attr.id,
          value: v,
          slug: valSlug,
        },
      });
      values.push(valRecord);
    }
    attributeMap[item.slug] = { attribute: attr, values };
  }

  return attributeMap;
}

// ============================================================================
// 6. PRODUCTS (EXACTLY 40), VARIANTS (EXACTLY 100) & MEDIA (EXACTLY 140)
// ============================================================================
async function seedProductsVariantsMedia(client = prisma, categories, collections, attributeMap) {
  console.log('\n[FORME SEED] 5/12 Seeding Exactly 40 Products, 100 Variants, and 140 Media Records...');

  // 40 Products specifications (4 per category)
  const productSpecs = [
    // Category 0: Dresses (Products 1-4)
    { catIdx: 0, name: 'Atelier Silk Slip Dress', baseSku: 'FRM-DRS-001', type: 'Slip Dress', price: 6499, compare: 7999, fabric: '100% GOTS Mulberry Silk Charmeuse', fit: 'Fluid Bias-Cut', aud: Audience.WOMEN },
    { catIdx: 0, name: 'Bias-Cut Mulberry Evening Gown', baseSku: 'FRM-DRS-002', type: 'Evening Gown', price: 8999, compare: 10999, fabric: 'Heavy Weight Silk Crepe', fit: 'Column Silhouette', aud: Audience.WOMEN },
    { catIdx: 0, name: 'Pleated Crepe Column Dress', baseSku: 'FRM-DRS-003', type: 'Column Dress', price: 7499, compare: 8499, fabric: 'Triacetate Crepe de Chine', fit: 'Straight Pleated', aud: Audience.WOMEN },
    { catIdx: 0, name: 'Halterneck Velvet Cocktail Dress', baseSku: 'FRM-DRS-004', type: 'Cocktail Dress', price: 7999, compare: 9499, fabric: 'Silk-Rayon Archival Velvet', fit: 'Fitted Bodice with Flared Hem', aud: Audience.WOMEN },

    // Category 1: Tops & Shirts (Products 5-8)
    { catIdx: 1, name: 'Organic Poplin Oversized Shirt', baseSku: 'FRM-TOP-001', type: 'Oversized Shirt', price: 2999, compare: 3499, fabric: '100% Long-Staple Egyptian Cotton Poplin', fit: 'Relaxed Architectural Drop', aud: Audience.UNISEX },
    { catIdx: 1, name: 'Silk Georgette Fluid Blouse', baseSku: 'FRM-TOP-002', type: 'Fluid Blouse', price: 3499, compare: 4299, fabric: 'Pure Como Silk Georgette', fit: 'Soft Billowing Draping', aud: Audience.WOMEN },
    { catIdx: 1, name: 'Tailored Collar Band Shirt', baseSku: 'FRM-TOP-003', type: 'Band Collar Shirt', price: 2799, compare: 3299, fabric: 'Compact Yarn Cotton Weave', fit: 'Slim Tailored', aud: Audience.MEN },
    { catIdx: 1, name: 'Asymmetric Draped Satin Camisole', baseSku: 'FRM-TOP-004', type: 'Camisole', price: 2499, compare: 2999, fabric: 'Acetate Silk Satin', fit: 'Diagonal Bias Draping', aud: Audience.WOMEN },

    // Category 2: T-Shirts (Products 9-12)
    { catIdx: 2, name: 'Heavyweight Egyptian Cotton Tee', baseSku: 'FRM-TSH-001', type: 'Crewneck Tee', price: 1499, compare: 1999, fabric: '280 GSM Combed Compact Cotton', fit: 'Boxy Drop-Shoulder', aud: Audience.UNISEX },
    { catIdx: 2, name: 'Mercerized Minimalist Crewneck', baseSku: 'FRM-TSH-002', type: 'Mercerized Tee', price: 1799, compare: 2299, fabric: 'Double-Mercerized Giza Cotton', fit: 'Clean Tailored Line', aud: Audience.MEN },
    { catIdx: 2, name: 'Raw-Edge Boxy Slub Tee', baseSku: 'FRM-TSH-003', type: 'Slub Tee', price: 1299, compare: 1499, fabric: 'Organic Slub Cotton Jersey', fit: 'Relaxed Box Cut', aud: Audience.UNISEX },
    { catIdx: 2, name: 'Supima Ribbed Long-Sleeve Top', baseSku: 'FRM-TSH-004', type: 'Long Sleeve Knit', price: 1999, compare: 2499, fabric: '2x2 Ribbed Supima Cotton', fit: 'Second-Skin Tailored Stretch', aud: Audience.WOMEN },

    // Category 3: Trousers & Pants (Products 13-16)
    { catIdx: 3, name: 'Wide-Leg High-Waisted Wool Trousers', baseSku: 'FRM-TRS-001', type: 'Wide Leg Trousers', price: 4499, compare: 5499, fabric: 'Biella Super 120s Virgin Wool', fit: 'High Rise with Deep Front Inverted Pleat', aud: Audience.WOMEN },
    { catIdx: 3, name: 'Pleated Front Straight Chino', baseSku: 'FRM-TRS-002', type: 'Pleated Chino', price: 3499, compare: 3999, fabric: 'Mercerized Cotton Twill', fit: 'Mid-Rise Straight Leg', aud: Audience.MEN },
    { catIdx: 3, name: 'Relaxed Fluid Silk Palazzos', baseSku: 'FRM-TRS-003', type: 'Palazzo Pants', price: 4999, compare: 5999, fabric: '100% Silk Crepe Habotai', fit: 'Flowing Wide Silhouette', aud: Audience.WOMEN },
    { catIdx: 3, name: 'Tapered Architectural Cigarette Pant', baseSku: 'FRM-TRS-004', type: 'Cigarette Pants', price: 3999, compare: 4799, fabric: 'Stretch Wool Gabardine', fit: 'Cropped Ankle Taper', aud: Audience.WOMEN },

    // Category 4: Denim (Products 17-20)
    { catIdx: 4, name: 'Selvedge Rigid Straight Jean', baseSku: 'FRM-DNM-001', type: 'Selvedge Denim', price: 3999, compare: 4999, fabric: '14oz Okayama Shuttle-Loomed Selvedge', fit: 'Classic High-Rise Straight', aud: Audience.MEN },
    { catIdx: 4, name: 'Wide-Leg Ecru Denim Trouser', baseSku: 'FRM-DNM-002', type: 'Ecru Denim', price: 3499, compare: 4299, fabric: 'Undyed Natural Organic Cotton Denim', fit: 'Relaxed Tailored Wide Leg', aud: Audience.WOMEN },
    { catIdx: 4, name: 'Vintage Washed High-Rise Flare', baseSku: 'FRM-DNM-003', type: 'Flared Denim', price: 3799, compare: 4599, fabric: 'Soft-Washed Ringspun Cotton Denim', fit: 'Subtle Retro Flare from Knee', aud: Audience.WOMEN },
    { catIdx: 4, name: 'Sculpted Denim Overshirt Jacket', baseSku: 'FRM-DNM-004', type: 'Denim Overshirt', price: 4499, compare: 5299, fabric: '11oz Washed Black Cotton Denim', fit: 'Architectural Boxy Cut', aud: Audience.UNISEX },

    // Category 5: Jackets & Outerwear (Products 21-24)
    { catIdx: 5, name: 'Double-Breasted Biella Wool Blazer', baseSku: 'FRM-JCK-001', type: 'Tailored Blazer', price: 8999, compare: 10999, fabric: '100% Pure Virgin Wool from Biella, Italy', fit: 'Structured Shoulders with Canvas Chest', aud: Audience.UNISEX },
    { catIdx: 5, name: 'Belted Storm Gabardine Trench Coat', baseSku: 'FRM-JCK-002', type: 'Trench Coat', price: 11999, compare: 14999, fabric: 'Water-Repellent Double-Weave Cotton Gabardine', fit: 'Cocoon Drape with Storm Flap', aud: Audience.WOMEN },
    { catIdx: 5, name: 'Structured Cashmere Cocoon Overcoat', baseSku: 'FRM-JCK-003', type: 'Overcoat', price: 13999, compare: 16999, fabric: '85% Virgin Wool, 15% Pure Cashmere', fit: 'Architectural Dropped Cocoon', aud: Audience.UNISEX },
    { catIdx: 5, name: 'Cropped Tailored Evening Tuxedo Jacket', baseSku: 'FRM-JCK-004', type: 'Tuxedo Jacket', price: 7999, compare: 9999, fabric: 'Fine Wool Barathea with Silk Satin Lapels', fit: 'Cropped Sharp Tailoring', aud: Audience.WOMEN },

    // Category 6: Co-Ord Sets (Products 25-28)
    { catIdx: 6, name: 'Silk Crepe Relaxed Lounging Set', baseSku: 'FRM-CRD-001', type: 'Silk Co-Ord', price: 6999, compare: 8499, fabric: 'Heavy Weight Silk Crepe de Chine', fit: 'Fluid Button-Up & Drawstring Pant', aud: Audience.WOMEN },
    { catIdx: 6, name: 'Tailored Waistcoat & Trouser Duo', baseSku: 'FRM-CRD-002', type: 'Tailored Suit Duo', price: 7499, compare: 8999, fabric: 'Pinstripe Italian Wool-Viscose', fit: 'Sculpted V-Waistcoat & Wide Trouser', aud: Audience.WOMEN },
    { catIdx: 6, name: 'Textured Linen Summer Twinset', baseSku: 'FRM-CRD-003', type: 'Linen Set', price: 5499, compare: 6499, fabric: '100% Normandy Delave Linen', fit: 'Boxy Short-Sleeve & Relaxed Short', aud: Audience.UNISEX },
    { catIdx: 6, name: 'Ribbed Knit Cardigan & Column Skirt Set', baseSku: 'FRM-CRD-004', type: 'Knit Set', price: 6499, compare: 7999, fabric: 'Merino Wool and Mulberry Silk Blend', fit: 'Fitted Rib Contour', aud: Audience.WOMEN },

    // Category 7: Skirts (Products 29-32)
    { catIdx: 7, name: 'Bias-Cut Silk Charmeuse Midi Skirt', baseSku: 'FRM-SKT-001', type: 'Midi Skirt', price: 4499, compare: 5499, fabric: 'Pure Como Silk Charmeuse', fit: 'Body-Skimming Diagonal Bias', aud: Audience.WOMEN },
    { catIdx: 7, name: 'Architectural Pleated Wool Wrap Skirt', baseSku: 'FRM-SKT-002', type: 'Wrap Skirt', price: 4999, compare: 5999, fabric: 'Fine Wool Tropical Suiting', fit: 'Asymmetric Knife Pleat', aud: Audience.WOMEN },
    { catIdx: 7, name: 'A-Line Gabardine Button-Front Skirt', baseSku: 'FRM-SKT-003', type: 'A-Line Skirt', price: 3499, compare: 4299, fabric: 'Structured Cotton Gabardine', fit: 'Flared A-Line with Horn Buttons', aud: Audience.WOMEN },
    { catIdx: 7, name: 'Sculpted Asymmetric Hem Fluted Skirt', baseSku: 'FRM-SKT-004', type: 'Fluted Skirt', price: 4299, compare: 4999, fabric: 'Viscose Crepe with Dense Drape', fit: 'Fluted Spiral Hemline', aud: Audience.WOMEN },

    // Category 8: Knitwear (Products 33-36)
    { catIdx: 8, name: 'Fine Gauge Mongolian Cashmere Turtleneck', baseSku: 'FRM-KNT-001', type: 'Cashmere Knit', price: 5999, compare: 7499, fabric: '100% Grade-A Mongolian Cashmere (12-Gauge)', fit: 'Classic Regular Fit with Ribbed Collar', aud: Audience.UNISEX },
    { catIdx: 8, name: 'Chunky Ribbed Fisherman Sweater', baseSku: 'FRM-KNT-002', type: 'Fisherman Knit', price: 4999, compare: 5999, fabric: '100% Pure British Lambswool', fit: 'Slouchy Dropped-Shoulder Knit', aud: Audience.MEN },
    { catIdx: 8, name: 'Oversized V-Neck Alpaca Cardigan', baseSku: 'FRM-KNT-003', type: 'Cardigan', price: 5499, compare: 6799, fabric: 'Baby Alpaca and Organic Wool Blend', fit: 'Deep V with Tortoiseshell Buttons', aud: Audience.WOMEN },
    { catIdx: 8, name: 'Silk-Cotton Seamless Polo Knit', baseSku: 'FRM-KNT-004', type: 'Polo Knit', price: 3499, compare: 4299, fabric: '55% Mulberry Silk, 45% Long-Staple Cotton', fit: 'Seamless Circular Knit Body', aud: Audience.MEN },

    // Category 9: Accessories (Products 37-40)
    { catIdx: 9, name: 'Structured Calfskin Atelier Tote', baseSku: 'FRM-ACC-001', type: 'Leather Tote', price: 9999, compare: 12999, fabric: 'Full-Grain Tuscan Vegetable-Tanned Calfskin', fit: 'Structured Architectural Silhouette', aud: Audience.UNISEX },
    { catIdx: 9, name: 'Hand-Rolled Como Silk Twill Scarf', baseSku: 'FRM-ACC-002', type: 'Silk Scarf', price: 2999, compare: 3999, fabric: '100% Silk Twill (16 Momme) with Hand-Rolled Edges', fit: '90cm x 90cm Square', aud: Audience.UNISEX },
    { catIdx: 9, name: 'Polished Brass Buckle Leather Belt', baseSku: 'FRM-ACC-003', type: 'Leather Belt', price: 1999, compare: 2499, fabric: 'Bridle Leather with Solid Brass Hardware', fit: '30mm Width Architectural Buckle', aud: Audience.UNISEX },
    { catIdx: 9, name: 'Archival Cashmere Travel Wrap Shawl', baseSku: 'FRM-ACC-004', type: 'Cashmere Shawl', price: 4499, compare: 5499, fabric: 'Pure Himalayan Cashmere Gauze', fit: '200cm x 75cm Generous Drape', aud: Audience.UNISEX },
  ];

  // Palette colors
  const colorPalette = [
    { name: 'Obsidian Black', hex: '#1C1917' },
    { name: 'Warm Ivory', hex: '#FAF8F5' },
    { name: 'Deep Charcoal', hex: '#2B2B2A' },
    { name: 'Midnight Navy', hex: '#1E293B' },
    { name: 'Hunter Olive', hex: '#3D4A3E' },
    { name: 'Alabaster Stone', hex: '#D4C5B9' },
    { name: 'Burgundy Wine', hex: '#5B1E31' },
    { name: 'Terracotta Rose', hex: '#9E6B55' },
    { name: 'Bleached White', hex: '#FFFFFF' },
    { name: 'Muted Sage', hex: '#8A9A86' },
  ];

  const sizePalette = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  // Verified public Cloudinary demo videos
  const sampleVideos = [
    'https://res.cloudinary.com/demo/video/upload/dog.mp4',
    'https://res.cloudinary.com/demo/video/upload/elephants.mp4',
    'https://res.cloudinary.com/demo/video/upload/snow_horses.mp4',
    'https://res.cloudinary.com/demo/video/upload/kitten_fighting.mp4',
  ];

  // High quality fashion Unsplash images
  const sampleImages = [
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1539533018447-63fcce667823?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1534126511673-b6899657816a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1544022613-e87ca75a784a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=800&q=80',
  ];

  const createdProducts = [];
  const createdVariants = [];
  const createdMedia = [];

  for (let pIdx = 0; pIdx < productSpecs.length; pIdx++) {
    const spec = productSpecs[pIdx];
    const category = categories[spec.catIdx];
    const slug = spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const product = await client.product.create({
      data: {
        name: spec.name,
        slug,
        baseSku: spec.baseSku,
        shortDescription: `Artisanal ${spec.type} engineered in ${spec.fabric}.`,
        longDescription: `An iconic silhouette from the FORME permanent collection. Crafted with architectural precision using noble ${spec.fabric}. Featuring ${spec.fit.toLowerCase()} and refined hand-finished details that honor the highest tradition of international tailoring. Designed to drape with understated elegance from day into evening.`,
        categoryId: category.id,
        audience: spec.aud,
        productType: spec.type,
        fabric: spec.fabric,
        fit: spec.fit,
        material: spec.fabric,
        careInstructions: 'Specialist eco-dry clean only. Store on wide cedar hangers in a ventilated wardrobe.',
        specifications: {
          weavingOrigin: 'Biella & Lake Como, Italy',
          construction: 'Full horsehair canvas with hand-stitched pick lapels',
          lining: '100% Bemberg Cupro breathable lining',
          hardware: 'Hand-carved horn and polished brass buttons',
        },
        tags: ['haute-couture', 'luxury-basics', category.slug, spec.aud.toLowerCase(), 'editorial-pick'],
        sellingPrice: toDec(spec.price),
        compareAtPrice: toDec(spec.compare),
        taxClassificationId: 'HSN-6204',
        status: ProductStatus.PUBLISHED,
        isFeatured: pIdx < 8,
        isNewArrival: pIdx >= 28,
        viewCount: 150 + pIdx * 25,
        salesCount: 20 + pIdx * 5,
        seoTitle: `${spec.name} — Luxury ${spec.type} | FORME`,
        seoDescription: `Acquire the handcrafted ${spec.name} in ${spec.fabric}. Complimentary white-glove express delivery.`,
        seoKeywords: [spec.name.toLowerCase(), spec.type.toLowerCase(), 'forme luxury', category.slug],
        metadata: {
          sartorialCareScore: 'A+',
          seamAllowanceCm: 4,
          artisanWorkshop: 'Mumbai Atelier No. 4',
        },
      },
    });

    createdProducts.push(product);

    // Link each product to 1 to 3 collections
    const primaryCol = collections[pIdx % collections.length];
    const secondaryCol = collections[(pIdx + 3) % collections.length];
    await client.collectionProduct.createMany({
      data: [
        { collectionId: primaryCol.id, productId: product.id, displayOrder: pIdx + 1 },
        { collectionId: secondaryCol.id, productId: product.id, displayOrder: pIdx + 2 },
      ],
      skipDuplicates: true,
    });

    // Link product to attributes
    const silVal = attributeMap['silhouette'].values[pIdx % attributeMap['silhouette'].values.length];
    const seaVal = attributeMap['season'].values[pIdx % attributeMap['season'].values.length];
    const occVal = attributeMap['occasion'].values[pIdx % attributeMap['occasion'].values.length];
    await client.productAttributeMapping.createMany({
      data: [
        { productId: product.id, attributeId: attributeMap['silhouette'].attribute.id, valueId: silVal.id },
        { productId: product.id, attributeId: attributeMap['season'].attribute.id, valueId: seaVal.id },
        { productId: product.id, attributeId: attributeMap['occasion'].attribute.id, valueId: occVal.id },
      ],
      skipDuplicates: true,
    });

    // Exactly 1 Product-Level VIDEO Media
    const videoUrl = sampleVideos[pIdx % sampleVideos.length];
    const videoMedia = await client.productMedia.create({
      data: {
        productId: product.id,
        variantId: null, // Product-level video
        mediaType: MediaType.VIDEO,
        publicId: `forme/videos/${product.slug}-runway-film`,
        secureUrl: videoUrl,
        thumbnailUrl: sampleImages[pIdx % sampleImages.length],
        altText: `Runway campaign film for ${product.name}`,
        displayOrder: 2,
        isPrimary: false,
        metadata: {
          durationSec: 32,
          aspectRatio: '16:9',
          resolution: '1080p',
          isMutedAutoplay: true,
        },
      },
    });
    createdMedia.push(videoMedia);

    // Determine variant count based on prompt distribution:
    // Group 1 (products 0..9): 1 variant each = 10 variants
    // Group 2 (products 10..19): 2 variants each = 20 variants
    // Group 3 (products 20..29): 3 variants each = 30 variants
    // Group 4 (products 30..39): 4 variants each = 40 variants
    let variantsForThisProduct = 1;
    if (pIdx >= 10 && pIdx < 20) variantsForThisProduct = 2;
    else if (pIdx >= 20 && pIdx < 30) variantsForThisProduct = 3;
    else if (pIdx >= 30 && pIdx < 40) variantsForThisProduct = 4;

    for (let vIdx = 0; vIdx < variantsForThisProduct; vIdx++) {
      const color = colorPalette[(pIdx * 2 + vIdx) % colorPalette.length];
      const size = sizePalette[(pIdx + vIdx) % sizePalette.length];
      const vSku = `${spec.baseSku}-${size}-${color.name.substring(0, 3).toUpperCase()}`;

      const stockQty = 40 + (pIdx % 5) * 5;
      const reservedQty = (pIdx + vIdx) % 4;
      const availQty = stockQty - reservedQty;

      const variant = await client.productVariant.create({
        data: {
          productId: product.id,
          sku: vSku,
          size,
          colorName: color.name,
          colorHex: color.hex,
          priceOverride: null, // inherits base selling price
          compareAtPriceOverride: null,
          stockQuantity: stockQty,
          reservedQuantity: reservedQty,
          availableQuantity: availQty,
          status: VariantStatus.ACTIVE,
          weight: toDec(0.45 + (pIdx % 4) * 0.15),
          attributes: {
            finish: 'Hand-brushed matte drape',
            washCare: 'Dry Clean Recommended',
          },
        },
      });

      createdVariants.push(variant);

      // Exactly 1 Variant-Specific IMAGE Media
      const imgUrl = sampleImages[(pIdx + vIdx) % sampleImages.length];
      const imageMedia = await client.productMedia.create({
        data: {
          productId: product.id,
          variantId: variant.id, // Variant-specific
          mediaType: MediaType.IMAGE,
          publicId: `forme/products/${variant.sku.toLowerCase()}`,
          secureUrl: imgUrl,
          thumbnailUrl: imgUrl,
          altText: `${product.name} in ${color.name} (${size})`,
          displayOrder: 1,
          isPrimary: true,
          metadata: {
            width: 1200,
            height: 1600,
            format: 'webp',
            colorTag: color.name,
          },
        },
      });
      createdMedia.push(imageMedia);
    }
  }

  return { products: createdProducts, variants: createdVariants, media: createdMedia };
}

// ============================================================================
// 7. PROMOTIONS (10 COUPONS, 6 OFFERS, 1 FLASH SALE)
// ============================================================================
async function seedPromotions(client = prisma, products, categories, collections, variants) {
  console.log('\n[FORME SEED] 6/12 Seeding Exactly 10 Coupons, 6 Offers, and 1 Flash Sale...');

  const now = new Date();
  const pastYear = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 365);
  const futureYear = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365);

  const couponSpecs = [
    { code: 'WELCOME10', desc: 'Atelier inaugural privilege: 10% off your introductory acquisition.', type: DiscountType.PERCENTAGE, val: 10, min: 2000, max: 1000, catIdx: 0 },
    { code: 'FORME15', desc: 'Private preview privilege: 15% off The Essentials capsule.', type: DiscountType.PERCENTAGE, val: 15, min: 3000, max: 2000, colIdx: 0 },
    { code: 'STYLE20', desc: 'Runway curation privilege: 20% off all silk tops and fine knitwear.', type: DiscountType.PERCENTAGE, val: 20, min: 5000, max: 2500, catIdx: 1 },
    { code: 'FESTIVE25', desc: 'Seasonal gala celebration: 25% off festive wardrobe tailoring.', type: DiscountType.PERCENTAGE, val: 25, min: 6000, max: 3500, colIdx: 8 },
    { code: 'DIWALI30', desc: 'Diwali edit privilege: 30% off architectural outerwear & gowns.', type: DiscountType.PERCENTAGE, val: 30, min: 8000, max: 5000, catIdx: 5 },
    { code: 'NEWSEASON15', desc: 'New perspectives drop: 15% off Autumn/Winter arrivals.', type: DiscountType.PERCENTAGE, val: 15, min: 4000, max: 2500, colIdx: 1 },
    { code: 'ESSENTIALS10', desc: 'Everyday icons collection: 10% off wardrobe foundations.', type: DiscountType.PERCENTAGE, val: 10, min: 2500, max: 1500, colIdx: 3 },
    { code: 'WEEKEND20', desc: 'Weekend uniform edit: 20% off relaxed luxury sets.', type: DiscountType.PERCENTAGE, val: 20, min: 5000, max: 3000, colIdx: 6 },
    { code: 'EDIT40', desc: 'Curated archival clearance: 40% off limited summer pieces.', type: DiscountType.PERCENTAGE, val: 40, min: 10000, max: 6000, colIdx: 4 },
    { code: 'SIGNATURE15', desc: 'Haute couture voucher: Flat ₹1,500 off signature tailoring.', type: DiscountType.FLAT, val: 1500, min: 5000, max: 1500, colIdx: 9 },
  ];

  const coupons = [];
  for (let i = 0; i < couponSpecs.length; i++) {
    const cs = couponSpecs[i];
    const coupon = await client.coupon.create({
      data: {
        code: cs.code,
        description: cs.desc,
        discountType: cs.type,
        discountValue: toDec(cs.val),
        maxDiscountAmount: cs.max ? toDec(cs.max) : null,
        minPurchaseAmount: toDec(cs.min),
        startDate: pastYear,
        endDate: futureYear,
        usageLimit: 500,
        timesRedeemed: 3,
        perCustomerLimit: 2,
        isActive: true,
        allowStacking: false,
        bannerUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80',
        conditions: { minItems: 1, excludeDiscountedItems: false },
        displayMetadata: { badgeText: cs.type === DiscountType.PERCENTAGE ? `${cs.val}% OFF` : `₹${cs.val} OFF`, categoryLabel: 'Curated Atelier Privilege' },
      },
    });

    coupons.push(coupon);

    // Link relationships across products, categories, and collections
    if (cs.catIdx !== undefined) {
      await client.couponCategory.create({
        data: { couponId: coupon.id, categoryId: categories[cs.catIdx].id },
      });
    }
    if (cs.colIdx !== undefined) {
      await client.couponCollection.create({
        data: { couponId: coupon.id, collectionId: collections[cs.colIdx].id },
      });
    }
    // Also attach to a specific product
    await client.couponProduct.create({
      data: { couponId: coupon.id, productId: products[i % products.length].id },
    });
  }

  // 6 Offers
  const offerSpecs = [
    { name: 'New Season Launch Offer', slug: 'new-season-launch', desc: '15% off jackets and outerwear.', type: DiscountType.PERCENTAGE, val: 15, catIdx: 5 },
    { name: 'Festive Wardrobe Offer', slug: 'festive-wardrobe-offer', desc: '20% off Festive Edit collection.', type: DiscountType.PERCENTAGE, val: 20, colIdx: 8 },
    { name: 'Everyday Essentials Offer', slug: 'everyday-essentials-offer', desc: '10% off tops and shirts.', type: DiscountType.PERCENTAGE, val: 10, catIdx: 1 },
    { name: 'Summer Edit Promotion', slug: 'summer-edit-promotion', desc: '25% off Summer Edit collection.', type: DiscountType.PERCENTAGE, val: 25, colIdx: 4 },
    { name: 'Selected Collection Offer', slug: 'selected-collection-offer', desc: '15% off Modern Minimalism.', type: DiscountType.PERCENTAGE, val: 15, colIdx: 1 },
    { name: 'Signature Styles Promotion', slug: 'signature-styles-promotion', desc: '20% off The Signature Collection.', type: DiscountType.PERCENTAGE, val: 20, colIdx: 9 },
  ];

  const offers = [];
  for (let i = 0; i < offerSpecs.length; i++) {
    const os = offerSpecs[i];
    const offer = await client.offer.create({
      data: {
        name: os.name,
        slug: os.slug,
        description: os.desc,
        discountType: os.type,
        discountValue: toDec(os.val),
        maxDiscountAmount: toDec(5000),
        minPurchaseAmount: toDec(0),
        startDate: pastYear,
        endDate: futureYear,
        usageLimit: 1000,
        perCustomerLimit: 5,
        isActive: true,
        allowStacking: false,
        bannerUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80',
        conditions: { autoApply: true },
        displayMetadata: { headline: os.name, tag: 'Official Atelier Promotion' },
      },
    });

    offers.push(offer);

    if (os.catIdx !== undefined) {
      await client.offerCategory.create({
        data: { offerId: offer.id, categoryId: categories[os.catIdx].id },
      });
    }
    if (os.colIdx !== undefined) {
      await client.offerCollection.create({
        data: { offerId: offer.id, collectionId: collections[os.colIdx].id },
      });
    }
    await client.offerProduct.create({
      data: { offerId: offer.id, productId: products[(i * 3) % products.length].id },
    });
  }

  // Exactly 1 Flash Sale
  const flashSale = await client.flashSale.create({
    data: {
      name: 'FORME Midnight Fashion Event',
      slug: 'forme-midnight-fashion-event',
      description: 'Exclusive 24-hour midnight privilege on selected runway tailoring and silk evening gowns.',
      startTime: pastYear,
      endTime: futureYear,
      status: FlashSaleStatus.ACTIVE,
      priority: 10,
      displaySettings: {
        timerEnabled: true,
        bannerText: 'MIDNIGHT COUTURE WINDOW',
        accentColor: '#9E6B55',
      },
    },
  });

  // Attach 6 FlashSaleProducts
  for (let i = 0; i < 6; i++) {
    const prod = products[i];
    const variant = variants.find((v) => v.productId === prod.id) || null;
    await client.flashSaleProduct.create({
      data: {
        flashSaleId: flashSale.id,
        productId: prod.id,
        variantId: variant ? variant.id : null,
        discountType: DiscountType.PERCENTAGE,
        discountValue: toDec(20 + i * 2),
        stockLimit: 25,
        soldCount: 8,
        displayOrder: i + 1,
      },
    });
  }

  return { coupons, offers, flashSale };
}

// ============================================================================
// 8. CONTENT MANAGEMENT & EDITORIAL (BANNERS, CMS, NEWSLETTERS)
// ============================================================================
async function seedCMS(client = prisma, categories, collections, products) {
  console.log('\n[FORME SEED] 7/12 Seeding Exactly 6 Banners (5 Image, 1 Video), Announcements, Sections, Navigation & Newsletter...');

  // Exactly 6 Banners (5 image, 1 video)
  const bannerSpecs = [
    { title: 'New Season — New Perspectives', sub: 'Autumn/Winter Haute Couture Collection', type: BannerType.HOME, mediaType: MediaType.IMAGE, url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1920&q=80', cta: 'Explore Collection', link: '/collections/the-essentials' },
    { title: 'Diwali Edit — Celebrate in Style', sub: 'Noble Silk & Wool Evening Ensembles', type: BannerType.COLLECTION, mediaType: MediaType.IMAGE, url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1920&q=80', cta: 'View Festive Capsule', link: '/collections/festive-edit' },
    { title: 'Festive Wardrobe — Up to 40% Off', sub: 'Exclusive Curated Archival Privileges', type: BannerType.OFFER, mediaType: MediaType.IMAGE, url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1920&q=80', cta: 'Shop Private Privileges', link: '/shop?discount=true' },
    { title: 'The Everyday Essentials', sub: 'Permanent Minimalist Foundations for the Discerning Wardrobe', type: BannerType.COLLECTION, mediaType: MediaType.IMAGE, url: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1920&q=80', cta: 'Discover Foundations', link: '/collections/everyday-icons' },
    { title: 'End of Season Archival Drop', sub: 'Last Pieces from Historic Biella & Como Runs', type: BannerType.EDITORIAL_SPLIT, mediaType: MediaType.IMAGE, url: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=1920&q=80', cta: 'Inspect Archive', link: '/shop' },
    { title: 'Atelier Runway Presentation Film', sub: 'A Visual Exploration of Natural Fiber Movement', type: BannerType.HOME, mediaType: MediaType.VIDEO, url: 'https://res.cloudinary.com/demo/video/upload/dog.mp4', cta: 'Watch Runway Film', link: '/journal' },
  ];

  const banners = [];
  for (let i = 0; i < bannerSpecs.length; i++) {
    const b = bannerSpecs[i];
    const createdBanner = await client.banner.create({
      data: {
        title: b.title,
        subtitle: b.sub,
        type: b.type,
        desktopMediaUrl: b.url,
        mobileMediaUrl: b.mediaType === MediaType.VIDEO ? b.url : b.url.replace('w=1920', 'w=800'),
        desktopMediaType: b.mediaType,
        mobileMediaType: b.mediaType,
        altText: b.title,
        ctaLabel: b.cta,
        ctaLink: b.link,
        isPublished: true,
        displayOrder: i + 1,
      },
    });
    banners.push(createdBanner);
  }

  // 4 Announcements
  await client.announcement.createMany({
    data: [
      { message: 'Complimentary white-glove express courier delivery on all domestic orders above ₹5,000 across India.', ctaLabel: 'Learn More', ctaLink: '/shipping-policy', backgroundColor: '#1C1917', textColor: '#FAF8F5', isPublished: true, displayOrder: 1 },
      { message: 'Discover the Autumn/Winter Haute Couture Runway Collection — Private Previews Now Open.', ctaLabel: 'View Drop', ctaLink: '/collections/the-essentials', backgroundColor: '#9E6B55', textColor: '#FFFFFF', isPublished: true, displayOrder: 2 },
      { message: 'Atelier Festive Wardrobe Privilege: Enjoy 25% off signature outerwear with code FESTIVE25.', ctaLabel: 'Claim Voucher', ctaLink: '/shop', backgroundColor: '#1C1917', textColor: '#FAF8F5', isPublished: true, displayOrder: 3 },
      { message: 'Bespoke Made-to-Measure Consultations available at our Mumbai & Milan Flagship Salons.', ctaLabel: 'Book Salon', ctaLink: '/contact', backgroundColor: '#22201E', textColor: '#FAF8F5', isPublished: true, displayOrder: 4 },
    ],
  });

  // 7 HomePageSections
  await client.homePageSection.createMany({
    data: [
      {
        title: 'Master Atelier Hero Presentation',
        subtitle: 'Designed to Be Worn. Made to Be Remembered.',
        type: HomePageSectionType.HERO_BANNER,
        references: { bannerIds: [banners[0].id, banners[5].id] },
        layoutConfig: { fullWidth: true, autoplay: true, intervalSec: 7 },
        displayOrder: 1,
        isPublished: true,
      },
      {
        title: 'Curated Runway Categories',
        subtitle: 'Architectural Silhouettes in Noble Fibers',
        type: HomePageSectionType.CATEGORY_CAROUSEL,
        references: { categoryIds: categories.slice(0, 6).map((c) => c.id) },
        layoutConfig: { columnsDesktop: 4, columnsMobile: 2 },
        displayOrder: 2,
        isPublished: true,
      },
      {
        title: 'The Permanent Foundations Edit',
        subtitle: 'Timeless tailored outerwear and silk evening gowns',
        type: HomePageSectionType.FEATURED_COLLECTION,
        references: { collectionId: collections[0].id, productIds: products.slice(0, 4).map((p) => p.id) },
        layoutConfig: { showCollectionHero: true },
        displayOrder: 3,
        isPublished: true,
      },
      {
        title: 'Atelier Midnight Window',
        subtitle: 'Limited-quantity runway privilege available for 24 hours',
        type: HomePageSectionType.FLASH_SALE_ROW,
        references: { productIds: products.slice(4, 8).map((p) => p.id) },
        layoutConfig: { showCountdown: true, badge: 'HAUTE COUTURE WINDOW' },
        displayOrder: 4,
        isPublished: true,
      },
      {
        title: 'Atelier Craftsmanship & Sourcing Studies',
        subtitle: 'From Biella looms to the master cutter’s table',
        type: HomePageSectionType.EDITORIAL_GRID,
        references: { editorialSlugs: ['the-art-of-everyday-dressing', 'a-study-in-modern-silhouettes'] },
        layoutConfig: { columns: 2, showAuthor: true },
        displayOrder: 5,
        isPublished: true,
      },
      {
        title: 'Seasonal Runway Film Lookbook',
        subtitle: 'A sensory cinematic perspective on movement and drape',
        type: HomePageSectionType.LOOKBOOK_SPLIT,
        references: { videoBannerId: banners[5].id, productIds: products.slice(8, 12).map((p) => p.id) },
        layoutConfig: { splitRatio: '50-50' },
        displayOrder: 6,
        isPublished: true,
      },
      {
        title: 'Patron Accolades & Appraisals',
        subtitle: 'Reflections from our international clientele',
        type: HomePageSectionType.TESTIMONIALS,
        references: { featuredReviewIds: [] },
        layoutConfig: { layout: 'editorial_quote_carousel' },
        displayOrder: 7,
        isPublished: true,
      },
    ],
  });

  // 3 Navigation Menus + 20+ Items
  const menuHeader = await client.navigationMenu.create({
    data: { name: 'Main Header Navigation', slug: 'main-header', isActive: true },
  });

  const menuMobile = await client.navigationMenu.create({
    data: { name: 'Mobile Navigation Drawer', slug: 'mobile-navigation', isActive: true },
  });

  const menuAccount = await client.navigationMenu.create({
    data: { name: 'Customer Account Suite', slug: 'account-navigation', isActive: true },
  });

  // Menu items for Main Header
  const headerLinks = [
    { label: 'Shop All', url: '/shop', badge: null },
    { label: 'Collections', url: '/collections', badge: null },
    { label: 'Dresses', url: '/categories/dresses', badge: null },
    { label: 'Tailored Jackets', url: '/categories/jackets-outerwear', badge: null },
    { label: 'Trousers', url: '/categories/trousers-pants', badge: null },
    { label: 'Knitwear', url: '/categories/knitwear', badge: null },
    { label: 'Accessories', url: '/categories/accessories', badge: null },
    { label: 'New Arrivals', url: '/shop?filter=new-arrivals', badge: 'NEW' },
    { label: 'Archival Sale', url: '/shop?discount=true', badge: 'PRIVILEGE' },
    { label: 'Editorial Journal', url: '/journal', badge: null },
  ];

  for (let i = 0; i < headerLinks.length; i++) {
    await client.navigationMenuItem.create({
      data: {
        menuId: menuHeader.id,
        label: headerLinks[i].label,
        url: headerLinks[i].url,
        highlightBadge: headerLinks[i].badge,
        displayOrder: i + 1,
      },
    });
  }

  // Menu items for Mobile Nav
  for (let i = 0; i < headerLinks.length; i++) {
    await client.navigationMenuItem.create({
      data: {
        menuId: menuMobile.id,
        label: headerLinks[i].label,
        url: headerLinks[i].url,
        highlightBadge: headerLinks[i].badge,
        displayOrder: i + 1,
      },
    });
  }

  // Menu items for Account Navigation
  const accountLinks = [
    { label: 'Overview', url: '/account' },
    { label: 'Orders & Archives', url: '/account/orders' },
    { label: 'Delivery Residences', url: '/account/addresses' },
    { label: 'Private Wishlist', url: '/account/wishlist' },
    { label: 'Garment Critiques', url: '/account/reviews' },
    { label: 'Atelier Notifications', url: '/account/notifications' },
    { label: 'Patron Profile', url: '/account/profile' },
    { label: 'Account Security', url: '/account/security' },
  ];

  for (let i = 0; i < accountLinks.length; i++) {
    await client.navigationMenuItem.create({
      data: {
        menuId: menuAccount.id,
        label: accountLinks[i].label,
        url: accountLinks[i].url,
        displayOrder: i + 1,
      },
    });
  }

  // 4 Footer Sections + 16+ Menu Items
  const footerSections = [
    {
      title: 'Atelier Silhouettes',
      items: [
        { label: 'Outerwear & Coats', url: '/categories/jackets-outerwear' },
        { label: 'Tailored Blazers', url: '/categories/jackets-outerwear' },
        { label: 'Mulberry Silk Dresses', url: '/categories/dresses' },
        { label: 'Fluid Trousers', url: '/categories/trousers-pants' },
        { label: 'Permanent Archive', url: '/collections/the-essentials' },
      ],
    },
    {
      title: 'Client Concierge',
      items: [
        { label: 'Sartorial Sizing Guide', url: '/size-guide' },
        { label: 'Order Tracking & Status', url: '/track-order' },
        { label: 'White-Glove Delivery Info', url: '/shipping-policy' },
        { label: 'Returns & Exchange Policy', url: '/return-policy' },
        { label: 'Garment Fiber Care & FAQ', url: '/faq' },
        { label: 'Concierge Desk Contact', url: '/contact' },
      ],
    },
    {
      title: 'The House of FORME',
      items: [
        { label: 'Heritage & Craftsmanship', url: '/about' },
        { label: 'Biella Mill Sourcing', url: '/about' },
        { label: 'Sustainability Manifesto', url: '/about' },
        { label: 'Client Salon Locations', url: '/contact' },
        { label: 'Private Wishlist', url: '/account/wishlist' },
      ],
    },
    {
      title: 'Legal & Policy',
      items: [
        { label: 'Privacy Manifesto & Cookies', url: '/privacy-policy' },
        { label: 'Terms of Haute Couture Sale', url: '/terms' },
        { label: 'FAQ & Client Rights', url: '/faq' },
        { label: 'Staff Command Center', url: '/admin/login' },
      ],
    },
  ];

  for (let i = 0; i < footerSections.length; i++) {
    const fs = footerSections[i];
    const createdSection = await client.footerSection.create({
      data: { title: fs.title, displayOrder: i + 1, isActive: true },
    });
    for (let j = 0; j < fs.items.length; j++) {
      await client.footerMenuItem.create({
        data: {
          sectionId: createdSection.id,
          label: fs.items[j].label,
          url: fs.items[j].url,
          displayOrder: j + 1,
        },
      });
    }
  }

  // 4 Editorial Content Articles
  await client.editorialContent.createMany({
    data: [
      {
        title: 'The Art of Everyday Dressing',
        slug: 'the-art-of-everyday-dressing',
        category: 'Atelier Journal',
        content: 'True sartorial elegance is not reserved for gala openings. It lives in the weight of a double-faced wool coat as you navigate the morning breeze, the fluid drape of silk against skin, and the quiet dignity of a silhouette engineered without superfluous adornment.',
        coverImageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80',
        author: 'Marcus Sterling, Atelier Director',
        isPublished: true,
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
        seoTitle: 'The Art of Everyday Dressing — FORME Journal',
        seoDescription: 'An editorial essay exploring modern sartorial minimalism and noble fabric selection.',
      },
      {
        title: 'A Study in Modern Silhouettes',
        slug: 'a-study-in-modern-silhouettes',
        category: 'Sartorial Studies',
        content: 'From the sculpted waist of our Biella blazers to the languid ease of our silk slip dresses, each piece is conceived as an architectural dialogue between structure and organic movement.',
        coverImageUrl: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1200&q=80',
        author: 'Eleonora Ross, Master Patternmaker',
        isPublished: true,
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20),
        seoTitle: 'A Study in Modern Silhouettes — FORME',
        seoDescription: 'An exploration of architectural tailoring and fluid draping in contemporary womenswear.',
      },
      {
        title: 'The New Language of Minimalism',
        slug: 'the-new-language-of-minimalism',
        category: 'Atelier Journal',
        content: 'Minimalism is often misunderstood as the absence of detail. In truth, it is the uncompromising perfection of every visible element: the pick-stitch along the lapel, the density of a horn button, the grain of Tuscan calfskin.',
        coverImageUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=80',
        author: 'FORME Editorial Board',
        isPublished: true,
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
        seoTitle: 'The New Language of Minimalism — FORME Journal',
        seoDescription: 'Why tactile restraint and artisanal textile honesty define the new era of fashion luxury.',
      },
      {
        title: 'Building a Timeless Wardrobe',
        slug: 'building-a-timeless-wardrobe',
        category: 'Wardrobe Architecture',
        content: 'A thoughtful wardrobe does not require an abundance of pieces; it requires garments of unimpeachable integrity that converse effortlessly with one another through seasons and decades.',
        coverImageUrl: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1200&q=80',
        author: 'FORME Concierge Advisory',
        isPublished: true,
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
        seoTitle: 'Building a Timeless Wardrobe — FORME Guide',
        seoDescription: 'Curatorial guidance on investing in permanent sartorial foundations.',
      },
    ],
  });

  // Exactly 12 Newsletter Subscriptions
  const newsletterEmails = [
    { email: 'patron.claire@paris-atelier.com', active: true, src: 'FOOTER' },
    { email: 'sartorial.collector@milan-couture.it', active: true, src: 'CHECKOUT' },
    { email: 'genevieve.vance@forme-patron.com', active: true, src: 'FOOTER' },
    { email: 'aarav.singhania@forme-patron.com', active: true, src: 'POPUP' },
    { email: 'priya.sharma@forme-patron.com', active: true, src: 'FOOTER' },
    { email: 'rohan.mehta@forme-patron.com', active: true, src: 'CHECKOUT' },
    { email: 'ananya.iyer@forme-patron.com', active: true, src: 'FOOTER' },
    { email: 'vikram.rao@forme-patron.com', active: true, src: 'POPUP' },
    { email: 'meera.kapoor@forme-patron.com', active: true, src: 'FOOTER' },
    { email: 'kabir.nair@forme-patron.com', active: true, src: 'CHECKOUT' },
    { email: 'archived.patron1@historic-mail.com', active: false, src: 'FOOTER' },
    { email: 'archived.patron2@historic-mail.com', active: false, src: 'POPUP' },
  ];

  for (const n of newsletterEmails) {
    await client.newsletterSubscription.create({
      data: {
        email: n.email,
        isActive: n.active,
        source: n.src,
        subscribedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
        unsubscribedAt: n.active ? null : new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
      },
    });
  }

  return { banners };
}

// ============================================================================
// 9. INVENTORY MANAGEMENT (2 LOCATIONS, LOGS & MOVEMENTS)
// ============================================================================
async function seedInventory(client = prisma, variants, admin) {
  console.log('\n[FORME SEED] 8/12 Seeding 2 Inventory Locations, Baseline Logs & Movements...');

  const locCentral = await client.inventoryLocation.create({
    data: {
      name: 'Central Atelier Warehouse',
      code: 'WH-MAIN',
      addressLine1: 'Plot 42, Bandra-Kurla Complex Fashion Corridor',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400051',
      country: 'India',
      isActive: true,
    },
  });

  const locAhm = await client.inventoryLocation.create({
    data: {
      name: 'FORME Ahmedabad Fulfilment Centre',
      code: 'WH-AHM',
      addressLine1: 'Sarkhej-Gandhinagar Highway Logistics Park',
      city: 'Ahmedabad',
      state: 'Gujarat',
      postalCode: '382421',
      country: 'India',
      isActive: true,
    },
  });

  // Create baseline stock movements and inventory logs for variants
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const initialQty = v.stockQuantity + 15;
    const loc = i % 2 === 0 ? locCentral : locAhm;

    await client.stockMovement.create({
      data: {
        variantId: v.id,
        locationId: loc.id,
        type: StockMovementType.PURCHASE_RECEIPT,
        quantity: initialQty,
        balanceAfter: initialQty,
        costPerUnit: toDec(950),
        notes: 'Initial atelier production receipt from master weaving mill',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120),
      },
    });

    await client.inventoryLog.create({
      data: {
        variantId: v.id,
        locationId: loc.id,
        previousStock: 0,
        newStock: initialQty,
        changeQuantity: initialQty,
        reason: 'Master atelier initial production batch intake',
        referenceType: 'SHIPMENT',
        referenceId: `MILL-IN-${v.sku}`,
        adminUserId: admin.id,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120),
      },
    });
  }

  return { locCentral, locAhm };
}

// ============================================================================
// 10. ORDERS (EXACTLY 50), ITEMS, PAYMENTS, SHIPMENTS & REFUNDS
// ============================================================================
async function seedOrdersAndCommerce(client = prisma, users, addresses, products, variants, coupons, offers, flashSale, locations, admin) {
  console.log('\n[FORME SEED] 9/12 Seeding Exactly 50 Orders with Mathematically Reconciled Financials...');

  const createdOrders = [];
  const deliveredOrders = [];

  // Order status distribution across 50 orders:
  // 32 DELIVERED, 5 SHIPPED, 5 PROCESSING/CONFIRMED/PACKED, 3 PLACED/PENDING, 3 CANCELLED, 2 RETURNED
  const statusSchedule = [
    // 0..31: 32 DELIVERED
    ...Array(32).fill(OrderStatus.DELIVERED),
    // 32..36: 5 SHIPPED
    ...Array(5).fill(OrderStatus.SHIPPED),
    // 37..41: 5 PROCESSING / CONFIRMED / PACKED
    OrderStatus.PACKED, OrderStatus.PROCESSING, OrderStatus.CONFIRMED, OrderStatus.CONFIRMED, OrderStatus.PROCESSING,
    // 42..44: 3 PLACED / PENDING
    OrderStatus.PLACED, OrderStatus.PLACED, OrderStatus.PENDING,
    // 45..47: 3 CANCELLED
    OrderStatus.CANCELLED, OrderStatus.CANCELLED, OrderStatus.CANCELLED,
    // 48..49: 2 RETURNED / RETURN_REQUESTED
    OrderStatus.RETURNED, OrderStatus.RETURN_REQUESTED,
  ];

  // Payment methods: 15 COD, 35 Razorpay (Cards, UPI, Netbanking)
  const paymentMethods = [
    PaymentMethod.RAZORPAY_CARD,
    PaymentMethod.RAZORPAY_UPI,
    PaymentMethod.COD,
    PaymentMethod.RAZORPAY_NETBANKING,
    PaymentMethod.RAZORPAY_CARD,
  ];

  let orderItemCountTotal = 0;

  for (let oIdx = 0; oIdx < 50; oIdx++) {
    const customer = users[oIdx % users.length];
    const customerAddresses = addresses.filter((a) => a.userId === customer.id);
    const shippingAddr = customerAddresses[0] || addresses[0];
    const billingAddr = customerAddresses[1] || shippingAddr;

    const targetStatus = statusSchedule[oIdx];
    const pMethod = paymentMethods[oIdx % paymentMethods.length];

    // Order date spread over the last 150 days chronologically
    const placedDaysAgo = 150 - oIdx * 2.8;
    const placedDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * Math.max(1, placedDaysAgo));
    const orderNumber = `FRM-2026${String(placedDate.getMonth() + 1).padStart(2, '0')}${String(placedDate.getDate()).padStart(2, '0')}-${String(1001 + oIdx)}`;

    // Select 2 or 3 distinct items per order
    const itemsCount = 2 + (oIdx % 2); // 2 or 3 items
    const selectedVariants = [];
    for (let k = 0; k < itemsCount; k++) {
      const v = variants[(oIdx * 2 + k * 7) % variants.length];
      if (!selectedVariants.some((sv) => sv.id === v.id)) {
        selectedVariants.push(v);
      }
    }

    // Determine if coupon was applied
    const applyCoupon = oIdx % 4 === 0;
    const coupon = applyCoupon ? coupons[oIdx % coupons.length] : null;

    // Mathematical Pricing Engine calculation
    let mrpSubtotal = new Decimal(0);
    let itemSubtotal = new Decimal(0);
    let offerDiscount = new Decimal(0);
    let flashSaleDiscount = new Decimal(0);

    const lineItemsData = [];

    for (const v of selectedVariants) {
      const prod = products.find((p) => p.id === v.productId);
      const qty = 1 + (oIdx % 2 === 0 && selectedVariants.indexOf(v) === 0 ? 1 : 0); // 1 or 2
      const unitSelling = toDec(prod.sellingPrice);
      const unitMrp = prod.compareAtPrice ? toDec(prod.compareAtPrice) : unitSelling;

      const lineMrp = mul(unitMrp, qty);
      const lineSelling = mul(unitSelling, qty);

      mrpSubtotal = add(mrpSubtotal, lineMrp);
      itemSubtotal = add(itemSubtotal, lineSelling);

      // Check if item qualifies for offer
      let lineOffer = new Decimal(0);
      let lineFlash = new Decimal(0);

      if (oIdx % 5 === 1) {
        // Sample offer applied: 10%
        lineOffer = calcPct(lineSelling, 10);
        offerDiscount = add(offerDiscount, lineOffer);
      } else if (oIdx % 6 === 2) {
        // Sample flash sale applied: 15%
        lineFlash = calcPct(lineSelling, 15);
        flashSaleDiscount = add(flashSaleDiscount, lineFlash);
      }

      lineItemsData.push({
        variant: v,
        product: prod,
        quantity: qty,
        unitSellingPrice: unitSelling,
        compareAtPrice: unitMrp,
        lineSelling,
        lineMrp,
        lineOffer,
        lineFlash,
        lineCoupon: new Decimal(0),
        taxableLine: sub(lineSelling, add(lineOffer, lineFlash)),
        lineTax: new Decimal(0),
        finalItemAmount: new Decimal(0),
      });
    }

    // Calculate coupon discount if applied
    let couponDiscount = new Decimal(0);
    if (coupon) {
      const postPromotionalSubtotal = lineItemsData.reduce((acc, it) => add(acc, it.taxableLine), new Decimal(0));
      if (postPromotionalSubtotal.greaterThanOrEqualTo(toDec(coupon.minPurchaseAmount))) {
        if (coupon.discountType === DiscountType.PERCENTAGE) {
          let rawDiscount = calcPct(postPromotionalSubtotal, coupon.discountValue);
          if (coupon.maxDiscountAmount) rawDiscount = Decimal.min(rawDiscount, toDec(coupon.maxDiscountAmount));
          couponDiscount = round2(rawDiscount);
        } else {
          couponDiscount = Decimal.min(toDec(coupon.discountValue), postPromotionalSubtotal);
        }
      }
    }

    // Allocate coupon discount proportionally
    let couponRemaining = couponDiscount;
    for (let li = 0; li < lineItemsData.length; li++) {
      const it = lineItemsData[li];
      if (li === lineItemsData.length - 1) {
        it.lineCoupon = couponRemaining;
      } else {
        const share = couponDiscount.isZero() ? new Decimal(0) : round2(mul(couponDiscount, div(it.taxableLine, itemSubtotal)));
        it.lineCoupon = share;
        couponRemaining = sub(couponRemaining, share);
      }
      it.taxableLine = Decimal.max(new Decimal(0), sub(it.taxableLine, it.lineCoupon));
    }

    const taxableSubtotal = lineItemsData.reduce((acc, it) => add(acc, it.taxableLine), new Decimal(0));

    // GST Tax calculation: 12% standard luxury rate
    // Intra-state (MH) = CGST 6% + SGST 6%, Inter-state = IGST 12%
    const isInterState = shippingAddr.state !== 'Maharashtra';
    const taxRate = 12.0;
    const totalTax = round2(calcPct(taxableSubtotal, taxRate));

    // Proportionally allocate line tax
    let taxRemaining = totalTax;
    for (let li = 0; li < lineItemsData.length; li++) {
      const it = lineItemsData[li];
      if (li === lineItemsData.length - 1) {
        it.lineTax = taxRemaining;
      } else {
        const share = totalTax.isZero() ? new Decimal(0) : round2(mul(totalTax, div(it.taxableLine, taxableSubtotal)));
        it.lineTax = share;
        taxRemaining = sub(taxRemaining, share);
      }
      it.finalItemAmount = round2(add(it.taxableLine, it.lineTax));
    }

    // Shipping fee rule: Free over ₹5,000, else ₹250
    const shipping = taxableSubtotal.greaterThanOrEqualTo(toDec(5000)) ? new Decimal(0) : toDec(250);

    // Reconciled Grand Total: sum(items.finalItemAmount) + shipping
    const sumFinalItems = lineItemsData.reduce((acc, it) => add(acc, it.finalItemAmount), new Decimal(0));
    const grandTotal = round2(add(sumFinalItems, shipping));

    // Payment status consistency
    let payStatus = PaymentStatus.CAPTURED;
    if (pMethod === PaymentMethod.COD) {
      payStatus = targetStatus === OrderStatus.DELIVERED ? PaymentStatus.CAPTURED : PaymentStatus.PENDING;
    } else if (targetStatus === OrderStatus.CANCELLED) {
      payStatus = PaymentStatus.REFUNDED;
    }

    // Snapshots
    const addrJson = {
      recipientName: shippingAddr.recipientName,
      phone: shippingAddr.phone,
      addressLine1: shippingAddr.addressLine1,
      addressLine2: shippingAddr.addressLine2 || null,
      landmark: shippingAddr.landmark || null,
      city: shippingAddr.city,
      state: shippingAddr.state,
      postalCode: shippingAddr.postalCode,
      country: shippingAddr.country,
    };

    const pricingBreakdown = {
      mrpSubtotal: mrpSubtotal.toFixed(2),
      itemSubtotal: itemSubtotal.toFixed(2),
      productDiscount: sub(mrpSubtotal, itemSubtotal).toFixed(2),
      offerDiscount: offerDiscount.toFixed(2),
      flashSaleDiscount: flashSaleDiscount.toFixed(2),
      couponDiscount: couponDiscount.toFixed(2),
      taxableSubtotal: taxableSubtotal.toFixed(2),
      taxRate: '12%',
      taxType: isInterState ? 'IGST' : 'CGST+SGST',
      tax: totalTax.toFixed(2),
      shipping: shipping.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      currency: 'INR',
    };

    // Create Order
    const order = await client.order.create({
      data: {
        orderNumber,
        userId: customer.id,
        shippingAddressSnapshot: addrJson,
        billingAddressSnapshot: addrJson,
        itemSubtotal: round2(itemSubtotal),
        mrpSubtotal: round2(mrpSubtotal),
        offerDiscount: round2(offerDiscount),
        flashSaleDiscount: round2(flashSaleDiscount),
        couponDiscount: round2(couponDiscount),
        tax: totalTax,
        shipping,
        grandTotal,
        currency: 'INR',
        paymentMethod: pMethod,
        paymentStatus: payStatus,
        orderStatus: targetStatus,
        couponId: coupon ? coupon.id : null,
        appliedCouponSnapshot: coupon ? { code: coupon.code, discount: couponDiscount.toFixed(2) } : null,
        appliedPromotionSnapshot: offerDiscount.greaterThan(0) ? { offerName: 'Atelier Seasonal Privilege', discount: offerDiscount.toFixed(2) } : null,
        pricingBreakdown,
        customerNotes: oIdx % 5 === 0 ? 'Please wrap in archival presentation tissue.' : null,
        placedAt: placedDate,
        updatedAt: new Date(placedDate.getTime() + 1000 * 60 * 60 * 24 * 2),
        cancelledAt: targetStatus === OrderStatus.CANCELLED ? new Date(placedDate.getTime() + 1000 * 60 * 60 * 4) : null,
      },
    });

    createdOrders.push(order);
    if (targetStatus === OrderStatus.DELIVERED) {
      deliveredOrders.push(order);
    }

    // Normalized OrderAddressSnapshot
    await client.orderAddressSnapshot.create({
      data: {
        orderId: order.id,
        recipientName: shippingAddr.recipientName,
        phone: shippingAddr.phone,
        addressLine1: shippingAddr.addressLine1,
        addressLine2: shippingAddr.addressLine2 || null,
        landmark: shippingAddr.landmark || null,
        city: shippingAddr.city,
        state: shippingAddr.state,
        postalCode: shippingAddr.postalCode,
        country: shippingAddr.country,
      },
    });

    // Create OrderItems
    for (const lit of lineItemsData) {
      orderItemCountTotal++;
      await client.orderItem.create({
        data: {
          orderId: order.id,
          productId: lit.product.id,
          variantId: lit.variant.id,
          productName: lit.product.name,
          productSlug: lit.product.slug,
          sku: lit.variant.sku,
          variantDetails: {
            size: lit.variant.size,
            colorName: lit.variant.colorName,
            colorHex: lit.variant.colorHex,
            fabric: lit.product.fabric,
            fit: lit.product.fit,
          },
          selectedSize: lit.variant.size,
          selectedColor: lit.variant.colorName,
          productImage: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
          quantity: lit.quantity,
          unitSellingPrice: round2(lit.unitSellingPrice),
          compareAtPrice: round2(lit.compareAtPrice),
          applicableDiscount: round2(add(lit.lineOffer, lit.lineFlash, lit.lineCoupon)),
          tax: lit.lineTax,
          finalItemAmount: lit.finalItemAmount,
          createdAt: placedDate,
        },
      });

      // Stock adjustment log for fulfilled orders
      if ([OrderStatus.SHIPPED, OrderStatus.DELIVERED].includes(targetStatus)) {
        await client.stockMovement.create({
          data: {
            variantId: lit.variant.id,
            locationId: locations.locCentral.id,
            type: StockMovementType.ORDER_FULFILLMENT,
            quantity: -lit.quantity,
            balanceAfter: lit.variant.stockQuantity - lit.quantity,
            notes: `Fulfillment for order ${order.orderNumber}`,
            createdAt: placedDate,
          },
        });
      }
    }

    // Payment record
    const rzpOrderId = pMethod !== PaymentMethod.COD ? `order_seed_${order.id.replace(/-/g, '').slice(0, 14)}` : null;
    const rzpPaymentId = payStatus === PaymentStatus.CAPTURED && pMethod !== PaymentMethod.COD ? `pay_seed_${order.id.replace(/-/g, '').slice(0, 14)}` : null;

    const payment = await client.payment.create({
      data: {
        orderId: order.id,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId,
        razorpaySignature: rzpPaymentId ? 'sig_seed_simulated_hmac256' : null,
        amount: grandTotal,
        currency: 'INR',
        method: pMethod,
        status: payStatus,
        capturedAt: payStatus === PaymentStatus.CAPTURED ? new Date(placedDate.getTime() + 1000 * 60 * 3) : null,
        failureReason: targetStatus === OrderStatus.CANCELLED && pMethod !== PaymentMethod.COD ? 'User initiated cancellation before shipment.' : null,
        gatewayResponse: { simulated: true, environment: 'development', capturedAmount: grandTotal.toFixed(2) },
        createdAt: placedDate,
      },
    });

    // Refund records for cancelled / returned orders
    if (targetStatus === OrderStatus.CANCELLED && pMethod !== PaymentMethod.COD) {
      await client.refund.create({
        data: {
          orderId: order.id,
          paymentId: payment.id,
          razorpayRefundId: `rfnd_seed_${order.id.replace(/-/g, '').slice(0, 14)}`,
          amount: grandTotal,
          currency: 'INR',
          status: RefundStatus.PROCESSED,
          reason: 'Pre-dispatch order cancellation requested by customer.',
          adminUserId: admin.id,
          processedAt: new Date(placedDate.getTime() + 1000 * 60 * 60 * 24),
          createdAt: placedDate,
        },
      });
    } else if (targetStatus === OrderStatus.RETURNED) {
      await client.refund.create({
        data: {
          orderId: order.id,
          paymentId: payment.id,
          razorpayRefundId: `rfnd_seed_ret_${order.id.replace(/-/g, '').slice(0, 12)}`,
          amount: grandTotal,
          currency: 'INR',
          status: RefundStatus.PROCESSED,
          reason: 'Garment returned within 14-day archival consideration window.',
          adminUserId: admin.id,
          processedAt: new Date(placedDate.getTime() + 1000 * 60 * 60 * 24 * 7),
          createdAt: placedDate,
        },
      });
    }

    // Shipments for SHIPPED and DELIVERED orders
    if ([OrderStatus.SHIPPED, OrderStatus.DELIVERED].includes(targetStatus)) {
      const carriers = ['Delhivery Express', 'Blue Dart Apex', 'DTDC Prime'];
      const carrier = carriers[oIdx % carriers.length];
      const trackingNumber = `FRM-AWB-${String(20260000 + oIdx)}`;
      const shippedDate = new Date(placedDate.getTime() + 1000 * 60 * 60 * 24);
      const deliveredDate = targetStatus === OrderStatus.DELIVERED ? new Date(placedDate.getTime() + 1000 * 60 * 60 * 72) : null;

      await client.shipment.create({
        data: {
          orderId: order.id,
          carrier,
          trackingNumber,
          trackingUrl: `https://track.forme-atelier.com/${trackingNumber}`,
          status: targetStatus === OrderStatus.DELIVERED ? ShipmentStatus.DELIVERED : ShipmentStatus.IN_TRANSIT,
          shippedAt: shippedDate,
          estimatedDeliveryAt: new Date(placedDate.getTime() + 1000 * 60 * 60 * 72),
          deliveredAt: deliveredDate,
          createdAt: shippedDate,
        },
      });
    }

    // OrderStatusHistory audit trail
    await client.orderStatusHistory.create({
      data: {
        orderId: order.id,
        previousStatus: null,
        newStatus: OrderStatus.PLACED,
        comment: 'Order registered successfully into atelier queue.',
        changedByUserId: null,
        createdAt: placedDate,
      },
    });

    if ([OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.PACKED, OrderStatus.SHIPPED, OrderStatus.DELIVERED].includes(targetStatus)) {
      await client.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: OrderStatus.PLACED,
          newStatus: OrderStatus.CONFIRMED,
          comment: 'Payment verified and textile cut allocated.',
          changedByUserId: admin.id,
          createdAt: new Date(placedDate.getTime() + 1000 * 60 * 60 * 2),
        },
      });
    }

    if ([OrderStatus.SHIPPED, OrderStatus.DELIVERED].includes(targetStatus)) {
      await client.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: OrderStatus.CONFIRMED,
          newStatus: OrderStatus.SHIPPED,
          comment: 'Consignment packaged in archival casing and handed over to courier.',
          changedByUserId: admin.id,
          createdAt: new Date(placedDate.getTime() + 1000 * 60 * 60 * 24),
        },
      });
    }

    if (targetStatus === OrderStatus.DELIVERED) {
      await client.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: OrderStatus.SHIPPED,
          newStatus: OrderStatus.DELIVERED,
          comment: 'Handover complete. Signature captured by courier.',
          changedByUserId: null,
          createdAt: new Date(placedDate.getTime() + 1000 * 60 * 60 * 72),
        },
      });
    }

    // PromotionUsage records
    if (coupon) {
      await client.promotionUsage.create({
        data: {
          userId: customer.id,
          orderId: order.id,
          couponId: coupon.id,
          discountAmountCaptured: couponDiscount,
          usedAt: placedDate,
        },
      });
    }

    if (offerDiscount.greaterThan(0)) {
      await client.promotionUsage.create({
        data: {
          userId: customer.id,
          orderId: order.id,
          offerId: offers[oIdx % offers.length].id,
          discountAmountCaptured: offerDiscount,
          usedAt: placedDate,
        },
      });
    }
  }

  console.log(`[FORME SEED] 50 Orders created with ${orderItemCountTotal} line items.`);
  return { orders: createdOrders, deliveredOrders };
}

// ============================================================================
// 11. SHOPPING DATA & REVIEWS (30 REVIEWS WITH VERIFIED PURCHASES)
// ============================================================================
async function seedShoppingAndReviews(client = prisma, users, products, variants, deliveredOrders) {
  console.log('\n[FORME SEED] 10/12 Seeding 10 Carts, 10 Wishlists, and Exactly 30 Reviews with Verified Purchases...');

  // 10 Carts
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const cart = await client.cart.create({
      data: {
        userId: u.id,
        couponCode: i === 0 ? 'WELCOME10' : null,
      },
    });

    // 2 items per cart = 20 CartItems total
    const v1 = variants[(i * 3) % variants.length];
    const v2 = variants[(i * 3 + 1) % variants.length];
    await client.cartItem.createMany({
      data: [
        { cartId: cart.id, variantId: v1.id, quantity: 1 },
        { cartId: cart.id, variantId: v2.id, quantity: 2 },
      ],
      skipDuplicates: true,
    });
  }

  // 10 Wishlists with 25 items total
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const wishlist = await client.wishlist.create({
      data: { userId: u.id },
    });

    // 2 to 3 items per wishlist
    const p1 = products[(i * 2) % products.length];
    const p2 = products[(i * 2 + 1) % products.length];
    const p3 = products[(i * 2 + 2) % products.length];

    await client.wishlistItem.createMany({
      data: [
        { wishlistId: wishlist.id, productId: p1.id },
        { wishlistId: wishlist.id, productId: p2.id },
        ...(i < 5 ? [{ wishlistId: wishlist.id, productId: p3.id }] : []),
      ],
      skipDuplicates: true,
    });
  }

  // 30 Reviews (with verified purchase guarantee based on delivered orders)
  const reviewContentPool = [
    { rating: 5, head: 'Exquisite Drape & Hand-Feel', text: 'The natural fiber weave holds structure effortlessly throughout the day. Truly exceptional tailoring.' },
    { rating: 5, head: 'Flawless Architecture', text: 'The shoulder roping and pick stitching surpass many established luxury houses. A permanent staple in my rotation.' },
    { rating: 4, head: 'Luxurious Weight and Fabric', text: 'Fabric density is superb. Sizing runs impeccably true to the sartorial matrix.' },
    { rating: 5, head: 'Understated Couture Elegance', text: 'Arrived packaged in acid-free archival casing with solid cedar hangers. The silk lining breathes beautifully.' },
    { rating: 4, head: 'Modern Proportions at Their Best', text: 'The high-waisted rise and fluid pleats create a monumental silhouette. Highly recommended.' },
  ];

  const createdReviews = [];

  // Map delivered order items to guarantee authentic verified purchases
  const deliveredPurchases = [];
  for (const o of deliveredOrders) {
    const oItems = await client.orderItem.findMany({ where: { orderId: o.id } });
    for (const it of oItems) {
      deliveredPurchases.push({ userId: o.userId, productId: it.productId });
    }
  }

  for (let rIdx = 0; rIdx < 30; rIdx++) {
    const template = reviewContentPool[rIdx % reviewContentPool.length];
    const prod = products[rIdx % products.length];

    // Check if this user actually purchased this product in a delivered order
    const purchase = deliveredPurchases.find((dp) => dp.productId === prod.id);
    const userId = purchase ? purchase.userId : users[rIdx % users.length].id;
    const isVerified = Boolean(purchase);

    const review = await client.review.create({
      data: {
        productId: prod.id,
        userId,
        rating: template.rating,
        headline: template.head,
        content: `${template.text} Crafted with remarkable care for the modern silhouette.`,
        isVerifiedPurchase: isVerified,
        isApproved: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * (30 - rIdx)),
      },
    });

    createdReviews.push(review);

    // 12 ReviewMedia samples
    if (rIdx < 12) {
      await client.reviewMedia.create({
        data: {
          reviewId: review.id,
          mediaType: MediaType.IMAGE,
          publicId: `forme/reviews/review-${review.id}`,
          url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
          displayOrder: 1,
        },
      });
    }
  }

  // 30 RecentlyViewedProduct records
  for (let i = 0; i < 30; i++) {
    const u = users[i % users.length];
    const p = products[i % products.length];
    await client.recentlyViewedProduct.create({
      data: {
        userId: u.id,
        productId: p.id,
        viewedAt: new Date(Date.now() - 1000 * 60 * 60 * (i * 4 + 1)),
      },
    });
  }

  // 18 SearchQueryLogs
  const fashionQueries = [
    'cashmere overcoat', 'mulberry silk slip dress', 'biella wool blazer', 'tailored wide leg trousers',
    'normandy linen twinset', 'selvedge straight denim', 'storm gabardine trench', 'como silk twill scarf',
    'tuscan calfskin tote', 'minimalist crewneck tee', 'architectural wrap skirt', 'cocktail velvet gown',
    'fisherman lambswool knit', 'poplin oversized shirt', 'cigarette suiting pant', 'mercerized giza tee',
    'evening tuxedo jacket', 'merino cardigan set'
  ];

  for (let i = 0; i < fashionQueries.length; i++) {
    await client.searchQueryLog.create({
      data: {
        query: fashionQueries[i],
        count: 45 - i * 2,
        resultsCount: 8 + (i % 4),
      },
    });
  }

  return { reviews: createdReviews };
}

// ============================================================================
// 12. NOTIFICATIONS, EMAIL LOGS & ADMIN AUDIT LOGS
// ============================================================================
async function seedNotificationsAndEmailLogs(client = prisma, users, orders, admin) {
  console.log('\n[FORME SEED] 11/12 Seeding Notifications, Email Delivery Logs, and 18 Admin Audit Logs...');

  // Notifications for customers
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const customerOrders = orders.filter((o) => o.userId === u.id);
    const firstOrder = customerOrders[0];

    await client.notification.createMany({
      data: [
        {
          userId: u.id,
          title: 'Order Artisan Confirmation',
          message: firstOrder ? `Your sartorial acquisition ${firstOrder.orderNumber} has entered master tailoring production.` : 'Welcome to your private client space.',
          type: 'ORDER_UPDATE',
          actionUrl: firstOrder ? `/account/orders/${firstOrder.id}` : '/account/orders',
          isRead: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
        },
        {
          userId: u.id,
          title: 'White-Glove Consignment Dispatched',
          message: firstOrder ? `Consignment ${firstOrder.orderNumber} is in transit via express courier.` : 'Your order is on the way.',
          type: 'ORDER_UPDATE',
          actionUrl: firstOrder ? `/track-order/${firstOrder.orderNumber}` : '/track-order',
          isRead: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
        },
        {
          userId: u.id,
          title: 'Private Runway Capsule Invitation',
          message: 'The House of FORME invites you to explore the Autumn/Winter Haute Couture drop.',
          type: 'PROMOTION',
          actionUrl: '/collections/the-signature-collection',
          isRead: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
        },
      ],
    });
  }

  // 25 EmailDeliveryLogs
  for (let i = 0; i < 25; i++) {
    const u = users[i % users.length];
    const o = orders[i % orders.length];
    await client.emailDeliveryLog.create({
      data: {
        recipientEmail: u.email,
        subject: `Transmission: Order Status for ${o.orderNumber}`,
        templateName: i % 2 === 0 ? 'order-confirmation' : 'order-shipped',
        provider: i % 3 === 0 ? 'BREVO' : 'NODEMAILER',
        messageId: `msg-seed-${Date.now()}-${i}`,
        status: EmailDeliveryStatus.DELIVERED,
        attempts: 1,
        userId: u.id,
        orderId: o.id,
        metadata: { simulated: true, environment: 'development' },
        idempotencyKey: `idemp-log-${o.id}-${i}`,
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * (i * 8 + 1)),
      },
    });
  }

  // Exactly 18 AdminAuditLogs referencing the Admin user
  const auditActions = [
    { act: 'PRODUCT_CREATE', entity: 'Product', id: 'prod-001', details: { name: 'Double-Breasted Biella Wool Blazer', price: 8999 } },
    { act: 'PRODUCT_UPDATE', entity: 'Product', id: 'prod-002', details: { changedField: 'sellingPrice', old: 8999, new: 9499 } },
    { act: 'PRICE_UPDATE', entity: 'ProductVariant', id: 'var-001', details: { sku: 'FRM-DRS-001-M-BLK', adjustment: 'Regular season' } },
    { act: 'CATEGORY_CREATE', entity: 'Category', id: 'cat-001', details: { name: 'Dresses', slug: 'dresses' } },
    { act: 'COLLECTION_PUBLISH', entity: 'Collection', id: 'col-001', details: { slug: 'the-essentials', status: 'PUBLISHED' } },
    { act: 'INVENTORY_ADJUSTMENT', entity: 'InventoryLocation', id: 'WH-MAIN', details: { intakeUnits: 250, warehouse: 'Central Atelier' } },
    { act: 'COUPON_CREATE', entity: 'Coupon', id: 'coup-001', details: { code: 'WELCOME10', discount: '10%' } },
    { act: 'OFFER_CREATE', entity: 'Offer', id: 'off-001', details: { slug: 'new-season-launch', discount: '15%' } },
    { act: 'BANNER_PUBLISH', entity: 'Banner', id: 'ban-001', details: { title: 'New Season — New Perspectives' } },
    { act: 'ORDER_STATUS_UPDATE', entity: 'Order', id: orders[0].id, details: { from: 'CONFIRMED', to: 'SHIPPED', courier: 'Delhivery' } },
    { act: 'REFUND_ISSUED', entity: 'Refund', id: 'rfnd-001', details: { amount: 32000, reason: 'Customer cancellation request' } },
    { act: 'STORE_SETTINGS_UPDATE', entity: 'StoreSetting', id: 'free_shipping_threshold', details: { threshold: 5000 } },
    { act: 'STOCK_RESTOCK', entity: 'StockMovement', id: 'sm-001', details: { variant: 'FRM-JCK-001-M-BLK', added: 50 } },
    { act: 'REVIEW_MODERATION', entity: 'Review', id: 'rev-001', details: { action: 'APPROVED', isVerified: true } },
    { act: 'TAX_SETTING_UPDATE', entity: 'TaxSetting', id: 'MH', details: { igst: '12%', status: 'ACTIVE' } },
    { act: 'HOMEPAGE_SECTION_REORDER', entity: 'HomePageSection', id: 'sec-001', details: { newOrder: [1, 2, 3, 4, 5, 6, 7] } },
    { act: 'FLASH_SALE_SCHEDULE', entity: 'FlashSale', id: 'forme-midnight-fashion-event', details: { status: 'ACTIVE', products: 6 } },
    { act: 'CURRENCY_RATE_AUDIT', entity: 'CurrencySetting', id: 'INR', details: { default: true, baseRate: 1.0 } },
  ];

  for (let i = 0; i < auditActions.length; i++) {
    const a = auditActions[i];
    await client.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        action: a.act,
        entityType: a.entity,
        entityId: a.id,
        details: a.details,
        ipAddress: '103.21.244.1',
        userAgent: 'FORME-Console/2.0 (macOS Director Workstation)',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * (i * 12 + 2)),
      },
    });
  }
}

// ============================================================================
// MASTER SEED ORCHESTRATION & VALIDATION
// ============================================================================
export async function seedDatabase(client = prisma) {
  const startTime = Date.now();
  console.log('================================================================');
  console.log('   FORME MASTER DATABASE SEEDING ENGINE — PRODUCTION INTEGRITY');
  console.log('   Brand Motto: Designed to Be Worn. Made to Be Remembered.');
  console.log('================================================================');

  // Step 1: Clear previous records
  await clearDatabase(client);

  // Step 2: Configurations
  await seedConfiguration(client);

  // Step 3: Users, Addresses, Auth records
  const { admin, customers, addresses } = await seedUsersAndAddresses(client);

  // Step 4: Categories & Collections
  const { categories, collections } = await seedCatalog(client);

  // Step 5: Attributes & Values
  const attributeMap = await seedAttributes(client);

  // Step 6: Products, Variants & Media
  const { products, variants, media } = await seedProductsVariantsMedia(client, categories, collections, attributeMap);

  // Step 7: Promotions (Coupons, Offers, Flash Sale)
  const { coupons, offers, flashSale } = await seedPromotions(client, products, categories, collections, variants);

  // Step 8: CMS (Banners, Announcements, Sections, Navigation, Editorials, Newsletters)
  const { banners } = await seedCMS(client, categories, collections, products);

  // Step 9: Inventory (Locations, Baseline Logs, Movements)
  const locations = await seedInventory(client, variants, admin);

  // Step 10: Orders & Commerce (Exactly 50 Orders with Math Reconciliation)
  const { orders, deliveredOrders } = await seedOrdersAndCommerce(client, customers, addresses, products, variants, coupons, offers, flashSale, locations, admin);

  // Step 11: Shopping & Reviews
  const { reviews } = await seedShoppingAndReviews(client, customers, products, variants, deliveredOrders);

  // Step 12: Notifications, Email Logs & Admin Audit Logs
  await seedNotificationsAndEmailLogs(client, customers, orders, admin);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n================================================================');
  console.log(`   MASTER SEED COMPLETED SUCCESSFULLY IN ${durationSec}s`);
  console.log('================================================================');
}

// CLI Execution Entry Point
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .catch((err) => {
      console.error('\n[FATAL ERROR] Seeding aborted:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
