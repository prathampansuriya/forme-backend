// ============================================================================
// FORME — Collection Media Upload to Cloudinary & DB Sync
// ----------------------------------------------------------------------------
// Discovers collection media folders in EITHER layout:
//
//   backend/public/<slug>/desktopMedia.mp4     ← flat layout
//   backend/public/collections/<slug>/desktopMedia.mp4   ← nested (your case)
//
// For each folder, expects these three files (extensions are auto-detected):
//   ├── desktopMedia.{mp4|webm|mov|m4v|jpg|jpeg|png|webp|avif}
//   ├── mobileMedia.{mp4|webm|mov|m4v|jpg|jpeg|png|webp|avif}
//   └── thumbnail.{jpg|jpeg|png|webp|avif}
//
// Uploads to Cloudinary under  forme/collections/<slug>/  and updates the
// matching Collection row with secure URLs + correct media types.
//
// Usage:
//   node prisma/update-collection-media.js
//   node prisma/update-collection-media.js --dry-run
//   node prisma/update-collection-media.js --slug=contemporary-classics
// ============================================================================

import { PrismaClient, MediaType } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend/.env (one level up from prisma/)
dotenv.config({ path: path.join(__dirname, '../.env') });

// ---------------------------------------------------------------------------
// Cloudinary configuration
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
const NESTED_COLLECTIONS_DIR = path.join(PUBLIC_DIR, 'collections');
const CLOUDINARY_ROOT = 'forme/collections';

const DESKTOP_NAMES = ['desktopMedia', 'desktopmedia', 'desktop-media', 'desktop'];
const MOBILE_NAMES = ['mobileMedia', 'mobilemedia', 'mobile-media', 'mobile'];
const THUMBNAIL_NAMES = ['thumbnail', 'thumb', 'poster'];

const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.m4v'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function findMediaFile(dir, baseNames, allowedExts) {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir);

    for (const base of baseNames) {
        for (const ext of allowedExts) {
            const match = files.find(
                (f) => f.toLowerCase() === `${base.toLowerCase()}${ext}`
            );
            if (match) {
                return path.join(dir, match);
            }
        }
    }
    return null;
}

function getMediaType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (VIDEO_EXTS.includes(ext)) return MediaType.VIDEO;
    if (IMAGE_EXTS.includes(ext)) return MediaType.IMAGE;
    return null;
}

