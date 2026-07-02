import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
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
  showClassSelector: boolean;
  onInputChange: (field: string, value: string) => void;
  isUnitLocked?: boolean;
  isGroupRegistration?: boolean;
  preSelectedUnitName?: string;
}

export const AcademicDataSection = ({ 
  formData, 
  fieldErrors, 
  series, 
  availableClasses, 
  availableUnits, 
  showClassSelector,
  onInputChange,
  isUnitLocked = false,
  isGroupRegistration = false,
  preSelectedUnitName
}: AcademicDataSectionProps) => {
  console.log('🎓 AcademicDataSection renderizado com:', { 
    seriesCount: series.length, 
    series: series,
    availableClassesCount: availableClasses.length,
    availableUnitsCount: availableUnits.length,
    formData: formData 
  });

  // Regra do ano letivo vigente: entre agosto e dezembro, próximo ano; caso contrário, ano atual
  const getCurrentAcademicYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    return currentMonth >= 8 ? String(currentYear + 1) : String(currentYear);
  };
  const academicYear = getCurrentAcademicYear();

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
          {`Série que o aluno irá estudar em ${academicYear}`} *
        </Label>
        <Combobox
          options={series.map((serie) => ({
            value: serie.id,
            label: serie.name
          }))}
          value={formData.seriesId}
          onValueChange={(value) => {
            console.log('🎯 Série selecionada:', value);
            onInputChange('seriesId', value);
          }}
          placeholder={series.length === 0 ? "Nenhuma série disponível" : "Selecione a série"}
          searchPlaceholder="Buscar série..."
          emptyMessage="Nenhuma série encontrada."
          disabled={series.length === 0}
          error={!!fieldErrors.seriesId}
        />
        {fieldErrors.seriesId && (
          <p className="text-red-600 text-sm mt-1">{fieldErrors.seriesId}</p>
        )}
      </div>

      {formData.seriesId && !(isGroupRegistration && availableUnits.length > 1 && !formData.unitId) && (
        <div>
          <Label htmlFor="unit" className={fieldErrors.unitId ? 'text-red-600' : ''}>
            Unidade *
          </Label>
          {isUnitLocked && preSelectedUnitName ? (
            <div>
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription>
                  Esta inscrição é exclusiva para a unidade: <strong>{preSelectedUnitName}</strong>
                </AlertDescription>
              </Alert>
            </div>
          ) : (
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
              <SelectContent side="bottom">
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
          )}
          {fieldErrors.unitId && (
            <p className="text-red-600 text-sm mt-1">{fieldErrors.unitId}</p>
          )}
        </div>
      )}

      {formData.seriesId && (formData.unitId || (isGroupRegistration && showClassSelector)) && (
        <div>
          {/* Mostrar seletor apenas quando há múltiplas turmas */}
          {showClassSelector && availableClasses.length > 1 && (
            <div>
              <Label htmlFor="class" className={fieldErrors.classId ? 'text-red-600' : ''}>
                Selecione a Turma *
              </Label>
              <Select 
                value={formData.classId} 
                onValueChange={(value) => {
                  console.log('🎓 Turma selecionada:', value);
                  onInputChange('classId', value);
                }}
              >
                <SelectTrigger className={fieldErrors.classId ? 'border-red-500 focus:border-red-500' : ''}>
                  <SelectValue placeholder="Selecione a turma" />
                </SelectTrigger>
                <SelectContent side="bottom">
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

          {/* Mostrar aviso quando não há turmas */}
          {availableClasses.length === 0 && (
            <div>
              <Label>Turma</Label>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Nenhuma turma disponível para esta combinação de série e unidade. Entre em contato com o administrador.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      )}
    </div>
  );
};