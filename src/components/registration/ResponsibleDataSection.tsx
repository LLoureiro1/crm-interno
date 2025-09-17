
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ValidationErrors, RegistrationFormData } from '@/types/registration';
import { formatPhone } from '@/utils/registrationFormatters';
import { sanitizeEmail, sanitizePhone } from '@/utils/sanitization';

interface ResponsibleDataSectionProps {
  formData: RegistrationFormData;
  fieldErrors: ValidationErrors;
  onInputChange: (field: string, value: string) => void;
}

export const ResponsibleDataSection = ({ formData, fieldErrors, onInputChange }: ResponsibleDataSectionProps) => {
  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    onInputChange('phone', formatted);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Dados do Responsável</h3>
      
      <div>
        <Label htmlFor="responsibleName" className={fieldErrors.responsibleName ? 'text-red-600' : ''}>
          Nome Completo do Responsável *
        </Label>
        <Input
          id="responsibleName"
          value={formData.responsibleName}
          onChange={(e) => onInputChange('responsibleName', e.target.value)}
          placeholder="Digite o nome completo do responsável"
          className={fieldErrors.responsibleName ? 'border-red-500 focus:border-red-500' : ''}
          required
        />
        {fieldErrors.responsibleName && (
          <p className="text-red-600 text-sm mt-1">{fieldErrors.responsibleName}</p>
        )}
      </div>

      <div>
        <Label htmlFor="phone" className={fieldErrors.phone ? 'text-red-600' : ''}>
          Telefone *
        </Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => handlePhoneChange(e.target.value)}
          placeholder="(XX) XXXXX-XXXX"
          maxLength={15}
          className={fieldErrors.phone ? 'border-red-500 focus:border-red-500' : ''}
          required
        />
        {fieldErrors.phone && (
          <p className="text-red-600 text-sm mt-1">{fieldErrors.phone}</p>
        )}
      </div>

      <div>
        <Label htmlFor="email" className={fieldErrors.email ? 'text-red-600' : ''}>
          E-mail
        </Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => onInputChange('email', sanitizeEmail(e.target.value))}
          placeholder="email@exemplo.com"
          className={fieldErrors.email ? 'border-red-500 focus:border-red-500' : ''}
        />
        {fieldErrors.email && (
          <p className="text-red-600 text-sm mt-1">{fieldErrors.email}</p>
        )}
      </div>
    </div>
  );
};
