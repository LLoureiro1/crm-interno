export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          attended: boolean | null
          comments: string | null
          created_at: string
          discount_percentage: number | null
          formato_entrevista: string | null
          id: string
          interviewer_id: string | null
          status: string
          student_id: string | null
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          attended?: boolean | null
          comments?: string | null
          created_at?: string
          discount_percentage?: number | null
          formato_entrevista?: string | null
          id?: string
          interviewer_id?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          attended?: boolean | null
          comments?: string | null
          created_at?: string
          discount_percentage?: number | null
          formato_entrevista?: string | null
          id?: string
          interviewer_id?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          annuity: number | null
          created_at: string
          has_exam: boolean
          id: string
          material_didatico_anual: number | null
          material_didatico_mes: number | null
          monthly_fee: number
          name: string
          parcelas: number | null
          series_id: string
          unit_id: string
        }
        Insert: {
          annuity?: number | null
          created_at?: string
          has_exam?: boolean
          id?: string
          material_didatico_anual?: number | null
          material_didatico_mes?: number | null
          monthly_fee: number
          name: string
          parcelas?: number | null
          series_id: string
          unit_id: string
        }
        Update: {
          annuity?: number | null
          created_at?: string
          has_exam?: boolean
          id?: string
          material_didatico_anual?: number | null
          material_didatico_mes?: number | null
          monthly_fee?: number
          name?: string
          parcelas?: number | null
          series_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_dates: {
        Row: {
          created_at: string
          exam_date: string
          exam_time: string
          id: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_date: string
          exam_time: string
          id?: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_date?: string
          exam_time?: string
          id?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_dates_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      interviewer_availability: {
        Row: {
          created_at: string
          date: string
          end_time: string
          id: string
          interviewer_id: string | null
          start_time: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time: string
          id?: string
          interviewer_id?: string | null
          start_time: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          interviewer_id?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviewer_availability_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interviewer_courses: {
        Row: {
          created_at: string
          id: string
          interviewer_id: string | null
          series_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          interviewer_id?: string | null
          series_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          interviewer_id?: string | null
          series_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interviewer_courses_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviewer_courses_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          profile: Database["public"]["Enums"]["user_profile"]
          unit_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name: string
          profile?: Database["public"]["Enums"]["user_profile"]
          unit_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          profile?: Database["public"]["Enums"]["user_profile"]
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          created_at: string
          id: string
          level: Database["public"]["Enums"]["education_level"]
          name: string
          ordenar: number
        }
        Insert: {
          created_at?: string
          id?: string
          level: Database["public"]["Enums"]["education_level"]
          name: string
          ordenar: number
        }
        Update: {
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["education_level"]
          name?: string
          ordenar?: number
        }
        Relationships: []
      }
      student_interactions: {
        Row: {
          comments: string | null
          created_at: string
          id: string
          interaction_type: string
          student_id: string | null
          user_id: string | null
        }
        Insert: {
          comments?: string | null
          created_at?: string
          id?: string
          interaction_type: string
          student_id?: string | null
          user_id?: string | null
        }
        Update: {
          comments?: string | null
          created_at?: string
          id?: string
          interaction_type?: string
          student_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_interactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          birth_date: string
          city: string | null
          class_id: string
          code: string | null
          created_at: string
          discount_percentage: number | null
          discount_material: number | null
          dropout_reason: Database["public"]["Enums"]["dropout_reason"] | null
          email: string
          exam_date: string | null
          id: string
          interview_date: string | null
          material_installments: number | null
          material_parcela: number | null
          material_payment_type: string | null
          math_grade: number | null
          neighborhood: string
          origin_school: string
          phone: string
          portuguese_grade: number | null
          responsible_name: string
          status: Database["public"]["Enums"]["student_status"]
          student_name: string
          tag: string | null
          ano_letivo: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          birth_date: string
          city?: string | null
          class_id: string
          code?: string | null
          created_at?: string
          discount_percentage?: number | null
          discount_material?: number | null
          dropout_reason?: Database["public"]["Enums"]["dropout_reason"] | null
          email: string
          exam_date?: string | null
          id?: string
          interview_date?: string | null
          material_installments?: number | null
          material_parcela?: number | null
          material_payment_type?: string | null
          math_grade?: number | null
          neighborhood: string
          origin_school: string
          phone: string
          portuguese_grade?: number | null
          responsible_name: string
          status?: Database["public"]["Enums"]["student_status"]
          student_name: string
          tag?: string | null
          ano_letivo?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          birth_date?: string
          city?: string | null
          class_id?: string
          code?: string | null
          created_at?: string
          discount_percentage?: number | null
          discount_material?: number | null
          dropout_reason?: Database["public"]["Enums"]["dropout_reason"] | null
          email?: string
          exam_date?: string | null
          id?: string
          interview_date?: string | null
          material_installments?: number | null
          material_parcela?: number | null
          material_payment_type?: string | null
          math_grade?: number | null
          neighborhood?: string
          origin_school?: string
          phone?: string
          portuguese_grade?: number | null
          responsible_name?: string
          status?: Database["public"]["Enums"]["student_status"]
          student_name?: string
          tag?: string | null
          ano_letivo?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      student_phones: {
        Row: {
          id: string
          student_id: string
          phone_number: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          phone_number: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          phone_number?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_phones_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          }
        ]
      }
      units: {
        Row: {
          address: string
          city: string
          created_at: string
          id: string
          name: string
          phone: string
          updated_at: string | null
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          id?: string
          name: string
          phone: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_student_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      dropout_reason:
        | "impossibilidade_contato"
        | "mudanca_de_endereco"
        | "matriculou_outra_escola"
        | "motivos_financeiros"
        | "falta_vaga"
        | "outro"
      education_level:
        | "educacao_infantil"
        | "fundamental_i"
        | "fundamental_ii"
        | "medio"
        | "cursos_livres"
      student_status:
        | "nao_confirmado"
        | "confirmado"
        | "cadastro_invalido"
        | "nenhum_agendamento"
        | "atendimento_agendado"
        | "atendimento_recentemente"
        | "atendimento_ha_mais_de_uma_semana"
        | "faltou_ao_atendimento"
        | "desistente"
        | "matriculado"
        | "ausente"
        | "processo_anos_anteriores"
      user_profile: "admin" | "direcao" | "entrevistador" | "padrao"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      dropout_reason: [
        "impossibilidade_contato",
        "mudanca_de_endereco",
        "matriculou_outra_escola",
        "motivos_financeiros",
        "falta_vaga",
        "outro",
      ],
      education_level: [
        "educacao_infantil",
        "fundamental_i",
        "fundamental_ii",
        "medio",
        "cursos_livres",
      ],
      student_status: [
        "nao_confirmado",
        "confirmado",
        "cadastro_invalido",
        "nenhum_agendamento",
        "atendimento_agendado",
        "atendimento_recentemente",
        "atendimento_ha_mais_de_uma_semana",
        "faltou_ao_atendimento",
        "desistente",
        "matriculado",
        "ausente",
        "processo_anos_anteriores",
      ],
      user_profile: ["admin", "direcao", "entrevistador", "padrao"],
    },
  },
} as const
