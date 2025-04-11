import { z } from 'zod';

/**
 * Schema for a single question in the application form
 */
const questionSchema = z.object({
  id: z.string(),
  text: z.string().min(3, { message: 'Question text is required' }),
  type: z.enum(['text', 'multiline']),
  required: z.boolean().default(false),
});

/**
 * Schema for the entire application questions form
 */
export const questionsFormSchema = z.object({
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
  
  questions: z.array(questionSchema)
    .min(1, { message: 'At least one question is required' })
    .refine(
      (questions) => questions.every(q => q.text.trim().length > 0),
      { message: 'All questions must have text' }
    ),
});

export type QuestionsFormValues = z.infer<typeof questionsFormSchema>;