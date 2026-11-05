import prisma from '../config/prisma.config.js';
import env from '../config/env.config.js';
import razorpayInstance from '../config/razorpay.config.js';
import { getEmailProvider } from './email/emailProviderFactory.js';
import { ApplicationError } from '../utils/ApplicationError.js';
import auditService from './audit.service.js';

export class AdminSettingService {
  // ==========================================
  // 1. STORE SETTINGS (KEY-VALUE JSON)
  // ==========================================

  async listStoreSettings() {
    return prisma.storeSetting.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async getStoreSettingByKey(key) {
    const setting = await prisma.storeSetting.findUnique({
      where: { key },
    });
    if (!setting) {
      throw ApplicationError.notFound(`Store setting with key '${key}' not found`);
    }
    return setting;
  }

  async upsertStoreSetting(key, value, description, adminUserId, req) {
    const result = await prisma.storeSetting.upsert({
      where: { key },
      update: {
        value,
        ...(description !== undefined ? { description } : {}),
      },
      create: {
        key,
        value,
        description: description || null,
      },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'STORE_SETTING_UPDATED',
      entityType: 'StoreSetting',
      entityId: result.id,
      details: { key, value },
      req,
    });

    return result;
  }

  // ==========================================
  // 2. TAX SETTINGS
  // ==========================================

  async listTaxSettings() {
    return prisma.taxSetting.findMany({
      orderBy: { stateName: 'asc' },
    });
  }

  async createTaxSetting(data, adminUserId, req) {
    const stateCode = data.stateCode.toUpperCase();
    const existing = await prisma.taxSetting.findUnique({ where: { stateCode } });
    if (existing) {
      throw ApplicationError.conflict(`Tax setting for state code '${stateCode}' already exists`);
    }

    const setting = await prisma.taxSetting.create({
      data: {
        stateCode,
        stateName: data.stateName,
        cgstRate: data.cgstRate !== undefined ? Number(data.cgstRate) : 6.0,
        sgstRate: data.sgstRate !== undefined ? Number(data.sgstRate) : 6.0,
        igstRate: data.igstRate !== undefined ? Number(data.igstRate) : 12.0,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'TAX_SETTING_CREATED',
      entityType: 'TaxSetting',
      entityId: setting.id,
      details: { stateCode, stateName: setting.stateName },
      req,
    });

    return setting;
  }

  async updateTaxSetting(id, data, adminUserId, req) {
    const existing = await prisma.taxSetting.findUnique({ where: { id } });
    if (!existing) throw ApplicationError.notFound(`Tax setting with ID '${id}' not found`);

    const updateData = {};
    if (data.stateCode !== undefined) updateData.stateCode = data.stateCode.toUpperCase();
    if (data.stateName !== undefined) updateData.stateName = data.stateName;
    if (data.cgstRate !== undefined) updateData.cgstRate = Number(data.cgstRate);
    if (data.sgstRate !== undefined) updateData.sgstRate = Number(data.sgstRate);
    if (data.igstRate !== undefined) updateData.igstRate = Number(data.igstRate);
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

    const updated = await prisma.taxSetting.update({
      where: { id },
      data: updateData,
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'TAX_SETTING_UPDATED',
      entityType: 'TaxSetting',
      entityId: id,
      details: updateData,
      req,
    });

    return updated;
  }

  async deleteTaxSetting(id, adminUserId, req) {
    const existing = await prisma.taxSetting.findUnique({ where: { id } });
    if (!existing) throw ApplicationError.notFound(`Tax setting with ID '${id}' not found`);

    await prisma.taxSetting.delete({ where: { id } });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'TAX_SETTING_DELETED',
      entityType: 'TaxSetting',
      entityId: id,
      details: { stateCode: existing.stateCode },
      req,
    });

    return { message: 'Tax setting deleted successfully', id };
  }

  // ==========================================
  // 3. SHIPPING SETTINGS
  // ==========================================

  async listShippingSettings() {
    return prisma.shippingSetting.findMany({
      orderBy: { rate: 'asc' },
    });
  }

  async createShippingSetting(data, adminUserId, req) {
    const setting = await prisma.shippingSetting.create({
      data: {
        name: data.name,
        minOrderAmount: data.minOrderAmount !== undefined ? Number(data.minOrderAmount) : 0,
        rate: data.rate !== undefined ? Number(data.rate) : 250.0,
        isFreeShipping: Boolean(data.isFreeShipping),
        estimatedDays: parseInt(data.estimatedDays, 10) || 3,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'SHIPPING_SETTING_CREATED',
      entityType: 'ShippingSetting',
      entityId: setting.id,
      details: { name: setting.name, rate: setting.rate },
      req,
    });

    return setting;
  }

  async updateShippingSetting(id, data, adminUserId, req) {
    const existing = await prisma.shippingSetting.findUnique({ where: { id } });
    if (!existing) throw ApplicationError.notFound(`Shipping setting with ID '${id}' not found`);

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.minOrderAmount !== undefined) updateData.minOrderAmount = Number(data.minOrderAmount);
    if (data.rate !== undefined) updateData.rate = Number(data.rate);
    if (data.isFreeShipping !== undefined) updateData.isFreeShipping = Boolean(data.isFreeShipping);
    if (data.estimatedDays !== undefined) updateData.estimatedDays = parseInt(data.estimatedDays, 10);
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

    const updated = await prisma.shippingSetting.update({
      where: { id },
      data: updateData,
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'SHIPPING_SETTING_UPDATED',
      entityType: 'ShippingSetting',
      entityId: id,
      details: updateData,
      req,
    });

    return updated;
  }

