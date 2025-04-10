import { describe, it, expect } from "vitest";
import {
  ProposalSchema,
  ProposalApplicationSchema,
  ProposalRFPSchema,
  FunderDetailsSchema,
  ApplicationQuestionsSchema,
  RFPResponseSchema,
} from "../../src/types/ProposalSchema";

describe("ProposalSchema validation", () => {
  // Base proposal validations
  describe("Base ProposalSchema", () => {
    it("should validate a valid proposal", () => {
      const validProposal = {
        id: "123",
        title: "Test Proposal",
        description: "A test proposal",
        userId: "user-123",
        status: "draft" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: "application" as const,
      };

      const result = ProposalSchema.safeParse(validProposal);
      expect(result.success).toBe(true);
    });

    it("should reject a proposal with missing required fields", () => {
      const invalidProposal = {
        id: "123",
        // Missing title
        description: "A test proposal",
        userId: "user-123",
        status: "draft" as const,
        // Missing dates
      };

      const result = ProposalSchema.safeParse(invalidProposal);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.formErrors.fieldErrors).toHaveProperty("title");
        expect(result.error.formErrors.fieldErrors).toHaveProperty("createdAt");
        expect(result.error.formErrors.fieldErrors).toHaveProperty("updatedAt");
      }
    });

    it("should reject a proposal with invalid status", () => {
      const invalidProposal = {
        id: "123",
        title: "Test Proposal",
        description: "A test proposal",
        userId: "user-123",
        status: "invalid_status", // Invalid status
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: "application" as const,
      };

      const result = ProposalSchema.safeParse(invalidProposal);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.formErrors.fieldErrors).toHaveProperty("status");
      }
    });

    it("should validate a proposal with a valid type", () => {
      const validProposal = {
        id: "123",
        title: "Test Proposal",
        description: "A test proposal",
        userId: "user-123",
        status: "draft" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: "rfp" as const, // Valid type
      };

      const result = ProposalSchema.safeParse(validProposal);
      expect(result.success).toBe(true);
    });

    it("should reject a proposal with an invalid type", () => {
      const invalidProposal = {
        id: "123",
        title: "Test Proposal",
        description: "A test proposal",
        userId: "user-123",
        status: "draft" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: "invalid", // Invalid type
      };

      const result = ProposalSchema.safeParse(invalidProposal);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.formErrors.fieldErrors).toHaveProperty("type");
      }
    });
  });

  // FunderDetails validations
  describe("FunderDetailsSchema", () => {
    it("should validate valid funder details", () => {
      const validDetails = {
        organizationName: "Example Foundation",
        fundingTitle: "Community Grant 2023",
        deadline: new Date().toISOString(),
        budgetRange: "50000",
        focusArea: "Education",
      };

      const result = FunderDetailsSchema.safeParse(validDetails);
      expect(result.success).toBe(true);
    });

    it("should reject funder details with missing fields", () => {
      const invalidDetails = {
        organizationName: "Example Foundation",
        // Missing fundingTitle
        deadline: new Date().toISOString(),
        // Missing budgetRange
        focusArea: "Education",
      };

      const result = FunderDetailsSchema.safeParse(invalidDetails);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.formErrors.fieldErrors).toHaveProperty(
          "fundingTitle"
        );
        expect(result.error.formErrors.fieldErrors).toHaveProperty(
          "budgetRange"
        );
      }
    });

    it("should reject when budgetRange contains non-numeric characters", () => {
      const invalidDetails = {
        organizationName: "Example Foundation",
        fundingTitle: "Community Grant 2023",
        deadline: new Date().toISOString(),
        budgetRange: "50,000$", // Invalid: should be numbers only
        focusArea: "Education",
      };

      const result = FunderDetailsSchema.safeParse(invalidDetails);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.formErrors.fieldErrors).toHaveProperty(
          "budgetRange"
        );
      }
    });

    it("should handle nullable deadline field", () => {
      const detailsWithNullDeadline = {
        organizationName: "Example Foundation",
        fundingTitle: "Community Grant 2023",
        deadline: null, // Testing null deadline
        budgetRange: "50000",
        focusArea: "Education",
      };

      const result = FunderDetailsSchema.safeParse(detailsWithNullDeadline);
      expect(result.success).toBe(false); // Should fail because deadline is required
    });
  });

  // ApplicationQuestions validations
  describe("ApplicationQuestionsSchema", () => {
    it("should validate valid application questions", () => {
      const validQuestions = {
        questions: [
          {
            text: "What is your organization's mission?",
            wordLimit: 200,
            charLimit: null,
            category: "Organizational Background",
          },
          {
            text: "Describe your project goals.",
            wordLimit: null,
            charLimit: 1000,
            category: "Project Goals",
          },
        ],
      };

      const result = ApplicationQuestionsSchema.safeParse(validQuestions);
      expect(result.success).toBe(true);
    });

    it("should reject empty questions array", () => {
      const invalidQuestions = {
        questions: [],
      };

      const result = ApplicationQuestionsSchema.safeParse(invalidQuestions);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.formErrors.fieldErrors.questions).toBeDefined();
      }
    });

    it("should reject questions with missing text field", () => {
      const invalidQuestions = {
        questions: [
          {
            // Missing text field
            wordLimit: 200,
            charLimit: null,
            category: "Organizational Background",
          },
        ],
      };

      const result = ApplicationQuestionsSchema.safeParse(invalidQuestions);
      expect(result.success).toBe(false);
    });

    it("should handle optional fields in questions", () => {
      const questionsWithOptionalFields = {
        questions: [
          {
            text: "What is your organization's mission?",
            // Missing optional fields is ok
          },
        ],
      };

      const result = ApplicationQuestionsSchema.safeParse(
        questionsWithOptionalFields
      );
      expect(result.success).toBe(true);
    });
  });

  // RFPResponse validations
  describe("RFPResponseSchema", () => {
    it("should validate a valid RFP response with URL", () => {
      const validResponse = {
        companyName: "Acme Corporation",
        rfpUrl: "https://example.com/rfp",
        rfpText: "",
      };

      const result = RFPResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it("should validate a valid RFP response with text", () => {
      const validResponse = {
        companyName: "Acme Corporation",
        rfpUrl: "",
        rfpText: "This RFP is for a new software system...",
      };

      const result = RFPResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it("should reject when both rfpUrl and rfpText are empty", () => {
      const invalidResponse = {
        companyName: "Acme Corporation",
        rfpUrl: "",
        rfpText: "",
      };

      const result = RFPResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
      if (!result.success) {
        // Check for custom error message about needing either URL or text
        expect(result.error.message).toContain("URL or text");
      }
    });

    it("should reject when companyName is missing", () => {
      const invalidResponse = {
        // Missing companyName
        rfpUrl: "https://example.com/rfp",
        rfpText: "",
      };

      const result = RFPResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.formErrors.fieldErrors).toHaveProperty(
          "companyName"
        );
      }
    });

    it("should validate when both rfpUrl and rfpText are provided", () => {
      const validResponse = {
        companyName: "Acme Corporation",
        rfpUrl: "https://example.com/rfp",
        rfpText: "This RFP is for a new software system...",
      };

      const result = RFPResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });
  });

  // Specialized Proposal schemas
  describe("ProposalApplicationSchema", () => {
    it("should validate a valid application proposal", () => {
      const validProposal = {
        id: "123",
        title: "Test Application",
        description: "An application proposal",
        userId: "user-123",
        status: "draft" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: "application" as const,
        funderDetails: {
          organizationName: "Example Foundation",
          fundingTitle: "Community Grant 2023",
          deadline: new Date().toISOString(),
          budgetRange: "50000",
          focusArea: "Education",
        },
        applicationQuestions: {
          questions: [
            {
              text: "What is your organization's mission?",
              wordLimit: 200,
              charLimit: null,
              category: "Organizational Background",
            },
          ],
        },
      };

      const result = ProposalApplicationSchema.safeParse(validProposal);
      expect(result.success).toBe(true);
    });

    it("should reject if missing funderDetails or applicationQuestions", () => {
      const invalidProposal = {
        id: "123",
        title: "Test Application",
        description: "An application proposal",
        userId: "user-123",
        status: "draft" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: "application" as const,
        // Missing funderDetails
        // Missing applicationQuestions
      };

      const result = ProposalApplicationSchema.safeParse(invalidProposal);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.formErrors.fieldErrors).toHaveProperty(
          "funderDetails"
        );
        expect(result.error.formErrors.fieldErrors).toHaveProperty(
          "applicationQuestions"
        );
      }
    });
  });

  describe("ProposalRFPSchema", () => {
    it("should validate a valid RFP proposal", () => {
      const validProposal = {
        id: "123",
        title: "Test RFP Response",
        description: "An RFP response proposal",
        userId: "user-123",
        status: "draft" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: "rfp" as const,
        funderDetails: {
          organizationName: "Example Foundation",
          fundingTitle: "Community Grant 2023",
          deadline: new Date().toISOString(),
          budgetRange: "50000",
          focusArea: "Education",
        },
        rfpResponse: {
          companyName: "Acme Corporation",
          rfpUrl: "https://example.com/rfp",
          rfpText: "This RFP is for a new software system...",
        },
      };

      const result = ProposalRFPSchema.safeParse(validProposal);
      expect(result.success).toBe(true);
    });

    it("should reject if missing funderDetails or rfpResponse", () => {
      const invalidProposal = {
        id: "123",
        title: "Test RFP Response",
        description: "An RFP response proposal",
        userId: "user-123",
        status: "draft" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: "rfp" as const,
        // Missing funderDetails
        // Missing rfpResponse
      };

      const result = ProposalRFPSchema.safeParse(invalidProposal);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.formErrors.fieldErrors).toHaveProperty(
          "funderDetails"
        );
        expect(result.error.formErrors.fieldErrors).toHaveProperty(
          "rfpResponse"
        );
      }
    });
  });
});
