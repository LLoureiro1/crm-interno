
export interface RegistrationFormData {
  studentName: string;
  responsibleName: string;
  birthDate: string;
  phone: string; // Telefone principal (vai para tabela students)
  additionalPhones: string[]; // Telefones extras (vão para tabela student_phones)
  email: string;
  cityId: string;
  cityName: string;
  neighborhood: string;
  originSchool: string;
  seriesId: string;
  classId: string;
  unitId: string;
  registrationSourceId: string; // ID da origem da inscrição
}

export interface RegistrationSource {
  id: string;
  source_key: string;
  source_label: string;
  sort_order: number;
}

export interface ValidationErrors {
  [key: string]: string;
}
