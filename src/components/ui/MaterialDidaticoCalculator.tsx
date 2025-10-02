import React from 'react';
import { BookOpen, Percent, CreditCard } from 'lucide-react';

export type MaterialPaymentType = 'a_vista' | 'parcelado_cartao' | 'parcelado_boleto' | null;

interface MaterialDidaticoCalculatorProps {
  materialAnual: number;
  materialMensal: number;
  discountMaterial: number | null;
  containerClassName?: string;
  className?: string;
  hasHadInterview?: boolean;
  paymentType?: MaterialPaymentType;
  installments?: number | null;
  savedInstallmentValue?: number | null;
}

export const MaterialDidaticoCalculator: React.FC<MaterialDidaticoCalculatorProps> = ({
  materialAnual,
  materialMensal,
  discountMaterial,
  containerClassName,
  className,
  hasHadInterview = false,
  paymentType = null,
  installments = null,
  savedInstallmentValue = null
}) => {
  // Função para calcular material didático com desconto
  const calculateMaterialWithDiscount = (originalValue: number, discountPercentage: number) => {
    const discountMultiplier = 1 - (discountPercentage / 100);
    return originalValue * discountMultiplier;
  };

  const hasDiscount = discountMaterial && discountMaterial > 0;
  const finalMaterialAnual = hasDiscount ? calculateMaterialWithDiscount(materialAnual, discountMaterial) : materialAnual;
  
  const savingsAnual = materialAnual - finalMaterialAnual;

  // Usar valor da parcela salvo ou calcular se não houver
  const installmentValue = savedInstallmentValue 
    ? savedInstallmentValue 
    : (installments && installments >= 1 ? finalMaterialAnual / installments : null);

  // Obter nome amigável do tipo de pagamento
  const getPaymentTypeName = () => {
    if (!paymentType) return null;
    switch (paymentType) {
      case 'a_vista': return 'À Vista';
      case 'parcelado_cartao': return 'Cartão de Crédito';
      case 'parcelado_boleto': return 'Boleto';
      default: return null;
    }
  };

  // Determinar a mensagem adequada baseada em hasHadInterview
  const getNoDiscountMessage = () => {
    if (!hasHadInterview) {
      return "Aluno não teve atendimento";
    }
    return "Nenhum desconto aplicado";
  };

  return (
    <div className={`space-y-4 ${containerClassName || ''}`}>
      {/* Informações do Material Didático */}
      <div className="bg-purple-50 p-4 rounded-lg border">
        <div className="flex items-center space-x-2 mb-3">
          <BookOpen className="h-4 w-4 text-purple-600" />
          <span className="font-medium text-purple-900">Material Didático</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Material Anual:</span>
            <p className="font-semibold text-lg">R$ {materialAnual.toFixed(2)}</p>
          </div>         
        </div>
      </div>

      {/* Informações de Pagamento */}
      {paymentType && (
        <div className="bg-blue-50 p-4 rounded-lg border">
          <div className="flex items-center space-x-2 mb-3">
            <CreditCard className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-900">Forma de Pagamento</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Tipo:</span>
              <p className="font-semibold text-lg">{getPaymentTypeName()}</p>
            </div>
            {installments && installments > 1 && (
              <div>
                <span className="text-gray-600">Parcelas:</span>
                <p className="font-semibold text-lg">{installments}x</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cálculo com Desconto */}
      {paymentType ? (
        <div className="bg-green-50 p-4 rounded-lg border">
          <div className="flex items-center space-x-2 mb-3">
            <Percent className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-900">Valores do Material</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Desconto Aplicado:</span>
              <p className="font-semibold text-lg text-green-700">{discountMaterial || 0}%</p>
            </div>
            <div>
              <span className="text-gray-600">Material Anual Final:</span>
              <p className="font-bold text-xl text-green-700">R$ {finalMaterialAnual.toFixed(2)}</p>
            </div>
            {installmentValue && (
              <div>
                <span className="text-gray-600">Valor da Parcela:</span>
                <p className="font-bold text-xl text-green-700">R$ {installmentValue.toFixed(2)}</p>
              </div>
            )}
            {hasDiscount && (
              <div>
                <span className="text-gray-600">Economia Total:</span>
                <p className="font-semibold text-lg text-green-600">R$ {savingsAnual.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 p-4 rounded-lg border">
          <div className="flex items-center space-x-2 mb-2">
            <Percent className="h-4 w-4 text-gray-600" />
            <span className="font-medium text-gray-900">Desconto</span>
          </div>
          <p className="text-gray-600">{getNoDiscountMessage()}</p>
        </div>
      )}
    </div>
  );
};
