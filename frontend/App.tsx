import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Category, CartItem, Product, SiteSettings } from './types';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import CatalogPage from './pages/CatalogPage';
import CartPage from './pages/CartPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import { fetchCatalog, fetchSiteSettings, getAdminToken, clearAdminToken } from './services/api';

type ToastState = { msg: string; id: number; open: boolean } | null;

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const App: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);

  const [toast, setToast] = useState<ToastState>(null);
  const [toastTimer, setToastTimer] = useState<number | null>(null);
  const whatsappPhone = useMemo(
    () => String(import.meta.env.VITE_WHATSAPP_PHONE || '').replace(/[^\d]/g, ''),
    []
  );
  const whatsappText = useMemo(
    () => encodeURIComponent('Здравствуйте! Хочу заказать консультацию.'),
    []
  );
  const whatsappUrl = useMemo(
    () => (whatsappPhone ? `https://wa.me/${whatsappPhone}?text=${whatsappText}` : ''),
    [whatsappPhone, whatsappText]
  );

  useEffect(() => {
    const handler = () => {
      if (!whatsappUrl) return;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    };
    window.addEventListener('arcmet:open-whatsapp', handler as any);
    return () => window.removeEventListener('arcmet:open-whatsapp', handler as any);
  }, [whatsappUrl]);
  // Cart persistence
  useEffect(() => {
    const savedCart = localStorage.getItem('arcmet_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch {
        setCart([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('arcmet_cart', JSON.stringify(cart));
  }, [cart]);

  // Catalog from backend
  useEffect(() => {
    fetchCatalog()
      .then((data) => setCategories((data.categories || []) as any))
      .catch(() => setCategories([]));
  }, []);

  // Site settings
  useEffect(() => {
    fetchSiteSettings()
      .then((data) => { if (data?.settings) setSiteSettings(data.settings as SiteSettings); })
      .catch(() => {});
  }, []);

  // Admin session (token)
  useEffect(() => {
    const t = getAdminToken();
    if (t) setIsAdminAuthenticated(true);
  }, []);

  const showToast = (msg: string) => {
    if (toastTimer) window.clearTimeout(toastTimer);

    const id = Date.now();
    setToast({ msg, id, open: true });

    const t = window.setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, open: false } : prev));
      window.setTimeout(() => setToast(null), 320);
    }, 2200);

    setToastTimer(t);
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });

    showToast('Товар добавлен в корзину');
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const clearCart = () => setCart([]);

  return (
    <Router>
      <ScrollToTop />
      <div className="flex flex-col min-h-screen relative overflow-x-hidden">
        <Header
          cartCount={cart.reduce((sum, i) => sum + i.quantity, 0)}
          categories={categories}
          phone={siteSettings?.phone}
        />

        {toast && (
          <div className="fixed right-4 top-[76px] z-[9999] pointer-events-none">
            <div
              className={[
                'bg-blue-600 text-white px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold',
                'transition-all duration-300 ease-out',
                toast.open ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0',
              ].join(' ')}
            >
              {toast.msg}
            </div>
          </div>
        )}

        <main className="flex-grow pt-24 md:pt-32">
          <Routes>
            <Route path="/" element={<HomePage categories={categories} onAddToCart={addToCart} siteSettings={siteSettings} />} />
            <Route
              path="/catalog"
              element={<CatalogPage categories={categories} onAddToCart={addToCart} />}
            />
            <Route
              path="/cart"
              element={
                <CartPage
                  cart={cart}
                  removeFromCart={removeFromCart}
                  updateQuantity={updateQuantity}
                  clearCart={clearCart}
                />
              }
            />
            <Route
              path="/admin"
              element={
                isAdminAuthenticated ? (
                  <AdminDashboard
                    categories={categories}
                    setCategories={setCategories}
                    onLogout={() => {
                      clearAdminToken();
                      setIsAdminAuthenticated(false);
                    }}
                  />
                ) : (
                  <AdminLogin onLogin={() => setIsAdminAuthenticated(true)} />
                )
              }
            />
          </Routes>
        </main>

        <Footer siteSettings={siteSettings} />
      </div>
      {whatsappUrl ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed right-5 bottom-5 z-[9999] w-14 h-14 rounded-full bg-green-500 text-white shadow-2xl flex items-center justify-center hover:bg-green-600"
          aria-label="WhatsApp"
        >
          <i className="fab fa-whatsapp text-2xl"></i>
        </a>
      ) : null}
</Router>
  );
};

export default App;
