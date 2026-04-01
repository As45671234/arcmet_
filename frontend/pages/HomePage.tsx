
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Hero from '../components/Hero';
import LeadForm from '../components/LeadForm';
import PartnersSection from "../components/PartnersSection";
import AboutSlider from "../components/InfographicSection";
import { Category, Product, SiteSettings } from '../types';
import { CATEGORY_IMAGES, DEFAULT_CATEGORY_IMAGE } from '../constants';
import { Link } from 'react-router-dom';
import { DEFAULT_PRODUCT_SLIDE_IMAGES } from '../homepageDefaults';
import { normalizeAssetUrl } from '../utils/assetUrl';

interface HomePageProps {
  categories: Category[];
  onAddToCart: (p: Product) => void;
  siteSettings?: SiteSettings | null;
}

const LOCAL_CATEGORY_IMAGES: Record<string, string> = {
  plastfoil: DEFAULT_PRODUCT_SLIDE_IMAGES.plastfoil,
  penoplex: DEFAULT_PRODUCT_SLIDE_IMAGES.penoplex,
  rheinzink: DEFAULT_PRODUCT_SLIDE_IMAGES.rheinzink,
  fachmann: DEFAULT_PRODUCT_SLIDE_IMAGES.fachmann,
  panelsan: DEFAULT_PRODUCT_SLIDE_IMAGES.panelsan,
  akfa: DEFAULT_PRODUCT_SLIDE_IMAGES.akfa,
  skyplast: DEFAULT_PRODUCT_SLIDE_IMAGES.rheinzink,
  protan: DEFAULT_PRODUCT_SLIDE_IMAGES.rheinzink,
  uteplitel: DEFAULT_PRODUCT_SLIDE_IMAGES.penoplex,
  default: DEFAULT_PRODUCT_SLIDE_IMAGES.plastfoil,
};

const BRAND_ORDER = [
  'plastfoil',
  'panelsan',
  'fachmann',
  'rheinzink',
  'penoplex',
  'akfa',
] as const;

const BRAND_TITLES: Record<(typeof BRAND_ORDER)[number], string> = {
  plastfoil: 'PLASTFOIL',
  panelsan: 'PANELSAN',
  fachmann: 'FACHMANN',
  rheinzink: 'RHEINZINK',
  penoplex: 'ПЕНОПЛЭКС',
  akfa: 'AKFA BUILD',
};

const BRAND_DESCRIPTIONS: Record<(typeof BRAND_ORDER)[number], string> = {
  plastfoil: 'ПВХ-мембраны и комплектующие для надежной гидроизоляции кровель и подземных конструкций.',
  panelsan: 'Сэндвич-панели и фасадные решения для быстровозводимых и энергоэффективных объектов.',
  fachmann: 'Профессиональные комплектующие и инженерные элементы для кровельных систем.',
  rheinzink: 'Премиальные решения для кровли и фасада с высокой долговечностью и архитектурной выразительностью.',
  penoplex: 'Эффективная теплоизоляция с высокой прочностью, низким водопоглощением и долгим сроком службы.',
  akfa: 'Профильные системы и строительные решения для современных коммерческих и жилых проектов.',
};

const BRAND_IMAGE_FALLBACKS: Record<(typeof BRAND_ORDER)[number], string> = {
  plastfoil: DEFAULT_PRODUCT_SLIDE_IMAGES.plastfoil,
  panelsan: DEFAULT_PRODUCT_SLIDE_IMAGES.panelsan,
  fachmann: DEFAULT_PRODUCT_SLIDE_IMAGES.fachmann,
  rheinzink: DEFAULT_PRODUCT_SLIDE_IMAGES.rheinzink,
  penoplex: DEFAULT_PRODUCT_SLIDE_IMAGES.penoplex,
  akfa: DEFAULT_PRODUCT_SLIDE_IMAGES.akfa,
};

const normalizeBrandKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, '')
    .replace(/[-_]+/g, '');

const resolveBrandKey = (input: { id?: string; title?: string }) => {
  const idKey = normalizeBrandKey(input.id || '');
  const titleKey = normalizeBrandKey(input.title || '');
  const combined = `${idKey} ${titleKey}`;

  if (combined.includes('plastfoil') || combined.includes('plastoil')) return 'plastfoil';
  if (combined.includes('panelsan')) return 'panelsan';
  if (combined.includes('fachmann')) return 'fachmann';
  if (combined.includes('rheinzink')) return 'rheinzink';
  if (combined.includes('penoplex') || combined.includes('пеноплекс')) return 'penoplex';
  if (combined.includes('akfabuild') || combined.includes('akfa')) return 'akfa';

  return null;
};

const DEFAULT_PRODUCT_SLIDES = [
  {
    id: 'plastfoil',
    title: BRAND_TITLES.plastfoil,
    image: BRAND_IMAGE_FALLBACKS.plastfoil,
    description: BRAND_DESCRIPTIONS.plastfoil,
  },
  {
    id: 'panelsan',
    title: BRAND_TITLES.panelsan,
    image: BRAND_IMAGE_FALLBACKS.panelsan,
    description: BRAND_DESCRIPTIONS.panelsan,
  },
  {
    id: 'fachmann',
    title: BRAND_TITLES.fachmann,
    image: BRAND_IMAGE_FALLBACKS.fachmann,
    description: BRAND_DESCRIPTIONS.fachmann,
  },
  {
    id: 'rheinzink',
    title: BRAND_TITLES.rheinzink,
    image: BRAND_IMAGE_FALLBACKS.rheinzink,
    description: BRAND_DESCRIPTIONS.rheinzink,
  },
  {
    id: 'penoplex',
    title: BRAND_TITLES.penoplex,
    image: BRAND_IMAGE_FALLBACKS.penoplex,
    description: BRAND_DESCRIPTIONS.penoplex,
  },
  {
    id: 'akfa',
    title: BRAND_TITLES.akfa,
    image: BRAND_IMAGE_FALLBACKS.akfa,
    description: BRAND_DESCRIPTIONS.akfa,
  },
];

