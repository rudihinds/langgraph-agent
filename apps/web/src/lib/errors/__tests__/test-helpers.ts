/**
 * Test helpers for error handling
 */
import { ApiErrorResponse, ApiSuccessResponse } from '../index';

/**
 * Test helper to check if a Response is a valid error response
 */
export async function expectErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedCode?: string
): Promise<void> {
  expect(response.status).toBe(expectedStatus);
  expect(response.headers.get('content-type')).toContain('application/json');
  
  const data = await response.json() as ApiErrorResponse;
  
  expect(data).toHaveProperty('success', false);
  expect(data).toHaveProperty('error.message');
  
  if (expectedCode) {
    expect(data.error).toHaveProperty('code', expectedCode);
  }
}

/**
 * Test helper to check if a Response is a valid success response
 */
export async function expectSuccessResponse<T>(
  response: Response,
  expectedStatus: number = 200
): Promise<T> {
  expect(response.status).toBe(expectedStatus);
  expect(response.headers.get('content-type')).toContain('application/json');
  
  const data = await response.json() as ApiSuccessResponse<T>;
  
  expect(data).toHaveProperty('success', true);
  expect(data).toHaveProperty('data');
  
  return data.data;
}