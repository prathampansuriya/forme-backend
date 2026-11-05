// ============================================================================
// FORME — Product Media Upload to Cloudinary & DB Sync
// ----------------------------------------------------------------------------
// Reads folders from  backend/public/catalog/<product-slug>/
//
// Layout rules (auto-detected):
//   • 1 image in the folder  → uploaded once, assigned to the single variant
//   • 2-4 images in the folder → matched by filename "Variant 01.png" …
//     to the product's variants ordered by creation (vIdx 0 → Variant 01, etc.)
//
// For every product:
//   1. Uploads each image to  forme/products/<slug>/<publicId>
//   2. DELETES all existing VIDEO ProductMedia rows for that product
//   3. Wipes existing IMAGE ProductMedia rows
//   4. Creates fresh IMAGE rows with the Cloudinary URLs, each bound to the
//      correct variantId (and marked isPrimary on the first variant image)
//
// Usage:
//   node prisma/update-product-media.js
//   node prisma/update-product-media.js --dry-run
//   node prisma/update-product-media.js --slug=a-line-gabardine-button-front-skirt
// ============================================================================

import { PrismaClient, MediaType } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// ---------------------------------------------------------------------------
// Cloudinary config
// ---------------------------------------------------------------------------
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
) {
    console.error(
        '\n[FATAL] Missing Cloudinary credentials. Please set ' +
        'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in backend/.env'
    );
    process.exit(1);
}

const prisma = new PrismaClient({ log: ['warn', 'error'] });

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SINGLE_SLUG_ARG = args.find((a) => a.startsWith('--slug='));
const SINGLE_SLUG = SINGLE_SLUG_ARG ? SINGLE_SLUG_ARG.split('=')[1] : null;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PUBLIC_DIR = path.join(__dirname, '../public');
const CATALOG_DIR = path.join(PUBLIC_DIR, 'catalog');
const CLOUDINARY_ROOT = 'forme/products';

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function listImageFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((f) => {
            const ext = path.extname(f).toLowerCase();
            return IMAGE_EXTS.includes(ext);
        })
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

// Extract a variant index from filename: "Variant 01.png" → 0, "Variant 03.jpg" → 2
// Returns -1 if not matched.
function variantIndexFromFilename(filename) {
    const base = path.basename(filename, path.extname(filename)).trim();
    const m = base.match(/variant[\s_-]*0*(\d+)/i);
    if (!m) return -1;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) && n >= 1 ? n - 1 : -1;
}

