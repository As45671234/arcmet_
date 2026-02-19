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
      else alert('Заявка отправлена!');
    } catch (err: any) {
      alert(err?.message || 'Ошибка при отправке');
    } finally {
      setIsSendingLead(false);
    }
  };

  return (
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
  );
};

export default LeadForm;
