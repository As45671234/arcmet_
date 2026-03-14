import React, { useEffect, useRef, useState } from "react";

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

export default function InfographicSection({
  id = "about",
  heading = "О компании",
  slides,
}: Props) {
  const data: Slide[] = slides ?? [
    {
      title: "ARCMET — комплексные поставки",
      text: "Мы помогаем быстро укомплектовать объект современными строительными материалами: от гидроизоляции до фасадных решений.",
      bullets: ["Прямые поставки от производителей", "Стабильные складские позиции", "Поддержка на каждом этапе"],
      imageUrl: "/about/postavka.jpg",
    },
    {
      title: "Консультации и подбор решений",
      text: "Подбираем материалы под задачу, бюджет и сроки. Даем технические рекомендации и помогаем избежать ошибок на объекте.",
      bullets: ["Анализ проекта", "Подбор аналогов", "Экономия времени и бюджета"],
      imageUrl: "/about/consultation.jpg",
    },
    {
      title: "Контроль качества и логистика",
      text: "Отгружаем только проверенную продукцию и выстраиваем удобную доставку по городу и регионам.",
      bullets: ["Проверка партий", "Гибкие условия доставки", "Прозрачные документы"],
      imageUrl: "/about/control.jpg",
    },
    {
      title: "Партнерство на годы",
      text: "Строим долгосрочные отношения с клиентами и подрядчиками, чтобы проекты двигались без простоев.",
      bullets: ["Личный менеджер", "Оперативные ответы", "Поддержка сложных проектов"],
      imageUrl: "/about/partner.jpg",
    },
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const wheelLockRef = useRef(false);
  const wheelAccRef = useRef(0);
  const activeIndexRef = useRef(0);
  const slidesCountRef = useRef(data.length);
  const lastWheelTsRef = useRef(0);
  const touchStartXRef = useRef(0);
  const touchDeltaXRef = useRef(0);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
    wheelAccRef.current = 0;
  }, [activeIndex]);

  useEffect(() => {
    slidesCountRef.current = data.length;
  }, [data.length]);

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (window.innerWidth < 1024) return;

      const trackEl = trackRef.current;
      if (!trackEl) return;
      if (slidesCountRef.current < 2) return;

      const rect = trackEl.getBoundingClientRect();
      const stickyTop = 96;
      const inStickyZone = rect.top <= stickyTop + 12 && rect.bottom >= stickyTop + 260;
      if (!inStickyZone) return;

      let delta = event.deltaY;
      if (event.deltaMode === 1) delta *= 16;
      else if (event.deltaMode === 2) delta *= window.innerHeight;
      if (Math.abs(delta) < 0.1) return;

      const currentIndex = activeIndexRef.current;
      const lastIndex = slidesCountRef.current - 1;
      const direction = delta > 0 ? 1 : -1;
      const atBoundary =
        (direction > 0 && currentIndex >= lastIndex) ||
        (direction < 0 && currentIndex <= 0);

      if (atBoundary) {
        wheelAccRef.current = 0;
        return;
      }

      event.preventDefault();

      const now = performance.now();
      if (now - lastWheelTsRef.current > 180) {
        wheelAccRef.current = 0;
      }
      lastWheelTsRef.current = now;

      if (wheelLockRef.current) return;

      wheelAccRef.current += delta;
      if (Math.abs(wheelAccRef.current) >= 50) {
        wheelLockRef.current = true;
        wheelAccRef.current = 0;
        setActiveIndex((prev) =>
          direction > 0 ? Math.min(prev + 1, lastIndex) : Math.max(prev - 1, 0)
        );
        window.setTimeout(() => {
          wheelLockRef.current = false;
        }, 400);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  const goToNext = () => {
    setActiveIndex((prev) => Math.min(prev + 1, data.length - 1));
  };

  const goToPrev = () => {
    setActiveIndex((prev) => Math.max(prev - 1, 0));
  };

  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? 0;
    touchDeltaXRef.current = 0;
  };

  const onTouchMove: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const currentX = event.touches[0]?.clientX ?? touchStartXRef.current;
    touchDeltaXRef.current = currentX - touchStartXRef.current;
  };

  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = () => {
    const delta = touchDeltaXRef.current;
    touchDeltaXRef.current = 0;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) goToNext();
    else goToPrev();
  };

  const current = data[activeIndex] ?? data[0];

  return (
    <section id={id} className="py-24 bg-white overflow-hidden">
      <div ref={trackRef} className="container mx-auto px-4 md:px-6 lg:min-h-[calc(100vh+2rem)]">
        <div className="lg:hidden" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white shadow-sm">
            <div className="relative h-64 sm:h-80 bg-gray-200">
              <img
                src={current.imageUrl}
                alt={current.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
            </div>
            <div className="relative bg-blue-900 px-5 py-6 pr-12">
              <div className="text-[10px] font-black tracking-[0.28em] uppercase text-blue-300 mb-3">
                {heading}
              </div>
              <div className="text-5xl font-light text-white">
                {String(activeIndex + 1).padStart(2, "0")}
              </div>
              <h3 className="text-xl font-semibold text-white mt-4 leading-snug">
                {current.title}
              </h3>
              <p className="text-blue-200 text-sm leading-relaxed mt-3">
                {current.text}
              </p>
              {current.bullets && current.bullets.length > 0 ? (
                <ul className="mt-4 space-y-1.5">
                  {current.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-blue-100 text-xs leading-relaxed">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          {data.length > 1 ? (
            <div className="mt-5 flex items-center justify-center gap-2.5">
              {data.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className="h-6 px-1.5 flex items-center justify-center"
                  aria-label={`Слайд ${idx + 1}`}
                >
                  <span
                    className={[
                      "block rounded-full transition-all",
                      idx === activeIndex ? "h-1.5 w-7 bg-orange-400" : "h-1.5 w-1.5 bg-slate-300",
                    ].join(" ")}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="hidden lg:block lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] rounded-[2rem] overflow-hidden border border-gray-200 bg-white">
          <div className="grid grid-cols-1 lg:grid-cols-2 h-full min-h-[560px]">

            {/* Left panel — dark blue */}
            <div className="relative bg-blue-900 p-8 md:p-12 lg:p-16 pr-16 lg:pr-24 flex items-center">
              <div className="max-w-xl">
                <div className="text-xs font-black tracking-[0.35em] uppercase text-blue-400 mb-6">
                  {heading}
                </div>
                <div className="text-7xl md:text-8xl font-light text-white">
                  {String(activeIndex + 1).padStart(2, "0")}
                </div>
                <h3 className="text-3xl md:text-4xl font-semibold text-white mt-8 leading-tight">
                  {current.title}
                </h3>
                <p className="text-blue-200 text-lg leading-relaxed mt-6 max-w-lg">
                  {current.text}
                </p>
                {current.bullets && current.bullets.length > 0 ? (
                  <ul className="mt-6 space-y-2">
                    {current.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-3 text-blue-100 text-sm">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {/* Vertical dot indicators */}
              {data.length > 1 ? (
                <div className="absolute right-6 md:right-8 top-1/2 -translate-y-1/2 flex flex-col gap-4">
                  {data.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveIndex(idx)}
                      className="w-3 h-8 flex items-center justify-center"
                      aria-label={`Слайд ${idx + 1}`}
                    >
                      <span
                        className={[
                          "block w-1 rounded-full transition-all",
                          idx === activeIndex ? "h-8 bg-orange-400" : "h-2 bg-blue-600",
                        ].join(" ")}
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Right panel — image */}
            <div className="relative min-h-[320px] h-full bg-gray-200">
              <img
                src={current.imageUrl}
                alt={current.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
