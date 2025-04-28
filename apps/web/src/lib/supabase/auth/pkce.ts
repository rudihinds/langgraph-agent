/**
 * Utility functions for implementing PKCE (Proof Key for Code Exchange) with Supabase Auth
 */

/**
 * Generates a random string for use as a PKCE code verifier
 * @param length Length of the verifier (default: 43 characters)
 * @returns Random string
 */
function generateRandomString(length = 43): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let result = "";
  const cryptoObj = globalThis.crypto;

  // Generate a random array of the specified length
  const randomValues = new Uint8Array(length);
  cryptoObj.getRandomValues(randomValues);

  // Map each random value to a character in our charset
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }

  return result;
}

/**
 * Generates a SHA-256 hash of the input string as a base64url encoded string
 * for use as a PKCE code challenge
 *
 * @param str String to hash (code verifier)
 * @returns Base64url encoded SHA-256 hash (code challenge)
 */
async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  // Convert string to Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);

  // Hash the data using SHA-256
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Convert the hash to a base64url encoded string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashBase64 = btoa(String.fromCharCode(...hashArray));

  // Convert base64 to base64url (URL-safe)
  return hashBase64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Generates a PKCE code verifier and code challenge pair
 * for use with Supabase Auth
 *
 * @returns Object containing code verifier and code challenge
 */
export async function generatePKCEVerifier(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const codeVerifier = generateRandomString();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  return { codeVerifier, codeChallenge };
}
