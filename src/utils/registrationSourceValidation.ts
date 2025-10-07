export interface RegistrationSourceFormData {
  source_key: string;
  source_label: string;
  is_active: boolean;
  sort_order: number;
}

export interface RegistrationSourceValidationErrors {
  source_key?: string;
  source_label?: string;
  sort_order?: string;
}

// Função para validar a chave da origem (deve ser única, sem espaços, apenas letras, números e underscore)
const isValidSourceKey = (key: string): boolean => {
  const sourceKeyRegex = /^[a-z][a-z0-9_]*$/;
  return sourceKeyRegex.test(key) && key.length >= 2 && key.length <= 50;
};

// Função para validar o label da origem
const isValidSourceLabel = (label: string): boolean => {
  return label.trim().length >= 2 && label.trim().length <= 100;
};

// Função para validar a ordem
const isValidSortOrder = (order: number): boolean => {
  return Number.isInteger(order) && order >= 0 && order <= 9999;
};

export const validateRegistrationSourceForm = (
  formData: RegistrationSourceFormData,
  existingSources: Array<{ source_key: string; id?: string }> = [],
  isEditing: boolean = false
): RegistrationSourceValidationErrors => {
  const errors: RegistrationSourceValidationErrors = {};

  // Validar source_key
  if (!formData.source_key.trim()) {
    errors.source_key = 'Chave da origem é obrigatória';
  } else if (!isValidSourceKey(formData.source_key)) {
    errors.source_key = 'Chave deve ter 2-50 caracteres, começar com letra e conter apenas letras minúsculas, números e underscore';
  } else {
    // Verificar se a chave já existe (apenas para criação ou se mudou)
    const keyExists = existingSources.some(source => 
      source.source_key === formData.source_key && 
      (!isEditing || source.id !== formData.source_key) // Se está editando, ignora o próprio registro
    );
    
    if (keyExists) {
      errors.source_key = 'Esta chave já existe para esta unidade';
    }
  }

  // Validar source_label
  if (!formData.source_label.trim()) {
    errors.source_label = 'Label da origem é obrigatório';
  } else if (!isValidSourceLabel(formData.source_label)) {
    errors.source_label = 'Label deve ter entre 2 e 100 caracteres';
  }

  // Validar sort_order
  if (!isValidSortOrder(formData.sort_order)) {
    errors.sort_order = 'Ordem deve ser um número inteiro entre 0 e 9999';
  }

  return errors;
};

// Função para gerar uma chave automática baseada no label
export const generateSourceKey = (label: string): string => {
  return label
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, '_') // Substitui espaços por underscore
    .replace(/_+/g, '_') // Remove underscores duplicados
    .replace(/^_|_$/g, ''); // Remove underscores no início e fim
};

// Função para sugerir a próxima ordem disponível
export const getNextSortOrder = (existingSources: Array<{ sort_order: number }>): number => {
  if (existingSources.length === 0) return 1;
  
  const maxOrder = Math.max(...existingSources.map(s => s.sort_order));
  return maxOrder + 1;
};

// Função para validar se uma chave é válida para uso em URLs/APIs
export const isUrlSafeKey = (key: string): boolean => {
  const urlSafeRegex = /^[a-z][a-z0-9_-]*$/;
  return urlSafeRegex.test(key);
};

// Função para formatar a chave para exibição
export const formatSourceKeyForDisplay = (key: string): string => {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};
