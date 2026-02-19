import React, { useState } from 'react';
import { sendOrder } from '../services/api';
import { CartItem } from '../types';
import { Link, useNavigate } from 'react-router-dom';

interface CartPageProps {
  cart: CartItem[];
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
}

const CartPage: React.FC<CartPageProps> = ({ cart, removeFromCart, updateQuantity, clearCart }) => {
  const navigate = useNavigate();
  const [isOrdering, setIsOrdering] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [address, setAddress] = useState('');

  const total = cart.reduce((sum, item) => sum + (item.prices.retail || 0) * item.quantity, 0);

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setIsOrdering(true);
    try {
      await sendOrder({
        customerName,
        customerPhone,
        customerEmail,
        address,
        items: cart,
        total,
      });

      alert('Заказ успешно сформирован. Мы свяжемся с вами по указанным контактам.');
      clearCart();
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setAddress('');
      navigate('/');
    } catch (e: any) {
      alert(e?.message || 'Ошибка при отправке заказа');
    } finally {
      setIsOrdering(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-6 py-32 text-center">
        <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8 text-3xl text-blue-200">
          <i className="fas fa-shopping-basket"></i>
        </div>
        <h1 className="text-4xl font-black text-blue-900 mb-6 uppercase tracking-tighter">Корзина пуста</h1>
        <p className="text-gray-500 mb-10 max-w-md mx-auto">Добавьте товары из нашего каталога, чтобы оформить заказ.</p>
        <Link
          to="/catalog"
          className="inline-block px-10 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 uppercase tracking-widest text-sm"
        >
          Перейти в каталог
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-12">
      <h1 className="text-4xl font-black text-blue-900 mb-12 uppercase tracking-tighter">Оформление заказа</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
        <div className="lg:col-span-2 space-y-4">
          {cart.map((item) => (
            <div
              key={item.id}
              className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-8"
            >
              <div className="w-24 h-24 bg-gray-100 rounded-2xl overflow-hidden flex-shrink-0">
                <img
                  src={item.image ? item.image : '/logo.png'}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-grow">
                <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">{item.brandOrGroup}</div>
                <h3 className="text-lg font-bold text-blue-900 line-clamp-1">{item.name}</h3>
                <div className="text-sm text-gray-400 mt-1">
                  {item.prices.retail ? `${item.prices.retail.toLocaleString()} ₸ / ${item.unit}` : 'По запросу'}
                </div>
              </div>

              <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-2xl">
                <button
                  onClick={() => updateQuantity(item.id, -1)}
                  className="w-10 h-10 rounded-xl hover:bg-white text-blue-900 font-bold transition-all shadow-sm"
                >
                  <i className="fas fa-minus"></i>
                </button>
                <span className="w-8 text-center font-black text-blue-900">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, 1)}
                  className="w-10 h-10 rounded-xl hover:bg-white text-blue-900 font-bold transition-all shadow-sm"
                >
                  <i className="fas fa-plus"></i>
                </button>
              </div>

              <div className="text-right min-w-[120px]">
                <div className="text-2xl font-black text-blue-600">
                  {item.prices.retail ? `${(item.prices.retail * item.quantity).toLocaleString()} ₸` : '...'}
                </div>
              </div>

              <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-500 transition-colors p-2">
                <i className="fas fa-trash-alt"></i>
              </button>
            </div>
          ))}
        </div>

        <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-gray-100 sticky top-32">
          <h3 className="text-2xl font-black text-blue-900 mb-8 uppercase tracking-tighter">Детали заказа</h3>

          <div className="space-y-4 mb-8">
            <div className="flex justify-between text-gray-500 font-medium">
              <span>Товары ({cart.length})</span>
              <span className="text-blue-900 font-black">{total.toLocaleString()} ₸</span>
            </div>
          </div>

          <form onSubmit={handleOrder} className="space-y-4">
            <input
              type="text"
              placeholder="Имя (не обязательно)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-blue-50 transition-all text-sm"
            />
            <input
              type="tel"
              placeholder="Телефон"
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-blue-50 transition-all text-sm"
            />
            <input
              type="email"
              placeholder="Email"
              required
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-blue-50 transition-all text-sm"
            />
            <textarea
              placeholder="Адрес доставки и комментарий"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-blue-50 transition-all h-32 text-sm"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            ></textarea>

            <button
              type="submit"
              disabled={isOrdering}
              className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl transition-all flex items-center justify-center gap-3 ${
                isOrdering ? 'bg-gray-200 text-gray-400' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
              }`}
            >
              {isOrdering ? <i className="fas fa-spinner fa-spin"></i> : 'Подтвердить заказ'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/catalog" className="text-blue-400 font-bold text-sm hover:underline">
              Вернуться к покупкам
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
