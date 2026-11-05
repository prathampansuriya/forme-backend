# FORME Database Seeding & Data Architecture Documentation

> **Brand:** FORME Contemporary Fashion House  
> **Tagline:** Designed to Be Worn. Made to Be Remembered.  
> **Database:** PostgreSQL via Prisma ORM  
> **Environment:** Development & Staging  

---

## 1. Architectural Overview

The FORME seeding engine (`backend/prisma/seed.js`) provides an authoritative, mathematically reconciled, and relationally complete dataset. It guarantees 100% schema coverage across all 65 Prisma models, strictly observing foreign key constraints, enumerated types, and financial accounting identities.

### Key Architectural Pillars:
1. **Safety-Guarded Reset:** Destructive resets are strictly constrained to non-production environments (`NODE_ENV !== 'production'`) and disallow any production connection string signatures.
2. **Deterministic & Repeatable:** Uses structured seeds ensuring identical relation mappings across runs without duplicate constraint errors.
3. **Exact Mathematical Reconciliation:** Every order, discount, tax, item allocation, and grand total reconciles to the exact **0.00 paisa** using the **Hamilton Largest Remainder Algorithm** for fraction distribution.
4. **Authentic Verified Reviews:** A review is flagged with `isVerifiedPurchase: true` if and only if the reviewer has a completed `DELIVERED` order containing the specific product.
5. **High-Fashion Editorial Tone:** Brand narratives, categories, collections, product descriptions, fabrics, and styling cues reflect high-end luxury fashion (Couture, Savile Row tailoring, Italian silk, cashmere, structured outerwear).

---

## 2. Seed Execution & Validation Commands

All commands can be executed from the `backend/` directory or root workspace:

```bash
# Standard seed (will reset and re-seed all tables in sequence)
npm run db:seed

# Explicit reset flag
npm run db:reset-seed

# Independent validation suite (verifies counts, relations & financial math)
npm run db:validate

# Prisma native seed trigger
npx prisma db seed
```

---

## 3. Development Credentials

All passwords are encrypted with `bcrypt` using **12 salt rounds**. Plaintext passwords are never stored in the database.

### Administrative Account
| Role | Email | Password | Phone |
| :--- | :--- | :--- | :--- |
| **SUPER_ADMIN** | `admin@forme.store` | `FormeAdmin@2026!` | `+919876543210` |

### Customer Patron Accounts
All 10 customers have pre-seeded home and work addresses, shopping carts, wishlists, browsing history, and order histories.

| # | Name | Email | Password | Phone | Default City |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 1 | Genevieve Vance | `genevieve.vance@forme-patron.com` | `PatronForme@2026!` | `+919820011001` | Mumbai |
| 2 | Alistair Sterling | `alistair.sterling@forme-patron.com` | `PatronForme@2026!` | `+919810022002` | New Delhi |
| 3 | Seraphina Moreau | `seraphina.moreau@forme-patron.com` | `PatronForme@2026!` | `+919845033003` | Bengaluru |
| 4 | Julian Thorne | `julian.thorne@forme-patron.com` | `PatronForme@2026!` | `+919830044004` | Kolkata |
| 5 | Vivienne Westwood | `vivienne.chen@forme-patron.com` | `PatronForme@2026!` | `+919884055005` | Chennai |
| 6 | Alexander Wright | `alexander.wright@forme-patron.com` | `PatronForme@2026!` | `+919879066006` | Ahmedabad |
| 7 | Camille Laurent | `camille.laurent@forme-patron.com` | `PatronForme@2026!` | `+919890077007` | Pune |
| 8 | Sebastian Croft | `sebastian.croft@forme-patron.com` | `PatronForme@2026!` | `+919840088008` | Hyderabad |
| 9 | Elena Rostova | `elena.rostova@forme-patron.com` | `PatronForme@2026!` | `+919814099009` | Chandigarh |
| 10 | Marcus Holloway | `marcus.holloway@forme-patron.com` | `PatronForme@2026!` | `+919829010010` | Jaipur |

