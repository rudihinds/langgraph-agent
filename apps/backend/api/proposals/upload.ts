import { Request, Response } from "express";
import { ProposalDocumentService } from "../../lib/db/proposal-documents.js";
import { serverSupabase } from "../../lib/supabase/client.js";
import { Logger } from "../../lib/logger.js";
import multer from "multer";

const logger = Logger.getInstance();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Upload RFP document for a proposal
 * POST /api/proposals/:proposalId/upload
 */
export async function uploadProposalDocument(req: Request, res: Response) {
  try {
    const { proposalId } = req.params;
    const file = req.file;
    const userId = req.user?.id; // Assuming auth middleware sets this

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file provided",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    logger.info("Processing document upload", {
      proposalId,
      fileName: file.originalname,
      fileSize: file.size,
      userId,
    });

    // Verify user owns the proposal
    const { data: proposal, error: proposalError } = await serverSupabase
      .from("proposals")
      .select("id, user_id")
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

    // Upload file to storage
    const filePath = `${proposalId}/${file.originalname}`;
    const { data: uploadData, error: uploadError } =
      await serverSupabase.storage
        .from("proposal-documents")
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

    if (uploadError || !uploadData) {
      logger.error("Storage upload failed", {
        proposalId,
        filePath,
        error: uploadError?.message,
      });
      return res.status(500).json({
        success: false,
        message: `Failed to upload file: ${uploadError?.message || "Unknown storage error"}`,
      });
    }

    // Get storage object ID for referential integrity
    const { data: storageObjects } = await serverSupabase.storage
      .from("proposal-documents")
      .list(proposalId);

    const storageObject = storageObjects?.find(
      (obj) => obj.name === file.originalname
    );

    // Create document record
    const document = await ProposalDocumentService.create({
      proposal_id: proposalId,
      file_name: file.originalname,
      file_path: filePath,
      file_type: file.mimetype,
      size_bytes: file.size,
      storage_object_id: storageObject?.id,
    });

    logger.info("Document upload successful", {
      proposalId,
      documentId: document.id,
      fileName: file.originalname,
    });

    // Optionally trigger background parsing
    // You could add this to a job queue here

    res.json({
      success: true,
      message: "File uploaded successfully",
      document: {
        id: document.id,
        name: document.file_name,
        size: document.size_bytes,
        type: document.file_type,
        uploadedAt: document.created_at,
      },
    });
  } catch (error) {
    logger.error("Upload endpoint error", {
      proposalId: req.params.proposalId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    res.status(500).json({
      success: false,
      message: "Internal server error during file upload",
    });
  }
}

// Middleware setup for the route
export const uploadMiddleware = upload.single("file");
