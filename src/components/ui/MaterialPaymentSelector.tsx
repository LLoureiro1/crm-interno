import React, { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, FileText, Zap } from 'lucide-react';

export type MaterialPaymentType = 'a_vista' | 'parcelado_cartao' | 'parcelado_boleto' | '';

interface MaterialPaymentSelectorProps {
  paymentType: MaterialPaymentType;
  installments: number;
  onPaymentTypeChange: (type: MaterialPaymentType) => void;
  onInstallmentsChange: (installments: number) => void;
  disabled?: boolean;
}

export const MaterialPaymentSelector: React.FC<MaterialPaymentSelectorProps> = ({
  paymentType,
  installments,
  onPaymentTypeChange,
  onInstallmentsChange,
  disabled = false
}) => {
  // Quando o tipo de pagamento muda, ajustar o número de parcelas se necessário
  useEffect(() => {
    if (paymentType === 'a_vista') {
      onInstallmentsChange(1);
    } else if (paymentType === 'parcelado_cartao') {
      // Se estava em 1x, mudar para 2x (mínimo para parcelado)
      if (installments === 1) {
        onInstallmentsChange(2);
      }
    } else if (paymentType === 'parcelado_boleto') {
      // Se estava em 1x, mudar para 2x (mínimo para parcelado)
      if (installments === 1) {
        onInstallmentsChange(2);
      }
      // Se passou de 6x, limitar a 6x
      if (installments > 6) {
        onInstallmentsChange(6);
      }
    }
  }, [paymentType]);

  const getMaxInstallments = () => {
    if (paymentType === 'parcelado_cartao') return 12;
    if (paymentType === 'parcelado_boleto') return 6;
    return 1;
  };

  const getDiscount = () => {
    if (paymentType === 'a_vista') return 10;
    if (paymentType === 'parcelado_cartao') return 5;
    return 0;
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold mb-3 block">Forma de Pagamento dos Recursos Didáticos</Label>
        <RadioGroup 
          value={paymentType} 
          onValueChange={onPaymentTypeChange}
          disabled={disabled}
          className="space-y-3"
        >
          {/* À Vista */}
          <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
            <RadioGroupItem value="a_vista" id="a_vista" />
            <Label htmlFor="a_vista" className="flex items-center space-x-2 cursor-pointer flex-1">
              <Zap className="h-5 w-5 text-yellow-600" />
              <div className="flex-1">
                <div className="font-medium">À Vista</div>
                <div className="text-sm text-gray-600">10% de desconto</div>
              </div>
              <div className="text-green-600 font-semibold">-10%</div>
            </Label>
          </div>

          {/* Parcelado no Cartão */}
          <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
            <RadioGroupItem value="parcelado_cartao" id="parcelado_cartao" />
            <Label htmlFor="parcelado_cartao" className="flex items-center space-x-2 cursor-pointer flex-1">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <div className="font-medium">Parcelado no Cartão</div>
                <div className="text-sm text-gray-600">Até 12x com 5% de desconto</div>
              </div>
              <div className="text-green-600 font-semibold">-5%</div>
            </Label>
          </div>

          {/* Parcelado no Boleto */}
          <div className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
            <RadioGroupItem value="parcelado_boleto" id="parcelado_boleto" />
            <Label htmlFor="parcelado_boleto" className="flex items-center space-x-2 cursor-pointer flex-1">
              <FileText className="h-5 w-5 text-gray-600" />
              <div className="flex-1">
                <div className="font-medium">Parcelado no Boleto</div>
                <div className="text-sm text-gray-600">Até 6x sem desconto</div>
              </div>
              <div className="text-gray-500 font-semibold">Sem desconto</div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Seletor de Parcelas - Apenas para parcelado */}
      {(paymentType === 'parcelado_cartao' || paymentType === 'parcelado_boleto') && (
        <div>
          <Label htmlFor="installments" className="text-sm font-medium">
            Número de Parcelas
          </Label>
          <Select 
            value={installments.toString()} 
            onValueChange={(value) => onInstallmentsChange(parseInt(value))}
            disabled={disabled}
          >
            <SelectTrigger id="installments" className="mt-2">
              <SelectValue placeholder="Selecione o número de parcelas" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: getMaxInstallments() - 1 }, (_, i) => i + 2).map((num) => (
                <SelectItem key={num} value={num.toString()}>
                  {num}x parcelas
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Resumo do Desconto */}
      {paymentType && (
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <div className="text-sm">
            <span className="font-medium">Desconto aplicado: </span>
            <span className="text-blue-700 font-semibold">{getDiscount()}%</span>
          </div>
          {(paymentType === 'parcelado_cartao' || paymentType === 'parcelado_boleto') && (
            <div className="text-sm mt-1">
              <span className="font-medium">Parcelamento: </span>
              <span className="text-blue-700 font-semibold">{installments}x</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

