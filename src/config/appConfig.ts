export const APP_CONFIG = {
  SCHOOL_NAME: 'Rede de Ensino APOGEU',
  /** URL pública do frontend (links em e-mails). Configure VITE_PUBLIC_APP_URL no deploy. */
  PUBLIC_APP_URL: import.meta.env.VITE_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : ''),
};
