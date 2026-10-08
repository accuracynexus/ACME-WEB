/**
 * Portal toast notifications using Sileo.
 * Sileo expects an object { title, description } for each toast.
 *
 * Usage:
 *   toast.success('Guardado correctamente')
 *   toast.error('No se pudo conectar')
 *   toast.success('Título', 'Descripción opcional')
 *   toast.promise(myPromise, { loading: 'Guardando...', success: 'Listo', error: 'Error' })
 */
import { sileo } from 'sileo';

type ToastArg = string | { title: string; description?: string };

function normalize(arg: ToastArg, desc?: string) {
  if (typeof arg === 'string') return { title: arg, description: desc };
  return arg;
}

// Sileo pausa todos los timers mientras el mouse esta sobre un toast y solo
// los reanuda en mouseleave. El toast sale arriba a la derecha, justo donde
// suele estar el cursor, y si ese mouseleave no llega se queda pegado. Por
// eso, ademas de la duracion, lo cerramos nosotros pase lo que pase.
const SUCCESS_DURATION_MS = 2000;
const DEFAULT_DURATION_MS = 4000;

function show(
  fn: (opts: { title?: string; description?: string; duration?: number }) => string,
  arg: ToastArg,
  desc: string | undefined,
  duration: number
) {
  const id = fn({ ...normalize(arg, desc), duration });
  window.setTimeout(() => sileo.dismiss(id), duration);
  return id;
}

export const toast = {
  success: (msg: ToastArg, desc?: string) =>
    show(sileo.success, msg, desc, SUCCESS_DURATION_MS),

  error: (msg: ToastArg, desc?: string) =>
    show(sileo.error, msg, desc, DEFAULT_DURATION_MS),

  info: (msg: ToastArg, desc?: string) =>
    show(sileo.info, msg, desc, DEFAULT_DURATION_MS),

  warning: (msg: ToastArg, desc?: string) =>
    show(sileo.warning, msg, desc, DEFAULT_DURATION_MS),

  promise: <T>(
    promise: Promise<T> | (() => Promise<T>),
    opts: {
      loading: ToastArg;
      success: ToastArg | ((data: T) => { title: string; description?: string });
      error: ToastArg | ((err: unknown) => { title: string; description?: string });
    }
  ) =>
    sileo.promise(promise, {
      loading: normalize(opts.loading),
      success:
        typeof opts.success === 'function'
          ? opts.success
          : normalize(opts.success),
      error:
        typeof opts.error === 'function'
          ? opts.error
          : normalize(opts.error),
    }),
};
