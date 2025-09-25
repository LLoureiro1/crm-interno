import React from 'react';
import { BookOpen, Percent } from 'lucide-react';

interface MaterialDidaticoCalculatorProps {
  materialAnual: number;
  materialMensal: number;
  discountMaterial: number | null;
  containerClassName?: string;
  className?: string;
  hasHadInterview?: boolean;
}

export const MaterialDidaticoCalculator: React.FC<MaterialDidaticoCalculatorProps> = ({
  materialAnual,
  materialMensal,
  discountMaterial,
  containerClassName,
  className,
  hasHadInterview = false
}) => {
  // Função para calcular material didático com desconto
  const calculateMaterialWithDiscount = (originalValue: number, discountPercentage: number) => {
    const discountMultiplier = 1 - (discountPercentage / 100);
    return originalValue * discountMultiplier;
  };

  const hasDiscount = discountMaterial && discountMaterial > 0;
  const finalMaterialAnual = hasDiscount ? calculateMaterialWithDiscount(materialAnual, discountMaterial) : materialAnual;
  const finalMaterialMensal = hasDiscount ? calculateMaterialWithDiscount(materialMensal, discountMaterial) : materialMensal;
  
  const savingsMensal = materialMensal - finalMaterialMensal;

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
          <div>
            <span className="text-gray-600">Material Mensal:</span>
            <p className="font-semibold text-lg">R$ {materialMensal.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Cálculo com Desconto */}
      {hasDiscount ? (
        <div className="bg-green-50 p-4 rounded-lg border">
          <div className="flex items-center space-x-2 mb-3">
            <Percent className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-900">Material com Desconto</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Desconto Aplicado:</span>
              <p className="font-semibold text-lg text-green-700">{discountMaterial}%</p>
            </div>
            <div>
              <span className="text-gray-600">Material Anual Final:</span>
              <p className="font-bold text-xl text-green-700">R$ {finalMaterialAnual.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-gray-600">Material Mensal Final:</span>
              <p className="font-bold text-xl text-green-700">R$ {finalMaterialMensal.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-gray-600">Economia Mensal:</span>
              <p className="font-semibold text-lg text-green-600">R$ {savingsMensal.toFixed(2)}</p>
            </div>
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
