import { renderMasterEmailLayout } from './emailLayout.js';
import env from '../config/env.config.js';

const clientUrl = env.CLIENT_URL || 'http://localhost:5173';

/**
 * 1. Newsletter Subscription Confirmation (Double Opt-In)
 */
export const newsletterSubscriptionConfirmationTemplate = ({
  subscriberEmail,
  confirmUrl,
  unsubscribeUrl,
}) => {
  const contentHtml = `
    <p>Greetings,</p>
    <p>Thank you for requesting to join the <strong>FORME Dispatch</strong> — our exclusive gazette covering seasonal collections, private salon presentations, and architectural design studies.</p>
    <p>To confirm your subscription and guarantee delivery to your inbox, please verify your interest by selecting the button below:</p>
  `;

  return {
    subject: 'Confirm Your FORME Subscription',
    html: renderMasterEmailLayout({
      preheader: 'Please confirm your subscription to the FORME journal',
      heading: 'Confirm Subscription',
      subtitle: 'Exclusive curations and private salon invitations',
      badge: 'Maison Gazette',
      contentHtml,
      ctaLabel: 'Confirm My Subscription',
      ctaUrl: confirmUrl || `${clientUrl}/newsletter/confirm?email=${encodeURIComponent(subscriberEmail)}`,
      isMarketing: true,
      unsubscribeUrl,
    }),
    text: `Please confirm your FORME subscription at: ${confirmUrl || clientUrl}`,
  };
};

/**
 * 2. Newsletter Welcome
 */
export const newsletterWelcomeTemplate = ({
  subscriberEmail,
  discountCode = 'FORMEFIRST10',
  discountPercent = 10,
  unsubscribeUrl,
}) => {
  const contentHtml = `
    <p>Welcome to the FORME community,</p>
    <p>Your subscription to our seasonal curations is officially confirmed. As a token of our appreciation, we invite you to experience our latest silhouette with a private introductory privilege.</p>

    <div style="background-color: #FAF8F5; border: 1px dashed #C5A880; padding: 24px 20px; text-align: center; margin: 28px 0;">
      <div style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #78716C; margin-bottom: 8px;">
        Complimentary First-Acquisition Privilege
      </div>
      <div style="font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 700; letter-spacing: 0.15em; color: #121212;">
        ${discountCode}
      </div>
      <div style="font-size: 12px; color: #57534E; margin-top: 8px;">
        Enjoy <strong>${discountPercent}% off</strong> your inaugural order. Enter code at checkout.
      </div>
    </div>

    <p style="font-size: 13px; color: #78716C;">
      Expect thoughtful correspondences highlighting our fabric sources, tailoring narratives, and early access to limited capsule releases.
    </p>
  `;

  return {
    subject: 'Welcome to FORME Curations — An Exclusive Invitation',
    html: renderMasterEmailLayout({
      preheader: `Welcome to FORME. Use code ${discountCode} for ${discountPercent}% off your first acquisition`,
      heading: 'An Exclusive Invitation',
      subtitle: 'Your journey into contemporary luxury begins here',
      badge: 'Clientele Privilege',
      contentHtml,
      ctaLabel: 'Explore the New Collection',
      ctaUrl: `${clientUrl}/shop`,
      isMarketing: true,
      unsubscribeUrl,
    }),
    text: `Welcome to FORME. Use code ${discountCode} for ${discountPercent}% off at: ${clientUrl}/shop`,
  };
};

/**
 * 3. Promotional Campaign
 */
export const promotionalCampaignTemplate = ({
  customerName = 'Valued Clientele',
  campaignTitle,
  heroImage = 'https://res.cloudinary.com/dbtq4qk6s/image/upload/v1/forme/campaign-hero.jpg',
  description,
  ctaLabel = 'Discover the Curation',
  ctaUrl,
  unsubscribeUrl,
}) => {
  const contentHtml = `
    <p>Dear ${customerName},</p>
    
    ${
      heroImage
        ? `<div style="margin: 16px 0 24px; text-align: center;">
            <img src="${heroImage}" alt="${campaignTitle}" width="520" style="width: 100%; max-width: 520px; height: auto; border: 1px solid #E7E5E4; display: block; margin: 0 auto;" />
          </div>`
        : ''
    }

    <div style="font-size: 14px; line-height: 24px; color: #44403C; margin: 20px 0;">
      ${description}
    </div>
  `;

  return {
    subject: `${campaignTitle} — FORME`,
    html: renderMasterEmailLayout({
      preheader: `${campaignTitle}. A new chapter in modern tailoring.`,
      heading: campaignTitle,
      subtitle: 'Exclusive seasonal presentation for our discerning clientele',
      badge: 'Seasonal Showcase',
      contentHtml,
      ctaLabel,
      ctaUrl: ctaUrl || `${clientUrl}/collections`,
      isMarketing: true,
      unsubscribeUrl,
    }),
    text: `${campaignTitle}: ${description}. Explore at ${ctaUrl || clientUrl}`,
  };
};

/**
 * 4. Coupon / Offer Campaign
 */
export const couponOfferTemplate = ({
  customerName = 'Valued Clientele',
  couponCode,
  discountText = '15% Off Your Next Piece',
  minPurchase = null,
  expiryDate,
  ctaUrl,
  unsubscribeUrl,
}) => {
  const contentHtml = `
    <p>Dear ${customerName},</p>
    <p>We invite you to indulge in your next bespoke wardrobe addition with a special privileged invitation.</p>

    <div style="background-color: #FAF8F5; border: 1px solid #C5A880; padding: 24px 20px; text-align: center; margin: 24px 0;">
      <div style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #8A6D4B; margin-bottom: 6px;">
        Private Clientele Voucher
      </div>
      <div style="font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 700; color: #121212;">
        ${discountText}
      </div>
      <div style="margin: 16px 0;">
        <span style="display: inline-block; background-color: #121212; color: #FAF8F5; font-family: 'Courier New', monospace; font-size: 20px; font-weight: 700; letter-spacing: 0.25em; padding: 8px 24px;">
          ${couponCode}
        </span>
      </div>
      <div style="font-size: 12px; color: #78716C;">
        ${minPurchase ? `Valid on orders above ${minPurchase}. ` : ''}Expires on <strong>${expiryDate || 'Limited Time'}</strong>.
      </div>
    </div>
  `;

  return {
    subject: `Private Clientele Invitation: ${discountText} — FORME`,
    html: renderMasterEmailLayout({
      preheader: `Private privilege: ${discountText} with code ${couponCode}`,
      heading: 'Private Privilege',
      subtitle: 'Reserved for our most dedicated patrons',
      badge: 'Private Voucher',
      contentHtml,
      ctaLabel: 'Claim Your Privilege',
      ctaUrl: ctaUrl || `${clientUrl}/shop`,
      isMarketing: true,
      unsubscribeUrl,
    }),
    text: `Private privilege: ${discountText} with code ${couponCode}. Use by ${expiryDate} at ${ctaUrl || clientUrl}`,
  };
};

export default {
  newsletterSubscriptionConfirmationTemplate,
  newsletterWelcomeTemplate,
  promotionalCampaignTemplate,
  couponOfferTemplate,
};

