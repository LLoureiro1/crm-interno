import { RegistrationFormData, ValidationErrors } from '@/types/registration';
import { validateEmailFormat } from '@/utils/sanitization';

export const validateForm = (formData: RegistrationFormData): ValidationErrors => {
  const errors: ValidationErrors = {};
  
  // Validar campos obrigatórios
  if (!formData.studentName.trim()) {
    errors.studentName = 'Nome do aluno é obrigatório';
  }
  
  if (!formData.responsibleName.trim()) {
    errors.responsibleName = 'Nome do responsável é obrigatório';
  }
  
  if (!formData.birthDate || formData.birthDate.length !== 10) {
    errors.birthDate = 'Data de nascimento válida é obrigatória (DD/MM/YYYY)';
  }
  
  if (!formData.phone || formData.phone.replace(/\D/g, '').length !== 11) {
    errors.phone = 'Telefone válido é obrigatório (11 dígitos com DDD)';
  }
  
  // Validar formato do email (opcional)
  if (formData.email.trim() && !validateEmailFormat(formData.email)) {
    errors.email = 'E-mail deve ter um formato válido';
  }
  
  if (!formData.cityName.trim()) {
    errors.cityName = 'Cidade é obrigatória';
  }
  
  if (!formData.neighborhood.trim()) {
    errors.neighborhood = 'Bairro é obrigatório';
  }
  
  if (!formData.seriesId) {
    errors.seriesId = 'Série é obrigatória';
  }
  
  if (!formData.unitId) {
    errors.unitId = 'Unidade é obrigatória';
  }
  
  // Turma não é mais obrigatória - sistema resolve automaticamente

  return errors;
};

export const convertDateToISO = (dateStr: string): string => {
  const [day, month, year] = dateStr.split('/');
  return `${year}-${month}-${day}`;
};