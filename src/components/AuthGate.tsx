import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Delete,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { motion, MotionConfig } from 'motion/react';
import type { VaultManifest, VaultSecurityConfig } from '../types/vault';
import {
  calculatePasswordStrength,
  DEMO_CREDENTIALS,
  validatePhase1Password,
  validatePhase2Pin,
  validatePhase3Key,
  type AuthPhase,
} from '../utils/vaultState';
import {
  createNewVault,
  createOrUnlockDemoVault,
  unlockVaultWithThreePhases,
  verifyVaultPhase,
  wipeEntireVault,
} from '../utils/vaultStorage';

interface AuthGateProps {
  existingConfig: VaultSecurityConfig | null;
  onUnlockSuccess: (payload: {
    key: CryptoKey;
    manifest: VaultManifest;
    config: VaultSecurityConfig;
  }) => void;
  onVaultReset: () => void;
}

export function AuthGate({
  existingConfig,
  onUnlockSuccess,
  onVaultReset,
}: AuthGateProps) {
  const isSetup = existingConfig === null;

  const [phase, setPhase] = useState<AuthPhase>(1);
  const [phase1Password, setPhase1Password] = useState('');
  const [phase1Confirm, setPhase1Confirm] = useState('');
  const [phase2Pin, setPhase2Pin] = useState('');
  const [phase3Key, setPhase3Key] = useState('');
  const [phase3Prompt, setPhase3Prompt] = useState(
    'Palabra o recuerdo personal'
  );
  const [seedStarterContent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const strength = calculatePasswordStrength(phase1Password);

  async function handlePhase1Submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (isSetup) {
      const check = validatePhase1Password(phase1Password);
      if (!check.valid) {
        setError(check.error ?? 'Contraseña inválida.');
        return;
      }
      if (phase1Password !== phase1Confirm) {
        setError('Las contraseñas no coinciden.');
        return;
      }
      setPhase(2);
      return;
    }

    if (!phase1Password) {
      setError('Ingresa tu contraseña maestra para continuar.');
      return;
    }

    setIsBusy(true);
    try {
      const ok = await verifyVaultPhase(1, phase1Password);
      if (!ok) {
        setError('Contraseña maestra incorrecta. Verifica e intenta de nuevo.');
        return;
      }
      setPhase(2);
    } finally {
      setIsBusy(false);
    }
  }

  async function handlePhase2Submit(e?: FormEvent) {
    if (e) e.preventDefault();
    setError(null);

    const check = validatePhase2Pin(phase2Pin);
    if (!check.valid) {
      setError(check.error ?? 'PIN inválido.');
      return;
    }

    if (isSetup) {
      setPhase(3);
      return;
    }

    setIsBusy(true);
    try {
      const ok = await verifyVaultPhase(2, phase2Pin);
      if (!ok) {
        setError('El PIN de 6 dígitos no coincide.');
        return;
      }
      setPhase(3);
    } finally {
      setIsBusy(false);
    }
  }

  async function handlePhase3Submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const check = validatePhase3Key(phase3Key);
    if (!check.valid) {
      setError(check.error ?? 'Llave personal inválida.');
      return;
    }

    setIsBusy(true);
    try {
      if (isSetup) {
        const result = await createNewVault({
          phase1Password,
          phase2Pin,
          phase3Key,
          phase3Prompt,
          seedStarterContent,
        });
        onUnlockSuccess(result);
      } else {
        const ok3 = await verifyVaultPhase(3, phase3Key);
        if (!ok3) {
          setError('La llave personal no coincide.');
          return;
        }
        const result = await unlockVaultWithThreePhases(
          phase1Password,
          phase2Pin,
          phase3Key
        );
        onUnlockSuccess(result);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo descifrar el casillero.'
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDemoUnlock() {
    setError(null);
    setIsBusy(true);
    try {
      const result = await createOrUnlockDemoVault();
      onUnlockSuccess(result);
    } catch {
      setError('No se pudo preparar el casillero de demostración.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleWipeVault() {
    setIsBusy(true);
    try {
      await wipeEntireVault();
      setPhase(1);
      setPhase1Password('');
      setPhase1Confirm('');
      setPhase2Pin('');
      setPhase3Key('');
      setConfirmReset(false);
      setError(null);
      onVaultReset();
    } finally {
      setIsBusy(false);
    }
  }

  function appendPinDigit(digit: string) {
    if (phase2Pin.length >= 6) return;
    setError(null);
    setPhase2Pin((prev) => prev + digit);
  }

  function backspacePin() {
    setError(null);
    setPhase2Pin((prev) => prev.slice(0, -1));
  }

  const phaseTitles: Record<AuthPhase, { title: string; subtitle: string }> = {
    1: {
      title: isSetup
        ? 'Fase 1 · Contraseña maestra'
        : 'Fase 1 · Contraseña maestra',
      subtitle: isSetup
        ? 'Define la primera barrera de cifrado para proteger tu casillero.'
        : 'Ingresa tu contraseña principal para iniciar el desbloqueo.',
    },
    2: {
      title: 'Fase 2 · PIN de seguridad',
      subtitle: isSetup
        ? 'Elige un código numérico de 6 dígitos para la segunda capa.'
        : 'Introduce tu PIN personal de 6 dígitos.',
    },
    3: {
      title: 'Fase 3 · Llave personal',
      subtitle: isSetup
        ? 'Establece una palabra clave final para derivar la llave AES-256.'
        : existingConfig?.phase3Prompt || 'Ingresa tu llave personal de resguardo.',
    },
  };

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-lg"
        >
          {/* Prominent wordmark above vessel (no logo) */}
          <div className="mb-8 text-center">
            <h1 className="font-display text-5xl sm:text-6xl font-semibold tracking-tight text-white drop-shadow-[0_2px_16px_rgba(2,6,23,0.6)]">
              Prometheus
            </h1>
            <p className="mt-2.5 text-sm text-slate-100/90 drop-shadow-[0_1px_8px_rgba(2,6,23,0.6)]">
              {isSetup
                ? 'Configura tu casillero privado con cifrado en tres fases'
                : 'Casillero privado protegido en tres fases'}
            </p>
          </div>

        {/* Main Liquid Glass Vessel */}
        <section
          aria-label={isSetup ? 'Configuración de acceso' : 'Acceso en tres fases'}
          className="liquid-glass rounded-3xl p-6 sm:p-8"
        >
          {/* 3-Phase Horizontal Progress Stepper (Zero-Pill clean typography) */}
          <div className="mb-7 flex items-center justify-between border-b border-white/10 pb-4 text-xs">
            {([1, 2, 3] as AuthPhase[]).map((step) => {
              const completed = step < phase;
              const current = step === phase;
              return (
                <div
                  key={step}
                  className={`flex items-center gap-2 transition-colors ${
                    current
                      ? 'font-semibold text-white'
                      : completed
                      ? 'font-medium text-sky-300'
                      : 'text-slate-400'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] tabular-nums ${
                      current
                        ? 'bg-white text-slate-950'
                        : completed
                        ? 'bg-sky-400/20 text-sky-300'
                        : 'bg-white/[0.08] text-slate-400'
                    }`}
                  >
                    {completed ? <Check className="h-3 w-3" aria-hidden="true" /> : step}
                  </span>
                  <span className="whitespace-nowrap">Fase {step}</span>
                </div>
              );
            })}
          </div>

          <div className="mb-6">
            <h2 className="font-display text-lg font-semibold text-white">
              {phaseTitles[phase].title}
            </h2>
            <p className="mt-1 text-sm text-slate-300 leading-relaxed">
              {phaseTitles[phase].subtitle}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-rose-400/30 bg-rose-950/60 px-4 py-3 text-sm text-rose-200"
            >
              {error}
            </div>
          )}

          {/* PHASE 1 FORM */}
          {phase === 1 && (
            <form onSubmit={handlePhase1Submit} className="space-y-4">
              <div>
                <label
                  htmlFor="phase1-password"
                  className="mb-1.5 block text-xs font-medium text-slate-200"
                >
                  Contraseña maestra
                </label>
                <div className="relative">
                  <input
                    id="phase1-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isSetup ? 'new-password' : 'current-password'}
                    value={phase1Password}
                    onChange={(e) => {
                      setError(null);
                      setPhase1Password(e.target.value);
                    }}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 pr-11 text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/25"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={
                      showPassword
                        ? 'Ocultar contraseña maestra'
                        : 'Mostrar contraseña maestra'
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {isSetup && phase1Password.length > 0 && (
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                    <span>Fortaleza: {strength.label}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((bar) => (
                        <span
                          key={bar}
                          className={`h-1 w-6 rounded-full transition-colors ${
                            bar <= strength.score ? 'bg-sky-400' : 'bg-white/15'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isSetup && (
                <div>
                  <label
                    htmlFor="phase1-confirm"
                    className="mb-1.5 block text-xs font-medium text-slate-200"
                  >
                    Confirmar contraseña maestra
                  </label>
                  <input
                    id="phase1-confirm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={phase1Confirm}
                    onChange={(e) => {
                      setError(null);
                      setPhase1Confirm(e.target.value);
                    }}
                    placeholder="Repite tu contraseña"
                    className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/25"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isBusy}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-slate-950 transition-all hover:bg-slate-100 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <span>{isBusy ? 'Verificando...' : 'Continuar a Fase 2'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          )}

          {/* PHASE 2 FORM */}
          {phase === 2 && (
            <form onSubmit={handlePhase2Submit} className="space-y-5">
              <div>
                <label
                  htmlFor="phase2-pin"
                  className="mb-2 block text-xs font-medium text-slate-200"
                >
                  PIN de 6 dígitos
                </label>
                <input
                  id="phase2-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={phase2Pin}
                  onChange={(e) => {
                    setError(null);
                    setPhase2Pin(e.target.value.replace(/\D/g, '').slice(0, 6));
                  }}
                  placeholder="••••••"
                  className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-center font-mono text-xl tracking-[0.5em] text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/25"
                  autoFocus
                />
              </div>

              {/* Tactile frosted numeric pad */}
              <div className="grid grid-cols-3 gap-2.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => appendPinDigit(digit)}
                    className="liquid-glass-subtle rounded-xl py-3 font-mono text-base font-medium text-slate-100 transition-transform hover:bg-white/15 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setPhase(1);
                  }}
                  aria-label="Volver a Fase 1"
                  className="rounded-xl border border-white/10 bg-white/[0.06] py-3 text-xs font-medium text-slate-300 hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={() => appendPinDigit('0')}
                  className="liquid-glass-subtle rounded-xl py-3 font-mono text-base font-medium text-slate-100 transition-transform hover:bg-white/15 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={backspacePin}
                  aria-label="Borrar dígito del PIN"
                  className="flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] py-3 text-slate-300 hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <Delete className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <button
                type="submit"
                disabled={isBusy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-slate-950 transition-all hover:bg-slate-100 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <span>{isBusy ? 'Verificando PIN...' : 'Continuar a Fase 3'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          )}

          {/* PHASE 3 FORM */}
          {phase === 3 && (
            <form onSubmit={handlePhase3Submit} className="space-y-4">
              {isSetup && (
                <div>
                  <label
                    htmlFor="phase3-prompt"
                    className="mb-1.5 block text-xs font-medium text-slate-200"
                  >
                    Pregunta o recordatorio personal (visible al desbloquear)
                  </label>
                  <input
                    id="phase3-prompt"
                    type="text"
                    value={phase3Prompt}
                    onChange={(e) => setPhase3Prompt(e.target.value)}
                    placeholder="Ej. Ciudad de mi primer viaje"
                    className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/25"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="phase3-key"
                  className="mb-1.5 block text-xs font-medium text-slate-200"
                >
                  Llave personal de verificación
                </label>
                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="phase3-key"
                    type={showPassword ? 'text' : 'password'}
                    value={phase3Key}
                    onChange={(e) => {
                      setError(null);
                      setPhase3Key(e.target.value);
                    }}
                    placeholder="Ingresa tu palabra clave"
                    className="w-full rounded-xl border border-white/15 bg-slate-950/60 pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/25"
                    autoFocus
                  />
                </div>
              </div>

              {isSetup && (
                <p className="text-xs text-slate-400">
                  Tu casillero se creará vacío y listo para que importes tus
                  propios archivos privados.
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setPhase(2);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.08] px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Atrás</span>
                </button>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-slate-950 transition-all hover:bg-slate-100 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {isBusy
                      ? 'Cifrando acceso...'
                      : isSetup
                      ? 'Crear y abrir casillero'
                      : 'Desbloquear casillero'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Quiet secondary utility below the vessel */}
        <div className="mt-6 flex flex-col items-center gap-3 text-center text-xs text-slate-200">
          {isSetup ? (
            <>
              <button
                type="button"
                onClick={handleDemoUnlock}
                disabled={isBusy}
                className="font-medium text-white hover:text-sky-200 underline underline-offset-4 drop-shadow-[0_1px_6px_rgba(2,6,23,0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded px-2 py-1"
              >
                Abrir casillero vacío con claves rápidas
              </button>
              <p className="text-slate-200/85 drop-shadow-[0_1px_6px_rgba(2,6,23,0.75)]">
                Claves rápidas: <span className="font-mono">{DEMO_CREDENTIALS.phase1Password}</span> ·{' '}
                <span className="font-mono">{DEMO_CREDENTIALS.phase2Pin}</span> ·{' '}
                <span className="font-mono">{DEMO_CREDENTIALS.phase3Key}</span>
              </p>
            </>
          ) : (
            <div>
              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="text-slate-200/90 hover:text-white underline underline-offset-4 drop-shadow-[0_1px_6px_rgba(2,6,23,0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded px-2 py-1"
                >
                  Restablecer y crear un nuevo casillero
                </button>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-slate-900/90 px-4 py-2">
                  <span className="text-slate-200">
                    ¿Borrar archivos actuales y reiniciar?
                  </span>
                  <button
                    type="button"
                    onClick={handleWipeVault}
                    className="font-medium text-rose-400 hover:text-rose-300"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="font-medium text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        </motion.div>
      </main>
    </MotionConfig>
  );
}
