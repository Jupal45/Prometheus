import { useRef, useState, type FormEvent } from 'react';
import {
  Download,
  HardDriveDownload,
  KeyRound,
  Lock,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import type { VaultManifest, VaultSecurityConfig } from '../types/vault';
import { formatBytes, formatShortDate } from '../utils/fileClassification';
import {
  validatePhase1Password,
  validatePhase2Pin,
  validatePhase3Key,
} from '../utils/vaultState';

interface SecurityViewProps {
  manifest: VaultManifest;
  config: VaultSecurityConfig;
  onLockVault: () => void;
  onExportBackup: () => Promise<void>;
  onRestoreBackup: (file: File) => Promise<number>;
  onUpdateCredentials: (params: {
    phase1Password: string;
    phase2Pin: string;
    phase3Key: string;
    phase3Prompt: string;
  }) => Promise<void>;
  onWipeVault: () => Promise<void>;
}

export function SecurityView({
  manifest,
  config,
  onLockVault,
  onExportBackup,
  onRestoreBackup,
  onUpdateCredentials,
  onWipeVault,
}: SecurityViewProps) {
  const [editing, setEditing] = useState(false);
  const [phase1, setPhase1] = useState('');
  const [phase2, setPhase2] = useState('');
  const [phase3, setPhase3] = useState('');
  const [prompt, setPrompt] = useState(config.phase3Prompt);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  const totalBytes = manifest.files.reduce((acc, f) => acc + f.size, 0);

  async function handleExportClick() {
    setErrorMsg(null);
    setStatusMsg(null);
    setIsBackingUp(true);
    try {
      await onExportBackup();
      setStatusMsg(
        `Respaldo descargado con ${manifest.files.length} archivos, ${manifest.folders.length} archiveros y ${manifest.playlists.length} playlists.`
      );
    } catch {
      setErrorMsg('No se pudo generar el respaldo del casillero.');
    } finally {
      setIsBackingUp(false);
    }
  }

  async function handleRestoreFileSelected(file: File) {
    setErrorMsg(null);
    setStatusMsg(null);
    setIsBackingUp(true);
    try {
      const restoredCount = await onRestoreBackup(file);
      setStatusMsg(
        `Respaldo restaurado y cifrado: ${restoredCount} archivos recuperados en tu casillero.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo restaurar el archivo de respaldo.'
      );
    } finally {
      setIsBackingUp(false);
    }
  }

  async function handleSaveCredentials(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    const c1 = validatePhase1Password(phase1);
    if (!c1.valid) {
      setErrorMsg(c1.error ?? 'Contraseña inválida.');
      return;
    }
    const c2 = validatePhase2Pin(phase2);
    if (!c2.valid) {
      setErrorMsg(c2.error ?? 'PIN inválido.');
      return;
    }
    const c3 = validatePhase3Key(phase3);
    if (!c3.valid) {
      setErrorMsg(c3.error ?? 'Llave personal inválida.');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateCredentials({
        phase1Password: phase1,
        phase2Pin: phase2,
        phase3Key: phase3,
        phase3Prompt: prompt,
      });
      setPhase1('');
      setPhase2('');
      setPhase3('');
      setEditing(false);
      setStatusMsg(
        'Credenciales de las 3 fases actualizadas y todo el casillero re-cifrado.'
      );
    } catch {
      setErrorMsg('No se pudieron actualizar las llaves de cifrado.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      aria-label="Seguridad y cifrado del casillero"
      className="mx-auto max-w-4xl px-4 py-8 sm:px-8 pb-28"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(2,6,23,0.65)]">
            Seguridad del casillero
          </h1>
          <p className="mt-1 text-sm text-slate-100/90 drop-shadow-[0_1px_6px_rgba(2,6,23,0.65)]">
            Cifrado local AES-256-GCM derivado de tus tres fases de acceso.
          </p>
        </div>

        <button
          type="button"
          onClick={onLockVault}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-medium text-slate-950 hover:bg-slate-100 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Bloquear casillero ahora</span>
        </button>
      </div>

      {statusMsg && (
        <div
          role="status"
          className="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-950/60 px-4 py-3 text-sm text-emerald-200"
        >
          {statusMsg}
        </div>
      )}

      {/* Summary Grid */}
      <div className="liquid-glass mb-6 grid grid-cols-1 divide-y divide-white/[0.08] rounded-3xl sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="p-6">
          <p className="text-xs text-slate-300">Archivos cifrados</p>
          <p className="mt-1.5 font-display text-2xl font-semibold text-white tabular-nums">
            {manifest.files.length}
          </p>
        </div>
        <div className="p-6">
          <p className="text-xs text-slate-300">Espacio protegido</p>
          <p className="mt-1.5 font-display text-2xl font-semibold text-white tabular-nums">
            {formatBytes(totalBytes)}
          </p>
        </div>
        <div className="p-6">
          <p className="text-xs text-slate-300">Última actualización</p>
          <p className="mt-1.5 font-display text-2xl font-semibold text-white tabular-nums">
            {formatShortDate(config.updatedAt)}
          </p>
        </div>
      </div>

      {/* Backup Export & Restore */}
      <div className="liquid-glass mb-6 rounded-3xl p-6 sm:p-8">
        <input
          ref={restoreInputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleRestoreFileSelected(file);
            e.target.value = '';
          }}
        />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <HardDriveDownload
                className="h-5 w-5 text-sky-300"
                aria-hidden="true"
              />
              <h2 className="font-display text-base font-semibold text-white">
                Respaldo de datos y archivos
              </h2>
            </div>
            <p className="mt-1.5 max-w-xl text-xs sm:text-sm text-slate-300 leading-relaxed">
              Guarda una copia completa en formato ZIP con todos tus archivos,
              archiveros y playlists de música para conservarlos o restaurarlos
              cuando quieras.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportClick}
              disabled={isBackingUp}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-medium text-slate-950 hover:bg-slate-100 disabled:opacity-60 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {isBackingUp ? 'Generando...' : 'Guardar respaldo (.zip)'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => restoreInputRef.current?.click()}
              disabled={isBackingUp}
              className="liquid-glass-subtle inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/15 hover:text-white disabled:opacity-60 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Restaurar respaldo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active 3 Phases */}
      <div className="liquid-glass mb-6 rounded-3xl p-6 sm:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-sky-300" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-white">
              Barreras activas de acceso
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditing((v) => !v);
              setErrorMsg(null);
            }}
            className="liquid-glass-subtle inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/15 hover:text-white"
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{editing ? 'Cancelar cambio' : 'Cambiar claves de 3 fases'}</span>
          </button>
        </div>

        <dl className="divide-y divide-white/[0.08] text-sm">
          <div className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <dt className="font-medium text-slate-100">
              Fase 1 · Contraseña maestra
            </dt>
            <dd className="text-xs text-slate-300 tabular-nums">
              Verificada con PBKDF2-SHA256 ({config.iterations.toLocaleString('es-ES')} iteraciones)
            </dd>
          </div>
          <div className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <dt className="font-medium text-slate-100">
              Fase 2 · PIN numérico
            </dt>
            <dd className="text-xs text-slate-300">
              6 dígitos independientes protegidos por sal criptográfica
            </dd>
          </div>
          <div className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <dt className="font-medium text-slate-100">
              Fase 3 · Llave personal
            </dt>
            <dd className="text-xs text-slate-300">
              Recordatorio: {config.phase3Prompt}
            </dd>
          </div>
        </dl>

        {editing && (
          <form
            onSubmit={handleSaveCredentials}
            className="mt-6 space-y-4 border-t border-white/[0.08] pt-6"
          >
            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl border border-rose-400/30 bg-rose-950/60 px-4 py-3 text-xs text-rose-200"
              >
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="sec-p1"
                  className="mb-1.5 block text-xs font-medium text-slate-200"
                >
                  Nueva contraseña maestra (Fase 1)
                </label>
                <input
                  id="sec-p1"
                  type="password"
                  value={phase1}
                  onChange={(e) => setPhase1(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl border border-white/15 bg-slate-950/65 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="sec-p2"
                  className="mb-1.5 block text-xs font-medium text-slate-200"
                >
                  Nuevo PIN de 6 dígitos (Fase 2)
                </label>
                <input
                  id="sec-p2"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={phase2}
                  onChange={(e) =>
                    setPhase2(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="6 dígitos"
                  className="w-full rounded-xl border border-white/15 bg-slate-950/65 px-3.5 py-2.5 font-mono text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="sec-p3"
                  className="mb-1.5 block text-xs font-medium text-slate-200"
                >
                  Nueva llave personal (Fase 3)
                </label>
                <input
                  id="sec-p3"
                  type="password"
                  value={phase3}
                  onChange={(e) => setPhase3(e.target.value)}
                  placeholder="Palabra clave"
                  className="w-full rounded-xl border border-white/15 bg-slate-950/65 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="sec-prompt"
                  className="mb-1.5 block text-xs font-medium text-slate-200"
                >
                  Pista visible en Fase 3
                </label>
                <input
                  id="sec-prompt"
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-950/65 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-xl bg-white px-5 py-2.5 text-xs font-medium text-slate-950 hover:bg-slate-100 disabled:opacity-60"
              >
                {isSaving
                  ? 'Re-cifrando casillero...'
                  : 'Guardar y re-cifrar archivos'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Reset / Wipe Vault */}
      <div className="liquid-glass rounded-3xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-sm font-semibold text-white">
            Restablecer casillero
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            Elimina permanentemente todos los archivos cifrados y las llaves de
            este navegador.
          </p>
        </div>

        {!confirmWipe ? (
          <button
            type="button"
            onClick={() => setConfirmWipe(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-950/50 px-4 py-2 text-xs font-medium text-rose-200 hover:bg-rose-900/60 whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Vaciar casillero</span>
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onWipeVault}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-500 whitespace-nowrap"
            >
              Confirmar borrado total
            </button>
            <button
              type="button"
              onClick={() => setConfirmWipe(false)}
              className="rounded-xl px-3 py-2 text-xs font-medium text-slate-300 hover:text-white whitespace-nowrap"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
