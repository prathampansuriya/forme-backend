import prisma from '../config/prisma.config.js';
import ApplicationError from '../utils/ApplicationError.js';

class CategoryService {
  /**
   * Retrieves category list formatted as a hierarchical tree with real product counts.
   */
  async listCategories({ includeInactive = false, flat = false } = {}) {
    const where = {
      ...(includeInactive ? {} : { status: 'ACTIVE' }),
    };

    const categories = await prisma.category.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            products: {
              where: {
                status: 'PUBLISHED',
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    if (flat) {
      return categories.map((cat) => ({
        ...cat,
        productCount: cat._count?.products || 0,
      }));
    }

    // Build hierarchical tree: root categories with children nested
    const categoryMap = new Map();
    const roots = [];

    categories.forEach((cat) => {
      categoryMap.set(cat.id, {
        ...cat,
        productCount: cat._count?.products || 0,
        children: [],
      });
    });

    categories.forEach((cat) => {
      const node = categoryMap.get(cat.id);
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  /**
   * Retrieves a single category by unique slug or ID.
   */
  async getCategoryBySlug(identifier) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const category = await prisma.category.findFirst({
      where: isUuid ? { id: identifier } : { slug: identifier },
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
        children: {
          where: { status: 'ACTIVE' },
          orderBy: { displayOrder: 'asc' },
          include: {
            _count: {
              select: {
                products: { where: { status: 'PUBLISHED', deletedAt: null } },
              },
            },
          },
        },
        _count: {
          select: {
            products: { where: { status: 'PUBLISHED', deletedAt: null } },
          },
        },
      },
    });

    if (!category) {
      throw ApplicationError.notFound(`Category "${identifier}" not found.`);
    }

    return {
      ...category,
      productCount: category._count?.products || 0,
      children: category.children.map((c) => ({
        ...c,
        productCount: c._count?.products || 0,
      })),
    };
  }

  /**
   * Computes available facet filters (sizes, colors, price range, fabrics) for products in this category.
   */
  async getCategoryFilters(identifier) {
    const category = await this.getCategoryBySlug(identifier);

    // Collect category IDs (self + child categories)
    const categoryIds = [category.id, ...(category.children || []).map((c) => c.id)];

    const products = await prisma.product.findMany({
      where: {
        categoryId: { in: categoryIds },
        status: 'PUBLISHED',
        deletedAt: null,
      },
      select: {
        sellingPrice: true,
        fabric: true,
        fit: true,
        audience: true,
        variants: {
          where: { status: 'ACTIVE' },
          select: {
            size: true,
            colorName: true,
            colorHex: true,
            availableQuantity: true,
          },
        },
      },
    });

    const sizes = new Set();
    const colorsMap = new Map();
    const fabrics = new Set();
    const fits = new Set();
    let minPrice = Infinity;
    let maxPrice = 0;

    products.forEach((p) => {
      const price = Number(p.sellingPrice);
      if (price < minPrice) minPrice = price;
      if (price > maxPrice) maxPrice = price;
      if (p.fabric) fabrics.add(p.fabric);
      if (p.fit) fits.add(p.fit);

      p.variants.forEach((v) => {
        if (v.size) sizes.add(v.size);
        if (v.colorName && v.colorHex) {
          colorsMap.set(v.colorName, {
            name: v.colorName,
            hex: v.colorHex,
          });
        }
      });
    });

    return {
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
      },
      priceRange: {
        min: minPrice === Infinity ? 0 : minPrice,
        max: maxPrice,
      },
      sizes: Array.from(sizes).sort(),
      colors: Array.from(colorsMap.values()),
      fabrics: Array.from(fabrics).sort(),
      fits: Array.from(fits).sort(),
    };
  }

  /**
   * Admin: Creates a new category.
   */
  async createCategory(data) {
    const existing = await prisma.category.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      throw ApplicationError.conflict(`A category with slug "${data.slug}" already exists.`);
    }

    if (data.parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: data.parentId },
      });
      if (!parent) {
        throw ApplicationError.badRequest(`Parent category with ID "${data.parentId}" not found.`);
      }
    }

    return await prisma.category.create({
      data,
    });
  }

  /**
   * Admin: Updates an existing category.
   */
  async updateCategory(id, data) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw ApplicationError.notFound(`Category with ID "${id}" not found.`);
    }

    if (data.slug && data.slug !== category.slug) {
      const duplicate = await prisma.category.findUnique({ where: { slug: data.slug } });
      if (duplicate) {
        throw ApplicationError.conflict(`Category slug "${data.slug}" is already taken.`);
      }
    }

    if (data.parentId && data.parentId === id) {
      throw ApplicationError.badRequest('A category cannot be its own parent.');
    }

    return await prisma.category.update({
      where: { id },
      data,
    });
  }

  /**
   * Admin: Deletes a category if it contains no products.
   */
  async deleteCategory(id) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true, children: true },
        },
      },
    });

    if (!category) {
      throw ApplicationError.notFound(`Category with ID "${id}" not found.`);
    }

    if (category._count.products > 0) {
      throw ApplicationError.conflict(
        `Cannot delete category "${category.name}" because it contains ${category._count.products} active or archived products. Reassign products first.`
      );
    }

    if (category._count.children > 0) {
      throw ApplicationError.conflict(
        `Cannot delete category "${category.name}" because it contains ${category._count.children} child subcategories.`
      );
    }

    await prisma.category.delete({ where: { id } });
    return { message: `Category "${category.name}" was successfully removed.` };
  }
}

export const categoryService = new CategoryService();
export default categoryService;
