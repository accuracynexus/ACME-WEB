import { adminService } from '../../core/services/adminService';
import { ImageUploadField } from './ImageUploadField';

interface LogoUploadFieldProps {
  merchantId: string;
  currentUrl: string;
  onChange: (newUrl: string) => void;
  disabled?: boolean;
}

// El bucket merchant-logos tiene limite de 2 MB.
export function LogoUploadField({ merchantId, currentUrl, onChange, disabled }: LogoUploadFieldProps) {
  return (
    <ImageUploadField
      currentUrl={currentUrl}
      onChange={onChange}
      upload={(file) => adminService.uploadMerchantLogo(merchantId, file, currentUrl)}
      previewLabel="Logo actual"
      emptyLabel="Sin logo cargado"
      nounLabel="logo"
      previewFit="contain"
      maxSizeMb={2}
      disabled={disabled}
    />
  );
}
