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
      ai_actions: {
        Row: {
          case_id: string | null
          client_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["ai_action_kind"]
          summary: string
          title: string
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["ai_action_kind"]
          summary?: string
          title: string
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["ai_action_kind"]
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_actions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_actions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          case_id: string | null
          client_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["appointment_kind"]
          location: string | null
          starts_at: string
          title: string
        }
        Insert: {
          case_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["appointment_kind"]
          location?: string | null
          starts_at: string
          title: string
        }
        Update: {
          case_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["appointment_kind"]
          location?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      case_facts: {
        Row: {
          case_id: string
          confidence: number
          created_at: string
          field: string
          id: string
          source_message_id: string | null
          value: string
        }
        Insert: {
          case_id: string
          confidence?: number
          created_at?: string
          field: string
          id?: string
          source_message_id?: string | null
          value: string
        }
        Update: {
          case_id?: string
          confidence?: number
          created_at?: string
          field?: string
          id?: string
          source_message_id?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_facts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_facts_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          area: string
          client_id: string
          created_at: string
          description: string
          id: string
          priority: Database["public"]["Enums"]["attention_level"]
          status: Database["public"]["Enums"]["case_status"]
          subject: string
        }
        Insert: {
          area: string
          client_id: string
          created_at?: string
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["attention_level"]
          status?: Database["public"]["Enums"]["case_status"]
          subject: string
        }
        Update: {
          area?: string
          client_id?: string
          created_at?: string
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["attention_level"]
          status?: Database["public"]["Enums"]["case_status"]
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          id: string
          last_contact_at: string | null
          name: string
          next_activity: string | null
          phone: string | null
          profile_id: string | null
          status: Database["public"]["Enums"]["client_status"]
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          last_contact_at?: string | null
          name: string
          next_activity?: string | null
          phone?: string | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["client_status"]
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          last_contact_at?: string | null
          name?: string
          next_activity?: string | null
          phone?: string | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["client_status"]
        }
        Relationships: [
          {
            foreignKeyName: "clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          case_id: string | null
          channel: Database["public"]["Enums"]["chat_channel"]
          client_id: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          channel?: Database["public"]["Enums"]["chat_channel"]
          client_id: string
          id?: string
          title?: string
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          channel?: Database["public"]["Enums"]["chat_channel"]
          client_id?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          analysis: Json | null
          analysis_status: Database["public"]["Enums"]["analysis_status"]
          case_id: string | null
          category: Database["public"]["Enums"]["document_category"]
          client_id: string
          created_at: string
          id: string
          name: string
          process_id: string | null
          size_bytes: number | null
          storage_path: string | null
          uploaded_by: string | null
        }
        Insert: {
          analysis?: Json | null
          analysis_status?: Database["public"]["Enums"]["analysis_status"]
          case_id?: string | null
          category?: Database["public"]["Enums"]["document_category"]
          client_id: string
          created_at?: string
          id?: string
          name: string
          process_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Update: {
          analysis?: Json | null
          analysis_status?: Database["public"]["Enums"]["analysis_status"]
          case_id?: string | null
          category?: Database["public"]["Enums"]["document_category"]
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          process_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          case_id: string | null
          client_id: string
          content: string
          created_at: string
          created_by: string | null
          documents: string[]
          id: string
          sources: string[]
          status: Database["public"]["Enums"]["draft_status"]
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          client_id: string
          content?: string
          created_at?: string
          created_by?: string | null
          documents?: string[]
          id?: string
          sources?: string[]
          status?: Database["public"]["Enums"]["draft_status"]
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          client_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          documents?: string[]
          id?: string
          sources?: string[]
          status?: Database["public"]["Enums"]["draft_status"]
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lawyer_profiles: {
        Row: {
          created_at: string
          id: string
          oab_number: string
          oab_state: string
          user_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          oab_number: string
          oab_state: string
          user_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          oab_number?: string
          oab_state?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      legal_data_sources: {
        Row: {
          entity_id: string
          entity_type: string
          external_id: string | null
          id: string
          provider: string
          raw_hash: string | null
          retrieved_at: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          external_id?: string | null
          id?: string
          provider: string
          raw_hash?: string | null
          retrieved_at?: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          external_id?: string | null
          id?: string
          provider?: string
          raw_hash?: string | null
          retrieved_at?: string
        }
        Relationships: []
      }
      legal_documents: {
        Row: {
          available_until: string | null
          created_at: string
          document_type: string | null
          external_url: string | null
          id: string
          movement_id: string | null
          name: string
          process_id: string
          provider: string
          storage_path: string | null
        }
        Insert: {
          available_until?: string | null
          created_at?: string
          document_type?: string | null
          external_url?: string | null
          id?: string
          movement_id?: string | null
          name: string
          process_id: string
          provider: string
          storage_path?: string | null
        }
        Update: {
          available_until?: string | null
          created_at?: string
          document_type?: string | null
          external_url?: string | null
          id?: string
          movement_id?: string | null
          name?: string
          process_id?: string
          provider?: string
          storage_path?: string | null
        }
        Relationships: []
      }
      legal_integration_settings: {
        Row: {
          id: boolean
          mode: string
          updated_at: string
        }
        Insert: {
          id?: boolean
          mode?: string
          updated_at?: string
        }
        Update: {
          id?: boolean
          mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      legal_lawyers: {
        Row: {
          id: string
          name: string
          oab_number: string
          oab_state: string
        }
        Insert: {
          id?: string
          name: string
          oab_number: string
          oab_state: string
        }
        Update: {
          id?: string
          name?: string
          oab_number?: string
          oab_state?: string
        }
        Relationships: []
      }
      legal_movements: {
        Row: {
          ai_generated_at: string | null
          ai_summary: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          dedup_key: string
          description: string
          external_id: string | null
          id: string
          lawyer_approved: boolean
          movement_code: string | null
          movement_date: string
          process_id: string
          provider: string
          provider_payload_hash: string | null
          title: string
        }
        Insert: {
          ai_generated_at?: string | null
          ai_summary?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          dedup_key: string
          description?: string
          external_id?: string | null
          id?: string
          lawyer_approved?: boolean
          movement_code?: string | null
          movement_date: string
          process_id: string
          provider: string
          provider_payload_hash?: string | null
          title: string
        }
        Update: {
          ai_generated_at?: string | null
          ai_summary?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          dedup_key?: string
          description?: string
          external_id?: string | null
          id?: string
          lawyer_approved?: boolean
          movement_code?: string | null
          movement_date?: string
          process_id?: string
          provider?: string
          provider_payload_hash?: string | null
          title?: string
        }
        Relationships: []
      }
      legal_parties: {
        Row: {
          document: string | null
          id: string
          name: string
          process_id: string
          role: string | null
          type: string | null
        }
        Insert: {
          document?: string | null
          id?: string
          name: string
          process_id: string
          role?: string | null
          type?: string | null
        }
        Update: {
          document?: string | null
          id?: string
          name?: string
          process_id?: string
          role?: string | null
          type?: string | null
        }
        Relationships: []
      }
      legal_process_access: {
        Row: {
          created_at: string
          process_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          process_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          process_id?: string
          user_id?: string
        }
        Relationships: []
      }
      legal_process_lawyers: {
        Row: {
          lawyer_id: string
          party_id: string | null
          process_id: string
        }
        Insert: {
          lawyer_id: string
          party_id?: string | null
          process_id: string
        }
        Update: {
          lawyer_id?: string
          party_id?: string | null
          process_id?: string
        }
        Relationships: []
      }
      legal_processes: {
        Row: {
          class_code: number | null
          class_name: string
          cnj_number: string
          court: string
          created_at: string
          degree: string | null
          distribution_date: string | null
          id: string
          judge: string | null
          jurisdiction: string | null
          last_movement_at: string | null
          last_sync_at: string | null
          secrecy_level: number
          status: string | null
          subject: string
          tribunal: string
          updated_at: string
        }
        Insert: {
          class_code?: number | null
          class_name?: string
          cnj_number: string
          court?: string
          created_at?: string
          degree?: string | null
          distribution_date?: string | null
          id?: string
          judge?: string | null
          jurisdiction?: string | null
          last_movement_at?: string | null
          last_sync_at?: string | null
          secrecy_level?: number
          status?: string | null
          subject?: string
          tribunal?: string
          updated_at?: string
        }
        Update: {
          class_code?: number | null
          class_name?: string
          cnj_number?: string
          court?: string
          created_at?: string
          degree?: string | null
          distribution_date?: string | null
          id?: string
          judge?: string | null
          jurisdiction?: string | null
          last_movement_at?: string | null
          last_sync_at?: string | null
          secrecy_level?: number
          status?: string | null
          subject?: string
          tribunal?: string
          updated_at?: string
        }
        Relationships: []
      }
      legal_provider_settings: {
        Row: {
          enabled: boolean
          environment: string
          last_error: string | null
          last_sync_at: string | null
          priority: number
          provider: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          environment?: string
          last_error?: string | null
          last_sync_at?: string | null
          priority?: number
          provider: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          environment?: string
          last_error?: string | null
          last_sync_at?: string | null
          priority?: number
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      process_subscriptions: {
        Row: {
          active: boolean
          created_at: string
          external_subscription_id: string | null
          id: string
          last_checked_at: string | null
          lawyer_id: string
          next_check_at: string | null
          process_id: string
          provider: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          external_subscription_id?: string | null
          id?: string
          last_checked_at?: string | null
          lawyer_id: string
          next_check_at?: string | null
          process_id: string
          provider: string
        }
        Update: {
          active?: boolean
          created_at?: string
          external_subscription_id?: string | null
          id?: string
          last_checked_at?: string | null
          lawyer_id?: string
          next_check_at?: string | null
          process_id?: string
          provider?: string
        }
        Relationships: []
      }
      provider_requests: {
        Row: {
          cached: boolean
          created_at: string
          duration_ms: number | null
          error_code: string | null
          estimated_cost: number
          id: string
          operation: string
          process_id: string | null
          provider: string
          requested_by: string | null
          status_code: number | null
          success: boolean
        }
        Insert: {
          cached?: boolean
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          estimated_cost?: number
          id?: string
          operation: string
          process_id?: string | null
          provider: string
          requested_by?: string | null
          status_code?: number | null
          success: boolean
        }
        Update: {
          cached?: boolean
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          estimated_cost?: number
          id?: string
          operation?: string
          process_id?: string | null
          provider?: string
          requested_by?: string | null
          status_code?: number | null
          success?: boolean
        }
        Relationships: []
      }
      messages: {
        Row: {
          author: Database["public"]["Enums"]["chat_author"]
          channel: Database["public"]["Enums"]["chat_channel"]
          content: string
          conversation_id: string
          created_at: string
          id: string
        }
        Insert: {
          author: Database["public"]["Enums"]["chat_author"]
          channel?: Database["public"]["Enums"]["chat_channel"]
          content: string
          conversation_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author?: Database["public"]["Enums"]["chat_author"]
          channel?: Database["public"]["Enums"]["chat_channel"]
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          description: string
          id: string
          level: Database["public"]["Enums"]["attention_level"]
          recipient_id: string
          state: Database["public"]["Enums"]["notification_state"]
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          level?: Database["public"]["Enums"]["attention_level"]
          recipient_id: string
          state?: Database["public"]["Enums"]["notification_state"]
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          level?: Database["public"]["Enums"]["attention_level"]
          recipient_id?: string
          state?: Database["public"]["Enums"]["notification_state"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      process_events: {
        Row: {
          date: string
          description: string
          id: string
          process_id: string
          title: string
        }
        Insert: {
          date: string
          description?: string
          id?: string
          process_id: string
          title: string
        }
        Update: {
          date?: string
          description?: string
          id?: string
          process_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_events_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          attention: Database["public"]["Enums"]["attention_level"]
          case_id: string | null
          class_name: string
          client_id: string
          cnj: string
          court: string
          created_at: string
          id: string
          last_checked_at: string | null
          last_movement: string | null
          last_movement_at: string | null
          parties: Json
          subject: string
        }
        Insert: {
          attention?: Database["public"]["Enums"]["attention_level"]
          case_id?: string | null
          class_name?: string
          client_id: string
          cnj: string
          court?: string
          created_at?: string
          id?: string
          last_checked_at?: string | null
          last_movement?: string | null
          last_movement_at?: string | null
          parties?: Json
          subject?: string
        }
        Update: {
          attention?: Database["public"]["Enums"]["attention_level"]
          case_id?: string | null
          class_name?: string
          client_id?: string
          cnj?: string
          court?: string
          created_at?: string
          id?: string
          last_checked_at?: string | null
          last_movement?: string | null
          last_movement_at?: string | null
          parties?: Json
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "processes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      tasks: {
        Row: {
          attention: Database["public"]["Enums"]["attention_level"]
          case_id: string | null
          client_id: string | null
          created_at: string
          done: boolean
          due_at: string | null
          id: string
          title: string
        }
        Insert: {
          attention?: Database["public"]["Enums"]["attention_level"]
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          done?: boolean
          due_at?: string | null
          id?: string
          title: string
        }
        Update: {
          attention?: Database["public"]["Enums"]["attention_level"]
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          done?: boolean
          due_at?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      ai_action_kind: "analysis" | "document" | "research" | "alert" | "draft"
      analysis_status: "pending" | "processing" | "analyzed" | "review"
      appointment_kind: "hearing" | "meeting" | "deadline" | "call"
      attention_level: "critical" | "important" | "followup" | "info"
      case_status: "intake" | "active" | "negotiation" | "judicial" | "closed"
      chat_author: "client" | "agent" | "lawyer"
      chat_channel: "pwa" | "whatsapp"
      client_status: "new" | "active" | "waiting" | "pending"
      document_category:
        | "peticoes"
        | "decisoes"
        | "contratos"
        | "pessoais"
        | "comprovantes"
        | "outros"
      draft_status: "draft" | "in_review" | "reviewed" | "final"
      notification_state: "unread" | "read" | "archived"
      user_role: "lawyer" | "client"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      ai_action_kind: ["analysis", "document", "research", "alert", "draft"],
      analysis_status: ["pending", "processing", "analyzed", "review"],
      appointment_kind: ["hearing", "meeting", "deadline", "call"],
      attention_level: ["critical", "important", "followup", "info"],
      case_status: ["intake", "active", "negotiation", "judicial", "closed"],
      chat_author: ["client", "agent", "lawyer"],
      chat_channel: ["pwa", "whatsapp"],
      client_status: ["new", "active", "waiting", "pending"],
      document_category: [
        "peticoes",
        "decisoes",
        "contratos",
        "pessoais",
        "comprovantes",
        "outros",
      ],
      draft_status: ["draft", "in_review", "reviewed", "final"],
      notification_state: ["unread", "read", "archived"],
      user_role: ["lawyer", "client"],
    },
  },
} as const
