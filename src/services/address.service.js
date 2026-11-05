import prisma from '../config/prisma.config.js';
import ApplicationError from '../utils/ApplicationError.js';

class AddressService {
  /**
   * Retrieves all saved addresses for an authenticated customer.
   */
  async listAddresses(userId) {
    if (!userId) {
      throw ApplicationError.unauthorized('Authentication required to access addresses.');
    }

    return prisma.address.findMany({
      where: { userId },
      orderBy: [
        { isDefaultShipping: 'desc' },
        { isDefaultBilling: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Retrieves a single address by ID verifying ownership.
   */
  async getAddressById(id, userId) {
    const address = await prisma.address.findUnique({
      where: { id },
    });

    if (!address) {
      throw ApplicationError.notFound('Address not found.', 'ADDRESS_NOT_FOUND');
    }

    if (address.userId !== userId) {
      throw ApplicationError.forbidden('You do not have permission to access this address.', 'FORBIDDEN_RESOURCE');
    }

    return address;
  }

  /**
   * Creates a new delivery address for the customer.
   */
  async createAddress(userId, data) {
    if (!userId) {
      throw ApplicationError.unauthorized('Authentication required to save address.');
    }

    const existingCount = await prisma.address.count({
      where: { userId },
    });

    // If first address, automatically set as default shipping and billing
    const isFirst = existingCount === 0;
    const isDefaultShipping = isFirst ? true : Boolean(data.isDefaultShipping);
    const isDefaultBilling = isFirst ? true : Boolean(data.isDefaultBilling);

    return prisma.$transaction(async (tx) => {
      // Unset previous defaults if new address is marked as default
      if (isDefaultShipping) {
        await tx.address.updateMany({
          where: { userId, isDefaultShipping: true },
          data: { isDefaultShipping: false },
        });
      }

      if (isDefaultBilling) {
        await tx.address.updateMany({
          where: { userId, isDefaultBilling: true },
          data: { isDefaultBilling: false },
        });
      }

      return tx.address.create({
        data: {
          userId,
          recipientName: data.recipientName.trim(),
          phone: data.phone.trim(),
          addressLine1: data.addressLine1.trim(),
          addressLine2: data.addressLine2 ? data.addressLine2.trim() : null,
          landmark: data.landmark ? data.landmark.trim() : null,
          city: data.city.trim(),
          state: data.state.trim(),
          postalCode: data.postalCode.trim(),
          country: data.country || 'India',
          addressType: data.addressType || 'HOME',
          isDefaultShipping,
          isDefaultBilling,
        },
      });
    });
  }

  /**
   * Updates an existing address verifying strict ownership.
   */
  async updateAddress(id, userId, data) {
    // 1. Strict ownership verification
    const existing = await prisma.address.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApplicationError.notFound('Address not found.', 'ADDRESS_NOT_FOUND');
    }

    if (existing.userId !== userId) {
      throw ApplicationError.forbidden('You do not have permission to modify another customer\'s address.', 'FORBIDDEN_RESOURCE');
    }

    return prisma.$transaction(async (tx) => {
      if (data.isDefaultShipping === true) {
        await tx.address.updateMany({
          where: { userId, id: { not: id }, isDefaultShipping: true },
          data: { isDefaultShipping: false },
        });
      }

      if (data.isDefaultBilling === true) {
        await tx.address.updateMany({
          where: { userId, id: { not: id }, isDefaultBilling: true },
          data: { isDefaultBilling: false },
        });
      }

      return tx.address.update({
        where: { id },
        data: {
          ...(data.recipientName && { recipientName: data.recipientName.trim() }),
          ...(data.phone && { phone: data.phone.trim() }),
          ...(data.addressLine1 && { addressLine1: data.addressLine1.trim() }),
          ...(data.addressLine2 !== undefined && { addressLine2: data.addressLine2 ? data.addressLine2.trim() : null }),
          ...(data.landmark !== undefined && { landmark: data.landmark ? data.landmark.trim() : null }),
          ...(data.city && { city: data.city.trim() }),
          ...(data.state && { state: data.state.trim() }),
          ...(data.postalCode && { postalCode: data.postalCode.trim() }),
          ...(data.country && { country: data.country }),
          ...(data.addressType && { addressType: data.addressType }),
          ...(data.isDefaultShipping !== undefined && { isDefaultShipping: Boolean(data.isDefaultShipping) }),
          ...(data.isDefaultBilling !== undefined && { isDefaultBilling: Boolean(data.isDefaultBilling) }),
        },
      });
    });
  }

  /**
   * Sets an address as default shipping, billing, or both.
   */
  async setDefaultAddress(id, userId, type = 'SHIPPING') {
    const existing = await prisma.address.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApplicationError.notFound('Address not found.', 'ADDRESS_NOT_FOUND');
    }

    if (existing.userId !== userId) {
      throw ApplicationError.forbidden('You do not have permission to modify this address.', 'FORBIDDEN_RESOURCE');
    }

    return prisma.$transaction(async (tx) => {
      const updates = {};

      if (type === 'SHIPPING' || type === 'BOTH') {
        await tx.address.updateMany({
          where: { userId, id: { not: id }, isDefaultShipping: true },
          data: { isDefaultShipping: false },
        });
        updates.isDefaultShipping = true;
      }

      if (type === 'BILLING' || type === 'BOTH') {
        await tx.address.updateMany({
          where: { userId, id: { not: id }, isDefaultBilling: true },
          data: { isDefaultBilling: false },
        });
        updates.isDefaultBilling = true;
      }

      return tx.address.update({
        where: { id },
        data: updates,
      });
    });
  }

  /**
   * Deletes an address verifying strict customer ownership.
   */
  async deleteAddress(id, userId) {
    const existing = await prisma.address.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApplicationError.notFound('Address not found.', 'ADDRESS_NOT_FOUND');
    }

    if (existing.userId !== userId) {
      throw ApplicationError.forbidden('You do not have permission to delete another customer\'s address.', 'FORBIDDEN_RESOURCE');
    }

    await prisma.$transaction(async (tx) => {
      await tx.address.delete({
        where: { id },
      });

      // If deleted address was a default, promote the latest remaining address
      if (existing.isDefaultShipping || existing.isDefaultBilling) {
        const remaining = await tx.address.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });

        if (remaining) {
          await tx.address.update({
            where: { id: remaining.id },
            data: {
              ...(existing.isDefaultShipping && { isDefaultShipping: true }),
              ...(existing.isDefaultBilling && { isDefaultBilling: true }),
            },
          });
        }
      }
    });

    return { success: true, message: 'Address removed successfully.' };
  }
}

export default new AddressService();

