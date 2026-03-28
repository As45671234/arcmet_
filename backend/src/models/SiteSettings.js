const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema(
  {
    phone: { type: String, default: '+7 775 702 92 98' },
    email: { type: String, default: 'ceo@arcmet.kz' },
    address: { type: String, default: 'Талапкерская 26а, офис 202' },
    kaspiEnabled: { type: Boolean, default: true },
    kaspiUrl: {
      type: String,
      default:
        'https://kaspi.kz/shop/info/merchant/17410012/reviews/?productCode=136545715&masterSku=136545715&merchantSku=424870474&tabId=PRODUCT',
    },
    halykEnabled: { type: Boolean, default: true },
    halykUrl: { type: String, default: 'https://halykbank.kz/' },
    heroSlides: [
      {
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        desc: { type: String, default: '' },
        img: { type: String, default: '' },
      },
    ],
    aboutSlides: [
      {
        title: { type: String, default: '' },
        text: { type: String, default: '' },
        imageUrl: { type: String, default: '' },
        bullets: [{ type: String }],
      },
    ],
    homepageImages: {
      headerLogo: { type: String, default: '' },
      footerLogo: { type: String, default: '' },
      partnersBackground: { type: String, default: '' },
      productSlides: [
        {
          id: { type: String, default: '' },
          image: { type: String, default: '' },
        },
      ],
      partnerLogos: [{ type: String }],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
