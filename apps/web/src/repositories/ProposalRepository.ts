import { SupabaseClient } from '@supabase/supabase-js';
import { Proposal } from '@/schemas/proposal';

export interface ProposalFilter {
  status?: string;
  proposal_type?: string;
  user_id?: string;
}

export class ProposalRepository {
  private supabase: SupabaseClient;
  private tableName = 'proposals';

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Create a new proposal
   */
  async create(proposal: Omit<Proposal, 'id'> & { user_id: string }): Promise<Proposal> {
    const now = new Date().toISOString();
    const proposalData = {
      ...proposal,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert(proposalData)
      .select()
      .single();

    if (error) {
      console.error('Error creating proposal:', error);
      throw new Error(`Failed to create proposal: ${error.message}`);
    }

    return data as Proposal;
  }

  /**
   * Get a proposal by ID
   */
  async getById(id: string, userId?: string): Promise<Proposal | null> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id);
    
    // If userId is provided, ensure the proposal belongs to this user
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        // PGRST116 is the error code for no rows returned by .single()
        return null;
      }
      console.error('Error fetching proposal:', error);
      throw new Error(`Failed to fetch proposal: ${error.message}`);
    }

    return data as Proposal;
  }

  /**
   * Get all proposals with optional filters
   */
  async getAll(filter?: ProposalFilter): Promise<Proposal[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*');

    // Apply filters if provided
    if (filter) {
      if (filter.status) {
        query = query.eq('status', filter.status);
      }
      if (filter.proposal_type) {
        query = query.eq('proposal_type', filter.proposal_type);
      }
      if (filter.user_id) {
        query = query.eq('user_id', filter.user_id);
      }
    }

    // Order by created_at descending (newest first)
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching proposals:', error);
      throw new Error(`Failed to fetch proposals: ${error.message}`);
    }

    return data as Proposal[];
  }

  /**
   * Update a proposal
   */
  async update(id: string, updates: Partial<Proposal>, userId?: string): Promise<Proposal> {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    let query = this.supabase
      .from(this.tableName)
      .update(updateData)
      .eq('id', id);
    
    // If userId is provided, ensure the proposal belongs to this user
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.select().single();

    if (error) {
      console.error('Error updating proposal:', error);
      throw new Error(`Failed to update proposal: ${error.message}`);
    }

    return data as Proposal;
  }

  /**
   * Delete a proposal
   */
  async delete(id: string, userId?: string): Promise<void> {
    let query = this.supabase
      .from(this.tableName)
      .delete()
      .eq('id', id);
    
    // If userId is provided, ensure the proposal belongs to this user
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { error } = await query;

    if (error) {
      console.error('Error deleting proposal:', error);
      throw new Error(`Failed to delete proposal: ${error.message}`);
    }
  }

  /**
   * Check if a proposal exists and belongs to a user
   */
  async existsForUser(id: string, userId: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error checking proposal existence:', error);
      throw new Error(`Failed to check proposal existence: ${error.message}`);
    }

    return count !== null && count > 0;
  }
}