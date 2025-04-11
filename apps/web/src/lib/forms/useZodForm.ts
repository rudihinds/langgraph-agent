import { useState, useCallback } from 'react';
import { z } from 'zod';
import { formatZodError, extractFieldErrors } from '../errors/form-errors';
import { logger } from '../logger';

/**
 * A custom hook for form state management with Zod validation
 * @param schema The Zod schema for form validation
 * @returns Form utilities including values, errors, handlers and validation
 */
export function useZodForm<T extends z.ZodTypeAny>(schema: T) {
  type FormValues = z.infer<T>;
  
  // Initialize with empty values based on schema shape
  const [values, setValues] = useState<Partial<FormValues>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Update a specific field value
   */
  const setValue = useCallback((field: keyof FormValues, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
    setIsDirty(prev => ({ ...prev, [field]: true }));
    
    // Clear field error if it exists
    if (errors[field as string]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field as string];
        return newErrors;
      });
    }
  }, [errors]);

  /**
   * Validate the entire form against the schema
   */
  const validateForm = useCallback(() => {
    try {
      logger.debug('Validating form against schema', values);
      
      // Parse values with the schema
      const result = schema.safeParse(values);
      
      if (!result.success) {
        // Format and set errors using our existing utility
        const formattedError = formatZodError(result.error);
        const fieldErrors = extractFieldErrors({ 
          success: false, 
          error: formattedError 
        });
        
        logger.debug('Form validation failed', fieldErrors);
        setErrors(fieldErrors);
        return { isValid: false, errors: fieldErrors };
      }
      
      // Clear all errors on successful validation
      logger.debug('Form validation successful');
      setErrors({});
      return { isValid: true, errors: {} };
    } catch (error) {
      logger.error('Unexpected error during form validation', {}, error);
      setErrors({ _form: 'An unexpected error occurred during validation' });
      return { isValid: false, errors: { _form: 'An unexpected error occurred during validation' } };
    }
  }, [schema, values]);

  /**
   * Focus the first field with an error
   */
  const focusFirstError = useCallback(() => {
    const firstErrorField = Object.keys(errors).find(key => key !== '_form');
    
    if (firstErrorField) {
      const field = document.getElementById(firstErrorField);
      if (field) {
        logger.debug(`Focusing field: ${firstErrorField}`);
        field.focus();
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
    }
    return false;
  }, [errors]);

  /**
   * Reset the form to its initial state
   */
  const resetForm = useCallback(() => {
    setValues({});
    setErrors({});
    setIsDirty({});
    setIsSubmitting(false);
  }, []);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback((onSubmit: (values: FormValues) => Promise<void>) => {
    return async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      
      if (isSubmitting) {
        logger.debug('Submission already in progress, ignoring additional request');
        return;
      }
      
      const { isValid } = validateForm();
      
      if (!isValid) {
        focusFirstError();
        return;
      }
      
      try {
        setIsSubmitting(true);
        await onSubmit(values as FormValues);
      } catch (error) {
        logger.error('Form submission error', {}, error);
        if (error instanceof z.ZodError) {
          const formattedError = formatZodError(error);
          const fieldErrors = extractFieldErrors({ 
            success: false, 
            error: formattedError 
          });
          setErrors(fieldErrors);
          focusFirstError();
        } else if (error instanceof Error) {
          setErrors({ _form: error.message });
        } else {
          setErrors({ _form: 'An unexpected error occurred' });
        }
      } finally {
        setIsSubmitting(false);
      }
    };
  }, [validateForm, focusFirstError, isSubmitting, values]);

  return {
    values,
    errors,
    isDirty,
    isSubmitting,
    setValue,
    validateForm,
    focusFirstError,
    resetForm,
    handleSubmit
  };
}