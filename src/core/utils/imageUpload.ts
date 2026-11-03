/**
 * Preparar una foto antes de subirla.
 *
 * Una foto de celular pesa 4 a 10 MB y mide 4000 px; el bucket de productos
 * admite 5 MB y la tienda la muestra a unos 400 px. Reducirla en el navegador
 * hace que casi siempre entre en el limite y que la tienda cargue rapido.
 */

/** Formatos que admite el bucket product-images. */
export const PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export class ImagePrepareError extends Error {}

export interface OptimizeOptions {
  /** Lado mayor maximo en pixeles. */
  maxSide: number;
  /** Calidad 0-1 al volver a comprimir. */
  quality?: number;
  /** Solo se recomprime si pesa mas que esto, para no degradar fotos ya livianas. */
  recompressAboveBytes?: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImagePrepareError('No se pudo leer la imagen. Prueba con otra foto en JPG o PNG.'));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Devuelve el mismo archivo si ya esta bien, o una version reducida.
 * Los GIF no se tocan (se perderia la animacion).
 */
export async function prepareImageForUpload(file: File, options: OptimizeOptions): Promise<File> {
  const { maxSide, quality = 0.86, recompressAboveBytes = 900 * 1024 } = options;
  if (file.type === 'image/gif') return file;

  const img = await loadImage(file);
  const largest = Math.max(img.naturalWidth, img.naturalHeight);
  const needsResize = largest > maxSide;
  if (!needsResize && file.size <= recompressAboveBytes) return file;

  const scale = needsResize ? maxSide / largest : 1;
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  // Fondo blanco: un PNG con transparencia pasado a JPEG saldria negro.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  // WebP pesa menos; si el navegador no lo genera cae a JPEG.
  let blob = await toBlob(canvas, 'image/webp', quality);
  let ext = 'webp';
  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob(canvas, 'image/jpeg', quality);
    ext = 'jpg';
  }
  // Si recomprimir no mejoro nada, se queda el original.
  if (!blob || (!needsResize && blob.size >= file.size)) return file;

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'foto';
  return new File([blob], `${baseName}.${ext}`, { type: blob.type });
}
