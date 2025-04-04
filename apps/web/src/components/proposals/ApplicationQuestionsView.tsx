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
import {
  ApplicationQuestionsSchema,
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
  AlertDialogDescription,
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
  onSubmit: (data: { questions: Question[] }) => void;
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
      setIsSaving(true);
      localStorage.setItem(
        "applicationQuestions",
        JSON.stringify({
          questions: questions.map(({ id, ...rest }) => rest),
        })
      );

      // Simulate a short delay to show the saving indicator
      setTimeout(() => {
        setIsSaving(false);
        setLastSaved(new Date());
      }, 600);
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(saveTimeout);
  }, [questions]);

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
    const newErrors: Record<string, string> = {};
    let isValid = true;

    questions.forEach((q) => {
      if (!q.text.trim()) {
        newErrors[q.id] = "Question text is required";
        isValid = false;
      }
    });

    setErrors(newErrors);

    // If there are errors, schedule scrolling to the first error
    if (!isValid) {
      // Use setTimeout to ensure the DOM has updated with the error messages
      setTimeout(() => {
        const firstErrorId = Object.keys(newErrors)[0];
        if (firstErrorId && questionRefs.current[firstErrorId]) {
          questionRefs.current[firstErrorId]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 100);
    }

    return isValid;
  }, [questions]);

  const handleSubmit = useCallback(() => {
    if (validateForm()) {
      onSubmit({
        questions: questions.map((question) => ({
          id: question.id,
          text: question.text,
          wordLimit: question.wordLimit,
          charLimit: question.charLimit,
          category: question.category,
        })),
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

  const togglePanel = useCallback((id: string) => {
    setActivePanel((prev) => (prev === id ? null : id));
  }, []);

  const handleFocus = useCallback(
    (
      e: React.FocusEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement
      >
    ) => {
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
    },
    []
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

// VIEW
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
  return (
    <TooltipProvider>
      <div className="container max-w-5xl px-4 py-8 mx-auto sm:px-6 lg:px-8">
        {/* Progress steps */}
        <div className="mb-8">
          <div className="relative">
            <div className="flex h-2 mb-6 overflow-hidden text-xs bg-gray-100 rounded">
              <div className="flex flex-col justify-center w-2/3 text-center text-white shadow-none whitespace-nowrap bg-primary"></div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <div className="flex flex-col items-center font-medium text-muted">
                <div className="flex items-center justify-center w-6 h-6 mb-1 bg-muted/30 text-primary border-2 rounded-full border-primary">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span>Funder Details</span>
              </div>
              <div className="flex flex-col items-center font-medium text-primary">
                <div className="flex items-center justify-center w-6 h-6 mb-1 text-white border-2 rounded-full border-primary bg-primary">
                  2
                </div>
                <span>Application Questions</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-6 h-6 mb-1 border-2 border-gray-300 rounded-full">
                  3
                </div>
                <span>Review & Create</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="lg:w-3/4">
            <div className="mb-6">
              <h1 className="mb-2 text-3xl font-bold tracking-tight">
                Application Questions
              </h1>
              <p className="text-lg text-muted-foreground">
                Enter the questions from your application to analyze and create
                your proposal.
              </p>
            </div>

            <Card className="mb-6 border-0 shadow-md">
              <CardHeader className="pb-3 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Questions</CardTitle>
                  <div className="flex items-center gap-2">
                    {isSaving && (
                      <span className="flex items-center text-xs text-muted-foreground animate-pulse">
                        <Save className="w-3 h-3 mr-1" />
                        Saving...
                      </span>
                    )}
                    {!isSaving && lastSaved && (
                      <span className="flex items-center text-xs text-muted-foreground">
                        <Check className="w-3 h-3 mr-1 text-green-500" />
                        Saved {lastSaved.toLocaleTimeString()}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openBulkImport}
                      className="flex items-center gap-1 text-sm"
                    >
                      <Clipboard className="w-4 h-4" />
                      <span className="hidden sm:inline">Bulk Import</span>
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Add all the questions from your grant or funding application
                  here.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 bg-white">
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
                        errors[question.id]
                          ? "border-destructive/50 bg-destructive/5"
                          : "border-muted hover:border-muted-foreground/20 hover:shadow-sm"
                      )}
                      data-testid={`question-${index + 1}`}
                      ref={(el) => {
                        questionRefs.current[question.id] = el;
                      }}
                    >
                      <div className="absolute flex space-x-1 transition-opacity opacity-0 right-3 top-3 group-hover:opacity-100">
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

                      <div className="mb-5">
                        <div className="flex items-center mb-2">
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
                          {question.category && (
                            <span className="px-2 py-1 ml-auto text-xs rounded bg-primary/10 text-primary">
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
                            errors[question.id]
                              ? "border-destructive"
                              : "border-input"
                          )}
                          aria-invalid={!!errors[question.id]}
                          aria-describedby={
                            errors[question.id]
                              ? `question-error-${question.id}`
                              : undefined
                          }
                          onFocus={handleFocus}
                        />
                        {errors[question.id] && (
                          <p
                            id={`question-error-${question.id}`}
                            className="flex items-center mt-1 text-sm text-destructive"
                          >
                            <Info className="w-3 h-3 mr-1" />
                            {errors[question.id]}
                          </p>
                        )}
                      </div>

                      <Collapsible open={activePanel === question.id}>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => togglePanel(question.id)}
                            className={cn(
                              "flex items-center gap-1 px-3 text-sm font-normal w-full justify-between",
                              activePanel === question.id
                                ? "bg-muted/50 text-primary"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                            aria-label={`Options for question ${index + 1}`}
                          >
                            <span>Question Options</span>
                            {activePanel === question.id ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent
                          className={cn(
                            "overflow-hidden transition-all",
                            "data-[state=closed]:animate-collapsible-up",
                            "data-[state=open]:animate-collapsible-down"
                          )}
                        >
                          <div className="pt-4 pb-1 mt-3 space-y-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div>
                                <Label
                                  htmlFor={`word-limit-${question.id}`}
                                  className="text-sm flex items-center gap-1 mb-1.5"
                                >
                                  Word limit
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="top"
                                      className="w-60 text-sm p-2"
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
                                />
                              </div>
                              <div>
                                <Label
                                  htmlFor={`char-limit-${question.id}`}
                                  className="text-sm flex items-center gap-1 mb-1.5"
                                >
                                  Character limit
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="top"
                                      className="w-60 text-sm p-2"
                                    >
                                      <p>
                                        Set a maximum character count for this
                                        question's response.
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
                                />
                              </div>
                            </div>
                            <div className="pt-1 pb-1">
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
                                    className="w-60 text-sm p-2"
                                  >
                                    <p>
                                      Categorizing questions helps organize and
                                      improve AI-generated responses.
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
                                    className="w-full focus:ring-offset-0"
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
                      </Collapsible>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <Button
                  variant="outline"
                  onClick={addQuestion}
                  className="flex items-center w-full gap-2 py-6 mt-2 border-dashed"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Question
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:w-1/4">
            <div className="sticky space-y-6 top-8">
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Help & Tips</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <ul className="space-y-2.5">
                    <CheckItem>
                      Add all questions from your grant application
                    </CheckItem>
                    <CheckItem>
                      For multiple questions, use bulk import
                    </CheckItem>
                    <CheckItem>
                      Add word limits if specified in the application
                    </CheckItem>
                    <CheckItem>
                      Categorize questions to improve generated responses
                    </CheckItem>
                  </ul>
                </CardContent>
              </Card>

              <div className="flex flex-col pt-4 space-y-3">
                <Button onClick={handleSubmit} size="lg" className="w-full">
                  Continue
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

        {/* Bulk Import Dialog */}
        <Dialog open={bulkImportOpen} onOpenChange={closeBulkImport}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Bulk Import Questions</DialogTitle>
              <DialogDescription>
                Paste your questions below, one per line. These will replace
                your current questions.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Textarea
                value={bulkImportText}
                onChange={(e) => updateBulkImportText(e.target.value)}
                placeholder="What is your organization's mission?&#10;Describe your project goals.&#10;What is your proposed budget?"
                className="min-h-[300px]"
                aria-label="Questions"
                onFocus={handleFocus}
              />
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
