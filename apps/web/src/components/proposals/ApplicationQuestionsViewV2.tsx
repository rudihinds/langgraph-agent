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
  Clipboard,
  Save,
  Info,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Import,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { CheckItem } from "@/components/ui/check-item";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { z } from "zod";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ProgressCircle } from "@/components/ui/progress-circle";
import { debounce } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { slugify } from "@/lib/utils";

// Define local schema because @proposal-writer/shared isn't available
export interface SharedQuestion {
  id: string;
  text: string;
  category: string | null;
  wordLimit: number | null;
  charLimit: number | null;
}

export interface ApplicationQuestions {
  questions: SharedQuestion[];
}

const ApplicationQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        text: z.string().min(1, "Question text is required"),
        category: z.string().nullable(),
        wordLimit: z.number().nullable(),
        charLimit: z.number().nullable(),
      })
    )
    .min(1, "At least one question is required"),
});

// MODEL
// Our internal Question type includes an ID for management purposes
// but keeps all the fields from the shared Question type
export interface Question {
  id: string;
  text: string;
  category: string | null;
  wordLimit: number | null;
  charLimit: number | null;
}

// When submitting, we convert our internal Questions to the shared schema format
export interface ApplicationQuestionsViewProps {
  onSubmit: (data: { questions: Omit<Question, "id">[] }) => void;
  onBack: () => void;
}

interface UseApplicationQuestionsModel {
  questions: Question[];
  errors: Record<string, string>;
  bulkImportOpen: boolean;
  bulkImportText: string;
  activePanel: string | null;
  isSaving: boolean;
  lastSaved: Date | null;
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
  togglePanel: (id: string) => void;
  questionRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  handleFocus: (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement
    >
  ) => void;
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
  const { toast } = useToast();
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
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
      if (questions.length > 0) {
        setIsSaving(true);

        // Strip IDs before saving for compatibility with the shared schema
        const questionsToSave = {
          questions,
        };

        localStorage.setItem(
          "applicationQuestions",
          JSON.stringify(questionsToSave)
        );

        setTimeout(() => {
          setIsSaving(false);
          setLastSaved(new Date());
        }, 600);
      }
    }, 1000);

    return () => clearTimeout(saveTimeout);
  }, [questions]);

  const validateForm = useCallback(() => {
    setErrors({});

    // Prepare the questions for validation (without ID)
    const questionsForValidation = questions.map(({ id, ...rest }) => rest);

    try {
      // Use the shared schema for validation
      ApplicationQuestionsSchema.parse({ questions: questionsForValidation });
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Process the error messages
        const formattedErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          // Find the question ID that corresponds to the error
          if (err.path.length >= 2 && err.path[0] === "questions") {
            const questionIndex = err.path[1] as number;
            const fieldName = err.path[2] as string;
            const questionId = questions[questionIndex]?.id;

            if (questionId) {
              // Create an error key like "question-123-text"
              const errorKey = `question-${questionId}-${fieldName || "text"}`;
              formattedErrors[errorKey] = err.message;
            }
          } else {
            // Handle array-level errors
            formattedErrors["questions"] = err.message;
          }
        });

        // Set the formatted errors
        setErrors(formattedErrors);
        return false;
      }

      // Generic error fallback
      setErrors({ form: "Form validation failed" });
      return false;
    }
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
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const updateQuestion = useCallback(
    (id: string, updates: Partial<Omit<Question, "id">>) => {
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, ...updates } : q))
      );
    },
    []
  );

  const moveQuestionUp = useCallback((id: string) => {
    setQuestions((prev) => {
      const index = prev.findIndex((q) => q.id === id);
      if (index <= 0) return prev;

      const newArray = [...prev];
      [newArray[index - 1], newArray[index]] = [
        newArray[index],
        newArray[index - 1],
      ];
      return newArray;
    });
  }, []);

  const moveQuestionDown = useCallback((id: string) => {
    setQuestions((prev) => {
      const index = prev.findIndex((q) => q.id === id);
      if (index < 0 || index >= prev.length - 1) return prev;

      const newArray = [...prev];
      [newArray[index], newArray[index + 1]] = [
        newArray[index + 1],
        newArray[index],
      ];
      return newArray;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (validateForm()) {
      // Convert our questions to the format expected by the shared schema
      const questionsWithoutIds = questions.map(({ id, ...rest }) => rest);

      // Call the submit handler with our prepared data
      onSubmit({ questions: questionsWithoutIds });

      toast({
        title: "Questions saved successfully",
        description: "Your application questions have been saved.",
      });
    } else {
      // Scroll to the first error
      const firstErrorId = Object.keys(errors)[0];
      const match = firstErrorId.match(/question-([^-]+)/);

      if (match && match[1]) {
        const errorQuestionId = match[1];
        const errorRef = questionRefs.current[errorQuestionId];

        if (errorRef) {
          errorRef.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }

      toast({
        title: "Validation failed",
        description: "Please fix the highlighted errors before submitting.",
        variant: "destructive",
      });
    }
  }, [onSubmit, questions, validateForm, errors, toast, questionRefs]);

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
    if (!bulkImportText.trim()) return;

    const lines = bulkImportText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    // Create question objects from each line
    const newQuestions = lines.map((text) => ({
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      text,
      wordLimit: null,
      charLimit: null,
      category: null,
    }));

    setQuestions((prev) => [...prev, ...newQuestions]);
    closeBulkImport();

    toast({
      title: "Questions imported",
      description: `${newQuestions.length} question${
        newQuestions.length === 1 ? "" : "s"
      } added.`,
    });
  }, [bulkImportText, closeBulkImport, toast]);

  const togglePanel = useCallback((id: string) => {
    setActivePanel((prev) => (prev === id ? null : id));
  }, []);

  const handleFocus = useCallback(
    (
      e: React.FocusEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement
      >
    ) => {
      // Clear error when field is focused
      const fieldName = e.target.name;
      if (fieldName && errors[fieldName]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[fieldName];
          return newErrors;
        });
      }
    },
    [errors]
  );

  return {
    questions,
    errors,
    bulkImportOpen,
    bulkImportText,
    activePanel,
    isSaving,
    lastSaved,
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
    togglePanel,
    questionRefs,
    handleFocus,
  };
}

