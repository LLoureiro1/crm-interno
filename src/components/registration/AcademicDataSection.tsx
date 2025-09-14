
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ValidationErrors, RegistrationFormData } from '@/types/registration';
import { sanitizeSchool } from '@/utils/sanitization';
import type { Tables } from '@/integrations/supabase/types';

type Serie = Tables<'series'>;
type Unit = Tables<'units'>;
type Class = Tables<'classes'> & {
  series: Serie;
  units: Unit;
};

interface AcademicDataSectionProps {
  formData: RegistrationFormData;
  fieldErrors: ValidationErrors;
  series: Serie[];
  availableClasses: Class[];
  availableUnits: Unit[];
  onInputChange: (field: string, value: string) => void;
}

export const AcademicDataSection = ({ 
  formData, 
  fieldErrors, 
  series, 
  availableClasses, 
  availableUnits, 
  onInputChange 
}: AcademicDataSectionProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Dados Acadêmicos</h3>
      
      <div>
        <Label htmlFor="originSchool" className={fieldErrors.originSchool ? 'text-red-600' : ''}>
          Escola de Origem *
        </Label>
        <Input
          id="originSchool"
          value={formData.originSchool}
          onChange={(e) => onInputChange('originSchool', sanitizeSchool(e.target.value))}
          placeholder="Digite a escola de origem"
          className={fieldErrors.originSchool ? 'border-red-500 focus:border-red-500' : ''}
          required
        />
        {fieldErrors.originSchool && (
          <p className="text-red-600 text-sm mt-1">{fieldErrors.originSchool}</p>
        )}
      </div>

      <div>
        <Label htmlFor="series" className={fieldErrors.seriesId ? 'text-red-600' : ''}>
          Série *
        </Label>
        <Select value={formData.seriesId} onValueChange={(value) => onInputChange('seriesId', value)}>
          <SelectTrigger className={fieldErrors.seriesId ? 'border-red-500 focus:border-red-500' : ''}>
            <SelectValue placeholder="Selecione a série" />
          </SelectTrigger>
          <SelectContent>
            {series.map((serie) => (
              <SelectItem key={serie.id} value={serie.id}>
                {serie.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.seriesId && (
          <p className="text-red-600 text-sm mt-1">{fieldErrors.seriesId}</p>
        )}
      </div>

      {formData.seriesId && (
        <div>
          <Label htmlFor="unit" className={fieldErrors.unitId ? 'text-red-600' : ''}>
            Unidade *
          </Label>
          <Select value={formData.unitId} onValueChange={(value) => onInputChange('unitId', value)}>
            <SelectTrigger className={fieldErrors.unitId ? 'border-red-500 focus:border-red-500' : ''}>
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent>
              {availableUnits.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.unitId && (
            <p className="text-red-600 text-sm mt-1">{fieldErrors.unitId}</p>
          )}
        </div>
      )}

      {(formData.unitId || formData.seriesId) && (
        <div>
          <Label htmlFor="class" className={fieldErrors.classId ? 'text-red-600' : ''}>
            Turma *
          </Label>
          <Select value={formData.classId} onValueChange={(value) => onInputChange('classId', value)}>
            <SelectTrigger className={fieldErrors.classId ? 'border-red-500 focus:border-red-500' : ''}>
              <SelectValue placeholder="Selecione a turma" />
            </SelectTrigger>
            <SelectContent>
              {availableClasses.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.classId && (
            <p className="text-red-600 text-sm mt-1">{fieldErrors.classId}</p>
          )}
        </div>
      )}
    </div>
  );
};
