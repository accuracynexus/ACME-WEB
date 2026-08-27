import { ChangeEvent, useRef, useState } from 'react';

export interface ImageUploadFieldProps {
  currentUrl: string;
  onChange: (newUrl: string) => void;
  /** Sube el archivo y devuelve la URL publica. */
  upload: (file: File) => Promise<{ data: string | null; error: { message: string } | null }>;
  /** Etiqueta de la vista previa, ej. "Logo actual". */
  previewLabel: string;
  /** Texto cuando no hay imagen, ej. "Sin logo cargado". */
  emptyLabel: string;
  /** Texto del boton, ej. "logo" -> "Subir logo" / "Reemplazar logo". */
  nounLabel: string;
  /** Los logos se ven mejor completos; las fotos de plato, recortadas. */
  previewFit?: 'contain' | 'cover';
  /** Limite en MB, alineado con el del bucket. */
  maxSizeMb?: number;
  disabled?: boolean;
}

export function ImageUploadField({
  currentUrl,
  onChange,
  upload,
  previewLabel,
  emptyLabel,
  nounLabel,
  previewFit = 'contain',
  maxSizeMb = 2,
  disabled,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar antes de subir: el bucket tambien lo rechaza, pero su error
    // llega crudo y el usuario no entiende que fue por peso o formato.
    if (!file.type.startsWith('image/')) {
      setUploadError('El archivo debe ser una imagen.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setUploadError(`La imagen supera ${maxSizeMb} MB. Comprimela e intenta de nuevo.`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setUploading(true);
    setUploadError(null);
    const result = await upload(file);
    setUploading(false);

    if (result.error) {
      setUploadError(result.error.message);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (result.data) {
      onChange(result.data);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      {currentUrl ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '12px 14px',
            borderRadius: '10px',
            border: '1px solid var(--acme-border-strong)',
            background: 'var(--acme-surface-hover)',
          }}
        >
          <img
            src={currentUrl}
            alt={previewLabel}
            style={{
              width: '64px',
              height: '64px',
              objectFit: previewFit,
              borderRadius: '8px',
              background: 'var(--acme-surface)',
              border: '1px solid var(--acme-border)',
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--acme-text)', marginBottom: '2px' }}>{previewLabel}</div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--acme-text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={currentUrl}
            >
              {currentUrl}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange('')}
            disabled={disabled || uploading}
            className="btn btn--ghost btn--sm"
            style={{ color: 'var(--acme-red)', flexShrink: 0 }}
          >
            Quitar
          </button>
        </div>
      ) : (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            border: '1px dashed var(--acme-border-strong)',
            background: 'var(--acme-surface-hover)',
            color: 'var(--acme-text-faint)',
            fontSize: '13px',
            textAlign: 'center',
          }}
        >
          {emptyLabel}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          disabled={disabled || uploading}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="btn btn--secondary btn--sm"
          style={{ fontWeight: 700 }}
        >
          {uploading ? (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: '6px', animation: 'spin 1s linear infinite' }}
              >
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
              </svg>
              Subiendo...
            </>
          ) : (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: '6px' }}
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {currentUrl ? `Reemplazar ${nounLabel}` : `Subir ${nounLabel}`}
            </>
          )}
        </button>
        {uploadError ? (
          <span style={{ fontSize: '12px', color: 'var(--acme-red)', fontWeight: 600 }} role="alert">
            {uploadError}
          </span>
        ) : null}
      </div>
    </div>
  );
}
