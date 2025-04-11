import { z } from 'zod';

/**
 * Schema for RFP form validation
 */
export const rfpFormSchema = z.object({
  title: z
    .string()
    .min(5, { message: 'Title must be at least 5 characters' })
    .max(200, { message: 'Title must be less than 200 characters' }),
  
  description: z
    .string()
    .min(10, { message: 'Description must be at least 10 characters' })
    .max(2000, { message: 'Description must be less than 2000 characters' }),
  
  deadline: z
    .date({ required_error: 'Deadline is required' })
    .refine((date) => date > new Date(), {
      message: 'Deadline must be in the future',
    }),
  
  fundingAmount: z
    .string()
    .min(1, { message: 'Funding amount is required' })
    .refine((val) => /^\d+(\.\d{1,2})?$/.test(val), {
      message: 'Please enter a valid funding amount (e.g., 10000 or 10000.00)',
    }),
  
  file: z
    .instanceof(File, { message: 'Please select a valid file to upload' })
    .refine((file) => file.size <= 50 * 1024 * 1024, {
      message: 'File size exceeds 50MB limit',
    })
    .refine(
      (file) => {
        const acceptedTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
        return acceptedTypes.includes(file.type);
      },
      {
        message: 'File type not supported. Please upload PDF, DOC, DOCX, TXT, XLS, or XLSX.',
      }
    ),
});

export type RfpFormValues = z.infer<typeof rfpFormSchema>;