async function uploadToCloudinary(localPath, folder, publicId) {
    if (DRY_RUN) {
        console.log(`   [DRY-RUN] Would upload → ${folder}/${publicId} (image)`);
        return {
            public_id: `${folder}/${publicId}`,
            secure_url: `https://res.cloudinary.com/DRYRUN/${folder}/${publicId}`,
        };
    }
    try {
        const result = await cloudinary.uploader.upload(localPath, {
            folder,
            public_id: publicId,
            resource_type: 'image',
            overwrite: true,
            invalidate: true,
            use_filename: false,
            unique_filename: false,
        });
        return result;
    } catch (err) {
        console.error(`   [UPLOAD ERROR] ${localPath}:`, err.message);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    console.log('\n================================================================');
    console.log('   FORME — PRODUCT MEDIA CLOUDINARY SYNC');
    console.log(`   Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}`);
    console.log(`   Single slug: ${SINGLE_SLUG || '(all folders)'}`);
    console.log('================================================================');

    if (!fs.existsSync(CATALOG_DIR)) {
        throw new Error(`Catalog directory not found: ${CATALOG_DIR}`);
    }

    console.log(`\n[SCAN] Using root: ${path.relative(process.cwd(), CATALOG_DIR)}`);

    // Discover folders
    let folderNames = fs
        .readdirSync(CATALOG_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

    if (SINGLE_SLUG) {
        folderNames = folderNames.filter((n) => n === SINGLE_SLUG);
        if (folderNames.length === 0) {
            throw new Error(`No folder named "${SINGLE_SLUG}" in ${CATALOG_DIR}`);
        }
    }

    console.log(`\n[SCAN] Found ${folderNames.length} product folder(s):\n`);
    for (const name of folderNames) console.log(`   • ${name}`);
    console.log('');

    const summary = {
        processed: 0,
        skipped: 0,
        failed: 0,
        videosDeleted: 0,
        imagesCreated: 0,
        errors: [],
    };

    for (const slug of folderNames) {
        console.log(`──────────────────────────────────────────────`);
        console.log(`📁 ${slug}`);
        const dir = path.join(CATALOG_DIR, slug);

        const product = await prisma.product.findUnique({
            where: { slug },
            include: {
                variants: { orderBy: { createdAt: 'asc' } },
                media: true,
            },
        });

        if (!product) {
            console.log(`   ⚠  No Product row with slug="${slug}" — skipping.`);
            summary.skipped++;
            continue;
        }

        const images = listImageFiles(dir);
        if (images.length === 0) {
            console.log(`   ⚠  No image files found — skipping.`);
            summary.skipped++;
            continue;
        }

        const variantCount = product.variants.length;
        if (variantCount === 0) {
            console.log(`   ⚠  Product has no variants — skipping.`);
            summary.skipped++;
            continue;
        }

        console.log(
            `   Product: "${product.name}" | Variants: ${variantCount} | Images: ${images.length}`
        );

        // Decide which image belongs to which variant
        // Map: variantIndex → [ { path, filename, uploadPublicId } ]
        const assignments = new Map(); // variantIndex → array of files

        if (images.length === 1) {
            // Single image → use for the single/first variant only
            console.log(`   Single-image folder → assigned to variant 0.`);
            assignments.set(0, [{ file: images[0] }]);
        } else {
            // Try to match by "Variant NN" filename
            let anyMatched = false;
            for (const file of images) {
                const idx = variantIndexFromFilename(file);
                if (idx >= 0 && idx < variantCount) {
                    anyMatched = true;
                    if (!assignments.has(idx)) assignments.set(idx, []);
                    assignments.get(idx).push({ file });
                }
            }

            // Fallback: if none of the filenames matched but image count == variant count,
            // assign images to variants in alphabetical order
            if (!anyMatched) {
                if (images.length === variantCount) {
                    console.log(
                        `   No "Variant NN" filenames — assigning ${images.length} images to ${variantCount} variants by order.`
                    );
                    for (let i = 0; i < images.length; i++) {
                        assignments.set(i, [{ file: images[i] }]);
                    }
                } else {
                    console.log(
                        `   ⚠  Could not match images to variants (found ${images.length} images, ${variantCount} variants, no "Variant NN" naming). Skipping.`
                    );
                    summary.skipped++;
                    continue;
                }
            }
        }

        // ---------- STEP 1: Delete all existing VIDEO media rows ----------
        const videoRows = product.media.filter((m) => m.mediaType === MediaType.VIDEO);
        if (videoRows.length > 0) {
            if (!DRY_RUN) {
                const del = await prisma.productMedia.deleteMany({
                    where: {
                        productId: product.id,
                        mediaType: MediaType.VIDEO,
                    },
                });
                summary.videosDeleted += del.count;
                console.log(`   ✓ Deleted ${del.count} VIDEO media row(s).`);
            } else {
                console.log(
                    `   [DRY-RUN] Would delete ${videoRows.length} VIDEO media row(s).`
                );
                summary.videosDeleted += videoRows.length;
            }
        } else {
            console.log(`   ✓ No VIDEO media to delete.`);
        }

        // ---------- STEP 2: Delete existing IMAGE media rows ----------
        const imageRows = product.media.filter((m) => m.mediaType === MediaType.IMAGE);
        if (imageRows.length > 0) {
            if (!DRY_RUN) {
                const del = await prisma.productMedia.deleteMany({
                    where: {
                        productId: product.id,
                        mediaType: MediaType.IMAGE,
                    },
                });
                console.log(`   ✓ Deleted ${del.count} existing IMAGE media row(s).`);
            } else {
                console.log(
                    `   [DRY-RUN] Would delete ${imageRows.length} existing IMAGE media row(s).`
                );
            }
        }

        // ---------- STEP 3: Upload each variant's image(s) ----------
        let uploadsOk = true;
        const uploadedByVariant = new Map(); // variantIndex → uploaded cloudinary result

        for (const [vIdx, fileList] of assignments.entries()) {
            const variant = product.variants[vIdx];
            if (!variant) {
                console.log(
                    `   ⚠  Variant index ${vIdx} not present (product has ${variantCount} variants).`
                );
                continue;
            }

            // We assume 1 image per variant folder slot (your case). If more than one,
            // only the first is used as the primary variant image (extras ignored).
            const firstFile = fileList[0]?.file;
            if (!firstFile) continue;

            const publicId = `variant-${String(vIdx + 1).padStart(2, '0')}`;
            const folder = `${CLOUDINARY_ROOT}/${slug}`;

            console.log(
                `   ↳ Uploading ${firstFile} → ${publicId} (variant ${variant.sku})`
            );
            const res = await uploadToCloudinary(
                path.join(dir, firstFile),
                folder,
                publicId
            );

            if (!res) {
                uploadsOk = false;
                summary.errors.push({ slug, reason: `upload_failed:${firstFile}` });
                continue;
            }

            uploadedByVariant.set(vIdx, {
                result: res,
                variantId: variant.id,
                file: firstFile,
            });
        }

        if (!uploadsOk) {
            console.log(`   ✗ One or more uploads failed — skipping DB insert.`);
            summary.failed++;
            continue;
        }

        // ---------- STEP 4: Insert new ProductMedia rows ----------
        if (!DRY_RUN) {
            try {
                // Sort by variant index so displayOrder matches
                const sortedEntries = Array.from(uploadedByVariant.entries()).sort(
                    (a, b) => a[0] - b[0]
                );

                for (let i = 0; i < sortedEntries.length; i++) {
                    const [vIdx, { result, variantId }] = sortedEntries[i];
                    const variant = product.variants[vIdx];

                    await prisma.productMedia.create({
                        data: {
                            productId: product.id,
                            variantId: variantId,
                            mediaType: MediaType.IMAGE,
                            publicId: result.public_id,
                            secureUrl: result.secure_url,
                            thumbnailUrl: result.secure_url,
                            altText: `${product.name} in ${variant.colorName} (${variant.size})`,
                            displayOrder: i + 1,
                            isPrimary: i === 0,
                            metadata: {
                                width: result.width || 1200,
                                height: result.height || 1600,
                                format: result.format || 'png',
                                colorTag: variant.colorName,
                                sourceFile: sortedEntries[i][1].file,
                            },
                        },
                    });
                    summary.imagesCreated++;
                }
                console.log(
                    `   ✓ Created ${sortedEntries.length} IMAGE media row(s).`
                );
                summary.processed++;
            } catch (err) {
                console.error(`   ✗ DB insert failed:`, err.message);
                summary.failed++;
                summary.errors.push({ slug, reason: err.message });
            }
        } else {
            console.log(
                `   [DRY-RUN] Would create ${uploadedByVariant.size} IMAGE media row(s).`
            );
            summary.processed++;
        }
    }

    // Summary
    console.log('\n================================================================');
    console.log('   SUMMARY');
    console.log('================================================================');
    console.log(`   Products processed : ${summary.processed}`);
    console.log(`   Skipped            : ${summary.skipped}`);
    console.log(`   Failed             : ${summary.failed}`);
    console.log(`   VIDEO rows deleted : ${summary.videosDeleted}`);
    console.log(`   IMAGE rows created : ${summary.imagesCreated}`);
    if (summary.errors.length > 0) {
        console.log('\n   Errors:');
        for (const e of summary.errors) console.log(`     • ${e.slug}: ${e.reason}`);
    }
    console.log('================================================================\n');
}

main()
    .catch((err) => {
        console.error('\n[FATAL]', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });