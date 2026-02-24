
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Hero from '../components/Hero';
import LeadForm from '../components/LeadForm';
import PartnersSection from "../components/PartnersSection";
import AboutSlider from "../components/InfographicSection";
import { Category, Product } from '../types';
import { CATEGORY_IMAGES, DEFAULT_CATEGORY_IMAGE } from '../constants';
import { Link } from 'react-router-dom';

interface HomePageProps {
  categories: Category[];
  onAddToCart: (p: Product) => void;
}

const HomePage: React.FC<HomePageProps> = ({ categories }) => {
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);


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
            alert('Заявка отправлена!');
          }}
        />
      </div>
    </div>
  ) : null;

  useEffect(() => {
    if (!isLeadModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLeadModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isLeadModalOpen]);

  return (
    <div className="animate-fade-up">
      <Hero onConsultationClick={() => setIsLeadModalOpen(true)} />
      
      <AboutSlider />

      {/* Catalog Preview */}
      <section className="py-24 bg-gray-50 overflow-hidden" id="catalog">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-black text-blue-900 mb-6 uppercase tracking-tight">Наша продукция</h2>
            <p className="text-gray-600 text-lg">Выбирайте лучшее для своих проектов. Мы работаем с проверенными брендами: PLASTFOIL, RHEINZINK, ПЕНОПЛЭКС, FACHMANN.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {categories.length > 0 ? (
              categories.map(cat => {
                const firstItemImage = cat.items.find((item) => item.image)?.image;
                const imageSrc = cat.image || firstItemImage || CATEGORY_IMAGES[cat.id] || DEFAULT_CATEGORY_IMAGE;

                return (
                <div key={cat.id} className="group bg-white rounded-3xl shadow-sm hover:shadow-xl transition-all border border-gray-100 hover:border-blue-200 overflow-hidden">
                  <div className="relative aspect-square w-full bg-white">
                    <img
                      src={imageSrc}
                      alt={cat.title}
                      className="h-full w-full object-contain p-6"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-8">
                  <h3 className="text-2xl font-bold text-blue-900 mb-4">{cat.title}</h3>
                  <p className="text-gray-500 mb-8 text-sm line-clamp-3">Надежные материалы для строительства и ремонта. Ознакомьтесь с полным ассортиментом продукции бренда {cat.title}.</p>
                  <Link 
                    to={`/catalog?cat=${cat.id}`} 
                    className="inline-flex items-center gap-2 text-blue-600 font-bold hover:gap-4 transition-all"
                  >
                    Перейти в каталог <i className="fas fa-arrow-right"></i>
                  </Link>
                  </div>
                </div>
              );
              })
            ) : (
              <div className="col-span-full py-12 text-center bg-white rounded-3xl shadow-inner text-gray-400">
                Загрузите товары в админ панели для отображения здесь.
              </div>
            )}
          </div>
        </div>
      </section>

      <PartnersSection />

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
                    <a href="tel:+77077978533" className="text-xl font-bold">+7 707 797 85 33</a>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-xl">
                    <i className="fas fa-envelope"></i>
                  </div>
                  <div>
                    <div className="text-blue-300 text-xs font-bold uppercase mb-1">Email</div>
                    <a href="mailto:ceo@arcmet.kz" className="text-xl font-bold">ceo@arcmet.kz</a>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-xl">
                    <i className="fas fa-map-marker-alt"></i>
                  </div>
                  <div>
                    <div className="text-blue-300 text-xs font-bold uppercase mb-1">Адрес</div>
                    <span className="text-xl font-bold">Талапкерская 26а, офис 202</span>
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
    </div>
  );
};

export default HomePage;