  async deleteShippingSetting(id, adminUserId, req) {
    const existing = await prisma.shippingSetting.findUnique({ where: { id } });
    if (!existing) throw ApplicationError.notFound(`Shipping setting with ID '${id}' not found`);

    await prisma.shippingSetting.delete({ where: { id } });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'SHIPPING_SETTING_DELETED',
      entityType: 'ShippingSetting',
      entityId: id,
      details: { name: existing.name },
      req,
    });

    return { message: 'Shipping setting deleted successfully', id };
  }

  // ==========================================
  // 4. CURRENCY SETTINGS
  // ==========================================

  async listCurrencySettings() {
    return prisma.currencySetting.findMany({
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    });
  }

  async createCurrencySetting(data, adminUserId, req) {
    const code = data.code.toUpperCase();
    const existing = await prisma.currencySetting.findUnique({ where: { code } });
    if (existing) throw ApplicationError.conflict(`Currency '${code}' already exists`);

    if (data.isDefault) {
      await prisma.currencySetting.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const currency = await prisma.currencySetting.create({
      data: {
        code,
        symbol: data.symbol,
        exchangeRate: data.exchangeRate !== undefined ? Number(data.exchangeRate) : 1.0,
        isDefault: Boolean(data.isDefault),
        decimalPlaces: parseInt(data.decimalPlaces, 10) || 2,
      },
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'CURRENCY_CREATED',
      entityType: 'CurrencySetting',
      entityId: currency.id,
      details: { code, symbol: currency.symbol },
      req,
    });

    return currency;
  }

  async updateCurrencySetting(id, data, adminUserId, req) {
    const existing = await prisma.currencySetting.findUnique({ where: { id } });
    if (!existing) throw ApplicationError.notFound(`Currency setting with ID '${id}' not found`);

    if (data.isDefault) {
      await prisma.currencySetting.updateMany({
        where: { id: { not: id }, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updateData = {};
    if (data.symbol !== undefined) updateData.symbol = data.symbol;
    if (data.exchangeRate !== undefined) updateData.exchangeRate = Number(data.exchangeRate);
    if (data.isDefault !== undefined) updateData.isDefault = Boolean(data.isDefault);
    if (data.decimalPlaces !== undefined) updateData.decimalPlaces = parseInt(data.decimalPlaces, 10);

    const updated = await prisma.currencySetting.update({
      where: { id },
      data: updateData,
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'CURRENCY_UPDATED',
      entityType: 'CurrencySetting',
      entityId: id,
      details: updateData,
      req,
    });

    return updated;
  }

  async deleteCurrencySetting(id, adminUserId, req) {
    const existing = await prisma.currencySetting.findUnique({ where: { id } });
    if (!existing) throw ApplicationError.notFound(`Currency setting with ID '${id}' not found`);

    if (existing.isDefault) {
      throw ApplicationError.badRequest('Cannot delete the default platform currency');
    }

    await prisma.currencySetting.delete({ where: { id } });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'CURRENCY_DELETED',
      entityType: 'CurrencySetting',
      entityId: id,
      details: { code: existing.code },
      req,
    });

    return { message: 'Currency setting deleted successfully', id };
  }

  // ==========================================
  // 5. BRAND SETTINGS
  // ==========================================

  async getBrandSettings() {
    let brand = await prisma.brandSettings.findFirst();
    if (!brand) {
      brand = await prisma.brandSettings.create({
        data: {
          brandName: 'FORME',
          tagline: 'Designed to Be Worn. Made to Be Remembered.',
          logoUrl: '/logo.png',
          faviconUrl: '/favicon.png',
          supportEmail: 'concierge@forme.store',
          supportPhone: '+91 800 367 6300',
          socialLinks: {
            instagram: 'https://instagram.com/forme',
            pinterest: 'https://pinterest.com/forme',
          },
        },
      });
    }
    return brand;
  }

  async updateBrandSettings(data, adminUserId, req) {
    const current = await this.getBrandSettings();

    const updateData = {};
    if (data.brandName !== undefined) updateData.brandName = data.brandName;
    if (data.tagline !== undefined) updateData.tagline = data.tagline;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.faviconUrl !== undefined) updateData.faviconUrl = data.faviconUrl;
    if (data.supportEmail !== undefined) updateData.supportEmail = data.supportEmail;
    if (data.supportPhone !== undefined) updateData.supportPhone = data.supportPhone;
    if (data.socialLinks !== undefined) updateData.socialLinks = data.socialLinks;

    const updated = await prisma.brandSettings.update({
      where: { id: current.id },
      data: updateData,
    });

    await auditService.recordAdminAction({
      adminUserId,
      action: 'BRAND_SETTINGS_UPDATED',
      entityType: 'BrandSettings',
      entityId: updated.id,
      details: updateData,
      req,
    });

    return updated;
  }

  // ==========================================
  // 6. HOMEPAGE LAYOUT CONFIGURATION
  // ==========================================

  async getHomepageLayout() {
    return prisma.homePageSection.findMany({
      orderBy: { displayOrder: 'asc' },
    });
  }

  async updateHomepageLayout(sections, adminUserId, req) {
    if (!Array.isArray(sections)) {
      throw ApplicationError.badRequest('Sections must be an array of section definitions');
    }

    const updatedSections = await prisma.$transaction(
      sections.map((section, idx) =>
        prisma.homePageSection.upsert({
          where: { id: section.id || 'new-uuid' },
          update: {
            title: section.title,
            subtitle: section.subtitle || null,
            type: section.type,
            references: section.references || null,
            layoutConfig: section.layoutConfig || null,
            displayOrder: idx,
            isPublished: section.isPublished !== undefined ? Boolean(section.isPublished) : true,
          },
          create: {
            title: section.title,
            subtitle: section.subtitle || null,
            type: section.type,
            references: section.references || null,
            layoutConfig: section.layoutConfig || null,
            displayOrder: idx,
            isPublished: section.isPublished !== undefined ? Boolean(section.isPublished) : true,
          },
        })
      )
    );

    await auditService.recordAdminAction({
      adminUserId,
      action: 'HOMEPAGE_LAYOUT_SAVED',
      entityType: 'HomePageSection',
      details: { sectionsCount: sections.length },
      req,
    });

    return updatedSections;
  }

  // ==========================================
  // 7. SYSTEM HEALTH & INTEGRATION PROBES
  // ==========================================

  async probePaymentGateway() {
    const keyId = env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;

    const isConfigured = Boolean(keyId && keySecret);
    const isMock = keyId?.includes('mock') || keyId?.includes('test_mock') || process.env.MOCK_PAYMENT === 'true';

    let connectivity = 'UNKNOWN';
    let latencyMs = 0;
    let message = 'Credentials present';

    if (isConfigured && !isMock && razorpayInstance) {
      try {
        const start = Date.now();
        await razorpayInstance.orders.all({ count: 1 });
        latencyMs = Date.now() - start;
        connectivity = 'CONNECTED';
        message = 'Razorpay Live/Test Gateway responsive';
      } catch (err) {
        connectivity = 'DEGRADED';
        message = `Gateway responded: ${err.message}`;
      }
    } else if (isMock) {
      connectivity = 'SANDBOX_MOCK';
      message = 'Using local development mock payment simulator';
    } else {
      connectivity = 'NOT_CONFIGURED';
      message = 'RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing';
    }

    return {
      service: 'Razorpay',
      status: connectivity === 'CONNECTED' || connectivity === 'SANDBOX_MOCK' ? 'OPERATIONAL' : 'DEGRADED',
      connectivity,
      isConfigured,
      keyIdPrefix: keyId ? `${keyId.substring(0, 8)}...` : null,
      latencyMs,
      message,
      timestamp: new Date(),
    };
  }

  async probeEmailTransport() {
    const providerName = (env.EMAIL_PROVIDER || 'nodemailer').toLowerCase();
    const isBrevo = providerName === 'brevo';

    let isConfigured = false;
    let details = {};

    if (isBrevo) {
      const apiKey = env.BREVO_API_KEY || process.env.BREVO_API_KEY;
      isConfigured = Boolean(apiKey);
      details = {
        provider: 'Brevo (Official Transactional API)',
        configured: isConfigured,
        apiKeyMasked: apiKey ? `${apiKey.substring(0, 6)}...` : null,
      };
    } else {
      const host = env.SMTP_HOST || 'smtp.gmail.com';
      const user = env.SMTP_USER;
      const pass = env.SMTP_PASS;
      isConfigured = Boolean(user && pass);
      details = {
        provider: 'Nodemailer (SMTP)',
        host,
        port: env.SMTP_PORT || 587,
        user: user ? `${user.substring(0, 3)}***` : null,
        configured: isConfigured,
      };
    }

    const providerInstance = getEmailProvider();
    const canSend = Boolean(providerInstance);

    return {
      service: 'Email Service',
      provider: providerName,
      status: isConfigured ? 'OPERATIONAL' : 'DEVELOPMENT_STREAM',
      canSend,
      details,
      timestamp: new Date(),
    };
  }
}

export const adminSettingService = new AdminSettingService();
export default adminSettingService;

