import { Request, Response } from "express";
import { ProposalDocumentService } from "../../lib/db/proposal-documents.js";
import { serverSupabase } from "../../lib/supabase/client.js";
import { Logger } from "../../lib/logger.js";

const logger = Logger.getInstance();

/**
 * Parse document text for a proposal
 * POST /api/proposals/:proposalId/parse-document
 */
export async function parseProposalDocument(req: Request, res: Response) {
  try {
    const { proposalId } = req.params;
    const userId = req.user?.id; // Assuming auth middleware sets this

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    logger.info("Processing document parsing request", {
      proposalId,
      userId,
    });

    // Verify user owns the proposal
    const { data: proposal, error: proposalError } = await serverSupabase
      .from("proposals")
      .select("id, user_id, rfp_document_id")
      .eq("id", proposalId)
      .eq("user_id", userId)
      .maybeSingle();

    if (proposalError || !proposal) {
      logger.warn("Proposal not found or access denied", {
        proposalId,
        userId,
        error: proposalError?.message,
      });
      return res.status(404).json({
        success: false,
        message: "Proposal not found or access denied",
      });
    }

    if (!proposal.rfp_document_id) {
      return res.status(400).json({
        success: false,
        message: "No document found for this proposal",
      });
    }

    // Get the document
    const document = await ProposalDocumentService.getById(
      proposal.rfp_document_id
    );
    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document record not found",
      });
    }

    // Check if already parsed
    if (document.parsing_status === "success" && document.parsed_text) {
      return res.json({
        success: true,
        message: "Document already parsed",
        document: {
          id: document.id,
          name: document.file_name,
          parsingStatus: document.parsing_status,
          textLength: document.parsed_text.length,
          parsedAt: document.parsed_at,
        },
      });
    }

    // Parse the document
    try {
      const text = await ProposalDocumentService.getDocumentText(document.id);

      logger.info("Document parsing successful", {
        proposalId,
        documentId: document.id,
        textLength: text.length,
      });

      res.json({
        success: true,
        message: "Document parsed successfully",
        document: {
          id: document.id,
          name: document.file_name,
          parsingStatus: "success",
          textLength: text.length,
          parsedAt: new Date().toISOString(),
        },
      });
    } catch (parseError) {
      logger.error("Document parsing failed", {
        proposalId,
        documentId: document.id,
        error:
          parseError instanceof Error ? parseError.message : "Unknown error",
      });

      res.status(500).json({
        success: false,
        message: "Failed to parse document",
        error:
          parseError instanceof Error ? parseError.message : "Unknown error",
      });
    }
  } catch (error) {
    logger.error("Parse document endpoint error", {
      proposalId: req.params.proposalId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    res.status(500).json({
      success: false,
      message: "Internal server error during document parsing",
    });
  }
}
