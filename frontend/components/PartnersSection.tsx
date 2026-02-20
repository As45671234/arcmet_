import React, { useEffect, useMemo, useRef } from 'react';

const PartnersSection: React.FC = () => {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const logos = useMemo(
    () => [
      '/logos/image-20.png',
      '/logos/frame.png',
      '/logos/frame2.png',
      '/logos/image-23.png',
      '/logos/image-24.png',
      '/logos/image-25.png',
      '/logos/image-26.png',
      '/logos/image-27.png',
      '/logos/image-28.png'
    ],
    []
  );

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    let raf = 0;
    let last = 0;

    const step = (t: number) => {
      if (!last) last = t;
      const dt = t - last;
      last = t;

      const speed = 0.05;
      el.scrollLeft += dt * speed;

      const half = el.scrollWidth / 2;
      if (el.scrollLeft >= half) el.scrollLeft = 0;

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const items = [...logos, ...logos];

  return (
    <section id="partners" className="bg-white">
      <div className="container mx-auto px-6 pt-24 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-blue-900 text-white p-10 md:p-14">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="text-xs font-black tracking-[0.3em] uppercase text-blue-200 mb-4">Партнёры</div>
              <h2 className="text-3xl md:text-5xl font-black leading-tight">
                Мы гордимся работой с нашими партнёрами
              </h2>
            </div>
            <p className="text-blue-100 leading-relaxed text-base md:text-lg">
              Мы сотрудничаем с проверенными производителями и поставщиками, чтобы обеспечивать стабильные поставки,
              качество материалов и прозрачные условия для наших клиентов.
            </p>
          </div>

          <img
            src="https://arcmet.kz/wp-content/themes/arcmet/img/gor-fon.svg"
            alt=""
            className="absolute right-0 bottom-0 w-[520px] max-w-none opacity-20 pointer-events-none select-none"
          />
        </div>
      </div>

     <div className="pb-24">
      <div
        ref={trackRef}
        className="w-full overflow-x-auto whitespace-nowrap scrollbar-none"
        style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >
        <div className="inline-flex gap-6 px-6">
          {items.map((src, idx) => (
            <div
              key={`${src}-${idx}`}
              className="
                inline-flex flex-shrink-0
                items-center justify-center
                w-[220px] h-[120px]
                bg-[rgb(202,202,202)]
                border border-gray-100
                rounded-2xl shadow-sm

                transition-all duration-300 ease-out
                origin-left

                hover:bg-[rgb(185,185,185)]
                hover:w-[385px]
                hover:shadow-md
                scrollbar-none
              "
            >
              <img
                src={src}
                alt=""
                className="max-h-[70px] max-w-[160px] object-contain"
              />
            </div>
          ))}
        </div>
      </div>
    </div>

    </section>
  );
};

export default PartnersSection;
