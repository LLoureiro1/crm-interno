import { RegistrationFormData, ValidationErrors } from '@/types/registration';
import { validateEmailFormat } from '@/utils/sanitization';

// Função auxiliar para validar telefone (aceita 10 ou 11 dígitos)
const isValidPhone = (phone: string): boolean => {
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length === 10 || digitsOnly.length === 11;
};

export const validateForm = (formData: RegistrationFormData, hasRegistrationSources: boolean = false): ValidationErrors => {
  const errors: ValidationErrors = {};
  
  // Validar campos obrigatórios
  if (!formData.studentName.trim()) {
    errors.studentName = 'Nome do aluno é obrigatório';
  }
  
  if (!formData.responsibleName.trim()) {
    errors.responsibleName = 'Nome do responsável é obrigatório';
  }
  
  // Validar telefone principal (obrigatório)
  if (!formData.phone || !isValidPhone(formData.phone)) {
    errors.phone = 'Telefone principal é obrigatório (10 ou 11 dígitos com DDD)';
  }

  // Validar telefones adicionais (opcionais, mas se preenchidos devem ser válidos)
  if (formData.additionalPhones && formData.additionalPhones.length > 0) {
    formData.additionalPhones.forEach((phone, index) => {
      if (phone && !isValidPhone(phone)) {
        errors[`additionalPhones.${index}`] = 'Telefone deve ter 10 ou 11 dígitos com DDD';
      }
    });
  }
  
  // Validar formato do email (opcional)
  if (formData.email.trim() && !validateEmailFormat(formData.email)) {
    errors.email = 'E-mail deve ter um formato válido';
  }
  
  if (!formData.seriesId) {
    errors.seriesId = 'Série é obrigatória';
  }
  
  if (!formData.unitId) {
    errors.unitId = 'Unidade é obrigatória';
  }
  
  // Validar origem da inscrição apenas se há opções disponíveis
  if (hasRegistrationSources && !formData.registrationSourceId.trim()) {
    errors.registrationSourceId = 'Por favor, selecione como conheceu a Apogeu';
  }
  
  // Turma não é mais obrigatória - sistema resolve automaticamente

  return errors;
};

export const convertDateToISO = (dateStr: string): string | null => {
  if (!dateStr || dateStr.trim() === '') {
    return null;
  }
  const [day, month, year] = dateStr.split('/');
  return `${year}-${month}-${day}`;
};