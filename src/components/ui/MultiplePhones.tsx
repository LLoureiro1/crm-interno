import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Phone } from 'lucide-react';
import { formatPhone } from '@/utils/registrationFormatters';

interface MultiplePhonesProps {
  primaryPhone: string;
  additionalPhones: string[];
  onPrimaryPhoneChange: (phone: string) => void;
  onAdditionalPhonesChange: (phones: string[]) => void;
  fieldErrors?: { [key: string]: string };
  disabled?: boolean;
}

export const MultiplePhones = ({ 
  primaryPhone, 
  additionalPhones, 
  onPrimaryPhoneChange, 
  onAdditionalPhonesChange, 
  fieldErrors, 
  disabled = false 
}: MultiplePhonesProps) => {
  const addPhone = () => {
    onAdditionalPhonesChange([...additionalPhones, '']);
  };

  const removePhone = (index: number) => {
    const updatedPhones = additionalPhones.filter((_, i) => i !== index);
    onAdditionalPhonesChange(updatedPhones);
  };

  const updateAdditionalPhone = (index: number, value: string) => {
    const updatedPhones = additionalPhones.map((phone, i) => 
      i === index ? formatPhone(value) : phone
    );
    onAdditionalPhonesChange(updatedPhones);
  };

  const handlePrimaryPhoneChange = (value: string) => {
    onPrimaryPhoneChange(formatPhone(value));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-lg font-semibold text-gray-800">
          <Phone className="h-4 w-4 inline mr-2" />
          Telefones *
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPhone}
          disabled={disabled}
          className="flex items-center space-x-1"
        >
          <Plus className="h-3 w-3" />
          <span>Adicionar Telefone</span>
        </Button>
      </div>

      {/* Telefone Principal */}
      <div className="p-4 border rounded-lg bg-blue-50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label htmlFor="primary-phone" className={fieldErrors?.phone ? 'text-red-600' : ''}>
              Telefone Principal *
            </Label>
            <Input
              id="primary-phone"
              value={primaryPhone}
              onChange={(e) => handlePrimaryPhoneChange(e.target.value)}
              placeholder="(XX) XXXXX-XXXX"
              maxLength={15}
              disabled={disabled}
              className={fieldErrors?.phone ? 'border-red-500 focus:border-red-500' : ''}
              required
            />
            {fieldErrors?.phone && (
              <p className="text-red-600 text-sm mt-1">{fieldErrors.phone}</p>
            )}
          </div>
          <div className="flex items-center">
            <div className="text-xs text-blue-600 font-medium">
              ✓ Telefone principal
            </div>
          </div>
        </div>
      </div>

      {/* Telefones Adicionais */}
      {additionalPhones.map((phone, index) => (
        <div key={index} className="p-4 border rounded-lg bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label htmlFor={`additional-phone-${index}`} className={fieldErrors?.[`additionalPhones.${index}`] ? 'text-red-600' : ''}>
                Telefone Adicional {index + 1}
              </Label>
              <Input
                id={`additional-phone-${index}`}
                value={phone}
                onChange={(e) => updateAdditionalPhone(index, e.target.value)}
                placeholder="(XX) XXXXX-XXXX"
                maxLength={15}
                disabled={disabled}
                className={fieldErrors?.[`additionalPhones.${index}`] ? 'border-red-500 focus:border-red-500' : ''}
              />
              {fieldErrors?.[`additionalPhones.${index}`] && (
                <p className="text-red-600 text-sm mt-1">{fieldErrors[`additionalPhones.${index}`]}</p>
              )}
            </div>
            
            <div className="flex items-center justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removePhone(index)}
                disabled={disabled}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}

      {additionalPhones.length === 0 && (
        <div className="text-center py-2 text-gray-500 text-sm">
          <p>Clique em "Adicionar Telefone" para incluir telefones extras</p>
        </div>
      )}
    </div>
  );
};
