export type AuthPhase = 1 | 2 | 3;

export const DEMO_CREDENTIALS = {
  phase1Password: 'prometheus2026',
  phase2Pin: '246810',
  phase3Key: 'amanecer',
  phase3Prompt: 'Momento del día favorito (pista: amanecer)',
} as const;

export interface PhaseValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePhase1Password(password: string): PhaseValidationResult {
  if (!password || password.length < 6) {
    return {
      valid: false,
      error: 'La contraseña maestra debe tener al menos 6 caracteres.',
    };
  }
  return { valid: true };
}

export function validatePhase2Pin(pin: string): PhaseValidationResult {
  const cleaned = pin.trim();
  if (!/^\d{6}$/.test(cleaned)) {
    return {
      valid: false,
      error: 'El PIN de acceso debe contener exactamente 6 dígitos numéricos.',
    };
  }
  return { valid: true };
}

export function validatePhase3Key(phrase: string): PhaseValidationResult {
  const cleaned = phrase.trim();
  if (cleaned.length < 3) {
    return {
      valid: false,
      error: 'La llave personal debe tener al menos 3 caracteres.',
    };
  }
  return { valid: true };
}

export function calculatePasswordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
} {
  if (!password) return { score: 0, label: 'Sin definir' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score++;

  const clamped = Math.min(4, Math.max(1, score)) as 1 | 2 | 3 | 4;
  const labels: Record<1 | 2 | 3 | 4, string> = {
    1: 'Básica',
    2: 'Moderada',
    3: 'Sólida',
    4: 'Alta',
  };
  return { score: clamped, label: labels[clamped] };
}

export function getNextTrackIndex(
  currentIndex: number,
  totalTracks: number,
  direction: 'next' | 'prev',
  shuffle: boolean
): number {
  if (totalTracks <= 0) return -1;
  if (totalTracks === 1) return 0;

  if (shuffle) {
    let candidate = Math.floor(Math.random() * totalTracks);
    if (candidate === currentIndex) {
      candidate = (currentIndex + 1) % totalTracks;
    }
    return candidate;
  }

  if (direction === 'next') {
    return (currentIndex + 1) % totalTracks;
  }
  return (currentIndex - 1 + totalTracks) % totalTracks;
}
