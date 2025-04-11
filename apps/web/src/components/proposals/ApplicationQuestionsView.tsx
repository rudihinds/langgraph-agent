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
  Loader2,
  ChevronLeft,
  Upload,
  FileText,
  File,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { CheckItem } from "@/components/ui/check-item";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  AutoClosePopover,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type Question as SharedQuestion,
  type ApplicationQuestions,
} from "@shared/types/ProposalSchema";
import { z } from "zod";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { slugify } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProgressCircle } from "@/components/ui/progress-circle";
import { debounce } from "@/lib/utils";
import { SubmitButton } from "./SubmitButton";
import { FormErrorBoundary, FieldError } from "@/components/ui/form-error";

// MODEL
// Extend the shared Question type to include ID for internal management
export interface Question extends Omit<SharedQuestion, "id"> {
  id: string;
  text: string;
  category: string | null;
  wordLimit: number | null;
  charLimit: number | null;
}

export interface ApplicationQuestionsViewProps {
  onSubmit: (data: {
    questions: Question[];
    errors?: Record<string, string>;
  }) => void;
  onBack: () => void;
  isSubmitting?: boolean;
  formErrors?: Record<string, string>;
}

interface UseApplicationQuestionsModel {
  questions: Question[];
  errors: Record<string, string>;
  bulkImportOpen: boolean;
  bulkImportText: string;
  activePanel: string | null;
  isSaving: boolean;
  lastSaved: Date | null;
  fileName: string | null;
  isUploading: boolean;
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
  handleBlur: () => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveFile: () => void;
}

