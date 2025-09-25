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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          banner_id: string | null
          campaign_id: string | null
          email_recipient: string | null
          event_type: string
          id: string
          ip_address: unknown | null
          metadata: Json | null
          referrer: string | null
          timestamp: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          banner_id?: string | null
          campaign_id?: string | null
          email_recipient?: string | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          referrer?: string | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          banner_id?: string | null
          campaign_id?: string | null
          email_recipient?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          referrer?: string | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_banner_id_fkey"
            columns: ["banner_id"]
            isOneToOne: false
            referencedRelation: "banner_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_banner_id_fkey"
            columns: ["banner_id"]
            isOneToOne: false
            referencedRelation: "banners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          campaign_id: string | null
          click_url: string | null
          created_at: string | null
          created_by: string | null
          current_clicks: number | null
          device_targeting: string[] | null
          end_date: string | null
          geo_targeting: string[] | null
          html_content: string
          id: string
          image_url: string | null
          is_active: boolean | null
          max_clicks: number | null
          name: string
          priority: number | null
          start_date: string | null
          target_audience: Json | null
          target_departments: string[] | null
          updated_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          click_url?: string | null
          created_at?: string | null
          created_by?: string | null
          current_clicks?: number | null
          device_targeting?: string[] | null
          end_date?: string | null
          geo_targeting?: string[] | null
          html_content: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          max_clicks?: number | null
          name: string
          priority?: number | null
          start_date?: string | null
          target_audience?: Json | null
          target_departments?: string[] | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          click_url?: string | null
          created_at?: string | null
          created_by?: string | null
          current_clicks?: number | null
          device_targeting?: string[] | null
          end_date?: string | null
          geo_targeting?: string[] | null
          html_content?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          max_clicks?: number | null
          name?: string
          priority?: number | null
          start_date?: string | null
          target_audience?: Json | null
          target_departments?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_banners_campaign"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          name: string
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          brand_colors: Json | null
          company_address: string | null
          company_name: string
          company_phone: string | null
          company_website: string | null
          created_at: string | null
          created_by: string | null
          default_signature_template: string | null
          id: string
          legal_disclaimer: string | null
          logo_url: string | null
          updated_at: string | null
        }
        Insert: {
          brand_colors?: Json | null
          company_address?: string | null
          company_name: string
          company_phone?: string | null
          company_website?: string | null
          created_at?: string | null
          created_by?: string | null
          default_signature_template?: string | null
          id?: string
          legal_disclaimer?: string | null
          logo_url?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_colors?: Json | null
          company_address?: string | null
          company_name?: string
          company_phone?: string | null
          company_website?: string | null
          created_at?: string | null
          created_by?: string | null
          default_signature_template?: string | null
          id?: string
          legal_disclaimer?: string | null
          logo_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      domains: {
        Row: {
          created_at: string | null
          created_by: string | null
          dns_record_type: string | null
          dns_record_value: string | null
          domain_name: string
          id: string
          is_verified: boolean | null
          organization_name: string | null
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          dns_record_type?: string | null
          dns_record_value?: string | null
          domain_name: string
          id?: string
          is_verified?: boolean | null
          organization_name?: string | null
          verification_token: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          dns_record_type?: string | null
          dns_record_value?: string | null
          domain_name?: string
          id?: string
          is_verified?: boolean | null
          organization_name?: string | null
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      email_signatures: {
        Row: {
          created_at: string | null
          created_by: string | null
          department: string | null
          html_content: string
          id: string
          is_active: boolean | null
          signature_type: string | null
          template_name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          html_content: string
          id?: string
          is_active?: boolean | null
          signature_type?: string | null
          template_name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          html_content?: string
          id?: string
          is_active?: boolean | null
          signature_type?: string | null
          template_name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      exchange_connections: {
        Row: {
          access_token: string
          created_at: string | null
          display_name: string
          email: string
          id: string
          is_active: boolean | null
          microsoft_user_id: string
          refresh_token: string
          token_expires_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          display_name: string
          email: string
          id?: string
          is_active?: boolean | null
          microsoft_user_id: string
          refresh_token: string
          token_expires_at: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          display_name?: string
          email?: string
          id?: string
          is_active?: boolean | null
          microsoft_user_id?: string
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          department: string | null
          email: string | null
          first_name: string | null
          id: string
          is_admin: boolean | null
          job_title: string | null
          last_name: string | null
          mobile: string | null
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_admin?: boolean | null
          job_title?: string | null
          last_name?: string | null
          mobile?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_admin?: boolean | null
          job_title?: string | null
          last_name?: string | null
          mobile?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      banner_analytics: {
        Row: {
          click_count: number | null
          click_through_rate: number | null
          created_at: string | null
          current_clicks: number | null
          id: string | null
          impression_count: number | null
          is_active: boolean | null
          max_clicks: number | null
          name: string | null
          total_events: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      increment_banner_clicks: {
        Args: { banner_uuid: string }
        Returns: undefined
      }
      is_admin_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
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
