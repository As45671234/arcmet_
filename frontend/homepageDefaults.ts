import type { HomepageImages } from './types';

import logoImg from './components/img/logo.png';
import qsLogo from './components/img/qs.png';
import simbolLogo from './components/img/sembol.png';
import sskLogo from './components/img/ssk.jpg';
import svoyLogo from './components/img/svoy.png';
import aigulLogo from './components/img/aigul.png';
import astanaLogo from './components/img/astana.png';
import biGroupLogo from './components/img/Bi-group.png';
import mamyrLogo from './components/img/mamyr.jpg';
import megaLogo from './components/img/MEGA.png';
import penoplexProduct01 from './components/img/company/penoplex-product-01.jpg';
import brandPlastfoil from './components/img/company/plastoil.webp';
import brandPanelsan from './components/img/company/panelsan.png';
import brandFachmann from './components/img/company/fachman.jpeg';
import brandRheinzink from './components/img/company/brand-rheinzink.jpg';
import brandAkfa from './components/img/company/brand-akfa.jpg';

export const DEFAULT_PRODUCT_SLIDE_IMAGES: Record<string, string> = {
  plastfoil: brandPlastfoil,
  panelsan: brandPanelsan,
  fachmann: brandFachmann,
  rheinzink: brandRheinzink,
  penoplex: penoplexProduct01,
  akfa: brandAkfa,
};

export const DEFAULT_PARTNER_LOGOS = [
  qsLogo,
  simbolLogo,
  sskLogo,
  svoyLogo,
  aigulLogo,
  astanaLogo,
  biGroupLogo,
  mamyrLogo,
  megaLogo,
];

export const DEFAULT_HOMEPAGE_IMAGES: HomepageImages = {
  headerLogo: logoImg,
  footerLogo: logoImg,
  partnersBackground: 'https://arcmet.kz/wp-content/themes/arcmet/img/gor-fon.svg',
  productSlides: Object.entries(DEFAULT_PRODUCT_SLIDE_IMAGES).map(([id, image]) => ({ id, image })),
  partnerLogos: DEFAULT_PARTNER_LOGOS,
};