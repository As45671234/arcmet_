
import React from 'react';

const Footer: React.FC = () => {
  const whatsappPhone = String(import.meta.env.VITE_WHATSAPP_PHONE || '').replace(/[^\d]/g, '');
  const whatsappUrl = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent('Здравствуйте! Хочу заказать консультацию.')}`
    : '';

  return (
    <footer className="bg-blue-950 pt-20 pb-10 text-white border-t border-white/5">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-20">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <img src="/components/img/logo.png" alt="Logo" className="w-12 h-12" />
              <span className="text-2xl font-black tracking-tighter">ARCMET</span>
            </div>
            <p className="text-blue-300 leading-relaxed text-sm">
              Комплексные поставки инновационных строительных материалов. Прямой дистрибьютор крупнейших заводов СНГ и Европы.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 bg-white/5 hover:bg-blue-500 rounded-xl flex items-center justify-center transition-all">
                <i className="fab fa-instagram"></i>
              </a>
              <a href="#" className="w-10 h-10 bg-white/5 hover:bg-blue-500 rounded-xl flex items-center justify-center transition-all">
                <i className="fab fa-facebook-f"></i>
              </a>
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
              <a href="#" className="w-10 h-10 bg-white/5 hover:bg-blue-500 rounded-xl flex items-center justify-center transition-all">
                <i className="fab fa-telegram-plane"></i>
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-bold mb-8 text-blue-200">Разделы</h4>
            <ul className="space-y-4 text-sm text-blue-300">
              <li><a href="#" className="hover:text-white transition-colors">Ассортимент</a></li>
              <li><a href="#" className="hover:text-white transition-colors">О компании</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Наши партнёры</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Сертификаты</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Контакты</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-bold mb-8 text-blue-200">Мы есть</h4>
            <ul className="space-y-4 text-sm text-blue-300">
              <li><a href="#" className="hover:text-white transition-colors">Kaspi.kz Shop</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Halyk Market</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Forte Market</a></li>
              <li><a href="#" className="hover:text-white transition-colors">JMart</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-bold mb-8 text-blue-200">Контакты</h4>
            <div className="space-y-6 text-sm text-blue-300">
              <div className="flex gap-4">
                <i className="fas fa-phone mt-1 text-blue-500"></i>
                <div>
                  <div className="font-bold text-white mb-1">+7 700 797 85 33</div>
                  <div className="text-xs uppercase font-bold text-blue-400">Пн - Сб, 09:00 - 18:00</div>
                </div>
              </div>
              <div className="flex gap-4">
                <i className="fas fa-envelope mt-1 text-blue-500"></i>
                <div className="font-bold text-white">info@arcmet.kz</div>
              </div>
              <div className="flex gap-4">
                <i className="fas fa-map-marker-alt mt-1 text-blue-500"></i>
                <div className="font-bold text-white">г. Астана, ул. С. Сейфуллин, 27/3</div>
              </div>
            </div>
          </div>
        </div>

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