async function uploadToCloudinary(localPath, folder, publicId, resourceType) {
    if (DRY_RUN) {
        console.log(`   [DRY-RUN] Would upload → ${folder}/${publicId} (${resourceType})`);
        return {
            public_id: `${folder}/${publicId}`,
            secure_url: `https://res.cloudinary.com/DRYRUN/${folder}/${publicId}`,
        };
    }

    try {
        const result = await cloudinary.uploader.upload(localPath, {
            folder,
            public_id: publicId,
            resource_type: resourceType,
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
// Root resolution
// ---------------------------------------------------------------------------
// Prefer public/collections/ when it exists (your layout), else public/.
function resolveScanRoot() {
    if (fs.existsSync(NESTED_COLLECTIONS_DIR)) {
        const entries = fs
            .readdirSync(NESTED_COLLECTIONS_DIR, { withFileTypes: true })
            .filter((d) => d.isDirectory());
        if (entries.length > 0) {
            return NESTED_COLLECTIONS_DIR;
        }
    }
    return PUBLIC_DIR;
}

// A folder is a "collection folder" if it contains at least one of our
// expected media files (so we don't try to process unrelated directories).
function looksLikeCollectionFolder(dir) {
    const desktop = findMediaFile(dir, DESKTOP_NAMES, [...VIDEO_EXTS, ...IMAGE_EXTS]);
    const mobile = findMediaFile(dir, MOBILE_NAMES, [...VIDEO_EXTS, ...IMAGE_EXTS]);
    const thumb = findMediaFile(dir, THUMBNAIL_NAMES, IMAGE_EXTS);
    return Boolean(desktop || mobile || thumb);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    console.log('\n================================================================');
    console.log('   FORME — COLLECTION MEDIA CLOUDINARY SYNC');
    console.log(`   Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}`);
    console.log(`   Single slug: ${SINGLE_SLUG || '(all folders)'}`);
    console.log('================================================================');

    if (!fs.existsSync(PUBLIC_DIR)) {
        throw new Error(`Public directory not found: ${PUBLIC_DIR}`);
    }

    const SCAN_ROOT = resolveScanRoot();
    console.log(`\n[SCAN] Using root: ${path.relative(process.cwd(), SCAN_ROOT) || '.'}`);

    // Discover candidate folders (directories only, and only those that
    // contain at least one expected media file OR have the matching slug in
    // the DB — we'll do the DB filter below).
    let folderNames = fs
        .readdirSync(SCAN_ROOT, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

    if (SINGLE_SLUG) {
        folderNames = folderNames.filter((n) => n === SINGLE_SLUG);
        if (folderNames.length === 0) {
            throw new Error(
                `No folder named "${SINGLE_SLUG}" inside ${SCAN_ROOT}`
            );
        }
    }

    // Keep only folders that actually look like collection media folders
    // (avoids picking up stray dirs like `.gitkeep`-only folders).
    folderNames = folderNames.filter((name) =>
        looksLikeCollectionFolder(path.join(SCAN_ROOT, name))
    );

    console.log(`[SCAN] Found ${folderNames.length} collection folder(s):\n`);
    for (const name of folderNames) console.log(`   • ${name}`);
    console.log('');

    const summary = {
        updated: 0,
        skipped: 0,
        failed: 0,
        errors: [],
    };

    for (const slug of folderNames) {
        console.log(`──────────────────────────────────────────────`);
        console.log(`📁 ${slug}`);
        const dir = path.join(SCAN_ROOT, slug);

        // Check DB has a Collection with this slug
        const collection = await prisma.collection.findUnique({
            where: { slug },
        });

        if (!collection) {
            console.log(`   ⚠  No Collection row with slug="${slug}" — skipping.`);
            summary.skipped++;
            continue;
        }

        const desktopPath = findMediaFile(dir, DESKTOP_NAMES, [
            ...VIDEO_EXTS,
            ...IMAGE_EXTS,
        ]);
        const mobilePath = findMediaFile(dir, MOBILE_NAMES, [
            ...VIDEO_EXTS,
            ...IMAGE_EXTS,
        ]);
        const thumbnailPath = findMediaFile(dir, THUMBNAIL_NAMES, IMAGE_EXTS);

        if (!desktopPath || !mobilePath || !thumbnailPath) {
            console.log(
                `   ⚠  Missing files — desktop=${!!desktopPath} mobile=${!!mobilePath} thumbnail=${!!thumbnailPath} — skipping.`
            );
            summary.skipped++;
            continue;
        }

        const desktopType = getMediaType(desktopPath);
        const mobileType = getMediaType(mobilePath);

        if (!desktopType || !mobileType) {
            console.log(`   ⚠  Unsupported file extension — skipping.`);
            summary.skipped++;
            continue;
        }

        console.log(`   Desktop : ${path.basename(desktopPath)} (${desktopType})`);
        console.log(`   Mobile  : ${path.basename(mobilePath)} (${mobileType})`);
        console.log(`   Thumb   : ${path.basename(thumbnailPath)}`);

        // Upload all three
        const desktopRes = await uploadToCloudinary(
            desktopPath,
            `${CLOUDINARY_ROOT}/${slug}`,
            'desktopMedia',
            desktopType === MediaType.VIDEO ? 'video' : 'image'
        );
        const mobileRes = await uploadToCloudinary(
            mobilePath,
            `${CLOUDINARY_ROOT}/${slug}`,
            'mobileMedia',
            mobileType === MediaType.VIDEO ? 'video' : 'image'
        );
        const thumbRes = await uploadToCloudinary(
            thumbnailPath,
            `${CLOUDINARY_ROOT}/${slug}`,
            'thumbnail',
            'image'
        );

        if (!desktopRes || !mobileRes || !thumbRes) {
            console.log(`   ✗ Upload failed for one or more media — skipping DB update.`);
            summary.failed++;
            summary.errors.push({ slug, reason: 'upload_failed' });
            continue;
        }

        // Update DB
        if (!DRY_RUN) {
            try {
                await prisma.collection.update({
                    where: { id: collection.id },
                    data: {
                        desktopBannerUrl: desktopRes.secure_url,
                        mobileBannerUrl: mobileRes.secure_url,
                        thumbnailUrl: thumbRes.secure_url,
                        desktopMediaType: desktopType,
                        mobileMediaType: mobileType,
                    },
                });
                console.log(`   ✓ DB updated.`);
                summary.updated++;
            } catch (err) {
                console.error(`   ✗ DB update failed:`, err.message);
                summary.failed++;
                summary.errors.push({ slug, reason: err.message });
            }
        } else {
            console.log(`   [DRY-RUN] Would update DB row.`);
            summary.updated++;
        }
    }

    // Summary
    console.log('\n================================================================');
    console.log('   SUMMARY');
    console.log('================================================================');
    console.log(`   Updated : ${summary.updated}`);
    console.log(`   Skipped : ${summary.skipped}`);
    console.log(`   Failed  : ${summary.failed}`);
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