import React, { useState } from 'react';
import { sendLead } from '../services/api';

interface LeadFormProps {
  onSuccess?: () => void;
}

const LeadForm: React.FC<LeadFormProps> = ({ onSuccess }) => {
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadMessage, setLeadMessage] = useState('');
  const [isSendingLead, setIsSendingLead] = useState(false);
  const [statusModal, setStatusModal] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingLead(true);
    try {
      await sendLead({
        name: leadName,
        phone: leadPhone,
        email: leadEmail,
        message: leadMessage || undefined,
      });
      setLeadName('');
      setLeadPhone('');
      setLeadEmail('');
      setLeadMessage('');
      if (onSuccess) onSuccess();
      else setStatusModal({ type: 'success', message: 'Заявка отправлена!' });
    } catch (err: any) {
      setStatusModal({ type: 'error', message: err?.message || 'Ошибка при отправке' });
    } finally {
      setIsSendingLead(false);
    }
  };

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Ваше имя (не обязательно)</label>
          <input
            type="text"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            placeholder="Александр"
            value={leadName}
            onChange={(e) => setLeadName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Телефон</label>
          <input
            type="tel"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            placeholder="+7 (___) ___-__-__"
            value={leadPhone}
            onChange={(e) => setLeadPhone(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Email</label>
          <input
            type="email"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            placeholder="you@mail.com"
            value={leadEmail}
            onChange={(e) => setLeadEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Сообщение</label>
          <textarea
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all min-h-[110px]"
            placeholder="Коротко опишите запрос..."
            value={leadMessage}
            onChange={(e) => setLeadMessage(e.target.value)}
          />
        </div>
        <button
          disabled={isSendingLead}
          className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all ${
            isSendingLead ? 'bg-gray-200 text-gray-400' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-200'
          }`}
        >
          {isSendingLead ? 'Отправка...' : 'Отправить заявку'}
        </button>
      </form>

      {statusModal ? (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={() => setStatusModal(null)}>
          <div
            className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-gray-100 p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${statusModal.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                <i className={`fas ${statusModal.type === 'success' ? 'fa-check' : 'fa-exclamation-triangle'}`}></i>
              </div>
              <div>
                <div className="text-lg font-black text-blue-900 uppercase tracking-tight">
                  {statusModal.type === 'success' ? 'Заявка отправлена' : 'Не удалось отправить'}
                </div>
                <div className="text-sm text-gray-500 mt-1">{statusModal.message}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStatusModal(null)}
              className={`w-full py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${statusModal.type === 'success' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
            >
              Понятно
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default LeadForm;
