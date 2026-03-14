import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Category, Product } from '../types';
import noPhotoImage from '../components/img/no photo/no-photo.svg';

interface CatalogPageProps {
  categories: Category[];
  onAddToCart: (p: Product) => void;
}

const CatalogPage: React.FC<CatalogPageProps> = ({ categories, onAddToCart }) => {
  const hasWhatsapp = String(import.meta.env.VITE_WHATSAPP_PHONE || '').replace(/[^\d]/g, '').length > 0;
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedSub, setSelectedSub] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductImageIndex, setSelectedProductImageIndex] = useState<number>(0);
  const [cardImageIndexMap, setCardImageIndexMap] = useState<Record<string, number>>({});
  const [quantity, setQuantity] = useState<number>(1);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const cardTouchStartRef = useRef<Record<string, { x: number; y: number }>>({});
  const modalTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const cat = searchParams.get('cat');
    const sub = searchParams.get('sub') || '';

    if (cat) setSelectedCatId(cat);
    else if (categories.length > 0) setSelectedCatId(categories[0].id);

    setSelectedSub(sub);
  }, [searchParams, categories]);

  useEffect(() => {
    if (!selectedProduct) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedProduct(null);
        setQuantity(1);
        setIsZoomed(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedProduct]);

  const closeModal = () => {
    setSelectedProduct(null);
    setSelectedProductImageIndex(0);
    setQuantity(1);
    setIsZoomed(false);
  };

  const activeCategory = categories.find((c) => c.id === selectedCatId);

  const subcategories: string[] = Array.from<string>(
    new Set<string>(
      (activeCategory?.items || [])
        .map((p) => (p.brandOrGroup || '').trim())
        .filter(
          (s): s is string =>
            s &&
            s.length <= 40 &&
            !/для оформления заказа/i.test(s) &&
            !/достаточно отправить запрос/i.test(s)
        )
    )
  ).sort((a, b) => a.localeCompare(b, 'ru'));

  const filteredProducts =
    activeCategory?.items
      .filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.brandOrGroup || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
      .filter((p) => !selectedSub || (p.brandOrGroup || '').trim() === selectedSub) || [];

  const getProductImages = (product: Product) => {
    const list = [
      ...(Array.isArray(product.images) ? product.images : []),
      product.image || '',
    ]
      .map((item) => String(item || '').trim())
      .filter(Boolean);

    return Array.from(new Set(list));
  };

  const getProductImage = (product: Product) => {
    const images = getProductImages(product);
    return images[0] || noPhotoImage;
  };

  const getCardImage = (product: Product) => {
    const images = getProductImages(product);
    if (!images.length) return noPhotoImage;
    const idx = Math.max(0, Math.min(cardImageIndexMap[product.id] ?? 0, images.length - 1));
    return images[idx] || images[0] || noPhotoImage;
  };

  const SWIPE_THRESHOLD = 36;

  const switchCardImage = (product: Product, direction: 1 | -1) => {
    const images = getProductImages(product);
    if (images.length <= 1) return;

    setCardImageIndexMap((prev) => {
      const current = prev[product.id] ?? 0;
      const next = (current + direction + images.length) % images.length;
      return { ...prev, [product.id]: next };
    });
  };

  const switchModalImage = (direction: 1 | -1) => {
    if (!selectedProduct) return;
    const images = getProductImages(selectedProduct);
    if (images.length <= 1) return;
    setSelectedProductImageIndex((prev) => (prev + direction + images.length) % images.length);
    setIsZoomed(false);
  };

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const target = event.currentTarget;
    if (target.src.includes('no-photo.svg')) return;
    target.src = noPhotoImage;
  };

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="flex flex-col lg:flex-row gap-12">
        <aside className="w-full lg:w-72 flex-shrink-0">
          <div className="sticky top-32">
            <h2 className="text-2xl font-black text-blue-900 mb-8 uppercase tracking-tighter">Категории</h2>
            <div className="space-y-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCatId(cat.id);
                    setSelectedSub('');
                    setSearchParams({ cat: cat.id });
                  }}
                  className={`w-full text-left px-5 py-4 rounded-2xl font-bold transition-all flex items-center justify-between ${
                    selectedCatId === cat.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                      : 'bg-white text-blue-900 hover:bg-blue-50'
                  }`}
                >
                  <span>{cat.title}</span>
                  <span
                    className={`text-[10px] px-2 py-1 rounded-lg ${
                      selectedCatId === cat.id ? 'bg-blue-500' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {cat.items.length}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-12 bg-blue-900 p-8 rounded-3xl text-white">
              <h4 className="text-xl font-bold mb-4">Нужна помощь?</h4>
              <p className="text-blue-200 text-sm mb-6 leading-relaxed">
                Наши эксперты помогут подобрать материалы под ваш бюджет и технические требования.
              </p>
              <button
                className={`w-full py-3 font-bold rounded-xl text-sm ${
                  hasWhatsapp ? 'bg-yellow-500 text-blue-900' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                onClick={() => hasWhatsapp && window.dispatchEvent(new CustomEvent('arcmet:open-whatsapp'))}
                disabled={!hasWhatsapp}
              >
                WhatsApp
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-grow">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
            <div>
              <h1 className="text-4xl font-black text-blue-900 uppercase tracking-tighter">
                {activeCategory?.title || 'Все товары'}
              </h1>
              <p className="text-gray-500 mt-2">Найдено {filteredProducts.length} наименований</p>
            </div>
            <div className="relative w-full md:w-96">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Поиск по названию или бренду..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-2xl pl-12 pr-4 py-3 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
              />
            </div>
          </div>

          {subcategories.length > 0 ? (
            <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => {
                  setSelectedSub('');
                  const next = new URLSearchParams(searchParams);
                  next.delete('sub');
                  setSearchParams(next);
                }}
                className={`flex-shrink-0 px-4 py-2 rounded-2xl font-bold text-sm transition-all border ${
                  !selectedSub
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-900 border-gray-200 hover:bg-blue-50'
                }`}
              >
                Все
              </button>
              {subcategories.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSelectedSub(s);
                    const next = new URLSearchParams(searchParams);
                    next.set('sub', s);
                    setSearchParams(next);
                  }}
                  className={`flex-shrink-0 px-4 py-2 rounded-2xl font-bold text-sm transition-all border ${
                    selectedSub === s
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-blue-900 border-gray-200 hover:bg-blue-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-2xl transition-all overflow-hidden group cursor-pointer"
                  onClick={() => {
                    setSelectedProduct(product);
                    setSelectedProductImageIndex(0);
                    setIsZoomed(false);
                  }}
                >
                  <div className="h-56 bg-gray-100 relative flex items-center justify-center overflow-hidden">
                    <img
                      src={getCardImage(product)}
                      alt={product.name}
                      onError={handleImageError}
                      className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      decoding="async"
                      onTouchStart={(event) => {
                        const t = event.touches[0];
                        cardTouchStartRef.current[product.id] = { x: t.clientX, y: t.clientY };
                      }}
                      onTouchEnd={(event) => {
                        const start = cardTouchStartRef.current[product.id];
                        if (!start) return;
                        const t = event.changedTouches[0];
                        const dx = t.clientX - start.x;
                        const dy = t.clientY - start.y;
                        if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
                        event.stopPropagation();
                        switchCardImage(product, dx < 0 ? 1 : -1);
                      }}
                    />
                    {getProductImages(product).length > 1 ? (
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/75 backdrop-blur-sm px-2.5 py-1 rounded-full">
                        {getProductImages(product).map((_, idx) => {
                          const activeIdx = cardImageIndexMap[product.id] ?? 0;
                          const isActive = activeIdx === idx;
                          return (
                            <button
                              key={`${product.id}-dot-${idx}`}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setCardImageIndexMap((prev) => ({ ...prev, [product.id]: idx }));
                              }}
                              className={`w-2.5 h-2.5 rounded-full border transition-all ${isActive ? 'bg-blue-600 border-blue-600 scale-110' : 'bg-white border-blue-300 hover:bg-blue-100'}`}
                              aria-label={`Фото ${idx + 1}`}
                            />
                          );
                        })}
                      </div>
                    ) : null}
                    {product.brandOrGroup &&
                    product.brandOrGroup.trim() &&
                    product.brandOrGroup.length <= 40 &&
                    !/для оформления заказа/i.test(product.brandOrGroup) ? (
                      <div className="absolute top-4 left-4 bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-2xl uppercase tracking-widest">
                        {product.brandOrGroup}
                      </div>
                    ) : null}
                  </div>

                  <div className="p-6">
                    <h3 className="text-lg font-bold text-blue-900 mb-4 line-clamp-2 h-14">{product.name}</h3>

                    <div className="space-y-2 mb-6">
                      {Object.entries(product.attrs)
                        .slice(0, 3)
                        .map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between text-xs">
                            <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                            <span className="font-bold text-gray-700">{val}</span>
                          </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-6 border-t border-gray-50">
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                          Цена за {product.unit}
                        </div>
                        <div className="text-2xl font-black text-blue-600">
                          {product.prices.retail
                            ? `${product.prices.retail.toLocaleString()} ₸`
                            : product.prices.note || 'По запросу'}
                        </div>
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onAddToCart(product);
                        }}
                        className="w-12 h-12 bg-blue-900 text-white rounded-2xl flex items-center justify-center hover:bg-blue-600 hover:scale-110 transition-all shadow-lg"
                      >
                        <i className="fas fa-plus"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-20 text-center border-2 border-dashed border-gray-200">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300 text-3xl">
                <i className="fas fa-box-open"></i>
              </div>
              <h3 className="text-2xl font-bold text-gray-400">Товары не найдены</h3>
              <p className="text-gray-400 mt-2">Попробуйте изменить параметры поиска или категорию</p>
            </div>
          )}
        </div>
      </div>

      {selectedProduct ? (
        <div
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] lg:gap-8 bg-gradient-to-br from-white to-gray-50">
              {/* LEFT: Image Gallery */}
              <div className="bg-white lg:sticky lg:top-0 lg:h-screen lg:max-h-screen overflow-auto">
                <div className="relative group h-72 sm:h-80 lg:h-full bg-gray-100 flex items-center justify-center overflow-hidden">
                  <img
                    src={getProductImages(selectedProduct)[selectedProductImageIndex] || getProductImage(selectedProduct)}
                    alt={selectedProduct.name}
                    onError={handleImageError}
                    className={`max-w-full max-h-full object-contain transition-transform duration-500 ${
                      isZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in group-hover:scale-110'
                    }`}
                    onClick={() => setIsZoomed(!isZoomed)}
                    decoding="async"
                    onTouchStart={(event) => {
                      const t = event.touches[0];
                      modalTouchStartRef.current = { x: t.clientX, y: t.clientY };
                    }}
                    onTouchEnd={(event) => {
                      const start = modalTouchStartRef.current;
                      if (!start) return;
                      const t = event.changedTouches[0];
                      const dx = t.clientX - start.x;
                      const dy = t.clientY - start.y;
                      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
                      event.stopPropagation();
                      switchModalImage(dx < 0 ? 1 : -1);
                    }}
                  />

                  {getProductImages(selectedProduct).length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          switchModalImage(-1);
                        }}
                        className="hidden lg:flex absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/85 border border-gray-200 text-blue-900 items-center justify-center shadow-md hover:bg-white"
                        aria-label="Предыдущее фото"
                      >
                        <i className="fas fa-chevron-left"></i>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          switchModalImage(1);
                        }}
                        className="hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/85 border border-gray-200 text-blue-900 items-center justify-center shadow-md hover:bg-white"
                        aria-label="Следующее фото"
                      >
                        <i className="fas fa-chevron-right"></i>
                      </button>
                    </>
                  ) : null}

                  {getProductImages(selectedProduct).length > 1 ? (
                    <div className="absolute left-4 bottom-4 right-4 flex gap-2 overflow-x-auto py-1">
                      {getProductImages(selectedProduct).map((img, idx) => (
                        <button
                          key={`${img}-${idx}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProductImageIndex(idx);
                            setIsZoomed(false);
                          }}
                          className={`w-14 h-14 rounded-xl overflow-hidden border-2 flex-shrink-0 bg-white/90 ${idx === selectedProductImageIndex ? 'border-blue-500' : 'border-white/70'}`}
                          aria-label={`Фото ${idx + 1}`}
                        >
                          <img src={img} alt={`Фото ${idx + 1}`} className="w-full h-full object-contain" onError={handleImageError} decoding="async" />
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {/* Zoom Indicator */}
                  <div className="absolute bottom-4 right-4 bg-black/70 text-white text-xs px-3 py-1.5 rounded-xl font-semibold">
                    <i className={`fas ${isZoomed ? 'fa-search-minus' : 'fa-search-plus'} mr-1.5`}></i>
                    {isZoomed ? 'Выход' : 'Увеличить'}
                  </div>

                  <button
                    onClick={closeModal}
                    className="absolute top-4 right-4 lg:hidden w-10 h-10 bg-white/90 text-gray-600 rounded-full hover:bg-white shadow-lg"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>

              {/* RIGHT: Product Info */}
              <div className="p-5 lg:p-6 flex flex-col justify-between min-h-screen lg:min-h-auto relative">
                {/* Close Button (Desktop) */}
                <button
                  onClick={closeModal}
                  className="hidden lg:flex absolute top-6 right-6 w-11 h-11 bg-gradient-to-br from-gray-100 to-gray-50 text-gray-500 hover:text-gray-700 rounded-full items-center justify-center hover:shadow-md transition-all"
                  aria-label="Закрыть"
                >
                  <i className="fas fa-times text-lg"></i>
                </button>

                {/* Brand Badge */}
                {selectedProduct.brandOrGroup && selectedProduct.brandOrGroup.trim() ? (
                  <div className="inline-flex self-start mb-2 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-blue-200">
                    <i className="fas fa-tag mr-1"></i>
                    {selectedProduct.brandOrGroup}
                  </div>
                ) : null}

                {/* Title */}
                <h2 className="text-2xl lg:text-3xl font-black text-gray-900 leading-tight mb-2 pr-10">
                  {selectedProduct.name}
                </h2>

                {/* SKU & Stock Status */}
                <div className="flex items-center gap-3 mb-4">
                  {selectedProduct.sku ? (
                    <span className="text-xs text-gray-500 font-medium">
                      SKU: <span className="font-bold text-gray-700">{selectedProduct.sku}</span>
                    </span>
                  ) : null}
                  <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${
                    selectedProduct.inStock
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-orange-50 text-orange-700 border border-orange-200'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${selectedProduct.inStock ? 'bg-emerald-500' : 'bg-orange-500'}`}></span>
                    {selectedProduct.inStock ? 'В наличии' : 'По заказу'}
                  </div>
                </div>

                {/* Description */}
                {selectedProduct.description ? (
                  <p className="text-gray-600 mb-5 leading-relaxed text-sm">
                    {selectedProduct.description}
                  </p>
                ) : null}

                {/* Price Section - EMPHASIS */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl p-5 mb-6 shadow-lg">
                  <div className="text-xs font-bold opacity-90 mb-1.5 uppercase tracking-wider">
                    <i className="fas fa-tag mr-1.5"></i>Цена за {selectedProduct.unit}
                  </div>
                  <div className="text-4xl lg:text-5xl font-black">
                    {selectedProduct.prices.retail
                      ? `${selectedProduct.prices.retail.toLocaleString()} ₸`
                      : selectedProduct.prices.note || 'По запросу'}
                  </div>
                  {!selectedProduct.prices.retail && selectedProduct.prices.note && (
                    <div className="text-xs text-blue-100 mt-1 font-medium">{selectedProduct.prices.note}</div>
                  )}
                </div>

                {/* Specs as Grid */}
                {Object.keys(selectedProduct.attrs).length > 0 ? (
                  <div className="mb-6">
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <i className="fas fa-list text-blue-600"></i>Характеристики
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {Object.entries(selectedProduct.attrs)
                        .slice(0, 6)
                        .map(([key, val]) => (
                          <div
                            key={key}
                            className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 hover:border-blue-300 hover:bg-blue-50 transition-all"
                          >
                            <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">
                              {key.replace(/_/g, ' ')}
                            </div>
                            <div className="text-sm font-bold text-gray-900">{val}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}

                {/* Quantity & Actions */}
                <div className="space-y-3">
                  {/* Quantity Selector */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="px-3 py-2 hover:bg-gray-100 transition-colors text-sm"
                      >
                        <i className="fas fa-minus text-gray-600"></i>
                      </button>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-14 text-center font-bold text-base outline-none border-l border-r border-gray-200"
                        min="1"
                      />
                      <button
                        onClick={() => setQuantity(quantity + 1)}
                        className="px-3 py-2 hover:bg-gray-100 transition-colors text-sm"
                      >
                        <i className="fas fa-plus text-gray-600"></i>
                      </button>
                    </div>
                    <span className="text-sm text-gray-500 font-medium">шт.</span>
                  </div>

                  {/* Main Button */}
                  <button
                    onClick={() => {
                      for (let i = 0; i < quantity; i++) {
                        onAddToCart(selectedProduct);
                      }
                      closeModal();
                    }}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold px-5 py-3 rounded-lg text-base transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-shopping-cart"></i>
                    Добавить в корзину
                  </button>

                  {/* Secondary Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-sm">
                      <i className="fas fa-heart text-sm"></i>
                      <span className="hidden sm:inline">Сравнить</span>
                    </button>
                    <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-sm">
                      <i className="fas fa-share-alt text-sm"></i>
                      <span className="hidden sm:inline">Поделиться</span>
                    </button>
                  </div>
                </div>

                {/* Footer Info */}
                <div className="text-xs text-gray-500 space-y-1.5 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-truck text-green-600"></i>
                    <span>Быстрая доставка</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="fas fa-undo text-blue-600"></i>
                    <span>Возврат 30 дней</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="fas fa-shield-alt text-orange-600"></i>
                    <span>Гарантия</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CatalogPage;
