"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronUp,
  ChevronDown,
  X,
  Plus,
  ChevronRight,
  Trash,
  Copy,
  Settings,
  ArrowUp,
  ArrowDown,
  Check,
} from "lucide-react";

// MODEL
export interface Question {
  id: string;
  text: string;
  wordLimit: number | null;
  charLimit: number | null;
  category: string | null;
}

export interface ApplicationQuestionsViewProps {
  onSubmit: (data: { questions: Omit<Question, "id">[] }) => void;
  onBack: () => void;
}

interface UseApplicationQuestionsModel {
  questions: Question[];
  errors: Record<string, string>;
  bulkImportOpen: boolean;
  bulkImportText: string;
  addQuestion: () => void;
  removeQuestion: (id: string) => void;
  updateQuestion: (id: string, updates: Partial<Omit<Question, "id">>) => void;
  moveQuestionUp: (id: string) => void;
  moveQuestionDown: (id: string) => void;
  handleSubmit: () => void;
  handleBack: () => void;
  validateForm: () => boolean;
  openBulkImport: () => void;
  closeBulkImport: () => void;
  updateBulkImportText: (text: string) => void;
  processBulkImport: () => void;
}

const QUESTION_CATEGORIES = [
  "Organizational Background",
  "Project Goals",
  "Implementation Plan",
  "Budget & Financials",
  "Evaluation & Impact",
  "Sustainability",
  "Other",
];

function useApplicationQuestions({
  onSubmit,
  onBack,
}: ApplicationQuestionsViewProps): UseApplicationQuestionsModel {
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: Date.now().toString(),
      text: "",
      wordLimit: null,
      charLimit: null,
      category: null,
    },
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");

  // Load saved questions from localStorage on mount
  useEffect(() => {
    const savedQuestions = localStorage.getItem("applicationQuestions");
    if (savedQuestions) {
      try {
        const { questions: savedQuestionData } = JSON.parse(savedQuestions);
        if (Array.isArray(savedQuestionData) && savedQuestionData.length > 0) {
          // Add IDs to saved questions if needed
          const questionsWithIds = savedQuestionData.map((q: any) => ({
            ...q,
            id:
              q.id ||
              Date.now().toString() +
                Math.random().toString(36).substring(2, 9),
          }));
          setQuestions(questionsWithIds);
        }
      } catch (e) {
        console.error("Failed to parse saved questions:", e);
      }
    }
  }, []);

  // Auto-save questions to localStorage when they change
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      localStorage.setItem(
        "applicationQuestions",
        JSON.stringify({
          questions: questions.map(({ id, ...rest }) => rest),
        })
      );
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(saveTimeout);
  }, [questions]);

  const addQuestion = useCallback(() => {
    setQuestions((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        text: "",
        wordLimit: null,
        charLimit: null,
        category: null,
      },
    ]);
  }, []);

  const removeQuestion = useCallback((id: string) => {
    setQuestions((prev) => {
      // Don't allow removing the last question
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((q) => q.id !== id);
    });

    // Clear any errors for this question
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[id];
      return newErrors;
    });
  }, []);

  const updateQuestion = useCallback(
    (id: string, updates: Partial<Omit<Question, "id">>) => {
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, ...updates } : q))
      );

      // Clear errors for this question if it was previously invalid and now has text
      if (updates.text && errors[id]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[id];
          return newErrors;
        });
      }
    },
    [errors]
  );

  const moveQuestionUp = useCallback((id: string) => {
    setQuestions((prev) => {
      const index = prev.findIndex((q) => q.id === id);
      if (index <= 0) return prev;

      const newQuestions = [...prev];
      const temp = newQuestions[index];
      newQuestions[index] = newQuestions[index - 1];
      newQuestions[index - 1] = temp;

      return newQuestions;
    });
  }, []);

  const moveQuestionDown = useCallback((id: string) => {
    setQuestions((prev) => {
      const index = prev.findIndex((q) => q.id === id);
      if (index === -1 || index >= prev.length - 1) return prev;

      const newQuestions = [...prev];
      const temp = newQuestions[index];
      newQuestions[index] = newQuestions[index + 1];
      newQuestions[index + 1] = temp;

      return newQuestions;
    });
  }, []);

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    questions.forEach((q) => {
      if (!q.text.trim()) {
        newErrors[q.id] = "Question text is required";
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [questions]);

  const handleSubmit = useCallback(() => {
    if (validateForm()) {
      onSubmit({
        questions: questions.map(({ id, ...rest }) => rest),
      });
    }
  }, [questions, validateForm, onSubmit]);

  const handleBack = useCallback(() => {
    onBack();
  }, [onBack]);

  const openBulkImport = useCallback(() => {
    setBulkImportOpen(true);
  }, []);

  const closeBulkImport = useCallback(() => {
    setBulkImportOpen(false);
    setBulkImportText("");
  }, []);

  const updateBulkImportText = useCallback((text: string) => {
    setBulkImportText(text);
  }, []);

  const processBulkImport = useCallback(() => {
    if (!bulkImportText.trim()) {
      closeBulkImport();
      return;
    }

    // Split by newlines and filter out empty lines
    const lines = bulkImportText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      closeBulkImport();
      return;
    }

    // Convert lines to questions
    const newQuestions = lines.map((text) => ({
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      text,
      wordLimit: null,
      charLimit: null,
      category: null,
    }));

    // Replace existing questions with new ones
    setQuestions(newQuestions);
    closeBulkImport();
  }, [bulkImportText, closeBulkImport]);

  return {
    questions,
    errors,
    bulkImportOpen,
    bulkImportText,
    addQuestion,
    removeQuestion,
    updateQuestion,
    moveQuestionUp,
    moveQuestionDown,
    handleSubmit,
    handleBack,
    validateForm,
    openBulkImport,
    closeBulkImport,
    updateBulkImportText,
    processBulkImport,
  };
}

