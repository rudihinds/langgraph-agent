export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          last_login: string | null;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          last_login?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          last_login?: string | null;
        };
      };
      proposals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          funder: string | null;
          applicant: string | null;
          status: "draft" | "in_progress" | "review" | "completed";
          created_at: string;
          updated_at: string;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          funder?: string | null;
          applicant?: string | null;
          status?: "draft" | "in_progress" | "review" | "completed";
          created_at?: string;
          updated_at?: string;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          funder?: string | null;
          applicant?: string | null;
          status?: "draft" | "in_progress" | "review" | "completed";
          created_at?: string;
          updated_at?: string;
          metadata?: Json | null;
        };
      };
      proposal_states: {
        Row: {
          id: string;
          proposal_id: string;
          thread_id: string;
          checkpoint_id: string;
          parent_checkpoint_id: string | null;
          created_at: string;
          metadata: Json | null;
          values: Json;
          next: string[];
          tasks: Json[];
          config: Json | null;
        };
        Insert: {
          id?: string;
          proposal_id: string;
          thread_id: string;
          checkpoint_id: string;
          parent_checkpoint_id?: string | null;
          created_at?: string;
          metadata?: Json | null;
          values: Json;
          next?: string[];
          tasks?: Json[];
          config?: Json | null;
        };
        Update: {
          id?: string;
          proposal_id?: string;
          thread_id?: string;
          checkpoint_id?: string;
          parent_checkpoint_id?: string | null;
          created_at?: string;
          metadata?: Json | null;
          values?: Json;
          next?: string[];
          tasks?: Json[];
          config?: Json | null;
        };
      };
      proposal_documents: {
        Row: {
          id: string;
          proposal_id: string;
          document_type:
            | "rfp"
            | "generated_section"
            | "final_proposal"
            | "supplementary";
          file_name: string;
          file_path: string;
          file_type: string | null;
          size_bytes: number | null;
          created_at: string;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          proposal_id: string;
          document_type:
            | "rfp"
            | "generated_section"
            | "final_proposal"
            | "supplementary";
          file_name: string;
          file_path: string;
          file_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          proposal_id?: string;
          document_type?:
            | "rfp"
            | "generated_section"
            | "final_proposal"
            | "supplementary";
          file_name?: string;
          file_path?: string;
          file_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
          metadata?: Json | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
