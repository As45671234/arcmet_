import React, { useRef, useState } from 'react';
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
  const checkoutBlockRef = useRef<HTMLDivElement | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [isCheckoutStarted, setIsCheckoutStarted] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'courier_astana' | 'pickup' | 'transport_company'>('courier_astana');
  const [paymentMethod, setPaymentMethod] = useState<'kaspi' | 'halyk'>('kaspi');

  const deliveryLabels: Record<'courier_astana' | 'pickup' | 'transport_company', string> = {
    courier_astana: 'Доставка курьером по Астане',
    pickup: 'Самовывоз (бесплатно)',
    transport_company: 'Транспортная компания (inDrive, CDEK)',
  };

  const paymentLabels: Record<'kaspi' | 'halyk', string> = {
    kaspi: 'Kaspi Pay (Gold, Red, Рассрочка)',
    halyk: 'Halyk Bank (онлайн-оплата)',
  };

  const total = cart.reduce((sum, item) => sum + (item.prices.retail || 0) * item.quantity, 0);
  const canSubmitOrder = String(customerPhone || '').trim().length > 0 && String(customerEmail || '').trim().length > 0;

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    const phone = String(customerPhone || '').trim();
    const email = String(customerEmail || '').trim();
    if (!phone || !email) {
      setOrderError('Укажите телефон и email перед отправкой заказа.');
      return;
    }

    setIsOrdering(true);
    try {
      await sendOrder({
        customerName,
        customerPhone: phone,
        customerEmail: email,
        address,
        comment,
        deliveryMethod,
        paymentMethod,
        items: cart,
        total,
      });

      setOrderSuccess(true);
      setTimeout(() => {
        clearCart();
        setCustomerName('');
        setCustomerPhone('');
        setCustomerEmail('');
        setAddress('');
        setComment('');
        setDeliveryMethod('courier_astana');
        setPaymentMethod('kaspi');
        setOrderSuccess(false);
        navigate('/');
      }, 3000);
    } catch (e: any) {
      const msg = String(e?.message || '').trim();
      setOrderError(msg === 'invalid order' ? 'Проверьте телефон, email и товары в корзине.' : (msg || 'Ошибка при отправке заказа'));
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
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <h1 className="text-3xl sm:text-4xl font-black text-blue-900 mb-6 sm:mb-10 uppercase tracking-tighter">Оформление заказа</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10 items-start">
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {cart.map((item) => (
            <div
              key={item.id}
              className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-2xl overflow-hidden flex-shrink-0">
                <img
                  src={item.image ? item.image : '/logo.png'}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-grow min-w-0">
                <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">{item.brandOrGroup}</div>
                <h3 className="text-base sm:text-lg font-bold text-blue-900 line-clamp-1">{item.name}</h3>
                {item.sku ? <div className="text-[11px] text-gray-400 mt-1">Арт: {item.sku}</div> : null}
                <div className="text-sm text-gray-400 mt-1">
                  {item.prices.retail ? `${item.prices.retail.toLocaleString()} ₸ / ${item.unit}` : 'По запросу'}
                </div>
              </div>

              <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl self-start sm:self-auto">
                <button
                  onClick={() => updateQuantity(item.id, -1)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl hover:bg-white text-blue-900 font-bold transition-all shadow-sm"
                >
                  <i className="fas fa-minus"></i>
                </button>
                <span className="w-8 text-center font-black text-blue-900">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, 1)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl hover:bg-white text-blue-900 font-bold transition-all shadow-sm"
                >
                  <i className="fas fa-plus"></i>
                </button>
              </div>

              <div className="text-right min-w-[96px] sm:min-w-[120px] ml-auto">
                <div className="text-xl sm:text-2xl font-black text-blue-600">
                  {item.prices.retail ? `${(item.prices.retail * item.quantity).toLocaleString()} ₸` : '...'}
                </div>
              </div>

              <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-500 transition-colors p-2">
                <i className="fas fa-trash-alt"></i>
              </button>
            </div>
          ))}
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-3xl sm:rounded-[36px] shadow-2xl border border-gray-100 sticky top-28">
          <h3 className="text-2xl font-black text-blue-900 mb-6 uppercase tracking-tighter">Детали заказа</h3>

          <div className="space-y-4 mb-8">
            <div className="flex justify-between text-gray-500 font-medium">
              <span>Товары ({cart.length})</span>
              <span className="text-blue-900 font-black">{total.toLocaleString()} ₸</span>
            </div>
            {isCheckoutStarted && (
              <>
                <div className="flex justify-between text-gray-500 font-medium">
                  <span>Доставка</span>
                  <span className="text-blue-900 text-sm font-bold text-right max-w-[180px]">{deliveryLabels[deliveryMethod]}</span>
                </div>
                <div className="flex justify-between text-gray-500 font-medium">
                  <span>Оплата</span>
                  <span className="text-blue-900 text-sm font-bold text-right max-w-[180px]">{paymentLabels[paymentMethod]}</span>
                </div>
              </>
            )}
          </div>

          {!isCheckoutStarted ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setIsCheckoutStarted(true);
                  setTimeout(() => {
                    checkoutBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 60);
                }}
                className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-200 transition-all"
              >
                Оформить заказ
              </button>
              <p className="text-xs text-gray-400 text-center">Далее выберите доставку, оплату и заполните контакты</p>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                form="checkout-form"
                type="submit"
                disabled={isOrdering || !canSubmitOrder}
                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl transition-all flex items-center justify-center gap-3 ${
                  isOrdering || !canSubmitOrder ? 'bg-gray-200 text-gray-400 shadow-none cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                }`}
              >
                {isOrdering ? <i className="fas fa-spinner fa-spin"></i> : 'Подтвердить заказ'}
              </button>
              {!canSubmitOrder ? <div className="text-xs text-gray-400 text-center">Сначала заполните телефон и email в форме ниже</div> : null}
              <button
                type="button"
                onClick={() => setIsCheckoutStarted(false)}
                className="w-full py-3 rounded-2xl font-bold text-sm border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Изменить корзину
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link to="/catalog" className="text-blue-400 font-bold text-sm hover:underline">
              Вернуться к покупкам
            </Link>
          </div>
        </div>
      </div>

      {isCheckoutStarted && (
        <div ref={checkoutBlockRef} className="mt-8 sm:mt-10 bg-white border border-gray-100 rounded-3xl sm:rounded-[36px] shadow-sm p-5 sm:p-8 lg:p-10">
          <h2 className="text-xl sm:text-2xl font-black text-blue-900 uppercase tracking-tighter mb-5 sm:mb-6">Данные для оформления</h2>
          <form id="checkout-form" onSubmit={handleOrder} className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <div className="space-y-6">
              <div className="rounded-3xl border border-gray-100 p-5 bg-gray-50">
                <h4 className="text-sm font-black text-blue-900 uppercase tracking-widest mb-3">Способ доставки</h4>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('courier_astana')}
                    className={`w-full text-left rounded-2xl border px-4 py-3 transition-all ${deliveryMethod === 'courier_astana' ? 'border-blue-300 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-blue-200'}`}
                  >
                    <div className="font-bold text-blue-900 text-sm">Доставка курьером по Астане</div>
                    <div className="text-xs text-gray-500 mt-1">Стоимость доставки рассчитывается менеджером.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('pickup')}
                    className={`w-full text-left rounded-2xl border px-4 py-3 transition-all ${deliveryMethod === 'pickup' ? 'border-blue-300 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-blue-200'}`}
                  >
                    <div className="font-bold text-blue-900 text-sm">Самовывоз (бесплатно)</div>
                    <div className="text-xs text-gray-500 mt-1">Забрать заказ в офисе/складе по договоренности.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('transport_company')}
                    className={`w-full text-left rounded-2xl border px-4 py-3 transition-all ${deliveryMethod === 'transport_company' ? 'border-blue-300 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-blue-200'}`}
                  >
                    <div className="font-bold text-blue-900 text-sm">Транспортная компания (inDrive, CDEK)</div>
                    <div className="text-xs text-gray-500 mt-1">Доставку рассчитываем после подтверждения заказа.</div>
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-100 p-5 bg-gray-50">
                <h4 className="text-sm font-black text-blue-900 uppercase tracking-widest mb-3">Способ оплаты</h4>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('kaspi')}
                    className={`w-full text-left rounded-2xl border px-4 py-3 transition-all ${paymentMethod === 'kaspi' ? 'border-blue-300 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-blue-200'}`}
                  >
                    <div className="font-bold text-blue-900 text-sm">Kaspi Pay (Gold, Red, Рассрочка)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('halyk')}
                    className={`w-full text-left rounded-2xl border px-4 py-3 transition-all ${paymentMethod === 'halyk' ? 'border-blue-300 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-blue-200'}`}
                  >
                    <div className="font-bold text-blue-900 text-sm">Halyk Bank (онлайн-оплата)</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <input
                type="text"
                placeholder="Имя (не обязательно)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-3.5 outline-none focus:ring-4 focus:ring-blue-50 transition-all text-sm"
              />
              <input
                type="tel"
                placeholder="Телефон"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-3.5 outline-none focus:ring-4 focus:ring-blue-50 transition-all text-sm"
              />
              <input
                type="email"
                placeholder="Email"
                required
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-3.5 outline-none focus:ring-4 focus:ring-blue-50 transition-all text-sm"
              />
              <textarea
                placeholder="Адрес доставки"
                className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-3.5 outline-none focus:ring-4 focus:ring-blue-50 transition-all h-28 sm:h-32 text-sm"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              ></textarea>

              <textarea
                placeholder="Комментарий к заказу"
                className="w-full bg-white border border-gray-200 rounded-2xl px-5 py-3.5 outline-none focus:ring-4 focus:ring-blue-50 transition-all h-24 text-sm"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              ></textarea>
            </div>
          </form>
        </div>
      )}

      {orderSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-[40px] p-12 w-[95%] max-w-lg shadow-2xl text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-check text-3xl text-green-600"></i>
            </div>
            <h3 className="text-2xl font-black text-blue-900 mb-4 uppercase tracking-tighter">Заказ принят!</h3>
            <p className="text-gray-600 text-lg mb-6">Спасибо за заказ. Мы свяжемся с вами по указанным контактам в течение 30 минут.</p>
            <div className="bg-blue-50 rounded-3xl p-4 border border-blue-100 text-sm text-gray-700">
              <div className="font-bold text-blue-900 mb-2">Ваши контакты:</div>
              <div>{customerPhone}</div>
              <div>{customerEmail}</div>
            </div>
          </div>
        </div>
      )}

      {orderError && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-exclamation"></i>
              </div>
              <div>
                <h4 className="text-lg font-black text-gray-900">Не удалось отправить заказ</h4>
                <p className="text-sm text-gray-500 mt-1">{orderError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOrderError('')}
              className="mt-5 w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors"
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
