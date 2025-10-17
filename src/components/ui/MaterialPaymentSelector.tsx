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
  compact?: boolean;
}

export const MaterialPaymentSelector: React.FC<MaterialPaymentSelectorProps> = ({
  paymentType,
  installments,
  onPaymentTypeChange,
  onInstallmentsChange,
  disabled = false,
  compact = false
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
      // Se passou de 12x, limitar a 12x
      if (installments > 12) {
        onInstallmentsChange(12);
      }
    }
  }, [paymentType]);

  const getMaxInstallments = () => {
    if (paymentType === 'parcelado_cartao') return 12;
    if (paymentType === 'parcelado_boleto') return 12;
    return 1;
  };

  const getDiscount = () => {
    if (paymentType === 'a_vista') return 10;
    if (paymentType === 'parcelado_cartao') return 5;
    return 0;
  };

  return (
    <div className={`${compact ? 'space-y-2' : 'space-y-4'}`}>
      <div>
        <Label className={`${compact ? 'text-xs font-medium mb-1' : 'text-base font-semibold mb-3'} block`}>
          {compact ? 'Pagamento Material' : 'Forma de Pagamento dos Recursos Didáticos'}
        </Label>
        <RadioGroup 
          value={paymentType} 
          onValueChange={onPaymentTypeChange}
          disabled={disabled}
          className={`${compact ? 'space-y-1' : 'space-y-3'}`}
        >
          {/* À Vista */}
          <div className={`flex items-center space-x-2 ${compact ? 'p-1.5 text-xs' : 'p-3'} rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer`}>
            <RadioGroupItem value="a_vista" id="a_vista" />
            <Label htmlFor="a_vista" className="flex items-center space-x-1 cursor-pointer flex-1">
              <Zap className={`${compact ? 'h-3 w-3' : 'h-5 w-5'} text-yellow-600`} />
              <div className="flex-1">
                <div className="font-medium">À Vista</div>
                {!compact && <div className="text-sm text-gray-600">10% de desconto</div>}
              </div>
              <div className="text-green-600 font-semibold">-10%</div>
            </Label>
          </div>

          {/* Parcelado no Cartão */}
          <div className={`flex items-center space-x-2 ${compact ? 'p-1.5 text-xs' : 'p-3'} rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer`}>
            <RadioGroupItem value="parcelado_cartao" id="parcelado_cartao" />
            <Label htmlFor="parcelado_cartao" className="flex items-center space-x-1 cursor-pointer flex-1">
              <CreditCard className={`${compact ? 'h-3 w-3' : 'h-5 w-5'} text-blue-600`} />
              <div className="flex-1">
                <div className="font-medium">Cartão</div>
                {!compact && <div className="text-sm text-gray-600">Até 12x com 5% de desconto</div>}
              </div>
              <div className="text-green-600 font-semibold">-5%</div>
            </Label>
          </div>

          {/* Parcelado no Boleto */}
          <div className={`flex items-center space-x-2 ${compact ? 'p-1.5 text-xs' : 'p-3'} rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer`}>
            <RadioGroupItem value="parcelado_boleto" id="parcelado_boleto" />
            <Label htmlFor="parcelado_boleto" className="flex items-center space-x-1 cursor-pointer flex-1">
              <FileText className={`${compact ? 'h-3 w-3' : 'h-5 w-5'} text-gray-600`} />
              <div className="flex-1">
                <div className="font-medium">Boleto</div>
                {!compact && <div className="text-sm text-gray-600">Até 12x sem desconto</div>}
              </div>
              <div className="text-gray-500 font-semibold text-xs">0%</div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Seletor de Parcelas - Apenas para parcelado */}
      {(paymentType === 'parcelado_cartao' || paymentType === 'parcelado_boleto') && (
        <div>
          <Label htmlFor="installments" className={`${compact ? 'text-xs' : 'text-sm font-medium'}`}>
            {compact ? 'Parcelas' : 'Número de Parcelas'}
          </Label>
          <Select 
            value={installments.toString()} 
            onValueChange={(value) => onInstallmentsChange(parseInt(value))}
            disabled={disabled}
          >
            <SelectTrigger id="installments" className={`${compact ? 'h-7 text-xs mt-1' : 'mt-2'}`}>
              <SelectValue placeholder="Selecione parcelas" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: getMaxInstallments() - 1 }, (_, i) => i + 2).map((num) => (
                <SelectItem key={num} value={num.toString()}>
                  {num}x {!compact && 'parcelas'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Resumo do Desconto - Versão compacta omite isso */}
      {paymentType && !compact && (
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

