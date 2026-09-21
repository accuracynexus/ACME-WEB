/**
 * Campana del aviso de pedido nuevo.
 *
 * Se sintetiza con Web Audio en vez de cargar un archivo: no hay que servir un
 * mp3 ni esperar a que descargue, y suena igual en el primer pedido del día que
 * en el número cincuenta.
 *
 * Los navegadores no dejan sonar nada hasta que la persona interactúa con la
 * página. Por eso el contexto se crea perezoso y se reanuda al primer clic;
 * mientras tanto `bloqueado` deja avisar en pantalla que hace falta activarlo.
 */

let ctx: AudioContext | null = null;

function obtenerContexto(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

/** True si el navegador todavía no nos deja sonar. */
export function sonidoBloqueado(): boolean {
  const c = obtenerContexto();
  return !c || c.state === 'suspended';
}

/** Se llama desde un clic real: es lo único que desbloquea el audio. */
export async function desbloquearSonido(): Promise<void> {
  const c = obtenerContexto();
  if (c && c.state === 'suspended') {
    try {
      await c.resume();
    } catch {
      // Si el navegador se niega, el aviso visual sigue estando.
    }
  }
}

/**
 * Dos notas ascendentes, cortas y claras. Se busca que corte el ruido de una
 * cocina sin resultar estridente a la décima vez.
 */
export function sonarCampana(): void {
  const c = obtenerContexto();
  if (!c || c.state !== 'running') return;

  const ahora = c.currentTime;
  const notas = [
    { hz: 880, en: 0 },
    { hz: 1320, en: 0.16 },
  ];

  for (const nota of notas) {
    const osc = c.createOscillator();
    const vol = c.createGain();

    osc.type = 'sine';
    osc.frequency.value = nota.hz;

    const inicio = ahora + nota.en;
    const fin = inicio + 0.28;
    vol.gain.setValueAtTime(0.0001, inicio);
    vol.gain.exponentialRampToValueAtTime(0.22, inicio + 0.02);
    vol.gain.exponentialRampToValueAtTime(0.0001, fin);

    osc.connect(vol).connect(c.destination);
    osc.start(inicio);
    osc.stop(fin + 0.02);
  }
}