const HomePage: React.FC<HomePageProps> = ({ categories, siteSettings }) => {
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isLeadSuccessOpen, setIsLeadSuccessOpen] = useState(false);
  const [activeProductIndex, setActiveProductIndex] = useState(0);
  const catalogTrackRef = useRef<HTMLDivElement | null>(null);
  const wheelLockRef = useRef(false);
  const wheelDeltaAccumulatorRef = useRef(0);
  const activeIndexRef = useRef(0);
  const slidesCountRef = useRef(0);
  const lastSwitchTsRef = useRef(0);
  const lastWheelEventTsRef = useRef(0);
  const touchStartXRef = useRef(0);
  const touchDeltaXRef = useRef(0);

  const matchedSlides = categories
    .map((cat) => {
      const brandKey = resolveBrandKey({ id: cat.id, title: cat.title });
      if (!brandKey) return null;

      return {
        id: cat.id || brandKey,
        brandKey,
        title: BRAND_TITLES[brandKey],
        image:
          BRAND_IMAGE_FALLBACKS[brandKey] ||
          LOCAL_CATEGORY_IMAGES[cat.id] ||
          CATEGORY_IMAGES[cat.id] ||
          LOCAL_CATEGORY_IMAGES.default ||
          DEFAULT_CATEGORY_IMAGE,
        description: BRAND_DESCRIPTIONS[brandKey],
      };
    })
    .filter((slide): slide is NonNullable<typeof slide> => Boolean(slide))
    .sort(
      (a, b) =>
        BRAND_ORDER.indexOf(a.brandKey) - BRAND_ORDER.indexOf(b.brandKey)
    );

  const productSlideImageOverrides = new Map(
    (siteSettings?.homepageImages?.productSlides || [])
      .map((item) => [String(item?.id || '').trim(), normalizeAssetUrl(item?.image)])
      .filter((entry): entry is [string, string] => Boolean(entry[0]))
  );

  const productSlides = DEFAULT_PRODUCT_SLIDES.map((slide) => ({
    ...slide,
    image: productSlideImageOverrides.get(slide.id) || slide.image,
  }));

  const safeActiveProductIndex = Math.min(
    Math.max(activeProductIndex, 0),
    Math.max(productSlides.length - 1, 0)
  );
  const activeSlide =
    productSlides[safeActiveProductIndex] ||
    DEFAULT_PRODUCT_SLIDES[0];

  const contactPhone = siteSettings?.phone || '+7 775 702 92 98';
  const contactEmail = siteSettings?.email || 'ceo@arcmet.kz';
  const contactAddress = siteSettings?.address || 'Талапкерская 26а, офис 202';


  const leadModal = isLeadModalOpen ? (
    <div
      className="fixed inset-0 z-[9998] bg-black/50 flex items-center justify-center p-4"
      onClick={() => setIsLeadModalOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl p-8 text-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-black text-blue-900 uppercase tracking-tighter">Заказать консультацию</h3>
          <button
            type="button"
            onClick={() => setIsLeadModalOpen(false)}
            className="w-10 h-10 rounded-2xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700"
            aria-label="Закрыть"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <LeadForm
          onSuccess={() => {
            setIsLeadModalOpen(false);
            setIsLeadSuccessOpen(true);
          }}
        />
      </div>
    </div>
  ) : null;

  const leadSuccessModal = isLeadSuccessOpen ? (
    <div
      className="fixed inset-0 z-[9999] bg-black/55 flex items-center justify-center p-4"
      onClick={() => setIsLeadSuccessOpen(false)}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center text-2xl mb-5">
          <i className="fas fa-check"></i>
        </div>
        <h3 className="text-2xl font-black text-blue-900 uppercase tracking-tighter mb-2">Заявка отправлена</h3>
        <p className="text-gray-500 mb-7">Спасибо! Мы получили вашу заявку и свяжемся с вами в ближайшее время.</p>
        <button
          type="button"
          onClick={() => setIsLeadSuccessOpen(false)}
          className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-blue-600 text-white shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all"
        >
          Отлично
        </button>
      </div>
    </div>
  ) : null;

  useEffect(() => {
    if (!isLeadModalOpen && !isLeadSuccessOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isLeadSuccessOpen) setIsLeadSuccessOpen(false);
      else setIsLeadModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isLeadModalOpen, isLeadSuccessOpen]);

  useEffect(() => {
    if (productSlides.length === 0) {
      setActiveProductIndex(0);
      return;
    }
    setActiveProductIndex((prev) => Math.min(prev, productSlides.length - 1));
  }, [productSlides.length]);

  useEffect(() => {
    activeIndexRef.current = activeProductIndex;
    wheelDeltaAccumulatorRef.current = 0;
  }, [activeProductIndex]);

  useEffect(() => {
    slidesCountRef.current = productSlides.length;
  }, [productSlides.length]);

  useEffect(() => {
    const onGlobalWheel = (event: WheelEvent) => {
      if (window.innerWidth < 1024) return;

      const trackEl = catalogTrackRef.current;
      if (!trackEl) return;
      if (slidesCountRef.current < 2) return;

      const rect = trackEl.getBoundingClientRect();
      const stickyTop = 96;
      const inStickyZone = rect.top <= stickyTop + 12 && rect.bottom >= stickyTop + 260;
      if (!inStickyZone) return;

      // Normalize delta based on deltaMode
      let normalizedDelta = event.deltaY;
      if (event.deltaMode === 1) {
        // Line mode (rare) - convert to pixels
        normalizedDelta = event.deltaY * 16;
      } else if (event.deltaMode === 2) {
        // Page mode (very rare) - convert to pixels
        normalizedDelta = event.deltaY * window.innerHeight;
      }
      // deltaMode === 0 is pixel mode (most common for both mouse and trackpad)

      if (Math.abs(normalizedDelta) < 0.1) return;

      const currentIndex = activeIndexRef.current;
      const lastIndex = slidesCountRef.current - 1;
      const direction = normalizedDelta > 0 ? 1 : -1;
      const atFirst = currentIndex <= 0;
      const atLast = currentIndex >= lastIndex;
      const atBoundary = (direction > 0 && atLast) || (direction < 0 && atFirst);

      if (atBoundary) {
        wheelDeltaAccumulatorRef.current = 0;
        return;
      }

      event.preventDefault();

      const now = performance.now();
      const timeSinceLastWheelEvent = now - lastWheelEventTsRef.current;
      lastWheelEventTsRef.current = now;
      
      // Reset accumulator if too much time passed (user stopped scrolling)
      if (timeSinceLastWheelEvent > 180) {
        wheelDeltaAccumulatorRef.current = 0;
      }

      // If we're in cooldown after a slide switch, ignore
      if (wheelLockRef.current) {
        return;
      }

      // Accumulate delta for both mouse and trackpad
      wheelDeltaAccumulatorRef.current += normalizedDelta;
      
      // Threshold: 
      // - Mouse wheel usually gives 100px per click -> triggers immediately
      // - Trackpad gives 3-8px per event -> needs 6-15 events to reach 50px
      const threshold = 50;
      
      if (Math.abs(wheelDeltaAccumulatorRef.current) >= threshold) {
        wheelLockRef.current = true;
        lastSwitchTsRef.current = now;
        wheelDeltaAccumulatorRef.current = 0;

        setActiveProductIndex((prev) =>
          direction > 0
            ? Math.min(prev + 1, lastIndex)
            : Math.max(prev - 1, 0)
        );

        // Cooldown period before next slide can be triggered
        window.setTimeout(() => {
          wheelLockRef.current = false;
        }, 400);
      }
    };

    window.addEventListener('wheel', onGlobalWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', onGlobalWheel);
    };
  }, []);

  return (
    <div className="animate-fade-up">
      <Hero onConsultationClick={() => setIsLeadModalOpen(true)} slides={siteSettings?.heroSlides} />

      <AboutSlider slides={siteSettings?.aboutSlides?.length ? siteSettings.aboutSlides : undefined} />

      {/* Catalog Preview */}
      <section className="py-24 bg-gray-50 overflow-hidden" id="catalog">
        <div
          ref={catalogTrackRef}
          className="container mx-auto px-4 md:px-6 lg:min-h-[calc(100vh+2rem)]"
        >
          {/* ── Mobile layout ── */}
          <div
            className="lg:hidden"
            onTouchStart={(e) => { touchStartXRef.current = e.touches[0]?.clientX ?? 0; touchDeltaXRef.current = 0; }}
            onTouchMove={(e) => { touchDeltaXRef.current = (e.touches[0]?.clientX ?? touchStartXRef.current) - touchStartXRef.current; }}
            onTouchEnd={() => {
              const d = touchDeltaXRef.current;
              touchDeltaXRef.current = 0;
              if (Math.abs(d) < 40) return;
              if (d < 0) setActiveProductIndex((p) => Math.min(p + 1, productSlides.length - 1));
              else setActiveProductIndex((p) => Math.max(p - 1, 0));
            }}
          >
            <div className="overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white shadow-sm">
              <div className="relative h-64 sm:h-80 bg-gray-100">
                <img
                  src={activeSlide.image}
                  alt={activeSlide.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="relative bg-gray-100 px-5 py-6 pr-12">
                <h2 className="text-[10px] font-black tracking-[0.28em] uppercase text-gray-400 mb-3">
                  Наша продукция
                </h2>
                <div className="text-5xl font-light text-gray-300">
                  {String(safeActiveProductIndex + 1).padStart(2, '0')}
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mt-4 uppercase tracking-wide leading-snug">
                  {activeSlide.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed mt-3">
                  {activeSlide.description}
                </p>
                <Link
                  to={`/catalog?cat=${activeSlide.id}`}
                  className="inline-flex items-center gap-2 mt-5 text-blue-600 font-bold text-sm"
                >
                  Перейти в каталог <i className="fas fa-arrow-right"></i>
                </Link>
              </div>
            </div>
            {productSlides.length > 1 ? (
              <div className="mt-5 flex items-center justify-center gap-2.5">
                {productSlides.map((slide, idx) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => setActiveProductIndex(idx)}
                    className="h-6 px-1.5 flex items-center justify-center"
                    aria-label={`Показать слайд ${idx + 1}`}
                  >
                    <span
                      className={[
                        'block rounded-full transition-all',
                        idx === safeActiveProductIndex ? 'h-1.5 w-7 bg-orange-500' : 'h-1.5 w-1.5 bg-gray-300',
                      ].join(' ')}
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* ── Desktop sticky layout ── */}
          <div className="hidden lg:block lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] rounded-[2rem] overflow-hidden border border-gray-200 bg-white">
            <div className="grid grid-cols-1 lg:grid-cols-2 h-full min-h-[560px]">
                <div className="relative bg-gray-100 p-8 md:p-12 lg:p-16 pr-16 lg:pr-24 flex items-center">
                  <div className="max-w-xl">
                    <h2 className="text-4xl md:text-5xl font-black text-gray-800 uppercase tracking-tight leading-tight">
                      Наша продукция
                    </h2>

                    <div className="text-7xl md:text-8xl font-light text-gray-300 mt-10">
                      {String(safeActiveProductIndex + 1).padStart(2, '0')}
                    </div>

                    <h3 className="text-3xl md:text-4xl font-semibold text-gray-700 mt-12 uppercase tracking-wide">
                      {activeSlide.title}
                    </h3>
                    <p className="text-gray-500 text-lg leading-relaxed mt-6 max-w-lg">
                      {activeSlide.description}
                    </p>

                    <Link
                      to={`/catalog?cat=${activeSlide.id}`}
                      className="inline-flex items-center gap-2 mt-10 text-blue-600 font-bold hover:gap-4 transition-all"
                    >
                      Перейти в каталог <i className="fas fa-arrow-right"></i>
                    </Link>
                  </div>

                  {productSlides.length > 1 ? (
                    <div className="absolute right-6 md:right-8 top-1/2 -translate-y-1/2 flex flex-col gap-4">
                      {productSlides.map((slide, index) => (
                        <button
                          key={slide.id}
                          type="button"
                          onClick={() => setActiveProductIndex(index)}
                          className="w-3 h-8 flex items-center justify-center"
                          aria-label={`Показать слайд ${index + 1}`}
                        >
                          <span
                            className={[
                              'block w-1 rounded-full transition-all',
                              index === safeActiveProductIndex ? 'h-8 bg-orange-500' : 'h-2 bg-gray-300',
                            ].join(' ')}
                          ></span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="relative min-h-[320px] h-full bg-white">
                  <img
                    src={activeSlide.image}
                    alt={activeSlide.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
          </div>
        </div>
      </section>

      <PartnersSection images={siteSettings?.homepageImages} />

      {/* Contacts Section */}
      <section className="py-24 bg-blue-900 text-white" id="contacts">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <h2 className="text-4xl font-black mb-8">Свяжитесь с нами</h2>
              <p className="text-blue-200 text-lg mb-12">Остались вопросы? Оставьте заявку и наши менеджеры свяжутся с вами в ближайшее время для консультации.</p>
              
              <div className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-xl">
                    <i className="fas fa-phone"></i>
                  </div>
                  <div>
                    <div className="text-blue-300 text-xs font-bold uppercase mb-1">Телефон</div>
                    <a href={`tel:${contactPhone.replace(/\s/g, '')}`} className="text-xl font-bold">{contactPhone}</a>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-xl">
                    <i className="fas fa-envelope"></i>
                  </div>
                  <div>
                    <div className="text-blue-300 text-xs font-bold uppercase mb-1">Email</div>
                    <a href={`mailto:${contactEmail}`} className="text-xl font-bold">{contactEmail}</a>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-xl">
                    <i className="fas fa-map-marker-alt"></i>
                  </div>
                  <div>
                    <div className="text-blue-300 text-xs font-bold uppercase mb-1">Адрес</div>
                    <span className="text-xl font-bold">{contactAddress}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-3xl shadow-2xl text-gray-900 mt-12">
                <div className="px-4 pt-4 pb-2 text-sm font-bold text-blue-900 uppercase tracking-widest">Мы на карте</div>
                <div className="overflow-hidden rounded-2xl border border-gray-100">
                  <iframe
                    title="ARCMET location"
                    src="https://www.google.com/maps?q=%D0%A2%D0%B0%D0%BB%D0%B0%D0%BF%D0%BA%D0%B5%D1%80%D1%81%D0%BA%D0%B0%D1%8F%2026%D0%B0%2C%20%D0%BE%D1%84%D0%B8%D1%81%20202&output=embed"
                    className="w-full h-64"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-white p-10 rounded-3xl shadow-2xl text-gray-900">
                <h3 className="text-2xl font-bold text-blue-900 mb-8">Быстрая заявка</h3>
                <LeadForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {typeof document !== 'undefined' && leadModal ? createPortal(leadModal, document.body) : null}
      {typeof document !== 'undefined' && leadSuccessModal ? createPortal(leadSuccessModal, document.body) : null}
    </div>
  );
};

export default HomePage;
