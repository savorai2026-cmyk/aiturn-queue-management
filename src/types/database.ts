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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          business_code: string
          business_notes: string | null
          channel: string | null
          client_id: number
          client_notes: string | null
          created_at: string | null
          currency: string | null
          end_time: string
          id: number
          metadata: Json | null
          price: number | null
          service_id: number | null
          start_time: string
          status: string
          updated_at: string | null
        }
        Insert: {
          appointment_date: string
          business_code: string
          business_notes?: string | null
          channel?: string | null
          client_id: number
          client_notes?: string | null
          created_at?: string | null
          currency?: string | null
          end_time: string
          id?: number
          metadata?: Json | null
          price?: number | null
          service_id?: number | null
          start_time: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          appointment_date?: string
          business_code?: string
          business_notes?: string | null
          channel?: string | null
          client_id?: number
          client_notes?: string | null
          created_at?: string | null
          currency?: string | null
          end_time?: string
          id?: number
          metadata?: Json | null
          price?: number | null
          service_id?: number | null
          start_time?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_appointment_business"
            columns: ["business_code"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["business_code"]
          },
          {
            foreignKeyName: "fk_appointment_client"
            columns: ["business_code", "client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["business_code", "id"]
          },
          {
            foreignKeyName: "fk_appointment_service"
            columns: ["business_code", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["business_code", "id"]
          },
        ]
      }
      appointment_services: {
        Row: {
          appointment_id: number
          buffer_time_minutes: number
          business_code: string
          created_at: string
          duration_minutes: number
          position: number
          price: number
          service_id: number
          title_snapshot: string
        }
        Insert: {
          appointment_id: number
          buffer_time_minutes?: number
          business_code: string
          created_at?: string
          duration_minutes: number
          position: number
          price: number
          service_id: number
          title_snapshot: string
        }
        Update: {
          appointment_id?: number
          buffer_time_minutes?: number
          business_code?: string
          created_at?: string
          duration_minutes?: number
          position?: number
          price?: number
          service_id?: number
          title_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_services_business_code_appointment_id_fkey"
            columns: ["business_code", "appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["business_code", "id"]
          },
          {
            foreignKeyName: "appointment_services_business_code_fkey"
            columns: ["business_code"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["business_code"]
          },
          {
            foreignKeyName: "appointment_services_business_code_service_id_fkey"
            columns: ["business_code", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["business_code", "id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_code: string
          created_at: string
          created_by: string | null
          id: string
          role: string
          status: string
          status_changed_at: string
          ui_preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          business_code: string
          created_at?: string
          created_by?: string | null
          id?: string
          role?: string
          status?: string
          status_changed_at?: string
          ui_preferences?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          business_code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          role?: string
          status?: string
          status_changed_at?: string
          ui_preferences?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_code_fkey"
            columns: ["business_code"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["business_code"]
          },
        ]
      }
      businesses: {
        Row: {
          agent_phone_number: string | null
          business_code: string
          business_name: string
          contact_phone: string | null
          created_at: string | null
          email: string | null
          is_active: boolean | null
          max_adv_booking_days: number | null
          slot_duration_minutes: number | null
          timezone: string | null
          ui_preferences: Json
          updated_at: string
          vapi_assistant_id: string | null
          wa_instance_id: string | null
          working_hours: Json | null
        }
        Insert: {
          agent_phone_number?: string | null
          business_code: string
          business_name: string
          contact_phone?: string | null
          created_at?: string | null
          email?: string | null
          is_active?: boolean | null
          max_adv_booking_days?: number | null
          slot_duration_minutes?: number | null
          timezone?: string | null
          ui_preferences?: Json
          updated_at?: string
          vapi_assistant_id?: string | null
          wa_instance_id?: string | null
          working_hours?: Json | null
        }
        Update: {
          agent_phone_number?: string | null
          business_code?: string
          business_name?: string
          contact_phone?: string | null
          created_at?: string | null
          email?: string | null
          is_active?: boolean | null
          max_adv_booking_days?: number | null
          slot_duration_minutes?: number | null
          timezone?: string | null
          ui_preferences?: Json
          updated_at?: string
          vapi_assistant_id?: string | null
          wa_instance_id?: string | null
          working_hours?: Json | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          acquisition_source: string | null
          allows_sms: boolean | null
          apartment_number: string | null
          birth_date_gregorian: string | null
          birth_date_hebrew: string | null
          building_number: string | null
          business_code: string
          city: string | null
          created_at: string
          email: string | null
          entrance: string | null
          floor: string | null
          full_name: string | null
          gender: string | null
          id: number
          landline_phone: string | null
          language: string | null
          last_contact: string | null
          mobile_phone: string
          national_id: string | null
          po_box: string | null
          preferred_channel: string | null
          street: string | null
          updated_at: string
          whatsapp_number: string | null
          zip_code: string | null
        }
        Insert: {
          acquisition_source?: string | null
          allows_sms?: boolean | null
          apartment_number?: string | null
          birth_date_gregorian?: string | null
          birth_date_hebrew?: string | null
          building_number?: string | null
          business_code: string
          city?: string | null
          created_at?: string
          email?: string | null
          entrance?: string | null
          floor?: string | null
          full_name?: string | null
          gender?: string | null
          id?: number
          landline_phone?: string | null
          language?: string | null
          last_contact?: string | null
          mobile_phone: string
          national_id?: string | null
          po_box?: string | null
          preferred_channel?: string | null
          street?: string | null
          updated_at?: string
          whatsapp_number?: string | null
          zip_code?: string | null
        }
        Update: {
          acquisition_source?: string | null
          allows_sms?: boolean | null
          apartment_number?: string | null
          birth_date_gregorian?: string | null
          birth_date_hebrew?: string | null
          building_number?: string | null
          business_code?: string
          city?: string | null
          created_at?: string
          email?: string | null
          entrance?: string | null
          floor?: string | null
          full_name?: string | null
          gender?: string | null
          id?: number
          landline_phone?: string | null
          language?: string | null
          last_contact?: string | null
          mobile_phone?: string
          national_id?: string | null
          po_box?: string | null
          preferred_channel?: string | null
          street?: string | null
          updated_at?: string
          whatsapp_number?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          buffer_time_minutes: number | null
          business_code: string
          color_code: string | null
          created_at: string | null
          deposit_amount: number | null
          description: string | null
          duration_minutes: number
          id: number
          is_active: boolean | null
          price: number
          service_code: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          buffer_time_minutes?: number | null
          business_code: string
          color_code?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          description?: string | null
          duration_minutes: number
          id?: number
          is_active?: boolean | null
          price: number
          service_code?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          buffer_time_minutes?: number | null
          business_code?: string
          color_code?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          description?: string | null
          duration_minutes?: number
          id?: number
          is_active?: boolean | null
          price?: number
          service_code?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_service_business"
            columns: ["business_code"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["business_code"]
          },
        ]
      }
      statuses: {
        Row: {
          business_code: string
          color: string | null
          created_at: string | null
          status_code: string
          status_text: string
        }
        Insert: {
          business_code: string
          color?: string | null
          created_at?: string | null
          status_code: string
          status_text: string
        }
        Update: {
          business_code?: string
          color?: string | null
          created_at?: string | null
          status_code?: string
          status_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "statuses_business_code_fkey"
            columns: ["business_code"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["business_code"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_business: {
        Args: { p_business_name: string; p_contact_phone?: string }
        Returns: string
      }
      create_appointment_with_services: {
        Args: {
          p_appointment_date: string
          p_business_code: string
          p_business_notes?: string
          p_channel?: string
          p_client_id: number
          p_client_notes?: string
          p_currency?: string
          p_service_ids: number[]
          p_start_time: string
          p_status?: string
        }
        Returns: {
          appointment_id: number
          end_time: string
          total_duration_minutes: number
          total_price: number
        }[]
      }
      get_available_appointment_slots: {
        Args: {
          p_appointment_date: string
          p_business_code: string
          p_limit?: number
          p_service_ids: number[]
        }
        Returns: {
          end_time: string
          start_time: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
