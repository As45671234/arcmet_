
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

interface HeaderProps {
  cartCount: number;
}

const Header: React.FC<HeaderProps> = ({ cartCount }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    { name: 'Каталог', path: '/catalog' },
    { name: 'О компании', sectionId: 'about' },
    { name: 'Партнёры', sectionId: 'partners' },
    { name: 'Контакты', sectionId: 'contacts' },
  ];

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
          <img src="/components/img/logo.png" alt="Logo" className="w-10 h-10" />
          <span className="text-xl font-extrabold tracking-tighter text-blue-900">ARCMET</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map(link => (
            link.sectionId ? (
              <button
                key={link.name}
                onClick={() => goToSection(link.sectionId as string)}
                className="text-sm font-semibold text-blue-900 hover:text-blue-600 transition-colors uppercase tracking-wider"
              >
                {link.name}
              </button>
            ) : (
              <Link 
                key={link.name} 
                to={link.path as string} 
                className="text-sm font-semibold text-blue-900 hover:text-blue-600 transition-colors uppercase tracking-wider"
              >
                {link.name}
              </Link>
            )
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link to="/cart" className="relative p-2 text-blue-900 hover:bg-blue-50 rounded-full transition-all">
            <i className="fas fa-shopping-cart text-lg"></i>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {cartCount}
              </span>
            )}
          </Link>
          <Link to="/admin" className="p-2 text-blue-900 hover:bg-blue-50 rounded-full transition-all" title="Admin">
            <i className="fas fa-user-shield text-lg"></i>
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
          {navLinks.map(link => (
            link.sectionId ? (
              <button
                key={link.name}
                className="text-lg font-bold text-blue-900 text-left"
                onClick={() => { setMobileMenuOpen(false); goToSection(link.sectionId as string); }}
              >
                {link.name}
              </button>
            ) : (
              <Link 
                key={link.name} 
                to={link.path as string} 
                className="text-lg font-bold text-blue-900"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.name}
              </Link>
            )
          ))}
        </div>
      )}
    </header>
  );
};

export default Header;