---

## 4. Entity & Model Coverage Matrix

| Category | Model | Target Count | Description |
| :--- | :--- | :---: | :--- |
| **Authentication & Users** | `User` | 11 | 1 Admin + 10 Customers (`authProvider: LOCAL`) |
| | `Address` | 20 | 2 per customer (1 Home default, 1 Work) |
| | `EmailOTP` | 11 | Realistic verification tokens |
| | `PasswordResetToken` | 11 | One-time password reset tokens |
| | `RefreshToken` | 11 | Active multi-device refresh sessions |
| **Catalog Architecture** | `Category` | 10 | Men, Women, Outerwear, Tailoring, Eveningwear, Knitwear, Leather Goods, Footwear, Accessories, Eyewear |
| | `Collection` | 10 | Monochrome Minimalist, Riviera Summer, Savile Modern, Cashmere Heritage, Evening Gala, Sculpted Silhouette, Urban Nomad, High Summer Silk, Architectural Leather, The Noir Edit |
| | `CollectionProduct` | 40+ | Cross-relational catalog mappings |
| | `Attribute` | 8 | Size, Color, Fabric, Fit, Silhouette, Sleeve, Collar, Pattern |
| | `AttributeValue` | 38 | Reusable attribute options with hex codes and slugs |
| | `Product` | 40 | 4 products per category with editorial attributes |
| | `Variant` | 100 | Distributed: 10 with 1, 10 with 2, 10 with 3, 10 with 4 |
| | `ProductMedia` | 140 | 100 variant primary images + 40 product editorial 4K videos |
| **Promotions & Offers** | `Coupon` | 10 | `FIRST10`, `FORMEVIP20`, `SUMMER15`, `LUXURY5000`, `FESTIVE25`, `SUITE1000`, `PRIVILEGE`, `ATELIER15`, `WELCOME500`, `MIDNIGHT` |
| | `Offer` | 6 | Automatic storewide and category tier discounts |
| | `FlashSale` | 1 | "The Midnight Gala — 24hr Exclusive Flash Sale" |
| | `FlashSaleProduct` | 6 | 6 high-demand luxury items at 25%-35% off |
| | `PromotionUsage` | Dynamic | Tracked across seeded patron orders |
| **CMS & Editorial** | `Banner` | 6 | 5 High-res responsive imagery + 1 Editorial 4K video banner |
| | `Announcement` | 4 | Marquee promotional ribbons |
| | `HomePageSection` | 7 | Dynamic layout sections (Hero, Trending, Category Grid, Lookbook, etc.) |
| | `NavigationMenu` | 3 | `main-header`, `mobile-navigation`, `account-navigation` |
| | `NavigationItem` | 22 | Multi-tier navigation trees with child links |
| | `FooterSection` | 4 | About, Client Service, Legal, Editorial |
| | `FooterItem` | 16 | Links to policies, guides, contact and corporate pages |
| | `Editorial` | 4 | Editorial longform articles (The Architecture of Draping, etc.) |
| **Commerce & Shopping** | `Cart` & `CartItem` | 10 / 20 | Persistent shopping baskets for all customers |
| | `Wishlist` & `WishlistItem` | 10 / 25 | Curated patron wishlists |
| | `RecentlyViewed` | 30 | Browsing history with timestamps |
| | `SearchQuery` | 18 | Popular search logs with match counts |
| | `Review` | 30 | Authentic customer reviews with ratings |
| | `ReviewMedia` | 12 | Customer-uploaded review photos |
| **Order Lifecycle** | `Order` | 50 | Across DELIVERED (30), SHIPPED (7), PROCESSING (5), PENDING (4), CANCELLED (2), RETURNED (2) |
| | `OrderItem` | ~125 | Individual variant line items with snapshots |
| | `OrderAddressSnapshot` | 50 | Immutable delivery snapshots |
| | `OrderStatusHistory` | ~150 | Complete chronological lifecycle audit trail |
| | `Payment` | 50 | Razorpay simulated captures + COD |
| | `Shipment` | 37 | Carrier tracking (Blue Dart, Delhivery) |
| | `Refund` | 4 | Automated ledger refunds for cancelled/returned orders |
| **Inventory & Warehouses** | `InventoryLocation` | 2 | `WH-MAIN` (Mumbai Flagship), `WH-AHM` (Gujarat Fulfillment) |
| | `InventoryLog` | 100+ | Initial stock receipts and bin logs |
| | `StockMovement` | 50+ | Inward/outward movement audits |
| | `StockReservation` | Dynamic | Reserved cart/order locks |
| **Store & System Settings** | `BrandSettings` | 1 | Brand name, logo, social links, editorial motto |
| | `StoreSetting` | 12 | Key-value store operational configurations |
| | `TaxSetting` | 10 | State-wise GST rates (MH, DL, KA, WB, TN, GJ, etc.) |
| | `ShippingSetting` | 3 | Standard, Express, White-Glove VIP Tiers |
| | `CurrencySetting` | 4 | INR (Base), USD, EUR, GBP |
| | `SEOSetting` | 10 | Structured metadata, OpenGraph tags |
| | `EmailTemplate` | 16 | Transactional notification email templates |
| | `EmailLog` | 25 | Delivery audit logs for order confirmations, OTPs |
| | `Newsletter` | 12 | Subscribed email patrons |
| | `AdminAuditLog` | 18 | Back-office audit trail tracking Admin actions |
| | `Notification` | 30+ | Customer real-time inbox notifications |
| | `NotificationPreference` | 11 | Channel preferences (Email, SMS, Push) for all users |

