
export interface RegistrationFormData {
  studentName: string;
  responsibleName: string;
  birthDate: string;
  phone: string;
  email: string;
  cityId: string;
  cityName: string;
  neighborhood: string;
  originSchool: string;
  seriesId: string;
  classId: string;
  unitId: string;
}

export interface ValidationErrors {
  [key: string]: string;
}
