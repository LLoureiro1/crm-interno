
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ValidationErrors, RegistrationFormData } from '@/types/registration';
import { sanitizePlainText } from '@/utils/sanitization';
import type { Tables } from '@/integrations/supabase/types';

type City = Tables<'cities'>;

interface AddressSectionProps {
  formData: RegistrationFormData;
  fieldErrors: ValidationErrors;
  cities: City[];
  onInputChange: (field: string, value: string) => void;
}

export const AddressSection = ({ formData, fieldErrors, cities, onInputChange }: AddressSectionProps) => {
  const [filteredCities, setFilteredCities] = useState<City[]>([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  const handleCitySearch = (value: string) => {
    onInputChange('cityName', value);
    onInputChange('cityId', '');
    // Não mais filtramos cidades - apenas atualizamos o valor
    setShowCityDropdown(false);
    setFilteredCities([]);
  };

  const selectCity = (city: City) => {
    onInputChange('cityId', city.id);
    onInputChange('cityName', city.name);
    setShowCityDropdown(false);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Endereço</h3>
      
      <div className="relative">
        <Label htmlFor="city" className={fieldErrors.cityName ? 'text-red-600' : ''}>
          Cidade *
        </Label>
        <Input
          id="city"
          value={formData.cityName}
          onChange={(e) => handleCitySearch(e.target.value)}
          placeholder="Digite o nome da cidade"
          className={fieldErrors.cityName ? 'border-red-500 focus:border-red-500' : ''}
        />
        {fieldErrors.cityName && (
          <p className="text-red-600 text-sm mt-1">{fieldErrors.cityName}</p>
        )}
      </div>

      <div>
        <Label htmlFor="neighborhood" className={fieldErrors.neighborhood ? 'text-red-600' : ''}>
          Bairro
        </Label>
        <Input
          id="neighborhood"
          value={formData.neighborhood}
          onChange={(e) => onInputChange('neighborhood', sanitizePlainText(e.target.value))}
          placeholder="Digite o bairro"
          className={fieldErrors.neighborhood ? 'border-red-500 focus:border-red-500' : ''}
        />
        {fieldErrors.neighborhood && (
          <p className="text-red-600 text-sm mt-1">{fieldErrors.neighborhood}</p>
        )}
      </div>
    </div>
  );
};
