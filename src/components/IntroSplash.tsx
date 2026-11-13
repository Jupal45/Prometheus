import { motion, MotionConfig } from 'motion/react';

export function IntroSplash() {
  return (
    <MotionConfig reducedMotion="user">
      <div
        role="status"
        aria-label="Iniciando Prometheus"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/30 backdrop-blur-[3px] px-6 select-none"
      >
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.65,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="text-center"
        >
          <h1 className="font-display text-5xl sm:text-7xl font-semibold tracking-tight text-white drop-shadow-[0_4px_24px_rgba(2,6,23,0.65)]">
            Prometheus
          </h1>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
