
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Category, Product } from '../types';

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

  useEffect(() => {
    const cat = searchParams.get('cat');
    const sub = searchParams.get('sub') || '';
    if (cat) setSelectedCatId(cat);
    else {
      if (categories.length > 0) setSelectedCatId(categories[0].id);
    }
    setSelectedSub(sub);
  }, [searchParams, categories]);

  const activeCategory = categories.find(c => c.id === selectedCatId);

  const subcategories = Array.from(
    new Set(
      (activeCategory?.items || [])
        .map((p) => (p.brandOrGroup || '').trim())
        .filter((s) =>
          s &&
          s.length <= 40 &&
          !/для оформления заказа/i.test(s) &&
          !/достаточно отправить запрос/i.test(s)
        )
    )
  ).sort((a, b) => a.localeCompare(b, 'ru'));

  const filteredProducts = activeCategory?.items.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.brandOrGroup||'').toLowerCase().includes(searchQuery.toLowerCase())
  ).filter(p => !selectedSub || (p.brandOrGroup || '').trim() === selectedSub) || [];

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Sidebar */}
        <aside className="w-full lg:w-72 flex-shrink-0">
          <div className="sticky top-32">
            <h2 className="text-2xl font-black text-blue-900 mb-8 uppercase tracking-tighter">Категории</h2>
            <div className="space-y-2">
              {categories.map(cat => (
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
                  <span className={`text-[10px] px-2 py-1 rounded-lg ${selectedCatId === cat.id ? 'bg-blue-500' : 'bg-gray-100 text-gray-500'}`}>
                    {cat.items.length}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-12 bg-blue-900 p-8 rounded-3xl text-white">
              <h4 className="text-xl font-bold mb-4">Нужна помощь?</h4>
              <p className="text-blue-200 text-sm mb-6 leading-relaxed">Наши эксперты помогут подобрать материалы под ваш бюджет и технические требования.</p>
              <button
                className={`w-full py-3 font-bold rounded-xl text-sm ${hasWhatsapp ? 'bg-yellow-500 text-blue-900' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                onClick={() => hasWhatsapp && window.dispatchEvent(new CustomEvent('arcmet:open-whatsapp'))}
                disabled={!hasWhatsapp}
              >
                WhatsApp
              </button>
            </div>
          </div>
        </aside>

        {/* Content */}
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
                  !selectedSub ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-900 border-gray-200 hover:bg-blue-50'
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
                    selectedSub === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-900 border-gray-200 hover:bg-blue-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {filteredProducts.map(product => (
                <div key={product.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-2xl transition-all overflow-hidden group">
                  {(product.image && product.image.trim()) ? (
              <div className="h-56 bg-gray-100 relative flex items-center justify-center overflow-hidden">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {product.brandOrGroup && product.brandOrGroup.trim() && product.brandOrGroup.length <= 40 && !/для оформления заказа/i.test(product.brandOrGroup) ? (
                  <div className="absolute top-4 left-4 bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-2xl uppercase tracking-widest">
                    {product.brandOrGroup}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="px-6 pt-6">
                {product.brandOrGroup && product.brandOrGroup.trim() && product.brandOrGroup.length <= 40 && !/для оформления заказа/i.test(product.brandOrGroup) ? (
                  <div className="inline-block bg-blue-50 text-blue-900 text-[10px] font-bold px-3 py-1.5 rounded-2xl uppercase tracking-widest mb-4">
                    {product.brandOrGroup}
                  </div>
                ) : null}
              </div>
            )}
            <div className="p-6">
                    <h3 className="text-lg font-bold text-blue-900 mb-4 line-clamp-2 h-14">{product.name}</h3>
                    
                    <div className="space-y-2 mb-6">
                      {Object.entries(product.attrs).slice(0, 3).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="font-bold text-gray-700">{val}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-6 border-t border-gray-50">
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Цена за {product.unit}</div>
                        <div className="text-2xl font-black text-blue-600">
                          {product.prices.retail 
                            ? `${product.prices.retail.toLocaleString()} ₸` 
                            : (product.prices.note || 'По запросу')}
                        </div>
                      </div>
                      <button 
                        onClick={() => onAddToCart(product)}
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
    </div>
  );
};

export default CatalogPage;
