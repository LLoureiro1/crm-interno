import React from 'react';
import { DollarSign, Percent } from 'lucide-react';

interface MonthlyFeeCalculatorProps {
  originalFee: number;
  discountPercentage: number | null;
  containerClassName?: string;
  showAnnualSavings?: boolean;
  showClassName?: boolean;
  className?: string;
  hasHadInterview?: boolean;
  annuity?: number; // anuidade da turma (opcional)
  parcelas?: number; // número de parcelas da anuidade (opcional)
}

export const MonthlyFeeCalculator: React.FC<MonthlyFeeCalculatorProps> = ({
  originalFee,
  discountPercentage,
  containerClassName,
  showAnnualSavings = true,
  showClassName = false,
  className,
  hasHadInterview = false,
  annuity,
  parcelas,
}) => {
  // Função para calcular mensalidade com desconto
  const calculateMonthlyFeeWithDiscount = (originalFee: number, discountPercentage: number) => {
    const discountMultiplier = 1 - (discountPercentage / 100);
    return originalFee * discountMultiplier;
  };

  const hasDiscount = discountPercentage && discountPercentage > 0;
  const finalFee = hasDiscount ? calculateMonthlyFeeWithDiscount(originalFee, discountPercentage) : originalFee;
  const savings = originalFee - finalFee;

  // Cálculo de anuidade e economia anual
  const parcelasCount = parcelas ?? 12;
  const annuityOriginal = annuity ?? (originalFee * parcelasCount);
  const annuityDiscounted = hasDiscount ? annuityOriginal * (1 - (Number(discountPercentage) / 100)) : annuityOriginal;
  const annualSavings = hasDiscount ? annuityOriginal - annuityDiscounted : 0;

  // Determinar a mensagem adequada baseada em hasHadInterview
  const getNoDiscountMessage = () => {
    if (!hasHadInterview) {
      return "Aluno não teve atendimento";
    }
    return "Nenhum desconto aplicado";
  };

  return (
    <div className={`space-y-4 ${containerClassName || ''}`}>
      {/* Informações da Mensalidade */}
      <div className="bg-blue-50 p-4 rounded-lg border">
        <div className="flex items-center space-x-2 mb-3">
          <DollarSign className="h-4 w-4 text-blue-600" />
          <span className="font-medium text-blue-900">Mensalidade da Turma</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Mensalidade Original:</span>
            <p className="font-semibold text-lg">R$ {originalFee.toFixed(2)}</p>
          </div>
          {showClassName && (
            <div>
              <span className="text-gray-600">Turma:</span>
              <p className="font-medium">{className}</p>
            </div>
          )}
        </div>
      </div>

      {/* Cálculo com Desconto */}
      {hasDiscount ? (
        <div className="bg-green-50 p-4 rounded-lg border">
          <div className="flex items-center space-x-2 mb-3">
            <Percent className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-900">Mensalidade com Desconto</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Desconto Aplicado:</span>
              <p className="font-semibold text-lg text-green-700">{discountPercentage}%</p>
            </div>
            <div>
              <span className="text-gray-600">Valor Final:</span>
              <p className="font-bold text-xl text-green-700">R$ {finalFee.toFixed(2)}</p>
            </div>
            {showAnnualSavings && (
              <div>
                <span className="text-gray-600">Economia Anual:</span>
                <p className="font-semibold text-lg text-green-600">R$ {annualSavings.toFixed(2)}</p>
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