// Define the props interface for the view component
interface ApplicationQuestionsViewComponentProps
  extends UseApplicationQuestionsModel {
  isSubmitting?: boolean;
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

// Define application questions schema locally
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

function useApplicationQuestions({
  onSubmit,
  onBack,
  isSubmitting,
  formErrors,
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
  const [userInteracting, setUserInteracting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Update local errors when external formErrors change
  useEffect(() => {
    if (formErrors && Object.keys(formErrors).length > 0) {
      setErrors((prev) => ({
        ...prev,
        ...formErrors,
      }));

      // Display a toast for external errors
      if (formErrors.submission) {
        toast({
          title: "Error",
          description: formErrors.submission,
          variant: "destructive",
        });
      }
    }
  }, [formErrors, toast]);

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
    // Don't auto-save if user is actively editing
    if (userInteracting) return;

    const saveTimeout = setTimeout(() => {
      // Only show saving indicator if there are actual questions to save
      if (questions.length > 0 && questions.some((q) => q.text.trim() !== "")) {
        setIsSaving(true);
        try {
          localStorage.setItem(
            "applicationQuestions",
            JSON.stringify({ questions, updatedAt: new Date() })
          );
          setLastSaved(new Date());
        } catch (e) {
          console.error("Failed to save questions:", e);
        } finally {
          // Short delay to show the saving indicator
          setTimeout(() => setIsSaving(false), 500);
        }
      }
    }, 1000);

    return () => clearTimeout(saveTimeout);
  }, [questions, userInteracting]);

  // Handle user interaction state
  const handleUserInteractionStart = () => {
    setUserInteracting(true);
  };

  const handleUserInteractionEnd = () => {
    setUserInteracting(false);
  };

  const addQuestion = useCallback(() => {
    const newId = Date.now().toString();
    setQuestions((prev) => [
      ...prev,
      {
        id: newId,
        text: "",
        wordLimit: null,
        charLimit: null,
        category: null,
      },
    ]);

    // Schedule focus to expand this panel
    setTimeout(() => {
      setActivePanel(newId);
    }, 100);
  }, []);

  const removeQuestion = useCallback((id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const updateQuestion = useCallback(
    (id: string, updates: Partial<Omit<Question, "id">>) => {
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, ...updates } : q))
      );

      // Clear error for this question if it was previously set
      if (errors[id]) {
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
    try {
      // Validate the questions
      const validationSchema = z.object({
        questions: z
          .array(
            z.object({
              id: z.string(),
              text: z.string().min(1, "Question text is required"),
              category: z.string().nullable(),
              wordLimit: z.number().nullable(),
              charLimit: z.number().nullable(),
            })
          )
          .min(1, "At least one question is required"),
      });

      console.log("Validating form data:", questions);
      validationSchema.parse({ questions });
      console.log("Validation successful");

      setErrors({});
      return true;
    } catch (error) {
      console.error("Validation failed:", error);

      if (error instanceof z.ZodError) {
        console.log("ZodError details:", JSON.stringify(error.errors, null, 2));
        const newErrors: Record<string, string> = {};

        // Add field-level errors
        error.errors.forEach((err) => {
          console.log("Processing error:", err);
          if (err.path[0] === "questions") {
            if (err.path.length > 1) {
              // This is a specific question error
              const index = err.path[1] as number;
              const field = err.path[2] as string;
              const questionId = questions[index]?.id;

              console.log("Field error:", { index, field, questionId });

              if (questionId) {
                const errorKey = `question_${questionId}_${field}`;
                newErrors[errorKey] = err.message;
                console.log(`Added error for ${errorKey}:`, err.message);

                // Focus the question with error
                setTimeout(() => {
                  console.log("Attempting to focus question:", questionId);
                  const questionEl = questionRefs.current[questionId];
                  if (questionEl) {
                    console.log("Question element found, scrolling into view");
                    questionEl.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                    setActivePanel(questionId);
                    console.log("Set active panel to:", questionId);
                  } else {
                    console.log("Question element not found in refs");
                  }
                }, 100);
              }
            } else {
              // General questions array error - don't add _form error but keep for toast notification
              console.log("General array error:", err.message);
              // Store this message for the toast but not for _form
              newErrors._toast_message = err.message;
            }
          }
        });

        // Remove adding generic _form error - field-level validation is sufficient
        // with focus handling

        console.log("Setting errors state with:", newErrors);
        setErrors(newErrors);

        // Show a toast to make the error more visible
        console.log("Showing toast notification");
        toast({
          title: "Validation Error",
          description:
            newErrors._toast_message || "Please correct the form errors",
          variant: "destructive",
        });
      }

      return false;
    }
  }, [questions, toast, questionRefs, setActivePanel]);

  const handleSubmit = useCallback(() => {
    console.log("Submit button clicked, validating form...");

    // Quick check for empty questions
    const emptyQuestions = questions.filter((q) => !q.text.trim());

    if (emptyQuestions.length > 0) {
      console.log("Empty questions detected:", emptyQuestions.length);
      const newErrors: Record<string, string> = {};

      emptyQuestions.forEach((q) => {
        newErrors[`question_${q.id}_text`] = "Question text is required";
      });

      // Set errors state (don't add _form error)
      setErrors(newErrors);

      // Focus the first empty question
      if (emptyQuestions[0]) {
        const firstQuestionId = emptyQuestions[0].id;
        setTimeout(() => {
          const questionEl = questionRefs.current[firstQuestionId];
          if (questionEl) {
            questionEl.scrollIntoView({ behavior: "smooth", block: "center" });
            setActivePanel(firstQuestionId);
          }
        }, 100);
      }

      // Show toast
      toast({
        title: "Missing Question Text",
        description: "Please fill out all question fields before continuing.",
        variant: "destructive",
      });

      return;
    }

    // Proceed with full validation if basic check passes
    const isValid = validateForm();
    console.log(
      "Form validation result:",
      isValid ? "Valid" : "Invalid",
      isValid ? "" : "Errors:",
      isValid ? "" : errors
    );

    if (isValid) {
      console.log("Form is valid, submitting data:", questions);
      onSubmit({ questions });
    } else {
      // Don't call onSubmit when validation fails
      // Just display local validation errors and prevent progression
      console.log("Validation failed - not submitting, errors:", errors);

      // Show a toast to make the error more visible
      toast({
        title: "Validation Error",
        description: "Please correct the errors in the form before continuing.",
        variant: "destructive",
      });
    }
  }, [
    questions,
    validateForm,
    onSubmit,
    errors,
    toast,
    questionRefs,
    setActivePanel,
    setErrors,
  ]);

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

  const togglePanel = useCallback((id: string) => {
    setActivePanel((prev) => (prev === id ? null : id));
  }, []);

  // Updated handleFocus to track user interaction
  const handleFocus = (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement
    >
  ) => {
    handleUserInteractionStart();
    // Move cursor to the end of text on focus if it's an input or textarea
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      const target = e.target;
      const length = target.value.length;

      // Use setTimeout to ensure this happens after the default focus behavior
      setTimeout(() => {
        target.selectionStart = length;
        target.selectionEnd = length;
      }, 0);
    }
  };

  // Add blur handler to track when interaction ends
  const handleBlur = () => {
    handleUserInteractionEnd();
  };

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);
      setIsUploading(true);

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setBulkImportText(content);
        }
        setIsUploading(false);
      };

      reader.onerror = () => {
        setIsUploading(false);
        // Reset file input
        e.target.value = "";
        setFileName(null);
        toast({
          title: "Error",
          description: "Failed to read file. Please try again.",
          variant: "destructive",
        });
      };

      reader.readAsText(file);
    },
    []
  );

  const handleRemoveFile = useCallback(() => {
    setFileName(null);
    setBulkImportText("");
  }, []);

  return {
    questions,
    errors,
    bulkImportOpen,
    bulkImportText,
    activePanel,
    isSaving,
    lastSaved,
    fileName,
    isUploading,
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
    handleBlur,
    handleFileUpload,
    handleRemoveFile,
  };
}

