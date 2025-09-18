import DOMPurify from 'dompurify';

/**
 * Configuração de sanitização para diferentes tipos de conteúdo
 */
const sanitizeConfig = {
  // Para comentários e texto livre - permite formatação básica
  richText: {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  },
  
  // Para nomes e campos simples - apenas texto
  plainText: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  },
  
  // Para campos de entrada - remove HTML completamente
  input: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  }
};

/**
 * Sanitiza texto rico (comentários) permitindo formatação básica
 */
export const sanitizeRichText = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  return DOMPurify.sanitize(input, sanitizeConfig.richText);
};

/**
 * Sanitiza texto simples (nomes, endereços, etc.)
 */
export const sanitizePlainText = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  return DOMPurify.sanitize(input, sanitizeConfig.plainText);
};

/**
 * Sanitiza entrada de usuário removendo todo HTML
 */
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  return DOMPurify.sanitize(input, sanitizeConfig.input);
};

/**
 * Sanitiza e limita o comprimento do texto
 */
export const sanitizeAndLimit = (input: string, maxLength: number = 1000): string => {
  const sanitized = sanitizeInput(input);
  return sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized;
};

/**
 * Sanitiza email (sem validação de formato durante digitação)
 */
export const sanitizeEmail = (email: string): string => {
  if (!email || typeof email !== 'string') return '';
  
  // Remove caracteres perigosos e limita comprimento
  const sanitized = email
    .toLowerCase()
    .trim()
    .replace(/[<>\"'&]/g, '')
    .substring(0, 254); // Limite RFC para emails
  
  return sanitized;
};

/**
 * Valida formato de email (para usar na validação do formulário)
 */
export const validateEmailFormat = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Valida e sanitiza telefone
 */
export const sanitizePhone = (phone: string): string => {
  if (!phone || typeof phone !== 'string') return '';
  
  // Remove tudo exceto números, parênteses, hífens e espaços
  const sanitized = phone.replace(/[^\d\(\)\-\s]/g, '');
  
  // Limita comprimento
  return sanitized.substring(0, 20);
};

/**
 * Sanitiza nome removendo caracteres especiais perigosos
 */
export const sanitizeName = (name: string): string => {
  if (!name || typeof name !== 'string') return '';
  
  // Remove caracteres HTML e scripts, mantém acentos e espaços
  const sanitized = name
    .replace(/<[^>]*>/g, '') // Remove tags HTML
    .replace(/[<>\"'&]/g, '') // Remove caracteres perigosos
    .trim();
  
  // Limita comprimento
  return sanitized.substring(0, 100);
};

/**
 * Sanitiza endereço
 */
export const sanitizeAddress = (address: string): string => {
  if (!address || typeof address !== 'string') return '';
  
  const sanitized = address
    .replace(/<[^>]*>/g, '') // Remove tags HTML
    .replace(/[<>\"'&]/g, '') // Remove caracteres perigosos
    .trim();
  
  return sanitized.substring(0, 200);
};

/**
 * Sanitiza escola de origem
 */
export const sanitizeSchool = (school: string): string => {
  if (!school || typeof school !== 'string') return '';
  
  const sanitized = school
    .replace(/<[^>]*>/g, '') // Remove tags HTML
    .replace(/[<>\"'&]/g, '') // Remove caracteres perigosos
    .trim();
  
  return sanitized.substring(0, 150);
};

/**
 * Verifica se o texto contém conteúdo malicioso
 */
export const containsMaliciousContent = (input: string): boolean => {
  if (!input || typeof input !== 'string') return false;
  
  const maliciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<link/gi,
    /<meta/gi,
    /<style/gi,
    /expression\s*\(/gi,
    /url\s*\(/gi,
  ];
  
  return maliciousPatterns.some(pattern => pattern.test(input));
};

/**
 * Sanitiza dados do formulário de inscrição
 */
export const sanitizeRegistrationData = (data: any) => {
  return {
    ...data,
    studentName: sanitizeName(data.studentName || ''),
    responsibleName: sanitizeName(data.responsibleName || ''),
    email: sanitizeEmail(data.email || ''),
    phone: sanitizePhone(data.phone || ''),
    cityName: sanitizePlainText(data.cityName || ''),
    neighborhood: sanitizePlainText(data.neighborhood || ''),
  };
};

/**
 * Sanitiza comentários de interação
 */
export const sanitizeInteractionComment = (comment: string): string => {
  if (!comment || typeof comment !== 'string') return '';
  
  // Para comentários, permitimos formatação básica mas sanitizamos
  const sanitized = sanitizeRichText(comment);
  
  // Verifica se ainda contém conteúdo malicioso após sanitização
  if (containsMaliciousContent(sanitized)) {
    return sanitizeInput(comment); // Fallback para sanitização completa
  }
  
  return sanitized;
};