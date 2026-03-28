
import React, { useMemo, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Category } from '../types';
import { DEFAULT_HOMEPAGE_IMAGES } from '../homepageDefaults';
import { normalizeAssetUrl } from '../utils/assetUrl';

interface HeaderProps {
  cartCount: number;
  categories: Category[];
  phone?: string;
  logoUrl?: string;
}

const Header: React.FC<HeaderProps> = ({ cartCount, categories, phone, logoUrl }) => {
  const PHONE = phone || '+7 775 702 92 98';
  const LOGO_URL = normalizeAssetUrl(logoUrl) || DEFAULT_HOMEPAGE_IMAGES.headerLogo;
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileCatalogOpen, setMobileCatalogOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setIsScrolled(y > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true } as any);
    return () => window.removeEventListener('scroll', handleScroll as any);
  }, []);

  const navLinks = [
    { name: 'О компании', sectionId: 'about' },
    { name: 'Партнёры', sectionId: 'partners' },
    { name: 'Контакты', sectionId: 'contacts' },
  ];

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.title.localeCompare(b.title, 'ru')),
    [categories]
  );

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
    <header
      className={`fixed top-0 left-0 z-[60] w-full border-b border-white/50 backdrop-blur-md shadow-xl ${
        isScrolled ? 'bg-white/90 py-3' : 'bg-white/70 py-4'
      } transition-colors duration-300 ease-out`}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src={LOGO_URL} alt="Logo" className="w-10 h-10 object-contain" />
          <span className="text-xl font-extrabold tracking-tighter text-blue-900">ARCMET</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <div className="relative group">
            <Link
              to="/catalog"
              className="text-sm font-semibold text-blue-900 hover:text-blue-600 transition-colors uppercase tracking-wider inline-flex items-center gap-2"
            >
              Каталог <i className="fas fa-chevron-down text-[10px] opacity-70"></i>
            </Link>
            {sortedCategories.length > 0 ? (
              <div className="absolute left-0 top-full pt-4 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-all">
                <div className="min-w-[260px] rounded-2xl bg-white shadow-2xl border border-gray-100 p-3">
                  <Link
                    to="/catalog"
                    className="block px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-50 rounded-xl transition-all"
                  >
                    Все товары
                  </Link>
                  <div className="h-px bg-gray-100 my-2" />
                  {sortedCategories.map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/catalog?cat=${cat.id}`}
                      className="block px-4 py-2 text-sm text-blue-900 hover:bg-blue-50 rounded-xl transition-all"
                    >
                      {cat.title}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {navLinks.map(link => (
            <button
              key={link.name}
              onClick={() => goToSection(link.sectionId as string)}
              className="text-sm font-semibold text-blue-900 hover:text-blue-600 transition-colors uppercase tracking-wider"
            >
              {link.name}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {/* Phone number */}
          <a
            href={`tel:${PHONE.replace(/\s/g, '')}`}
            className="hidden md:flex items-center gap-2 text-blue-900 font-bold text-sm hover:text-blue-600 transition-colors"
          >
            <i className="fas fa-phone text-xs"></i>
            <span>{PHONE}</span>
          </a>
          <Link to="/cart" className="relative p-2 text-blue-900 hover:bg-blue-50 rounded-full transition-all">
            <i className="fas fa-shopping-cart text-lg"></i>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {cartCount}
              </span>
            )}
          </Link>
          <button 
            className="md:hidden p-2 text-blue-900"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white border-t border-gray-100 shadow-xl p-6 flex flex-col gap-4">
          <div>
            <button
              type="button"
              className="text-lg font-bold text-blue-900 text-left w-full flex items-center justify-between"
              onClick={() => setMobileCatalogOpen((prev) => !prev)}
            >
              Каталог <i className={`fas fa-chevron-${mobileCatalogOpen ? 'up' : 'down'} text-xs`}></i>
            </button>
            {mobileCatalogOpen ? (
              <div className="mt-3 pl-3 flex flex-col gap-3">
                <Link
                  to="/catalog"
                  className="text-base font-semibold text-blue-900"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Все товары
                </Link>
                {sortedCategories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/catalog?cat=${cat.id}`}
                    className="text-base text-blue-900/80"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {cat.title}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          {navLinks.map(link => (
            <button
              key={link.name}
              className="text-lg font-bold text-blue-900 text-left"
              onClick={() => { setMobileMenuOpen(false); goToSection(link.sectionId as string); }}
            >
              {link.name}
            </button>
          ))}

          <a
            href={`tel:${PHONE.replace(/\s/g, '')}`}
            className="flex items-center gap-3 text-blue-900 font-bold text-lg"
          >
            <i className="fas fa-phone"></i>
            {PHONE}
          </a>
        </div>
      )}
    </header>
  );
};

export default Header;
