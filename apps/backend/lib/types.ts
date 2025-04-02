export type User = {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  last_login?: string;
};

export type Proposal = {
  id: string;
  user_id: string;
  title: string;
  funder?: string;
  applicant?: string;
  status: "draft" | "in_progress" | "review" | "completed";
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
};

export type ProposalState = {
  id: string;
  proposal_id: string;
  thread_id: string;
  checkpoint_id: string;
  parent_checkpoint_id?: string;
  created_at: string;
  metadata?: Record<string, any>;
  values: Record<string, any>;
  next: string[];
  tasks: Record<string, any>[];
  config?: Record<string, any>;
};

export type ProposalDocument = {
  id: string;
  proposal_id: string;
  document_type:
    | "rfp"
    | "generated_section"
    | "final_proposal"
    | "supplementary";
  file_name: string;
  file_path: string;
  file_type?: string;
  size_bytes?: number;
  created_at: string;
  metadata?: Record<string, any>;
};
