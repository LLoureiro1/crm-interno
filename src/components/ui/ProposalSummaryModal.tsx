import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, DollarSign, Percent, CreditCard, FileText, Package, Calendar } from 'lucide-react';

interface ProposalSummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: {
    student_name: string;
    classes: {
      name: string;
      series: { name: string };
      units: { name: string };
      monthly_fee: number;
      material_didatico_anual?: number | null;
    };
    discount_percentage: number | null;
    discount_material: number | null;
    material_payment_type?: string | null;
    material_installments?: number | null;
    material_parcela?: number | null;
  };
}

export const ProposalSummaryModal: React.FC<ProposalSummaryModalProps> = ({
  open,
  onOpenChange,
  student
}) => {
  const calculateFinalMonthlyFee = () => {
    if (!student.discount_percentage) return student.classes.monthly_fee;
    return student.classes.monthly_fee * (1 - (student.discount_percentage / 100));
  };

  const calculateFinalMaterialAnual = () => {
    const materialAnual = student.classes.material_didatico_anual || 0;
    if (!student.discount_material) return materialAnual;
    return materialAnual * (1 - (student.discount_material / 100));
  };

  const getPaymentTypeName = () => {
    switch (student.material_payment_type) {
      case 'a_vista': return 'À Vista';
      case 'parcelado_cartao': return 'Cartão de Crédito';
      case 'parcelado_boleto': return 'Boleto';
      default: return '-';
    }
  };

  const finalMonthlyFee = calculateFinalMonthlyFee();
  const monthlySavings = student.classes.monthly_fee - finalMonthlyFee;
  const finalMaterialAnual = calculateFinalMaterialAnual();
  const materialSavings = (student.classes.material_didatico_anual || 0) - finalMaterialAnual;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            📋 Resumo da Proposta
          </DialogTitle>
          <p className="text-center text-gray-600 text-sm">
            {student.student_name}
          </p>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Informações da Turma */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-2 mb-3">
              <GraduationCap className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900">Turma</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Série:</span>
                <span className="font-medium">{student.classes.series.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Unidade:</span>
                <span className="font-medium">{student.classes.units.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Turma:</span>
                <span className="font-medium">{student.classes.name}</span>
              </div>
            </div>
          </div>

          {/* Mensalidade */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center space-x-2 mb-3">
              <DollarSign className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-green-900">Mensalidade</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 text-sm">Valor Original:</span>
                <span className="text-gray-500 line-through">R$ {student.classes.monthly_fee.toFixed(2)}</span>
              </div>
              {student.discount_percentage && student.discount_percentage > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Desconto:</span>
                  <Badge className="bg-green-600">{student.discount_percentage}%</Badge>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-green-200">
                <span className="font-semibold text-gray-800">Valor Final:</span>
                <span className="text-2xl font-bold text-green-700">R$ {finalMonthlyFee.toFixed(2)}</span>
              </div>
              {monthlySavings > 0 && (
                <div className="bg-green-100 p-2 rounded text-center">
                  <p className="text-sm text-green-700">
                    💰 Economia de <strong>R$ {monthlySavings.toFixed(2)}/mês</strong> 
                    <span className="text-xs"> (R$ {(monthlySavings * 12).toFixed(2)}/ano)</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Material Didático */}
          {student.classes.material_didatico_anual && student.classes.material_didatico_anual > 0 && (
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center space-x-2 mb-3">
                <Package className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-purple-900">Material Didático</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Valor Anual:</span>
                  <span className={student.discount_material && student.discount_material > 0 ? "text-gray-500 line-through" : "font-medium"}>
                    R$ {student.classes.material_didatico_anual.toFixed(2)}
                  </span>
                </div>
                
                {/* Forma de Pagamento */}
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Forma de Pagamento:</span>
                  <div className="flex items-center space-x-2">
                    {student.material_payment_type === 'a_vista' && <FileText className="h-4 w-4 text-purple-600" />}
                    {student.material_payment_type === 'parcelado_cartao' && <CreditCard className="h-4 w-4 text-purple-600" />}
                    {student.material_payment_type === 'parcelado_boleto' && <FileText className="h-4 w-4 text-purple-600" />}
                    <span className="font-medium">{getPaymentTypeName()}</span>
                  </div>
                </div>

                {student.discount_material && student.discount_material > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">Desconto:</span>
                    <Badge className="bg-purple-600">{student.discount_material}%</Badge>
                  </div>
                )}

                {/* Valor Final do Material */}
                <div className="flex justify-between items-center pt-2 border-t border-purple-200">
                  <span className="font-semibold text-gray-800">Valor Total:</span>
                  <span className="text-xl font-bold text-purple-700">R$ {finalMaterialAnual.toFixed(2)}</span>
                </div>

                {/* Parcelamento */}
                {student.material_installments && student.material_installments > 1 && student.material_parcela && (
                  <div className="bg-purple-100 p-3 rounded">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-purple-700" />
                        <span className="text-sm font-medium text-purple-900">Parcelamento:</span>
                      </div>
                      <span className="text-lg font-bold text-purple-700">
                        {student.material_installments}x de R$ {student.material_parcela.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {materialSavings > 0 && (
                  <div className="bg-purple-100 p-2 rounded text-center">
                    <p className="text-sm text-purple-700">
                      💰 Economia de <strong>R$ {materialSavings.toFixed(2)}</strong> no material
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Resumo Total */}
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-4 rounded-lg border-2 border-gray-300">
            <h3 className="font-bold text-center text-gray-800 mb-3 text-lg">💼 Investimento Total</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Mensalidade (12 meses):</span>
                <span className="font-medium">R$ {(finalMonthlyFee * 12).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Material Didático:</span>
                <span className="font-medium">R$ {finalMaterialAnual.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t-2 border-gray-300">
                <span className="font-bold text-gray-800">Total Anual:</span>
                <span className="text-2xl font-bold text-gray-900">
                  R$ {(finalMonthlyFee * 12 + finalMaterialAnual).toFixed(2)}
                </span>
              </div>
              {(monthlySavings > 0 || materialSavings > 0) && (
                <div className="bg-green-100 p-2 rounded text-center mt-2">
                  <p className="text-sm font-semibold text-green-700">
                    🎉 Economia Total: R$ {((monthlySavings * 12) + materialSavings).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