interface ApplicationQuestionsViewComponentProps
  extends ApplicationQuestionsViewProps {
  questions: Question[];
  errors: Record<string, string>;
  bulkImportOpen: boolean;
  bulkImportText: string;
  activePanel: string | null;
  isSaving: boolean;
  lastSaved: Date | null;
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
  togglePanel: (id: string) => void;
  questionRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  handleFocus: (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement
    >
  ) => void;
}

function ApplicationQuestionsViewComponent({
  questions,
  errors,
  bulkImportOpen,
  bulkImportText,
  activePanel,
  isSaving,
  lastSaved,
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
  togglePanel,
  questionRefs,
  handleFocus,
}: ApplicationQuestionsViewComponentProps) {
  // Calculate completion percentage
  const completedQuestions = questions.filter((q) => q.text.trim().length > 0);
  const completionPercentage =
    questions.length > 0
      ? Math.round((completedQuestions.length / questions.length) * 100)
      : 0;

  return (
    <TooltipProvider>
      <div className="space-y-8 pb-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Application Questions
            </h1>
            <p className="text-muted-foreground">
              Add the questions from the grant application
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBack}
                  type="button"
                >
                  Back
                </Button>
              </TooltipTrigger>
              <TooltipContent>Return to the previous step</TooltipContent>
            </Tooltip>

            <Button
              onClick={handleSubmit}
              size="sm"
              type="button"
              disabled={questions.length === 0}
            >
              Save & Continue
            </Button>
          </div>
        </div>

        {/* Auto-save indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ProgressCircle
              value={completionPercentage}
              size="sm"
              showValue={false}
            />
            <div>
              <div className="text-sm font-medium">
                {questions.length}{" "}
                {questions.length === 1 ? "question" : "questions"} added
              </div>
              <div className="text-xs text-muted-foreground">
                {completionPercentage}% complete
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {isSaving ? (
              <span className="text-xs text-muted-foreground">Saving...</span>
            ) : lastSaved ? (
              <span className="text-xs text-muted-foreground">
                Last saved:{" "}
                {lastSaved.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ) : null}
          </div>
        </div>

        {errors.questions && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errors.questions}</AlertDescription>
          </Alert>
        )}

        {/* Empty state */}
        {questions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="pt-6 text-center">
              <Info className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-3 text-lg font-medium">No questions added</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Start by adding questions from the grant application.
              </p>
              <Button onClick={addQuestion} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Add First Question
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {questions.map((question, index) => (
              <Collapsible
                key={question.id}
                open={activePanel === question.id}
                onOpenChange={() => togglePanel(question.id)}
                className={cn(
                  "rounded-lg border bg-card text-card-foreground shadow-sm",
                  errors[`question-${question.id}-text`] && "border-destructive"
                )}
              >
                <div
                  ref={(el) => {
                    if (el) questionRefs.current[question.id] = el;
                  }}
                  className="p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium">
                        {index + 1}
                      </div>
                      <h3 className="font-medium">
                        {question.text
                          ? question.text.length > 40
                            ? question.text.substring(0, 40) + "..."
                            : question.text
                          : `Question ${index + 1}`}
                      </h3>
                      {question.category && (
                        <Badge variant="outline">{question.category}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => moveQuestionUp(question.id)}
                        disabled={index === 0}
                        className="h-8 w-8"
                      >
                        <ArrowUp className="h-4 w-4" />
                        <span className="sr-only">Move up</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => moveQuestionDown(question.id)}
                        disabled={index === questions.length - 1}
                        className="h-8 w-8"
                      >
                        <ArrowDown className="h-4 w-4" />
                        <span className="sr-only">Move down</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeQuestion(question.id)}
                        className="h-8 w-8 text-destructive"
                      >
                        <Trash className="h-4 w-4" />
                        <span className="sr-only">Remove</span>
                      </Button>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          {activePanel === question.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>

                  <CollapsibleContent className="pt-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor={`question-${question.id}-text`}
                          className={cn(
                            errors[`question-${question.id}-text`] &&
                              "text-destructive"
                          )}
                        >
                          Question Text
                          <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                          id={`question-${question.id}-text`}
                          name={`question-${question.id}-text`}
                          value={question.text || ""}
                          onChange={(e) =>
                            updateQuestion(question.id, {
                              text: e.target.value,
                            })
                          }
                          onFocus={handleFocus}
                          className={cn(
                            "min-h-[100px]",
                            errors[`question-${question.id}-text`] &&
                              "border-destructive"
                          )}
                          placeholder="Enter the question text from the application form"
                        />
                        {errors[`question-${question.id}-text`] && (
                          <p className="text-xs text-destructive">
                            {errors[`question-${question.id}-text`]}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor={`question-${question.id}-category`}>
                            Category (Optional)
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
                              id={`question-${question.id}-category`}
                            >
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">None</SelectItem>
                              {QUESTION_CATEGORIES.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`question-${question.id}-wordLimit`}>
                            Word Limit (Optional)
                          </Label>
                          <Input
                            id={`question-${question.id}-wordLimit`}
                            type="number"
                            min="0"
                            value={question.wordLimit || ""}
                            onChange={(e) =>
                              updateQuestion(question.id, {
                                wordLimit: e.target.value
                                  ? parseInt(e.target.value)
                                  : null,
                              })
                            }
                            placeholder="e.g., 500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`question-${question.id}-charLimit`}>
                            Character Limit (Optional)
                          </Label>
                          <Input
                            id={`question-${question.id}-charLimit`}
                            type="number"
                            min="0"
                            value={question.charLimit || ""}
                            onChange={(e) =>
                              updateQuestion(question.id, {
                                charLimit: e.target.value
                                  ? parseInt(e.target.value)
                                  : null,
                              })
                            }
                            placeholder="e.g., 2000"
                          />
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}

            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={addQuestion}
                className="w-full max-w-md"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Another Question
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={openBulkImport}
            className="mr-auto"
            type="button"
          >
            <Import className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Button variant="outline" onClick={handleBack} type="button">
            Back
          </Button>
          <Button
            onClick={handleSubmit}
            type="button"
            disabled={questions.length === 0}
          >
            Save & Continue
          </Button>
        </div>

        {/* Bulk import dialog */}
        <Dialog open={bulkImportOpen} onOpenChange={closeBulkImport}>
          <DialogContent
            className="sm:max-w-md"
            aria-labelledby="bulk-import-v2-dialog-title"
            aria-describedby="bulk-import-v2-dialog-description"
          >
            <DialogTitle id="bulk-import-v2-dialog-title">
              Bulk Import Questions
            </DialogTitle>
            <DialogDescription id="bulk-import-v2-dialog-description">
              Enter one question per line. Each line will be added as a separate
              question.
            </DialogDescription>
            <div className="space-y-4 py-4">
              <Textarea
                placeholder="Enter one question per line..."
                className="min-h-[200px]"
                value={bulkImportText}
                onChange={(e) => updateBulkImportText(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeBulkImport}>
                Cancel
              </Button>
              <Button
                onClick={processBulkImport}
                disabled={!bulkImportText.trim()}
              >
                Import Questions
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

export default function ApplicationQuestionsView(
  props: ApplicationQuestionsViewProps
) {
  const model = useApplicationQuestions(props);

  return <ApplicationQuestionsViewComponent {...props} {...model} />;
}
