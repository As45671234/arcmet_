import React, { useEffect, useMemo, useState } from "react";

type Slide = {
  title: string;
  text: string;
  imageUrl: string;
  bullets?: string[];
};

type Props = {
  id?: string;
  heading?: string;
  slides?: Slide[];
};

const AUTOPLAY_MS = 7000;

export default function InfographicSection({
  id = "about",
  heading = "О компании",
  slides,
}: Props) {
  const data = useMemo<Slide[]>(
    () =>
      slides ?? [
        {
          title: "ARCMET — комплексные поставки",
          text:
            "Мы помогаем быстро укомплектовать объект современными строительными материалами: от гидроизоляции до фасадных решений.",
          bullets: ["Прямые поставки от производителей", "Стабильные складские позиции", "Поддержка на каждом этапе"],
          imageUrl: "/about/postavka.jpg",
        },
        {
          title: "Консультации и подбор решений",
          text:
            "Подбираем материалы под задачу, бюджет и сроки. Даем технические рекомендации и помогаем избежать ошибок на объекте.",
          bullets: ["Анализ проекта", "Подбор аналогов", "Экономия времени и бюджета"],
          imageUrl: "/about/consultation.jpg",
        },
        {
          title: "Контроль качества и логистика",
          text:
            "Отгружаем только проверенную продукцию и выстраиваем удобную доставку по городу и регионам.",
          bullets: ["Проверка партий", "Гибкие условия доставки", "Прозрачные документы"],
          imageUrl: "/about/control.jpg",
        },
        {
          title: "Партнерство на годы",
          text:
            "Строим долгосрочные отношения с клиентами и подрядчиками, чтобы проекты двигались без простоев.",
          bullets: ["Личный менеджер", "Оперативные ответы", "Поддержка сложных проектов"],
          imageUrl: "/about/partner.jpg",
        },
      ],
    [slides]
  );

  const [active, setActive] = useState(0);

  useEffect(() => {
    if (data.length <= 1) return;
    const timer = window.setInterval(() => {
      setActive((prev) => (prev + 1) % data.length);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [data.length]);

  const goNext = () => setActive((prev) => (prev + 1) % data.length);
  const goPrev = () => setActive((prev) => (prev - 1 + data.length) % data.length);

  const current = data[active];

  return (
    <section id={id} className="py-24 bg-slate-50 text-slate-900">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div>
            <div className="text-xs font-black tracking-[0.35em] uppercase text-blue-600 mb-4">
              {heading}
            </div>
            <h2 className="text-4xl md:text-5xl font-black leading-tight text-blue-900">
              Мы строим надежные цепочки поставок
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goPrev}
              className="w-12 h-12 rounded-2xl border border-slate-200 text-blue-900 hover:bg-blue-50 transition-all"
              aria-label="Предыдущий слайд"
            >
              <i className="fas fa-arrow-left"></i>
            </button>
            <button
              type="button"
              onClick={goNext}
              className="w-12 h-12 rounded-2xl border border-slate-200 text-blue-900 hover:bg-blue-50 transition-all"
              aria-label="Следующий слайд"
            >
              <i className="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 items-stretch">
          <div className="bg-white border border-slate-100 rounded-3xl p-8 md:p-10 shadow-xl">
            <div className="text-6xl md:text-7xl font-light text-blue-200 mb-6">
              {String(active + 1).padStart(2, "0")}
            </div>
            <h3 className="text-2xl md:text-3xl font-black mb-5 text-blue-900">{current.title}</h3>
            <p className="text-slate-600 leading-relaxed mb-8">{current.text}</p>
            {current.bullets && current.bullets.length > 0 ? (
              <ul className="space-y-3 text-sm text-slate-600">
                {current.bullets.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="relative rounded-3xl overflow-hidden border border-slate-100 shadow-2xl">
            <img src={current.imageUrl} alt={current.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/35 via-slate-900/10 to-transparent" />
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          {data.map((slide, idx) => (
            <button
              key={slide.title}
              type="button"
              onClick={() => setActive(idx)}
              className={[
                "px-4 py-2 rounded-full text-xs uppercase tracking-widest font-bold transition-all",
                idx === active ? "bg-blue-600 text-white" : "bg-white text-blue-900/70 border border-slate-200 hover:bg-blue-50",
              ].join(" ")}
            >
              {String(idx + 1).padStart(2, "0")}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
