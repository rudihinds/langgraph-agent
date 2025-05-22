import express from "express";
import { z } from "zod";
import { ProposalThreadAssociationService } from "../../services/proposalThreadAssociation.service.js";
import { AuthenticatedRequest } from "../../lib/types/auth.js";

const router = express.Router();
const proposalThreadService = new ProposalThreadAssociationService();

// Zod schema for POST body
const postSchema = z.object({
  rfpId: z.string().min(1, "rfpId is required"),
  appGeneratedThreadId: z.string().min(1, "appGeneratedThreadId is required"),
  proposalTitle: z.string().optional(),
});

// POST /api/rfp/proposal_threads
router.post("/", async (req: AuthenticatedRequest, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res
      .status(401)
      .json({ error: "Unauthorized", message: "User not authenticated" });
  }
  const parse = postSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid input", details: parse.error.flatten() });
  }
  const { rfpId, appGeneratedThreadId, proposalTitle } = parse.data;
  try {
    const result = await proposalThreadService.recordNewProposalThread({
      userId,
      rfpId,
      appGeneratedThreadId,
      proposalTitle,
    });
    if (
      result &&
      typeof result === "object" &&
      "error" in result &&
      result.error
    ) {
      return next(new Error(String(result.error)));
    }
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

// GET /api/rfp/proposal_threads?rfpId=...
router.get("/", async (req: AuthenticatedRequest, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res
      .status(401)
      .json({ error: "Unauthorized", message: "User not authenticated" });
  }
  const rfpId =
    typeof req.query.rfpId === "string" ? req.query.rfpId : undefined;
  try {
    const threads = await proposalThreadService.listUserProposalThreads(
      userId,
      rfpId
    );
    if (threads === null) {
      return next(
        new Error(
          "Failed to fetch proposal threads due to an unexpected issue in the service."
        )
      );
    }
    return res.status(200).json({ threads });
  } catch (err) {
    return next(err);
  }
});

export default router;
