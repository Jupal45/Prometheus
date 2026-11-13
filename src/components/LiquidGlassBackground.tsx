import bgTolucaNightUrl from '../assets/images/bg_toluca_night_forest_1794598712302.jpg';

export function LiquidGlassBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-slate-950"
    >
      <img
        src={bgTolucaNightUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover object-center scale-[1.01]"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(15, 23, 42, 0.34) 0%, rgba(15, 23, 42, 0.2) 45%, rgba(15, 23, 42, 0.48) 100%)',
        }}
      />
    </div>
  );
}
