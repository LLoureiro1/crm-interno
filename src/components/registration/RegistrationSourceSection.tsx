import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRegistrationSources } from '@/hooks/useRegistrationSources';
import { Loader2 } from 'lucide-react';

interface RegistrationSourceSectionProps {
  formData: {
    registrationSourceId: string;
    unitId: string;
  };
  fieldErrors: {
    registrationSourceId?: string;
  };
  onInputChange: (field: string, value: string) => void;
}

export const RegistrationSourceSection = ({ 
  formData, 
  fieldErrors, 
  onInputChange 
}: RegistrationSourceSectionProps) => {
  const { sources, loading, error } = useRegistrationSources(formData.unitId);

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Como você conheceu o Apogeu?</h3>
        <div className="flex items-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-gray-600">Carregando opções...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Como você conheceu o Apogeu?</h3>
        <div className="text-sm text-red-600">
          {error}
        </div>
      </div>
    );
  }

  if (sources.length === 0) {
    return null; // Não exibe a seção se não há origens configuradas
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Como você conheceu o Apogeu?</h3>
      
      <div>
        <Label htmlFor="registrationSourceId" className={fieldErrors.registrationSourceId ? 'text-red-600' : ''}>
          Origem da Inscrição *
        </Label>
        <Select
          value={formData.registrationSourceId}
          onValueChange={(value) => onInputChange('registrationSourceId', value)}
        >
          <SelectTrigger className={fieldErrors.registrationSourceId ? 'border-red-500 focus:border-red-500' : ''}>
            <SelectValue placeholder="Selecione como conheceu o Apogeu" />
          </SelectTrigger>
          <SelectContent>
            {sources.map((source) => (
              <SelectItem key={source.id} value={source.id}>
                {source.source_label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.registrationSourceId && (
          <p className="text-red-600 text-sm mt-1">{fieldErrors.registrationSourceId}</p>
        )}
      </div>
    </div>
  );
};
