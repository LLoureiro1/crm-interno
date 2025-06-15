
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ValidationErrors, RegistrationFormData } from '@/types/registration';
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
    
    if (value.length >= 3) {
      const filtered = cities.filter(city => 
        city.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredCities(filtered);
      setShowCityDropdown(true);
    } else {
      setShowCityDropdown(false);
      setFilteredCities([]);
    }
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
        <Label htmlFor="city" className={fieldErrors.cityId ? 'text-red-600' : ''}>
          Cidade *
        </Label>
        <Input
          id="city"
          value={formData.cityName}
          onChange={(e) => handleCitySearch(e.target.value)}
          placeholder="Digite pelo menos 3 letras da cidade"
          className={fieldErrors.cityId ? 'border-red-500 focus:border-red-500' : ''}
          required
        />
        {fieldErrors.cityId && (
          <p className="text-red-600 text-sm mt-1">{fieldErrors.cityId}</p>
        )}
        {showCityDropdown && filteredCities.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {filteredCities.map((city) => (
              <div
                key={city.id}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                onClick={() => selectCity(city)}
              >
                {city.name}
              </div>
            ))}
          </div>
        )}
        {showCityDropdown && filteredCities.length === 0 && formData.cityName.length >= 3 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
            <div className="px-4 py-2 text-gray-500">
              Nenhuma cidade encontrada
            </div>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="neighborhood" className={fieldErrors.neighborhood ? 'text-red-600' : ''}>
          Bairro *
        </Label>
        <Input
          id="neighborhood"
          value={formData.neighborhood}
          onChange={(e) => onInputChange('neighborhood', e.target.value)}
          placeholder="Digite o bairro"
          className={fieldErrors.neighborhood ? 'border-red-500 focus:border-red-500' : ''}
          required
        />
        {fieldErrors.neighborhood && (
          <p className="text-red-600 text-sm mt-1">{fieldErrors.neighborhood}</p>
        )}
      </div>
    </div>
  );
};