// VIEW with updated styling
function ApplicationQuestionsViewComponent({
  questions,
  errors,
  bulkImportOpen,
  bulkImportText,
  activePanel,
  isSaving,
  lastSaved,
  fileName,
  isUploading,
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
  handleBlur,
  handleFileUpload,
  handleRemoveFile,
  isSubmitting,
}: ApplicationQuestionsViewComponentProps) {
  const [currentFocus, setCurrentFocus] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(
    QUESTION_CATEGORIES[0]
  );
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <TooltipProvider>
      <div className="container max-w-5xl px-4 py-8 mx-auto sm:px-6 lg:px-8">
        <FormErrorBoundary initialErrors={errors}>
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="lg:w-3/4">
              <div className="mb-6">
                <h1 className="mb-2 text-3xl font-bold tracking-tight">
                  Application Questions
                </h1>
                <p className="text-lg text-muted-foreground">
                  Enter the questions from your application to analyze and
                  create your proposal.
                </p>
              </div>

              <Card className="mb-6 border-0 shadow-md">
                <CardHeader className="pb-3 border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">Questions</CardTitle>
                    <div className="flex items-center gap-2">
                      {isSaving ? (
                        <span className="flex items-center text-xs text-muted-foreground">
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Saving...
                        </span>
                      ) : (
                        lastSaved && (
                          <span className="flex items-center text-xs text-muted-foreground">
                            <Check className="w-3 h-3 mr-1 text-green-500" />
                            Saved {lastSaved.toLocaleTimeString()}
                          </span>
                        )
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openBulkImport}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-input bg-background hover:bg-muted"
                      >
                        <Upload className="w-4 h-4" />
                        <span className="hidden sm:inline">
                          Import Questions
                        </span>
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    Add all the questions from your grant or funding application
                    here.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 bg-white">
                  {/* Required fields indicator */}
                  <p className="text-xs text-muted-foreground mb-2">
                    <span className="text-destructive">*</span> Required fields
                  </p>

                  {/* Preserve only submission errors, remove duplicated validation errors */}
                  {errors.submission && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="w-4 h-4" />
                      <AlertTitle>Submission Error</AlertTitle>
                      <AlertDescription>{errors.submission}</AlertDescription>
                    </Alert>
                  )}

                  <AnimatePresence>
                    {questions.map((question, index) => (
                      <motion.div
                        key={question.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className={cn(
                          "group border rounded-md p-5 relative mb-4 transition-all",
                          errors[`question_${question.id}_text`]
                            ? "border-destructive/50"
                            : "border-muted hover:border-muted-foreground/20 hover:shadow-sm"
                        )}
                        data-testid={`question-${index + 1}`}
                        ref={(el: HTMLDivElement | null) => {
                          questionRefs.current[question.id] = el;
                        }}
                      >
                        <div className="flex justify-end mb-2">
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => moveQuestionUp(question.id)}
                              disabled={index === 0}
                              aria-label={`Move question ${index + 1} up`}
                              className="w-8 h-8"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => moveQuestionDown(question.id)}
                              disabled={index === questions.length - 1}
                              aria-label={`Move question ${index + 1} down`}
                              className="w-8 h-8"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeQuestion(question.id)}
                              aria-label={`Remove question ${index + 1}`}
                              className="w-8 h-8 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="mb-5">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <Label
                                htmlFor={`question-${question.id}`}
                                className="flex items-center text-base font-medium"
                              >
                                <span className="inline-flex items-center justify-center w-6 h-6 mr-2 text-sm rounded-full bg-primary/10 text-primary">
                                  {index + 1}
                                </span>
                                Question Text
                                <span className="ml-1 text-destructive">*</span>
                              </Label>
                            </div>
                            {question.category && (
                              <span className="px-2 py-1 text-xs rounded bg-primary/10 text-primary">
                                {question.category}
                              </span>
                            )}
                          </div>
                          <Textarea
                            id={`question-${question.id}`}
                            value={question.text}
                            onChange={(e) =>
                              updateQuestion(question.id, {
                                text: e.target.value,
                              })
                            }
                            placeholder="Enter your question here..."
                            className={cn(
                              "min-h-24 transition-all",
                              errors[`question_${question.id}_text`]
                                ? "border-destructive/70 ring-0 focus-visible:ring-destructive/30"
                                : "border-input"
                            )}
                            aria-invalid={
                              !!errors[`question_${question.id}_text`]
                            }
                            aria-describedby={
                              errors[`question_${question.id}_text`]
                                ? `question-error-${question.id}`
                                : undefined
                            }
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            required
                            name={`question-${question.id}-text`}
                          />
                          {errors[`question_${question.id}_text`] && (
                            <FieldError
                              error={errors[`question_${question.id}_text`]}
                              id={`question-error-${question.id}`}
                            />
                          )}
                        </div>

                        <Collapsible
                          key={question.id}
                          open={activePanel === question.id}
                          onOpenChange={() => togglePanel(question.id)}
                        >
                          <motion.div
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            ref={(el: HTMLDivElement | null) => {
                              questionRefs.current[question.id] = el;
                            }}
                            className="mb-4 overflow-hidden bg-white border rounded-lg shadow-sm"
                          >
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring focus-visible:ring-primary focus-visible:ring-opacity-75">
                              <span>Question Options</span>
                              {activePanel === question.id ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </CollapsibleTrigger>
                            <CollapsibleContent
                              className={cn(
                                "overflow-hidden transition-all",
                                "data-[state=closed]:animate-collapsible-up",
                                "data-[state=open]:animate-collapsible-down"
                              )}
                            >
                              <div className="px-6 pt-4 pb-5 space-y-6">
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                  <div>
                                    <Label
                                      htmlFor={`word-limit-${question.id}`}
                                      className="text-sm flex items-center gap-1 mb-2"
                                    >
                                      Word limit
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent
                                          side="top"
                                          className="p-2 text-sm w-60"
                                        >
                                          <p>
                                            Set a maximum word count for this
                                            question's response.
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
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
                                      onFocus={handleFocus}
                                      onBlur={handleBlur}
                                      className="h-10"
                                    />
                                  </div>
                                  <div>
                                    <Label
                                      htmlFor={`char-limit-${question.id}`}
                                      className="text-sm flex items-center gap-1 mb-2"
                                    >
                                      Character limit
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent
                                          side="top"
                                          className="p-2 text-sm w-60"
                                        >
                                          <p>
                                            Set a maximum character count for
                                            this question's response.
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
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
                                      onFocus={handleFocus}
                                      onBlur={handleBlur}
                                      className="h-10"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <Label
                                    htmlFor={`category-${question.id}`}
                                    className="flex items-center gap-1 mb-2 text-sm"
                                  >
                                    Question category
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="top"
                                        className="p-2 text-sm w-60"
                                      >
                                        <p>
                                          Categorizing questions helps organize
                                          and improve AI-generated responses.
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </Label>
                                  <div className="relative">
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
                                        className="w-full h-10"
                                      >
                                        <SelectValue placeholder="Select a category (optional)" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {QUESTION_CATEGORIES.map((category) => (
                                          <SelectItem
                                            key={category}
                                            value={category}
                                          >
                                            {category}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </motion.div>
                        </Collapsible>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  <Button
                    onClick={addQuestion}
                    variant="outline"
                    className="w-full mt-4 border-dashed"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Another Question
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="lg:w-1/4">
              <div className="sticky space-y-6 top-32">
                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Help & Tips</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <ul className="space-y-2.5">
                      <CheckItem>
                        Add all questions from your original application
                      </CheckItem>
                      <CheckItem>
                        Keep the exact wording from the application
                      </CheckItem>
                      <CheckItem>
                        Use "Bulk Import" to paste multiple questions at once
                      </CheckItem>
                      <CheckItem>
                        Add word limits if specified in the application
                      </CheckItem>
                    </ul>
                  </CardContent>
                </Card>

                <div className="flex flex-col pt-4 space-y-3">
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      handleSubmit();
                    }}
                    size="lg"
                    className="w-full"
                    type="button"
                  >
                    Next
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    size="lg"
                    className="w-full"
                  >
                    Back
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </FormErrorBoundary>

        {/* Bulk Import Dialog */}
        <Dialog open={bulkImportOpen} onOpenChange={closeBulkImport}>
          <DialogContent
            className="sm:max-w-md"
            aria-labelledby="bulk-import-dialog-title"
            aria-describedby="bulk-import-dialog-description"
          >
            <DialogHeader>
              <DialogTitle id="bulk-import-dialog-title">
                Bulk Import Questions
              </DialogTitle>
              <DialogDescription id="bulk-import-dialog-description">
                Paste your questions below, one per line, or upload a text file.
                These will replace your current questions.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <label
                  htmlFor="question-file-upload"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-input bg-background",
                    "hover:bg-muted cursor-pointer"
                  )}
                >
                  <Upload className="w-4 h-4" />
                  Upload Questions File
                </label>
                <input
                  id="question-file-upload"
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  onFocus={handleFocus}
                />

                {fileName && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground truncate max-w-[200px]">
                      {fileName}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRemoveFile}
                      className="w-6 h-6 rounded-full hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remove file"
                      onFocus={handleFocus}
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {isUploading ? (
                <div className="min-h-[250px] border rounded-md p-4 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-pulse">
                      <File className="w-12 h-12 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Processing file...
                    </p>
                  </div>
                </div>
              ) : (
                <Textarea
                  value={bulkImportText}
                  onChange={(e) => updateBulkImportText(e.target.value)}
                  placeholder="What is your organization's mission?&#10;Describe your project goals.&#10;What is your proposed budget?"
                  className="min-h-[250px]"
                  aria-label="Questions"
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeBulkImport}>
                Cancel
              </Button>
              <Button onClick={processBulkImport}>Import Questions</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// COMPONENT
export default function ApplicationQuestionsView(
  props: ApplicationQuestionsViewProps
) {
  const model = useApplicationQuestions(props);
  return <ApplicationQuestionsViewComponent {...props} {...model} />;
}
