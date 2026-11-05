/**
 * FORME Master Email Templates Registry
 * Aggregates all Haute Couture email templates with backwards compatibility.
 */
import { renderMasterEmailLayout } from './emailLayout.js';

export * from './emailLayout.js';
export * from './authTemplates.js';
export * from './commerceTemplates.js';
export * from './marketingTemplates.js';
export * from './adminTemplates.js';

// Legacy compatibility wrapper
export const renderBaseEmailTemplate = ({ heading, content, ctaLabel, ctaUrl }) => {
  return renderMasterEmailLayout({
    heading,
    contentHtml: content,
    ctaLabel,
    ctaUrl,
  });
};

export default {
  renderBaseEmailTemplate,
  renderMasterEmailLayout,
};
