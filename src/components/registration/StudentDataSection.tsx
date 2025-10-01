
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ValidationErrors, RegistrationFormData } from '@/types/registration';

interface StudentDataSectionProps {
  formData: RegistrationFormData;
  fieldErrors: ValidationErrors;
  onInputChange: (field: string, value: string) => void;
}

export const StudentDataSection = ({ formData, fieldErrors, onInputChange }: StudentDataSectionProps) => {
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
          onChange={(e) => onInputChange('studentName', e.target.value)}
          placeholder="Digite o nome completo do aluno"
          className={fieldErrors.studentName ? 'border-red-500 focus:border-red-500' : ''}
          required
        />
        {fieldErrors.studentName && (
          <p className="text-red-600 text-sm mt-1">{fieldErrors.studentName}</p>
        )}
      </div>
    </div>
  );
};
