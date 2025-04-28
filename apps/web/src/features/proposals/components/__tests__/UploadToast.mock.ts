// Mock implementation for UploadToast.ts
export const useFileUploadToast = vi.fn(() => ({
  showFileUploadToast: vi.fn(),
}));

// Export the mock for jest.mock
export default {
  useFileUploadToast,
};