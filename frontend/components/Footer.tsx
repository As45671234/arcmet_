
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SiteSettings } from '../types';
import logo from './img/logo.png';

interface FooterProps {
  siteSettings?: SiteSettings | null;
}

const Footer: React.FC<FooterProps> = ({ siteSettings }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const whatsappPhone = String(import.meta.env.VITE_WHATSAPP_PHONE || '').replace(/[^\d]/g, '');
  const whatsappUrl = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent('Здравствуйте! Хочу заказать консультацию.')}`
    : '';
  const phone = siteSettings?.phone || '+7 775 702 92 98';
  const email = siteSettings?.email || 'ceo@arcmet.kz';
  const address = siteSettings?.address || 'Талапкерская 26а, офис 202';
  const kaspiEnabled = siteSettings?.kaspiEnabled ?? true;
  const halykEnabled = siteSettings?.halykEnabled ?? true;
  const kaspiUrl = siteSettings?.kaspiUrl || 'https://kaspi.kz/shop/info/merchant/17410012/reviews/?productCode=136545715&masterSku=136545715&merchantSku=424870474&tabId=PRODUCT';
  const halykUrl = siteSettings?.halykUrl || 'https://halykbank.kz/';

  const goToSection = (id: string) => {
    const doScroll = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(doScroll, 50);
    } else {
      setTimeout(doScroll, 0);
    }
  };

  return (
    <footer className="bg-blue-950 pt-20 pb-10 text-white border-t border-white/5">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16 mb-20">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <img src={logo} alt="Logo" className="w-12 h-12" />
              <span className="text-2xl font-black tracking-tighter">ARCMET</span>
            </div>
            <p className="text-blue-300 leading-relaxed text-sm">
              Комплексные поставки инновационных строительных материалов. Прямой дистрибьютор крупнейших заводов СНГ и Европы.
            </p>
            <div className="flex gap-4">
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-white/5 hover:bg-blue-500 rounded-xl flex items-center justify-center transition-all"
                >
                  <i className="fab fa-whatsapp"></i>
                </a>
              ) : (
                <span className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center opacity-40 cursor-not-allowed">
                  <i className="fab fa-whatsapp"></i>
                </span>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-lg font-bold mb-8 text-blue-200">Разделы</h4>
            <ul className="space-y-4 text-sm text-blue-300">
              <li>
                <Link to="/catalog" className="hover:text-white transition-colors">
                  Каталог
                </Link>
              </li>
              <li>
                <button type="button" onClick={() => goToSection('about')} className="hover:text-white transition-colors text-left">
                  О компании
                </button>
              </li>
              <li>
                <button type="button" onClick={() => goToSection('partners')} className="hover:text-white transition-colors text-left">
                  Наши партнёры
                </button>
              </li>
              <li>
                <button type="button" onClick={() => goToSection('contacts')} className="hover:text-white transition-colors text-left">
                  Контакты
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-bold mb-8 text-blue-200">Контакты</h4>
            <div className="space-y-6 text-sm text-blue-300">
              <div className="flex gap-4">
                <i className="fas fa-phone mt-1 text-blue-500"></i>
                <div>
                  <div className="font-bold text-white mb-1">{phone}</div>
                  <div className="text-xs uppercase font-bold text-blue-400">Пн - Сб, 09:00 - 18:00</div>
                </div>
              </div>
              <div className="flex gap-4">
                <i className="fas fa-envelope mt-1 text-blue-500"></i>
                <div className="font-bold text-white">{email}</div>
              </div>
              <div className="flex gap-4">
                <i className="fas fa-map-marker-alt mt-1 text-blue-500"></i>
                <div className="font-bold text-white">{address}</div>
              </div>
            </div>
          </div>
        </div>

        {(kaspiEnabled || halykEnabled) && (
          <div className="mb-10 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-300">Наш магазин</div>
              <div className="mt-1 text-sm font-semibold text-white">Смотрите нас на Kaspi и Halyk</div>
            </div>
            <div className="flex flex-wrap gap-3">
              {kaspiEnabled ? (
                <a
                  href={kaspiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#ef3124] px-4 py-2.5 text-sm font-black uppercase tracking-wide text-white shadow-[0_10px_24px_rgba(239,49,36,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(239,49,36,0.34)]"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-white text-[#ef3124]">
                    <svg width="16" height="16" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 20C8 13.373 13.373 8 20 8s12 5.373 12 12-5.373 12-12 12S8 26.627 8 20z" fill="#ef3124"/>
                      <path d="M17 14l6 6-6 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <span>Kaspi</span>
                </a>
              ) : null}
              {halykEnabled ? (
                <a
                  href={halykUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#00a651] px-4 py-2.5 text-sm font-black uppercase tracking-wide text-white shadow-[0_10px_24px_rgba(0,166,81,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(0,166,81,0.32)]"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-white text-[#00a651]">
                    <svg width="16" height="16" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 20C8 13.373 13.373 8 20 8s12 5.373 12 12-5.373 12-12 12S8 26.627 8 20z" fill="#00a651"/>
                      <path d="M14 20h12M20 14v12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <span>Halyk</span>
                </a>
              ) : null}
            </div>
          </div>
        )}

        <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
            © 2021-2024 ARCMET. Все права защищены.
          </div>
          <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
            Разработка — <a href="#" className="text-white hover:text-blue-400 underline underline-offset-4">factum agency</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
