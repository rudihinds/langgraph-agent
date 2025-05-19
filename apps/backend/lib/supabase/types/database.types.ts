export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      checkpoint_blobs: {
        Row: {
          blob: string | null
          channel: string
          checkpoint_ns: string
          thread_id: string
          type: string
          version: string
        }
        Insert: {
          blob?: string | null
          channel: string
          checkpoint_ns?: string
          thread_id: string
          type: string
          version: string
        }
        Update: {
          blob?: string | null
          channel?: string
          checkpoint_ns?: string
          thread_id?: string
          type?: string
          version?: string
        }
        Relationships: []
      }
      checkpoint_migrations: {
        Row: {
          v: number
        }
        Insert: {
          v: number
        }
        Update: {
          v?: number
        }
        Relationships: []
      }
      checkpoint_writes: {
        Row: {
          blob: string
          channel: string
          checkpoint_id: string
          checkpoint_ns: string
          idx: number
          task_id: string | null
          thread_id: string
          type: string | null
        }
        Insert: {
          blob: string
          channel: string
          checkpoint_id: string
          checkpoint_ns?: string
          idx?: number
          task_id?: string | null
          thread_id: string
          type?: string | null
        }
        Update: {
          blob?: string
          channel?: string
          checkpoint_id?: string
          checkpoint_ns?: string
          idx?: number
          task_id?: string | null
          thread_id?: string
          type?: string | null
        }
        Relationships: []
      }
      checkpoints: {
        Row: {
          checkpoint: Json
          checkpoint_id: string
          checkpoint_ns: string
          metadata: Json | null
          parent_checkpoint_id: string | null
          thread_id: string
        }
        Insert: {
          checkpoint: Json
          checkpoint_id: string
          checkpoint_ns?: string
          metadata?: Json | null
          parent_checkpoint_id?: string | null
          thread_id: string
        }
        Update: {
          checkpoint?: Json
          checkpoint_id?: string
          checkpoint_ns?: string
          metadata?: Json | null
          parent_checkpoint_id?: string | null
          thread_id?: string
        }
        Relationships: []
      }
      proposal_documents: {
        Row: {
          created_at: string | null
          document_type: string
          file_name: string
          file_path: string
          file_type: string | null
          id: string
          metadata: Json | null
          proposal_id: string | null
          size_bytes: number | null
        }
        Insert: {
          created_at?: string | null
          document_type: string
          file_name: string
          file_path: string
          file_type?: string | null
          id?: string
          metadata?: Json | null
          proposal_id?: string | null
          size_bytes?: number | null
        }
        Update: {
          created_at?: string | null
          document_type?: string
          file_name?: string
          file_path?: string
          file_type?: string | null
          id?: string
          metadata?: Json | null
          proposal_id?: string | null
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_documents_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_sessions: {
        Row: {
          id: number
          last_activity: string
          metadata: Json | null
          proposal_id: string
          start_time: string
          status: string
          thread_id: string
          user_id: string
        }
        Insert: {
          id?: number
          last_activity?: string
          metadata?: Json | null
          proposal_id: string
          start_time?: string
          status?: string
          thread_id: string
          user_id: string
        }
        Update: {
          id?: number
          last_activity?: string
          metadata?: Json | null
          proposal_id?: string
          start_time?: string
          status?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_sessions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_states: {
        Row: {
          checkpoint_id: string
          config: Json | null
          created_at: string | null
          id: string
          metadata: Json | null
          next: string[] | null
          parent_checkpoint_id: string | null
          proposal_id: string
          tasks: Json[] | null
          thread_id: string
          values: Json
        }
        Insert: {
          checkpoint_id: string
          config?: Json | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          next?: string[] | null
          parent_checkpoint_id?: string | null
          proposal_id: string
          tasks?: Json[] | null
          thread_id: string
          values: Json
        }
        Update: {
          checkpoint_id?: string
          config?: Json | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          next?: string[] | null
          parent_checkpoint_id?: string | null
          proposal_id?: string
          tasks?: Json[] | null
          thread_id?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "proposal_states_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          applicant: string | null
          created_at: string | null
          deadline: string | null
          funder: string | null
          id: string
          metadata: Json | null
          project_name: string | null
          rfp_document_id: string | null
          status: Database["public"]["Enums"]["proposal_status"] | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          applicant?: string | null
          created_at?: string | null
          deadline?: string | null
          funder?: string | null
          id?: string
          metadata?: Json | null
          project_name?: string | null
          rfp_document_id?: string | null
          status?: Database["public"]["Enums"]["proposal_status"] | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          applicant?: string | null
          created_at?: string | null
          deadline?: string | null
          funder?: string | null
          id?: string
          metadata?: Json | null
          project_name?: string | null
          rfp_document_id?: string | null
          status?: Database["public"]["Enums"]["proposal_status"] | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_rfp_proposal_threads: {
        Row: {
          app_generated_thread_id: string
          created_at: string
          id: string
          proposal_title: string | null
          rfp_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_generated_thread_id: string
          created_at?: string
          id?: string
          proposal_title?: string | null
          rfp_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_generated_thread_id?: string
          created_at?: string
          id?: string
          proposal_title?: string | null
          rfp_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          last_login: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          last_login?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_login?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      proposal_status:
        | "queued"
        | "running"
        | "awaiting_review"
        | "approved"
        | "edited"
        | "stale"
        | "complete"
        | "error"
        | "needs_revision"
        | "draft"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      proposal_status: [
        "queued",
        "running",
        "awaiting_review",
        "approved",
        "edited",
        "stale",
        "complete",
        "error",
        "needs_revision",
        "draft",
      ],
    },
  },
} as const
