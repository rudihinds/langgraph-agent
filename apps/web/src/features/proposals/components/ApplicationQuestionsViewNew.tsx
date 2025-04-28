"use client";

import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { FormOverlay } from "./FormOverlay";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AppointmentPicker } from "@/components/ui/appointment-picker";
import { formatDateForAPI } from "@/lib/utils/date-utils";
import { FormErrorBoundary } from "@/components/ui/form-error";
import { FormField } from "@/components/ui/form-field";
import { useZodForm } from "@/lib/forms/useZodForm";
import { QuestionField, Question } from "@/components/ui/question-field";
import {
  questionsFormSchema,
  QuestionsFormValues,
} from "@/lib/forms/schemas/questions-form-schema";
import { logger } from "@/lib/logger";
import { createProposalWithQuestions } from "@/lib/proposal-actions/actions[dep]";

type ApplicationQuestionsViewProps = {
  userId: string;
  onSuccess?: (proposalId: string) => void;
};

export function ApplicationQuestionsView({
  userId,
  onSuccess,
}: ApplicationQuestionsViewProps) {
  // Track overlay and submission state
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [currentOverlayStep, setCurrentOverlayStep] = useState(0);
  const [proposalId, setProposalId] = useState<string | null>(null);

  // Track questions state
  const [questions, setQuestions] = useState<Question[]>([
    { id: uuidv4(), text: "", type: "text", required: false },
  ]);

  // Use the form validation hook
  const { values, errors, isSubmitting, setValue, handleSubmit } =
    useZodForm(questionsFormSchema);

  // Set initial values for fields that aren't directly bound to inputs
  React.useEffect(() => {
    setValue("questions", questions);
  }, [questions, setValue]);

  // Question management functions
  const addQuestion = () => {
    const newQuestion = {
      id: uuidv4(),
      text: "",
      type: "text",
      required: false,
    };
    const updatedQuestions = [...questions, newQuestion];
    setQuestions(updatedQuestions);
    setValue("questions", updatedQuestions);
  };

  const updateQuestion = (updatedQuestion: Question) => {
    const updatedQuestions = questions.map((q) =>
      q.id === updatedQuestion.id ? updatedQuestion : q
    );
    setQuestions(updatedQuestions);
    setValue("questions", updatedQuestions);
  };

  const deleteQuestion = (id: string) => {
    // Don't allow deleting if it's the only question
    if (questions.length <= 1) return;

    const updatedQuestions = questions.filter((q) => q.id !== id);
    setQuestions(updatedQuestions);
    setValue("questions", updatedQuestions);
  };

  // Handle form submission
  const onSubmit = handleSubmit(async (formValues: QuestionsFormValues) => {
    try {
      logger.debug("Starting application questions submission process");

      // Start overlay and progress indicators
      setOverlayVisible(true);
      setCurrentOverlayStep(0);

      // Validating step
      await new Promise((resolve) => setTimeout(resolve, 500));
      setCurrentOverlayStep(1);

      // Create proposal with questions
      const result = await createProposalWithQuestions({
        userId,
        title: formValues.title,
        description: formValues.description,
        deadline: formatDateForAPI(formValues.deadline),
        questions: formValues.questions.map((q) => ({
          text: q.text,
          type: q.type,
          required: q.required,
        })),
      });

      // Handle successful creation
      if (result.success && result.proposalId) {
        logger.debug("Successfully created proposal with questions", result);
        setProposalId(result.proposalId);
        setCurrentOverlayStep(2);

        // Complete feedback with short delay
        setTimeout(() => {
          setOverlayVisible(false);
          if (result.proposalId && onSuccess) {
            onSuccess(result.proposalId);
          }
        }, 1500);
      } else {
        throw new Error(result.error || "Failed to create proposal");
      }
    } catch (error) {
      // Reset UI for error state
      setOverlayVisible(false);
      logger.error("Error creating proposal with questions", {}, error);
      throw error; // Let the form hook handle the error
    }
  });

  // Get field-specific errors for questions
  const getQuestionError = (questionId: string): string | undefined => {
    // Find any error for this specific question
    const errorKey = Object.keys(errors).find((key) =>
      key.startsWith(`question_${questionId}`)
    );
    return errorKey ? errors[errorKey] : undefined;
  };

  return (
    <FormErrorBoundary initialErrors={errors}>
      <form onSubmit={onSubmit} className="space-y-4 max-w-2xl mx-auto">
        {/* Form overlay for progress feedback */}
        {overlayVisible && (
          <FormOverlay
            isVisible={overlayVisible}
            currentStep={currentOverlayStep}
            onComplete={() => {
              setOverlayVisible(false);
              if (proposalId && onSuccess) onSuccess(proposalId);
            }}
          />
        )}

        <Card className="shadow-md border-0">
          <CardHeader className="bg-muted/30 border-b pb-3">
            <CardTitle>Create Application Form</CardTitle>
            <CardDescription>
              Set up an application form with customized questions
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Required fields indicator */}
            <p className="text-xs text-muted-foreground mb-2">
              <span className="text-destructive">*</span> Required fields
            </p>

            {/* Title field */}
            <FormField
              id="title"
              type="text"
              label="Title"
              value={values.title || ""}
              onChange={(value) => setValue("title", value)}
              error={errors.title}
              required
              placeholder="Enter a title for this application"
            />

            {/* Description field */}
            <FormField
              id="description"
              type="textarea"
              label="Description"
              value={values.description || ""}
              onChange={(value) => setValue("description", value)}
              error={errors.description}
              required
              placeholder="Enter a brief description for applicants"
              rows={4}
            />

            {/* Deadline field */}
            <FormField
              id="deadline"
              type="date"
              label="Submission Deadline"
              value={values.deadline}
              onChange={(date) => setValue("deadline", date)}
              error={errors.deadline}
              required
              DatePickerComponent={AppointmentPicker}
              allowManualInput={true}
            />

            {/* Questions section */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium">Application Questions</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addQuestion}
                  className="flex items-center"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Question
                </Button>
              </div>

              {errors.questions &&
                !errors.questions.startsWith("question_") && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.questions}
                  </p>
                )}

              <div className="space-y-3">
                {questions.map((question, index) => (
                  <QuestionField
                    key={question.id}
                    question={question}
                    index={index}
                    onUpdate={updateQuestion}
                    onDelete={() => deleteQuestion(question.id)}
                    error={getQuestionError(question.id)}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 mt-4">
          <Button
            type="submit"
            className="w-full md:w-auto"
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create"}
          </Button>
        </div>
      </form>
    </FormErrorBoundary>
  );
}