---

## 5. Mathematical Pricing Engine & Financial Identities

Every seeded order strictly obeys the central pricing engine formulas:

### A. Order-Level Math Identities
$$ \text{Total Discount} = \text{Offer Discount} + \text{Flash Sale Discount} + \text{Coupon Discount} $$
$$ \text{Taxable Subtotal} = \max(0, \text{Subtotal} - \text{Total Discount}) $$
$$ \text{Total Tax} = \text{Round}_2\left(\text{Taxable Subtotal} \times \text{Tax Rate}\right) $$
$$ \text{Shipping Fee} = \begin{cases} 0.00 & \text{if Taxable Subtotal} \ge 5000 \\ 250.00 & \text{otherwise} \end{cases} $$
$$ \text{Grand Total} = \text{Taxable Subtotal} + \text{Total Tax} + \text{Shipping Fee} $$

### B. OrderItem Reconciliation via Hamilton Method
To avoid floating-point penny discrepancies across line items:
1. Each item receives a proportional discount share:
   $$ \text{Item Discount Share} = \left\lfloor \text{Order Discount} \times \frac{\text{Item Subtotal}}{\text{Order Subtotal}} \times 100 \right\rfloor \div 100 $$
2. The remaining fractional paisa are distributed one by one to items sorted by largest remainder.
3. Item tax is computed on its exact `taxableAmount`:
   $$ \sum_{i=1}^n \text{OrderItem}_i.\text{finalItemAmount} + \text{Shipping Fee} \equiv \text{Order}.\text{grandTotal} $$
   *(Verified to 0.00 paisa across all 50 orders in `validate.js`).*

---

## 6. Media Asset & Sourcing Strategy

Seeded media assets use curated, high-definition fashion photography and video streams from Unsplash and Pexels.
- Variant images: `1600x2000` portrait editorial crops with authentic fabric close-ups and model silhouettes.
- Product videos: Curated luxury runway loops in `.mp4` format.

### Replacing Seed Media with Cloudinary in Production:
1. Upload high-res lookbook assets to your Cloudinary folder: `forme/products/`.
2. Update the `url` and `publicId` fields in `ProductMedia` via the Admin Dashboard or via Cloudinary webhook sync.
3. The schema natively supports Cloudinary public IDs and responsive transformations.

---

*FORME Contemporary Fashion House — Designed to Be Worn. Made to Be Remembered.*

