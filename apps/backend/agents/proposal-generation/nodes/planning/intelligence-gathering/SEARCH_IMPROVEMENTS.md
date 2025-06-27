# Intelligence Search Improvements

## Problem Statement
The original search implementation was returning 0 results for companies like Social Finance, despite public information being readily available (e.g., https://www.socialfinance.org.uk/who-we-are/people).

## Root Causes Identified
1. **Complex queries exceeding Tavily's 400-character recommendation** - Using multiple OR operators and boolean logic
2. **Incorrect use of Google-style `site:` operators** - Should use Tavily's `includeDomains` parameter instead
3. **No progressive search approach** - Trying to find everything in one search instead of discovery → extraction

## Improvements Implemented

### 1. Simplified Query Generation
- Removed complex boolean operators (OR, AND)
- Kept queries under 400 characters
- Focus on simple, clear search terms

**Before:**
```typescript
return `("${context.company}" OR "${context.company.replace(/\s+(Limited|Ltd|Inc|LLC|Corp)$/i, '')}") AND (${expandedTerms}) AND "${context.industry}"`;
```

**After:**
```typescript
return `"${context.company}" ${expansion}`;
```

### 2. Proper Domain Filtering
- Moved from `site:` in query strings to `includeDomains` parameter
- Domain-specific configurations for different search strategies

**Before:**
```typescript
query: "Social Finance site:linkedin.com decision makers"
```

**After:**
```typescript
query: "Social Finance decision makers",
includeDomains: ["linkedin.com"]
```

### 3. Two-Phase Progressive Search

#### Phase 1: Discovery
- New "discovery" search strategy
- Finds organization's main website and team pages
- Simple queries like: `"Social Finance" team leadership people`

#### Phase 2: Extraction & Individual Search  
- Extract names from team pages using `intelligence_extract`
- Search for individuals: `"John Smith" "Social Finance" LinkedIn profile`
- New "individual" search strategy for targeted searches

### 4. Adaptive Search Improvements
- Quality assessment after each search
- Automatic retry with different strategies if quality is low
- Strategy progression: discovery → standard → expanded → refined → alternative
- Topic-specific preferred strategies

### 5. Enhanced Logging
- Detailed search progress tracking
- Quality scores for each search
- Strategy selection reasoning
- Result summaries

## Implementation Details

### New Files Created
- `progressive-search-utils.ts` - Utilities for two-phase search approach

### Modified Files
- `adaptive-search-utils.ts` - Added discovery and individual query generators
- `intelligence-search.ts` - Proper includeDomains usage, enhanced logging
- `research-agent.ts` - Progressive search guidance, discovery phase detection
- `intelligence-extract.ts` - Simulated name extraction from team pages

### Key Functions Added
- `generateDiscoveryQuery()` - Creates simple queries for finding organization pages
- `generateIndividualQuery()` - Creates targeted queries for specific people
- `findTeamPages()` - Identifies team/people pages from search results
- `extractCompanyDomain()` - Extracts company domain for targeted searches
- `isTeamPage()` - Pattern matching for team page URLs

## Expected Behavior
1. For "Social Finance decision makers", the system will:
   - First run discovery search: `"Social Finance" team leadership people`
   - Find pages like socialfinance.org.uk/who-we-are/people
   - Extract the page content to get names
   - Search for individuals on LinkedIn

2. Quality-based retries ensure we get results even if initial searches fail

3. Simplified queries work better with Tavily's search algorithm

## Testing Recommendations
1. Test with Social Finance to verify it now finds results
2. Monitor quality scores to ensure they improve with new approach
3. Verify team page detection works for various URL patterns
4. Check that individual searches return LinkedIn profiles