import { createClient, PostgrestError } from '@supabase/supabase-js';
import { z } from 'zod';

/**
 * Schema for document metadata validation based on actual database schema
 */
export const DocumentMetadataSchema = z.object({
  id: z.string().uuid(),
  proposal_id: z.string().uuid(),
  document_type: z.enum(['rfp', 'generated_section', 'final_proposal', 'supplementary']),
  file_name: z.string(),
  file_path: z.string(),
  file_type: z.string().optional(),
  size_bytes: z.number().optional(),
  created_at: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

// Custom type for storage errors since Supabase doesn't export this directly
interface StorageError {
  message: string;
  status?: number;
}

/**
 * Service for retrieving documents from Supabase
 */
export class DocumentService {
  private supabase;
  private bucket: string;
  
  constructor(
    supabaseUrl = process.env.SUPABASE_URL || '',
    supabaseKey = process.env.SUPABASE_SERVICE_KEY || '',
    bucket = 'proposal-documents'
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.bucket = bucket;
  }
  
  /**
   * Fetch document metadata from the database
   * @param documentId - The ID of the document to retrieve
   * @returns Document metadata
   */
  async getDocumentMetadata(documentId: string): Promise<DocumentMetadata> {
    const { data, error } = await this.supabase
      .from('proposal_documents')
      .select('*')
      .eq('id', documentId)
      .single();
      
    if (error) {
      throw new Error(`Failed to retrieve document metadata: ${error.message} (${(error as PostgrestError).code || 'unknown'})`);
    }
    
    return DocumentMetadataSchema.parse(data);
  }
  
  /**
   * Download document from Supabase storage
   * @param documentId - The ID of the document to download
   * @returns Buffer containing document data and metadata
   */
  async downloadDocument(documentId: string): Promise<{ 
    buffer: Buffer, 
    metadata: DocumentMetadata 
  }> {
    // Fetch metadata to get file path
    const metadata = await this.getDocumentMetadata(documentId);
    
    // Download the file using the file_path from metadata
    const { data, error } = await this.supabase
      .storage
      .from(this.bucket)
      .download(metadata.file_path);
      
    if (error || !data) {
      throw new Error(`Failed to download document: ${error?.message || 'Unknown error'} (${(error as StorageError)?.status || 'unknown'})`);
    }
    
    // Convert blob to buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    return { buffer, metadata };
  }
  
  /**
   * List documents for a specific proposal
   * @param proposalId - The ID of the proposal
   * @returns Array of document metadata
   */
  async listProposalDocuments(proposalId: string): Promise<DocumentMetadata[]> {
    const { data, error } = await this.supabase
      .from('proposal_documents')
      .select('*')
      .eq('proposal_id', proposalId);
      
    if (error) {
      throw new Error(`Failed to list proposal documents: ${error.message} (${(error as PostgrestError).code || 'unknown'})`);
    }
    
    return z.array(DocumentMetadataSchema).parse(data || []);
  }
  
  /**
   * Get a specific document by type for a proposal
   * @param proposalId - The ID of the proposal 
   * @param documentType - The type of document to retrieve
   * @returns Document metadata if found
   */
  async getProposalDocumentByType(
    proposalId: string, 
    documentType: 'rfp' | 'generated_section' | 'final_proposal' | 'supplementary'
  ): Promise<DocumentMetadata | null> {
    const { data, error } = await this.supabase
      .from('proposal_documents')
      .select('*')
      .eq('proposal_id', proposalId)
      .eq('document_type', documentType)
      .maybeSingle();
      
    if (error) {
      throw new Error(`Failed to get proposal document by type: ${error.message} (${(error as PostgrestError).code || 'unknown'})`);
    }
    
    return data ? DocumentMetadataSchema.parse(data) : null;
  }
}