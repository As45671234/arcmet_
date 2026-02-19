
import React, { useState, useEffect } from 'react';

const slides = [
  {
    title: "Теплоизоляционные системы",
    subtitle: "ПРИОРИТЕТНОГО УРОВНЯ",
    desc: "Профессиональные решения для объектов любой сложности. Гарантия качества от ведущих производителей.",
    img: "https://hidropro.ru/upload/dev2fun.imagecompress/webp/img/2-kak-vyglyadet-gidroizolyaciya-fundamenta.webp",
    color: "bg-blue-900/60"
  },
  {
    title: "Инновационная гидроизоляция",
    subtitle: "НАДЁЖНОСТЬ И ДОЛГОВЕЧНОСТЬ",
    desc: "Полимерные мембраны нового поколения. Идеальная защита от влаги на 50+ лет.",
    img: "https://ir.ozone.ru/s3/multimedia-o/6775911780.jpg",
    color: "bg-gray-900/60"
  }
];

interface HeroProps {
  onConsultationClick: () => void;
}

const Hero: React.FC<HeroProps> = ({ onConsultationClick }) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrent(p => (p + 1) % slides.length), 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative h-[85vh] min-h-[600px] overflow-hidden">
      {slides.map((slide, idx) => (
        <div 
          key={idx}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === current ? 'opacity-100' : 'opacity-0'}`}
        >
          <img src={slide.img} alt={slide.title} className="w-full h-full object-cover" />
          <div className={`absolute inset-0 ${slide.color} flex items-center`}>
            <div className="container mx-auto px-6">
              <div className={`max-w-3xl transform transition-all duration-700 ${idx === current ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                <h2 className="text-blue-400 font-bold tracking-widest mb-4 uppercase text-sm md:text-base">
                  {slide.subtitle}
                </h2>
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-tight mb-6">
                  {slide.title}
                </h1>
                <p className="text-lg md:text-xl text-gray-200 mb-10 leading-relaxed max-w-xl">
                  {slide.desc}
                </p>
                <div className="flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={onConsultationClick}
                    className="px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-blue-900 font-bold rounded-lg transition-all transform hover:-translate-y-1 shadow-lg uppercase text-sm tracking-wider"
                  >
                    Заказать консультацию
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Indicators */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-3">
        {slides.map((_, idx) => (
          <button 
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-1.5 rounded-full transition-all ${idx === current ? 'w-12 bg-yellow-500' : 'w-4 bg-white/50'}`}
          />
        ))}
      </div>
    </section>
  );
};

export default Hero;
