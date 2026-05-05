import { ChangeEvent, useRef, useState } from 'react';
import { adminService } from '../../core/services/adminService';

interface LogoUploadFieldProps {
  merchantId: string;
  currentUrl: string;
  onChange: (newUrl: string) => void;
  disabled?: boolean;
}

export function LogoUploadField({ merchantId, currentUrl, onChange, disabled }: LogoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const result = await adminService.uploadMerchantLogo(merchantId, file, currentUrl);
    setUploading(false);
    if (result.error) {
      setUploadError(result.error.message);
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
            border: '1px solid #d1d5db',
            background: '#f9fafb',
          }}
        >
          <img
            src={currentUrl}
            alt="Logo actual"
            style={{
              width: '64px',
              height: '64px',
              objectFit: 'contain',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #e5e7eb',
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '2px' }}>Logo actual</div>
            <div
              style={{
                fontSize: '11px',
                color: '#6b7280',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={currentUrl}
            >
              {currentUrl}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            border: '1px dashed #d1d5db',
            background: '#f9fafb',
            color: '#9ca3af',
            fontSize: '13px',
            textAlign: 'center',
          }}
        >
          Sin logo cargado
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
              {currentUrl ? 'Reemplazar logo' : 'Subir logo'}
            </>
          )}
        </button>
        {uploadError ? (
          <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>{uploadError}</span>
        ) : null}
      </div>
    </div>
  );
}
