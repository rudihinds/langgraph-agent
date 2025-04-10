/**
 * Database schema type definitions for Supabase
 * These types match the structure of the database tables
 */
export type Database = {
  public: {
    Tables: {
      proposals: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          status: 'draft' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
          user_id: string;
          created_at: string;
          updated_at: string;
          proposal_type: 'application' | 'rfp';
          funder_details: Record<string, any> | null;
          file_url?: string | null;
          deadline?: string | null;
          questions?: Array<Record<string, any>> | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          status?: 'draft' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
          user_id: string;
          created_at?: string;
          updated_at?: string;
          proposal_type: 'application' | 'rfp';
          funder_details?: Record<string, any> | null;
          file_url?: string | null;
          deadline?: string | null;
          questions?: Array<Record<string, any>> | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          status?: 'draft' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
          user_id?: string;
          created_at?: string;
          updated_at?: string;
          proposal_type?: 'application' | 'rfp';
          funder_details?: Record<string, any> | null;
          file_url?: string | null;
          deadline?: string | null;
          questions?: Array<Record<string, any>> | null;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
          last_login: string | null;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          last_login?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          last_login?: string | null;
        };
      };
    };
    Views: {};
    Functions: {};
  };
  storage: {
    Tables: {
      objects: {
        Row: {
          id: string;
          name: string;
          owner: string;
          bucket_id: string;
          created_at: string;
          updated_at: string;
          last_accessed_at: string;
          metadata: Record<string, any> | null;
        };
      };
    };
  };
};