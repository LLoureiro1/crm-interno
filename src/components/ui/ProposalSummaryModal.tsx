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
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader className="pb-3">
          <DialogTitle className="text-xl font-bold text-center">
            📋 Resumo da Proposta
          </DialogTitle>
          <div className="text-center space-y-1">
            <p className="text-gray-800 font-semibold">
              {student.student_name}
            </p>
            <div className="flex items-center justify-center space-x-4 text-xs text-gray-600">
              <span className="flex items-center space-x-1">
                <GraduationCap className="h-3 w-3" />
                <span>{student.classes.series.name}</span>
              </span>
              <span>•</span>
              <span>{student.classes.units.name}</span>                            
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Mensalidade */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-3 rounded-lg border border-green-200">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <h3 className="font-semibold text-green-900 text-sm">Mensalidade</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600">Parcela Integral:</span>
                <span className="text-gray-500 line-through text-xs">R$ {student.classes.monthly_fee.toFixed(2)}</span>
              </div>
              {student.discount_percentage && student.discount_percentage > 0 && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600">Desconto:</span>
                  <Badge className="bg-green-600 text-xs px-2 py-0">{student.discount_percentage}%</Badge>
                </div>
              )}
              <div className="flex justify-between items-center pt-1 border-t border-green-200">
                <span className="font-semibold text-gray-800 text-xs">Final:</span>
                <span className="text-lg font-bold text-green-700">R$ {finalMonthlyFee.toFixed(2)}</span>
              </div>
              {monthlySavings > 0 && (
                <div className="bg-green-100 p-1.5 rounded text-center">
                  <p className="text-xs text-green-700">
                    💰 <strong>-R$ {monthlySavings.toFixed(2)}/mês</strong>
                    <span className="block text-xs mt-0.5">(-R$ {(monthlySavings * 12).toFixed(2)}/ano)</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Material Didático */}
          {student.classes.material_didatico_anual && student.classes.material_didatico_anual > 0 && (
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-3 rounded-lg border border-purple-200">
              <div className="flex items-center space-x-2 mb-2">
                <Package className="h-4 w-4 text-purple-600" />
                <h3 className="font-semibold text-purple-900 text-sm">Material Didático</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600">Anual:</span>
                  <span className={student.discount_material && student.discount_material > 0 ? "text-gray-500 line-through text-xs" : "font-medium text-xs"}>
                    R$ {student.classes.material_didatico_anual.toFixed(2)}
                  </span>
                </div>
                
                {/* Forma de Pagamento */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600">Pagamento:</span>
                  <div className="flex items-center space-x-1">
                    {student.material_payment_type === 'a_vista' && <FileText className="h-3 w-3 text-purple-600" />}
                    {student.material_payment_type === 'parcelado_cartao' && <CreditCard className="h-3 w-3 text-purple-600" />}
                    {student.material_payment_type === 'parcelado_boleto' && <FileText className="h-3 w-3 text-purple-600" />}
                    <span className="font-medium">{getPaymentTypeName()}</span>
                  </div>
                </div>

                {student.discount_material && student.discount_material > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-600">Desconto:</span>
                    <Badge className="bg-purple-600 text-xs px-2 py-0">{student.discount_material}%</Badge>
                  </div>
                )}

                {/* Valor Final do Material */}
                <div className="flex justify-between items-center pt-1 border-t border-purple-200">
                  <span className="font-semibold text-gray-800 text-xs">Total:</span>
                  <span className="text-lg font-bold text-purple-700">R$ {finalMaterialAnual.toFixed(2)}</span>
                </div>

                {/* Parcelamento */}
                {student.material_installments && student.material_installments > 1 && student.material_parcela && (
                  <div className="bg-purple-100 p-1.5 rounded">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3 text-purple-700" />
                        <span className="text-xs font-medium text-purple-900">Parcelas:</span>
                      </div>
                      <span className="text-sm font-bold text-purple-700">
                        {student.material_installments}x R$ {student.material_parcela.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {materialSavings > 0 && (
                  <div className="bg-purple-100 p-1.5 rounded text-center">
                    <p className="text-xs text-purple-700">
                      💰 <strong>-R$ {materialSavings.toFixed(2)}</strong>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

