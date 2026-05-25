export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      email_integrations: {
        Row: {
          id: string
          unit_id: string | null
          sender_email: string
          sender_name: string
          webhook_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          unit_id?: string | null
          sender_email: string
          sender_name?: string
          webhook_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          unit_id?: string | null
          sender_email?: string
          sender_name?: string
          webhook_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_integrations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          id: string
          student_id: string | null
          appointment_id: string | null
          unit_id: string | null
          template_id: string | null
          trigger_type: Database["public"]["Enums"]["email_trigger_type"]
          to_email: string
          to_name: string | null
          subject: string
          html_body: string
          status: Database["public"]["Enums"]["email_queue_status"]
          scheduled_for: string
          idempotency_key: string
          provider_message_id: string | null
          error_message: string | null
          attempts: number
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          student_id?: string | null
          appointment_id?: string | null
          unit_id?: string | null
          template_id?: string | null
          trigger_type: Database["public"]["Enums"]["email_trigger_type"]
          to_email: string
          to_name?: string | null
          subject: string
          html_body: string
          status?: Database["public"]["Enums"]["email_queue_status"]
          scheduled_for?: string
          idempotency_key: string
          provider_message_id?: string | null
          error_message?: string | null
          attempts?: number
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string | null
          appointment_id?: string | null
          unit_id?: string | null
          template_id?: string | null
          trigger_type?: Database["public"]["Enums"]["email_trigger_type"]
          to_email?: string
          to_name?: string | null
          subject?: string
          html_body?: string
          status?: Database["public"]["Enums"]["email_queue_status"]
          scheduled_for?: string
          idempotency_key?: string
          provider_message_id?: string | null
          error_message?: string | null
          attempts?: number
          sent_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          id: string
          unit_id: string | null
          trigger_type: Database["public"]["Enums"]["email_trigger_type"]
          name: string
          subject: string
          html_body: string
          is_active: boolean
          send_offset_days: number
          send_at_hour: number
          send_at_minute: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          unit_id?: string | null
          trigger_type: Database["public"]["Enums"]["email_trigger_type"]
          name: string
          subject: string
          html_body: string
          is_active?: boolean
          send_offset_days?: number
          send_at_hour?: number
          send_at_minute?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          unit_id?: string | null
          trigger_type?: Database["public"]["Enums"]["email_trigger_type"]
          name?: string
          subject?: string
          html_body?: string
          is_active?: boolean
          send_offset_days?: number
          send_at_hour?: number
          send_at_minute?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_unit_id_fkey"
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
      contact_attempts: {
        Row: {
          id: string
          student_id: string
          attempted_by: string
          attempted_at: string
          channel: Database["public"]["Enums"]["contact_channel"]
          reason: Database["public"]["Enums"]["contact_reason"]
          succeeded: boolean
          comment: string | null
          related_status: Database["public"]["Enums"]["student_status"]
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          attempted_by: string
          attempted_at?: string
          channel: Database["public"]["Enums"]["contact_channel"]
          reason: Database["public"]["Enums"]["contact_reason"]
          succeeded?: boolean
          comment?: string | null
          related_status: Database["public"]["Enums"]["student_status"]
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          attempted_by?: string
          attempted_at?: string
          channel?: Database["public"]["Enums"]["contact_channel"]
          reason?: Database["public"]["Enums"]["contact_reason"]
          succeeded?: boolean
          comment?: string | null
          related_status?: Database["public"]["Enums"]["student_status"]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_attempts_attempted_by_fkey"
            columns: ["attempted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          name: string
          profile: Database["public"]["Enums"]["user_profile"]
          unit_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id: string
          name: string
          profile?: Database["public"]["Enums"]["user_profile"]
          unit_id?: string | null
        }
        Update: {
          ativo?: boolean
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
          invalid_reason: Database["public"]["Enums"]["invalid_reason"] | null
          email: string
          exam_date: string | null
          id: string
          interview_date: string | null
          material_installments: number | null
          material_parcela: number | null
          material_payment_type: string | null
          math_grade: number | null
          final_grade: number | null
          neighborhood: string
          origin_school: string
          phone: string
          portuguese_grade: number | null
          responsible_name: string
          status: Database["public"]["Enums"]["student_status"]
          student_name: string
          tag: string | null
          tracking_code: string | null
          registration_token: string
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
          invalid_reason?: Database["public"]["Enums"]["invalid_reason"] | null
          email: string
          exam_date?: string | null
          id?: string
          interview_date?: string | null
          material_installments?: number | null
          material_parcela?: number | null
          material_payment_type?: string | null
          math_grade?: number | null
          final_grade?: number | null
          neighborhood: string
          origin_school: string
          phone: string
          portuguese_grade?: number | null
          responsible_name: string
          status?: Database["public"]["Enums"]["student_status"]
          student_name: string
          tag?: string | null
          tracking_code?: string | null
          registration_token?: string
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
          invalid_reason?: Database["public"]["Enums"]["invalid_reason"] | null
          email?: string
          exam_date?: string | null
          id?: string
          interview_date?: string | null
          material_installments?: number | null
          material_parcela?: number | null
          material_payment_type?: string | null
          math_grade?: number | null
          final_grade?: number | null
          neighborhood?: string
          origin_school?: string
          phone?: string
          portuguese_grade?: number | null
          responsible_name?: string
          status?: Database["public"]["Enums"]["student_status"]
          student_name?: string
          tag?: string | null
          tracking_code?: string | null
          registration_token?: string
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
          institution_id: string | null
          name: string
          phone: string
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          id?: string
          institution_id?: string | null
          name: string
          phone: string
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          id?: string
          institution_id?: string | null
          name?: string
          phone?: string
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          }
        ]
      },
      contact_lists: {
        Row: {
          id: string
          name: string
          status_in: Database["public"]["Enums"]["student_status"][] | null
          unit_ids: string[] | null
          series_ids: string[] | null
          class_ids: string[] | null
          academic_years: string[] | null
          exam_date_filters: string[] | null
          is_active: boolean
          distribution_mode: string | null
          created_by: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          status_in?: Database["public"]["Enums"]["student_status"][] | null
          unit_ids?: string[] | null
          series_ids?: string[] | null
          class_ids?: string[] | null
          academic_years?: string[] | null
          exam_date_filters?: string[] | null
          is_active?: boolean
          distribution_mode?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          status_in?: Database["public"]["Enums"]["student_status"][] | null
          unit_ids?: string[] | null
          series_ids?: string[] | null
          class_ids?: string[] | null
          academic_years?: string[] | null
          exam_date_filters?: string[] | null
          is_active?: boolean
          distribution_mode?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_lists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      contact_list_assignees: {
        Row: {
          id: string
          list_id: string
          user_id: string
          weight: number
          created_at: string
        }
        Insert: {
          id?: string
          list_id: string
          user_id: string
          weight?: number
          created_at?: string
        }
        Update: {
          id?: string
          list_id?: string
          user_id?: string
          weight?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_list_assignees_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_list_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      contact_list_items: {
        Row: {
          id: string
          list_id: string
          student_id: string
          assigned_user_id: string | null
          entered_at: string
          left_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          list_id: string
          student_id: string
          assigned_user_id?: string | null
          entered_at?: string
          left_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          list_id?: string
          student_id?: string
          assigned_user_id?: string | null
          entered_at?: string
          left_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_list_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_list_items_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      public_interviewer_profiles: {
        Row: {
          id: string
          name: string
        }
        Relationships: []
      }
    }
    Functions: {
      generate_student_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      ,
      distribute_contact_list_items: {
        Args: { p_list_id: string }
        Returns: undefined
      },
      register_student: {
        Args: { p_payload: Json }
        Returns: Json
      },
      get_occupied_slots: {
        Args: {
          p_date: string
          p_interviewer_ids: string[]
        }
        Returns: {
          interviewer_id: string
          appointment_time: string
        }[]
      },
      get_my_appointment: {
        Args: {
          p_student_id: string
          p_registration_token: string
        }
        Returns: Json
      },
      public_schedule_interview: {
        Args: {
          p_student_id: string
          p_interviewer_id: string
          p_date: string
          p_time: string
          p_registration_token: string
          p_comments?: string
        }
        Returns: Json
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
      invalid_reason:
        | "cadastro_duplicado"
        | "cadastro_de_teste"
        | "ja_e_aluno"
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
      contact_channel: "phone" | "whatsapp" | "email" | "in_person"
      contact_reason:
        | "agendamento"
        | "reagendamento"
        | "confirmacao_prova"
        | "convidar_ausentes"
        | "followup_pos_atendimento"
      email_trigger_type:
        | "student_registered"
        | "appointment_scheduled"
        | "appointment_reminder_same_day"
        | "exam_reminder_1_day_before"
      email_queue_status:
        | "pending"
        | "sending"
        | "sent"
        | "failed"
        | "cancelled"
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
      invalid_reason: [
        "cadastro_duplicado",
        "cadastro_de_teste",
        "ja_e_aluno",
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
      contact_channel: ["phone", "whatsapp", "email", "in_person"],
      contact_reason: [
        "agendamento",
        "reagendamento",
        "confirmacao_prova",
        "convidar_ausentes",
        "followup_pos_atendimento",
      ],
      email_trigger_type: [
        "student_registered",
        "appointment_scheduled",
        "appointment_reminder_same_day",
        "exam_reminder_1_day_before",
      ],
      email_queue_status: [
        "pending",
        "sending",
        "sent",
        "failed",
        "cancelled",
      ],
    },
  },
} as const