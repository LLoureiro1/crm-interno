
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ValidationErrors, RegistrationFormData } from '@/types/registration';

interface AddressSectionProps {
  formData: RegistrationFormData;
  fieldErrors: ValidationErrors;
  onInputChange: (field: string, value: string) => void;
}

export const AddressSection = ({ formData, fieldErrors, onInputChange }: AddressSectionProps) => {
  return (
    <div className="space-y-4">
      {/* Campos de cidade removidos - mantendo apenas a estrutura para futura expansão */}
    </div>
  );
};
