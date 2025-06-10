/**
 * Funder Name Extraction Utility
 * Extracts organization/funder name from RFP document text using pattern matching
 */

import { Logger } from "@/lib/logger.js";

const logger = Logger.getInstance();

// Common patterns for identifying funder organizations in RFP documents
const FUNDER_PATTERNS = [
  // "The [Organization] is seeking..."
  /(?:The\s+)([A-Z][A-Za-z\s&,.'-]+(?:Department|Ministry|Agency|Bureau|Commission|Authority|Office|Institute|Foundation|Corporation|Company|Inc\.|LLC|Ltd\.|University|College|School|District|City|County|State|Government))/gi,

  // "Organization Name hereby solicits..."
  /^([A-Z][A-Za-z\s&,.'-]+(?:Department|Ministry|Agency|Bureau|Commission|Authority|Office|Institute|Foundation|Corporation|Company|Inc\.|LLC|Ltd\.|University|College|School|District|City|County|State|Government))\s+(?:hereby\s+)?(?:solicits|requests|invites|seeks)/gim,

  // Header patterns with organization names
  /(?:REQUEST FOR PROPOSAL|RFP|INVITATION TO BID|ITB).*?(?:from|by|issued by)\s+([A-Z][A-Za-z\s&,.'-]+(?:Department|Ministry|Agency|Bureau|Commission|Authority|Office|Institute|Foundation|Corporation|Company|Inc\.|LLC|Ltd\.|University|College|School|District|City|County|State|Government))/gi,

  // "Issued by [Organization]"
  /(?:issued\s+by|prepared\s+by|published\s+by)\s+([A-Z][A-Za-z\s&,.'-]+(?:Department|Ministry|Agency|Bureau|Commission|Authority|Office|Institute|Foundation|Corporation|Company|Inc\.|LLC|Ltd\.|University|College|School|District|City|County|State|Government))/gi,

  // Organization name in contact information
  /(?:contact|inquiries|questions).*?([A-Z][A-Za-z\s&,.'-]+(?:Department|Ministry|Agency|Bureau|Commission|Authority|Office|Institute|Foundation|Corporation|Company|Inc\.|LLC|Ltd\.|University|College|School|District|City|County|State|Government))/gi,

  // Procurement or contracting office patterns
  /(?:procurement|contracting)\s+(?:office|department)\s+of\s+([A-Z][A-Za-z\s&,.'-]+)/gi,
];

// Common suffixes that indicate organization types
const ORG_SUFFIXES = [
  "Department",
  "Ministry",
  "Agency",
  "Bureau",
  "Commission",
  "Authority",
  "Office",
  "Institute",
  "Foundation",
  "Corporation",
  "Company",
  "Inc.",
  "LLC",
  "Ltd.",
  "University",
  "College",
  "School",
  "District",
  "City",
  "County",
  "State",
  "Government",
  "Services",
  "Administration",
  "Board",
];

// Words to exclude from organization names (common false positives)
const EXCLUDE_WORDS = [
  "United States",
  "Federal Government",
  "Public Sector",
  "Private Sector",
  "Local Government",
  "State Government",
  "Federal Agency",
  "Government Agency",
  "Contracting Officer",
  "Project Manager",
  "Program Manager",
];

/**
 * Extract the most likely funder organization name from RFP document text
 */
export function extractFunderName(rfpText: string): string | null {
  try {
    logger.info("Extracting funder name from RFP document", {
      textLength: rfpText.length,
    });

    if (!rfpText || rfpText.trim().length === 0) {
      logger.warn("Empty RFP text provided for funder extraction");
      return null;
    }

    // Clean the text for better pattern matching
    const cleanText = rfpText.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();

    const candidates: { name: string; confidence: number; source: string }[] =
      [];

    // Apply each pattern to find potential funder names
    FUNDER_PATTERNS.forEach((pattern, index) => {
      const matches = cleanText.matchAll(pattern);

      for (const match of matches) {
        if (match[1]) {
          const candidateName = cleanOrganizationName(match[1]);

          if (candidateName && !isExcludedName(candidateName)) {
            // Calculate confidence based on pattern reliability and position in document
            const confidence = calculateConfidence(
              pattern,
              match,
              cleanText,
              index
            );

            candidates.push({
              name: candidateName,
              confidence,
              source: `pattern_${index}`,
            });
          }
        }
      }
    });

    if (candidates.length === 0) {
      logger.warn("No funder name candidates found in RFP document");
      return null;
    }

    // Sort candidates by confidence and select the best one
    const sortedCandidates = candidates
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Keep top 5 for logging

    logger.info("Funder name extraction candidates found", {
      candidatesCount: candidates.length,
      topCandidates: sortedCandidates.map((c) => ({
        name: c.name,
        confidence: c.confidence,
        source: c.source,
      })),
    });

    const bestCandidate = sortedCandidates[0];

    logger.info("Selected funder name", {
      funderName: bestCandidate.name,
      confidence: bestCandidate.confidence,
      source: bestCandidate.source,
    });

    return bestCandidate.name;
  } catch (error) {
    logger.error("Error extracting funder name from RFP", { error });
    return null;
  }
}

/**
 * Clean and normalize organization name
 */
function cleanOrganizationName(rawName: string): string | null {
  if (!rawName) return null;

  // Remove extra whitespace and normalize
  let cleaned = rawName
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[""'']/g, '"')
    .replace(/[–—]/g, "-");

  // Remove common prefixes that aren't part of the organization name
  cleaned = cleaned.replace(/^(?:The\s+|A\s+|An\s+)/i, "");

  // Ensure proper capitalization
  cleaned = cleaned.replace(/\b\w+/g, (word) => {
    // Keep certain words lowercase unless they start the name
    const lowerWords = [
      "of",
      "and",
      "the",
      "for",
      "in",
      "on",
      "at",
      "by",
      "to",
    ];
    if (lowerWords.includes(word.toLowerCase()) && cleaned.indexOf(word) > 0) {
      return word.toLowerCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  // Validate minimum length and structure
  if (cleaned.length < 3 || cleaned.length > 200) {
    return null;
  }

  return cleaned;
}

/**
 * Check if a name should be excluded (common false positives)
 */
function isExcludedName(name: string): boolean {
  const lowerName = name.toLowerCase();

  return (
    EXCLUDE_WORDS.some((excludeWord) =>
      lowerName.includes(excludeWord.toLowerCase())
    ) ||
    // Exclude very generic terms
    /^(?:department|agency|office|bureau|commission)$/i.test(name) ||
    // Exclude names that are mostly numbers or special characters
    !/[a-zA-Z]/.test(name) ||
    // Exclude very short generic terms
    /^(?:inc|llc|ltd|corp|co)\.?$/i.test(name)
  );
}

/**
 * Calculate confidence score for a candidate funder name
 */
function calculateConfidence(
  pattern: RegExp,
  match: RegExpMatchArray,
  fullText: string,
  patternIndex: number
): number {
  let confidence = 0.5; // Base confidence

  // Higher confidence for patterns that appear early in document
  const position = match.index || 0;
  const relativePosition = position / fullText.length;
  if (relativePosition < 0.1)
    confidence += 0.3; // Very early in document
  else if (relativePosition < 0.3)
    confidence += 0.2; // Early in document
  else if (relativePosition < 0.5) confidence += 0.1; // First half

  // Pattern reliability scoring (earlier patterns are more reliable)
  confidence += (FUNDER_PATTERNS.length - patternIndex) * 0.05;

  // Bonus for having organization suffixes
  const candidateName = match[1];
  if (
    ORG_SUFFIXES.some((suffix) =>
      candidateName.toLowerCase().includes(suffix.toLowerCase())
    )
  ) {
    confidence += 0.2;
  }

  // Bonus for proper capitalization pattern
  if (/^[A-Z][a-z]/.test(candidateName)) {
    confidence += 0.1;
  }

  // Penalty for very long names (likely false positives)
  if (candidateName.length > 100) {
    confidence -= 0.2;
  }

  // Bonus for names that appear multiple times in document
  const occurrences = (
    fullText.match(
      new RegExp(candidateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
    ) || []
  ).length;
  if (occurrences > 1) {
    confidence += Math.min(occurrences * 0.1, 0.3);
  }

  return Math.min(Math.max(confidence, 0), 1); // Clamp between 0 and 1
}
