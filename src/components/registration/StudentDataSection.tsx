
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ValidationErrors, RegistrationFormData } from '@/types/registration';
import { formatDate } from '@/utils/registrationFormatters';
import { sanitizeName } from '@/utils/sanitization';

interface StudentDataSectionProps {
  formData: RegistrationFormData;
  fieldErrors: ValidationErrors;
  onInputChange: (field: string, value: string) => void;
}

export const StudentDataSection = ({ formData, fieldErrors, onInputChange }: StudentDataSectionProps) => {
  const handleDateChange = (value: string) => {
    const formatted = formatDate(value);
    onInputChange('birthDate', formatted);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Dados do Aluno</h3>
      
      <div>
        <Label htmlFor="studentName" className={fieldErrors.studentName ? 'text-red-600' : ''}>
          Nome Completo do Aluno *
        </Label>
        <Input
          id="studentName"
          value={formData.studentName}
          onChange={(e) => onInputChange('studentName', sanitizeName(e.target.value))}
          placeholder="Digite o nome completo do aluno"
          className={fieldErrors.studentName ? 'border-red-500 focus:border-red-500' : ''}
          required
        />
        {fieldErrors.studentName && (
          <p className="text-red-600 text-sm mt-1">{fieldErrors.studentName}</p>
        )}
      </div>

      <div>
        <Label htmlFor="birthDate" className={fieldErrors.birthDate ? 'text-red-600' : ''}>
          Data de Nascimento *
        </Label>
        <Input
          id="birthDate"
          value={formData.birthDate}
          onChange={(e) => handleDateChange(e.target.value)}
          placeholder="DD/MM/YYYY"
          maxLength={10}
          className={fieldErrors.birthDate ? 'border-red-500 focus:border-red-500' : ''}
          required
        />
        {fieldErrors.birthDate && (
          <p className="text-red-600 text-sm mt-1">{fieldErrors.birthDate}</p>
        )}
      </div>
    </div>
  );
};