// VIEW
interface ApplicationQuestionsViewComponentProps
  extends ApplicationQuestionsViewProps {
  questions: Question[];
  errors: Record<string, string>;
  bulkImportOpen: boolean;
  bulkImportText: string;
  addQuestion: () => void;
  removeQuestion: (id: string) => void;
  updateQuestion: (id: string, updates: Partial<Omit<Question, "id">>) => void;
  moveQuestionUp: (id: string) => void;
  moveQuestionDown: (id: string) => void;
  handleSubmit: () => void;
  handleBack: () => void;
  openBulkImport: () => void;
  closeBulkImport: () => void;
  updateBulkImportText: (text: string) => void;
  processBulkImport: () => void;
}

function ApplicationQuestionsViewComponent({
  questions,
  errors,
  bulkImportOpen,
  bulkImportText,
  addQuestion,
  removeQuestion,
  updateQuestion,
  moveQuestionUp,
  moveQuestionDown,
  handleSubmit,
  handleBack,
  openBulkImport,
  closeBulkImport,
  updateBulkImportText,
  processBulkImport,
}: ApplicationQuestionsViewComponentProps) {
  return (
    <div className="container max-w-3xl mx-auto py-8">
      <div className="flex items-center space-x-2 mb-2">
        <span className="text-sm text-muted-foreground">Proposal Type</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Application Questions</span>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Application Questions</h1>
        <p className="text-muted-foreground">
          Enter the questions from your application below. You can add as many
          questions as needed and optionally specify word limits and categories.
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Questions</h2>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={openBulkImport}
                className="flex items-center gap-1"
              >
                <Copy className="h-4 w-4" />
                Bulk Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={addQuestion}
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Question
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {questions.map((question, index) => (
              <div
                key={question.id}
                className="border rounded-md p-4 relative"
                data-testid={`question-${index + 1}`}
              >
                <div className="absolute right-2 top-2 flex space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveQuestionUp(question.id)}
                    disabled={index === 0}
                    aria-label={`Move question ${index + 1} up`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveQuestionDown(question.id)}
                    disabled={index === questions.length - 1}
                    aria-label={`Move question ${index + 1} down`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeQuestion(question.id)}
                    aria-label={`Remove question ${index + 1}`}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mb-4 pr-20">
                  <Label htmlFor={`question-${question.id}`}>
                    Question {index + 1}
                  </Label>
                  <Textarea
                    id={`question-${question.id}`}
                    value={question.text}
                    onChange={(e) =>
                      updateQuestion(question.id, { text: e.target.value })
                    }
                    className="mt-1"
                    placeholder="Enter your question here..."
                    aria-invalid={!!errors[question.id]}
                    aria-describedby={
                      errors[question.id]
                        ? `question-error-${question.id}`
                        : undefined
                    }
                  />
                  {errors[question.id] && (
                    <p
                      id={`question-error-${question.id}`}
                      className="text-sm text-destructive mt-1"
                    >
                      {errors[question.id]}
                    </p>
                  )}
                </div>

                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-1"
                      aria-label={`Options for question ${index + 1}`}
                    >
                      <Settings className="h-4 w-4" />
                      Options
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`word-limit-${question.id}`}>
                          Word limit
                        </Label>
                        <Input
                          id={`word-limit-${question.id}`}
                          type="number"
                          min="0"
                          placeholder="No limit"
                          value={
                            question.wordLimit !== null
                              ? question.wordLimit
                              : ""
                          }
                          onChange={(e) =>
                            updateQuestion(question.id, {
                              wordLimit: e.target.value
                                ? parseInt(e.target.value)
                                : null,
                            })
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`char-limit-${question.id}`}>
                          Character limit
                        </Label>
                        <Input
                          id={`char-limit-${question.id}`}
                          type="number"
                          min="0"
                          placeholder="No limit"
                          value={
                            question.charLimit !== null
                              ? question.charLimit
                              : ""
                          }
                          onChange={(e) =>
                            updateQuestion(question.id, {
                              charLimit: e.target.value
                                ? parseInt(e.target.value)
                                : null,
                            })
                          }
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`category-${question.id}`}>
                        Category
                      </Label>
                      <Select
                        value={question.category || ""}
                        onValueChange={(value) =>
                          updateQuestion(question.id, {
                            category: value || null,
                          })
                        }
                      >
                        <SelectTrigger
                          id={`category-${question.id}`}
                          className="mt-1 w-full"
                        >
                          <SelectValue placeholder="Select a category (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {QUESTION_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack}>
          Back
        </Button>
        <Button onClick={handleSubmit}>Continue</Button>
      </div>

      {/* Bulk Import Dialog */}
      <Dialog open={bulkImportOpen} onOpenChange={closeBulkImport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Import Questions</DialogTitle>
            <DialogDescription>
              Paste your questions below, one per line. These will replace your
              current questions.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea
              value={bulkImportText}
              onChange={(e) => updateBulkImportText(e.target.value)}
              placeholder="What is your organization's mission?&#10;Describe your project goals.&#10;What is your proposed budget?"
              className="min-h-[200px]"
              aria-label="Questions"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeBulkImport}>
              Cancel
            </Button>
            <Button onClick={processBulkImport}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// COMPONENT
export default function ApplicationQuestionsView(
  props: ApplicationQuestionsViewProps
) {
  const model = useApplicationQuestions(props);
  return <ApplicationQuestionsViewComponent {...props} {...model} />;
}
