import prisma from '../config/prisma.config.js';

export class BaseRepository {
  constructor(modelName) {
    this.modelName = modelName;
    this.model = prisma[modelName];
  }

  // Get active client (supports interactive transactions)
  getClient(tx) {
    return tx ? tx[this.modelName] : this.model;
  }

  async findById(id, { select, include, tx } = {}) {
    return this.getClient(tx).findUnique({
      where: { id },
      ...(select ? { select } : {}),
      ...(include ? { include } : {}),
    });
  }

  async findFirst(where = {}, { select, include, orderBy, tx } = {}) {
    return this.getClient(tx).findFirst({
      where,
      ...(select ? { select } : {}),
      ...(include ? { include } : {}),
      ...(orderBy ? { orderBy } : {}),
    });
  }

  async findMany(where = {}, { select, include, orderBy, skip, take, tx } = {}) {
    return this.getClient(tx).findMany({
      where,
      ...(select ? { select } : {}),
      ...(include ? { include } : {}),
      ...(orderBy ? { orderBy } : {}),
      ...(skip !== undefined ? { skip } : {}),
      ...(take !== undefined ? { take } : {}),
    });
  }

  async count(where = {}, { tx } = {}) {
    return this.getClient(tx).count({ where });
  }

  async create(data, { select, include, tx } = {}) {
    return this.getClient(tx).create({
      data,
      ...(select ? { select } : {}),
      ...(include ? { include } : {}),
    });
  }

  async update(id, data, { select, include, tx } = {}) {
    return this.getClient(tx).update({
      where: { id },
      data,
      ...(select ? { select } : {}),
      ...(include ? { include } : {}),
    });
  }

  async delete(id, { tx } = {}) {
    return this.getClient(tx).delete({
      where: { id },
    });
  }

  async paginate(where = {}, { page = 1, limit = 20, select, include, orderBy, tx } = {}) {
    const pageNum = Math.max(1, Number(page) || 1);
    const take = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * take;

    const [total, items] = await Promise.all([
      this.count(where, { tx }),
      this.findMany(where, { select, include, orderBy, skip, take, tx }),
    ]);

    const totalPages = Math.ceil(total / take) || 1;

    return {
      items,
      meta: {
        page: pageNum,
        limit: take,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    };
  }
}

export default BaseRepository;

