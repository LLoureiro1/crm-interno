import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ValidationErrors, RegistrationFormData } from '@/types/registration';
import type { Tables } from '@/integrations/supabase/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

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
  console.log('🎓 AcademicDataSection renderizado com:', { 
    seriesCount: series.length, 
    series: series,
    availableClassesCount: availableClasses.length,
    availableUnitsCount: availableUnits.length,
    formData: formData 
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Dados Acadêmicos</h3>
      
      {/* Alerta se não há séries disponíveis */}
      {series.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Nenhuma série encontrada. Entre em contato com o administrador para configurar as séries disponíveis.
          </AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="series" className={fieldErrors.seriesId ? 'text-red-600' : ''}>
          Série *
        </Label>
        <Select 
          value={formData.seriesId} 
          onValueChange={(value) => {
            console.log('🎯 Série selecionada:', value);
            onInputChange('seriesId', value);
          }}
          disabled={series.length === 0}
        >
          <SelectTrigger className={fieldErrors.seriesId ? 'border-red-500 focus:border-red-500' : ''}>
            <SelectValue placeholder={series.length === 0 ? "Nenhuma série disponível" : "Selecione a série"} />
          </SelectTrigger>
          <SelectContent>
            {series.length === 0 ? (
              <SelectItem value="no-data" disabled>
                Nenhuma série disponível
              </SelectItem>
            ) : (
              series.map((serie) => (
                <SelectItem key={serie.id} value={serie.id}>
                  {serie.name}
                </SelectItem>
              ))
            )}
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
          <Select 
            value={formData.unitId} 
            onValueChange={(value) => {
              console.log('🏢 Unidade selecionada:', value);
              onInputChange('unitId', value);
            }}
            disabled={availableUnits.length === 0}
          >
            <SelectTrigger className={fieldErrors.unitId ? 'border-red-500 focus:border-red-500' : ''}>
              <SelectValue placeholder={availableUnits.length === 0 ? "Nenhuma unidade disponível" : "Selecione a unidade"} />
            </SelectTrigger>
            <SelectContent>
              {availableUnits.length === 0 ? (
                <SelectItem value="no-units" disabled>
                  Nenhuma unidade disponível para esta série
                </SelectItem>
              ) : (
                availableUnits.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {fieldErrors.unitId && (
            <p className="text-red-600 text-sm mt-1">{fieldErrors.unitId}</p>
          )}
        </div>
      )}

      {formData.unitId && formData.seriesId && (
        <div>
          <Label htmlFor="class" className={fieldErrors.classId ? 'text-red-600' : ''}>
            Turma *
          </Label>
          <Select 
            value={formData.classId} 
            onValueChange={(value) => {
              console.log('🎓 Turma selecionada:', value);
              onInputChange('classId', value);
            }}
            disabled={availableClasses.length === 0}
          >
            <SelectTrigger className={fieldErrors.classId ? 'border-red-500 focus:border-red-500' : ''}>
              <SelectValue placeholder={availableClasses.length === 0 ? "Nenhuma turma disponível" : "Selecione a turma"} />
            </SelectTrigger>
            <SelectContent>
              {availableClasses.length === 0 ? (
                <SelectItem value="no-classes" disabled>
                  Nenhuma turma disponível para esta série e unidade
                </SelectItem>
              ) : (
                availableClasses.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))
              )}
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