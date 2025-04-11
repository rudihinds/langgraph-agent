// "use client";

// /**
//  * @deprecated This file is deprecated in favor of ApplicationQuestionsView.tsx
//  * The validation approach from this file has been merged into the main component.
//  * Please use ApplicationQuestionsView.tsx for all new development.
//  */

// import { useState, useEffect, useCallback, useRef } from "react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea";
// import { Label } from "@/components/ui/label";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from "@/components/ui/dialog";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardFooter,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import {
//   Collapsible,
//   CollapsibleContent,
//   CollapsibleTrigger,
// } from "@/components/ui/collapsible";
// import {
//   ChevronUp,
//   ChevronDown,
//   X,
//   Plus,
//   ChevronRight,
//   Trash,
//   Copy,
//   Settings,
//   ArrowUp,
//   ArrowDown,
//   Check,
//   Clipboard,
//   Save,
//   Info,
//   HelpCircle,
//   CheckCircle2,
//   AlertCircle,
//   Import,
// } from "lucide-react";
// import { cn } from "@/lib/utils";
// import { AnimatePresence, motion } from "framer-motion";
// import { CheckItem } from "@/components/ui/check-item";
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from "@/components/ui/popover";
// import {
//   Tooltip,
//   TooltipContent,
//   TooltipProvider,
//   TooltipTrigger,
// } from "@/components/ui/tooltip";
// import { z } from "zod";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { Badge } from "@/components/ui/badge";
// import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
// import { ProgressCircle } from "@/components/ui/progress-circle";
// import { debounce } from "@/lib/utils";
// import { useToast } from "@/components/ui/use-toast";
// import {
//   AlertDialog,
//   AlertDialogAction,
//   AlertDialogCancel,
//   AlertDialogContent,
//   AlertDialogDescription,
//   AlertDialogFooter,
//   AlertDialogHeader,
//   AlertDialogTitle,
//   AlertDialogTrigger,
// } from "@/components/ui/alert-dialog";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { Separator } from "@/components/ui/separator";
// import { Switch } from "@/components/ui/switch";
// import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
// import { slugify } from "@/lib/utils";
// import { FormErrorBoundary, FieldError } from "@/components/ui/form-error";

// // Define local schema because @proposal-writer/shared isn't available
// export interface SharedQuestion {
//   id: string;
//   text: string;
//   category: string | null;
//   wordLimit: number | null;
//   charLimit: number | null;
// }

// export interface ApplicationQuestions {
//   questions: SharedQuestion[];
// }

// const ApplicationQuestionsSchema = z.object({
//   questions: z
//     .array(
//       z.object({
//         text: z.string().min(1, "Question text is required"),
//         category: z.string().nullable(),
//         wordLimit: z.number().nullable(),
//         charLimit: z.number().nullable(),
//       })
//     )
//     .min(1, "At least one question is required"),
// });

// // MODEL
// // Our internal Question type includes an ID for management purposes
// // but keeps all the fields from the shared Question type
// export interface Question {
//   id: string;
//   text: string;
//   category: string | null;
//   wordLimit: number | null;
//   charLimit: number | null;
// }

// // When submitting, we convert our internal Questions to the shared schema format
// export interface ApplicationQuestionsViewProps {
//   onSubmit: (data: { questions: Omit<Question, "id">[] }) => void;
//   onBack: () => void;
// }

// interface UseApplicationQuestionsModel {
//   questions: Question[];
//   errors: Record<string, string>;
//   bulkImportOpen: boolean;
//   bulkImportText: string;
//   activePanel: string | null;
//   isSaving: boolean;
//   lastSaved: Date | null;
//   addQuestion: () => void;
//   removeQuestion: (id: string) => void;
//   updateQuestion: (id: string, updates: Partial<Omit<Question, "id">>) => void;
//   moveQuestionUp: (id: string) => void;
//   moveQuestionDown: (id: string) => void;
//   handleSubmit: () => void;
//   handleBack: () => void;
//   validateForm: () => boolean;
//   openBulkImport: () => void;
//   closeBulkImport: () => void;
//   updateBulkImportText: (text: string) => void;
//   processBulkImport: () => void;
//   togglePanel: (id: string) => void;
//   questionRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
//   handleFocus: (
//     e: React.FocusEvent<
//       HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement
//     >
//   ) => void;
// }

// const QUESTION_CATEGORIES = [
//   "Organizational Background",
//   "Project Goals",
//   "Implementation Plan",
//   "Budget & Financials",
//   "Evaluation & Impact",
//   "Sustainability",
//   "Other",
// ];

// // Add this at the top level right after all imports
// const KEY_DEBUG = "FORM_DEBUG_" + Math.random().toString(36).substring(2, 9);

// function useApplicationQuestions({
//   onSubmit,
//   onBack,
// }: ApplicationQuestionsViewProps): UseApplicationQuestionsModel {
//   const { toast } = useToast();
//   const [questions, setQuestions] = useState<Question[]>([
//     {
//       id: Date.now().toString(),
//       text: "",
//       wordLimit: null,
//       charLimit: null,
//       category: null,
//     },
//   ]);

//   // Use useRef to track the latest errors for debugging
//   const errorsRef = useRef<Record<string, string>>({});
//   const [errors, setErrors] = useState<Record<string, string>>({});

//   // Enhanced error setter that also updates the ref
//   const setErrorsWithTracking = useCallback(
//     (
//       newErrors:
//         | Record<string, string>
//         | ((prev: Record<string, string>) => Record<string, string>)
//     ) => {
//       if (typeof newErrors === "function") {
//         setErrors((prev) => {
//           const result = newErrors(prev);
//           // Log the update
//           console.log(`🔥 setErrorsWithTracking (function)`, {
//             prev: JSON.stringify(prev),
//             result: JSON.stringify(result),
//           });
//           // Store in ref
//           errorsRef.current = result;
//           // Force debug key in window to allow browser inspection
//           try {
//             (window as any)[KEY_DEBUG] = { errors: result };
//           } catch (e) {}
//           return result;
//         });
//       } else {
//         // Log the direct update
//         console.log(`🔥 setErrorsWithTracking (direct)`, {
//           current: JSON.stringify(errors),
//           new: JSON.stringify(newErrors),
//         });
//         // Store in ref
//         errorsRef.current = newErrors;
//         // Set in state
//         setErrors(newErrors);
//         // Force debug key in window to allow browser inspection
//         try {
//           (window as any)[KEY_DEBUG] = { errors: newErrors };
//         } catch (e) {}
//       }
//     },
//     [errors]
//   );

//   const [bulkImportOpen, setBulkImportOpen] = useState(false);
//   const [bulkImportText, setBulkImportText] = useState("");
//   const [activePanel, setActivePanel] = useState<string | null>(null);
//   const [isSaving, setIsSaving] = useState(false);
//   const [lastSaved, setLastSaved] = useState<Date | null>(null);
//   const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

//   // Load saved questions from localStorage on mount
//   useEffect(() => {
//     const savedQuestions = localStorage.getItem("applicationQuestions");
//     if (savedQuestions) {
//       try {
//         const { questions: savedQuestionData } = JSON.parse(savedQuestions);
//         if (Array.isArray(savedQuestionData) && savedQuestionData.length > 0) {
//           // Add IDs to saved questions if needed
//           const questionsWithIds = savedQuestionData.map((q: any) => ({
//             ...q,
//             id:
//               q.id ||
//               Date.now().toString() +
//                 Math.random().toString(36).substring(2, 9),
//           }));
//           setQuestions(questionsWithIds);
//         }
//       } catch (e) {
//         console.error("Failed to parse saved questions:", e);
//       }
//     }
//   }, []);

//   // Auto-save questions to localStorage when they change
//   useEffect(() => {
//     const saveTimeout = setTimeout(() => {
//       if (questions.length > 0) {
//         setIsSaving(true);

//         // Strip IDs before saving for compatibility with the shared schema
//         const questionsToSave = {
//           questions,
//         };

//         localStorage.setItem(
//           "applicationQuestions",
//           JSON.stringify(questionsToSave)
//         );

//         setTimeout(() => {
//           setIsSaving(false);
//           setLastSaved(new Date());
//         }, 600);
//       }
//     }, 1000);

//     return () => clearTimeout(saveTimeout);
//   }, [questions]);

//   const validateForm = useCallback(() => {
//     console.log("🔍 validateForm called - Validating questions:", questions);
//     try {
//       // Validate the questions
//       const validationSchema = z.object({
//         questions: z
//           .array(
//             z.object({
//               id: z.string(),
//               text: z.string().min(1, "Question text is required"),
//               category: z.string().nullable(),
//               wordLimit: z.number().nullable().optional(),
//               charLimit: z.number().nullable().optional(),
//             })
//           )
//           .min(1, "At least one question is required"),
//       });

//       console.log("🔍 Running schema validation on:", { questions });
//       validationSchema.parse({ questions });

//       console.log("✅ Validation succeeded - no errors found");
//       setErrorsWithTracking({});
//       return true;
//     } catch (error) {
//       console.error("❌ Validation failed:", error);

//       if (error instanceof z.ZodError) {
//         console.log(
//           "🔍 ZodError details:",
//           JSON.stringify(error.errors, null, 2)
//         );
//         const newErrors: Record<string, string> = {};

//         // Add field-level errors
//         error.errors.forEach((err) => {
//           console.log("🔍 Processing error:", err);
//           if (err.path[0] === "questions") {
//             if (err.path.length > 1) {
//               // This is a specific question error
//               const index = err.path[1] as number;
//               const field = err.path[2] as string;
//               const questionId = questions[index]?.id;

//               console.log("🔍 Field error:", { index, field, questionId });

//               if (questionId) {
//                 const errorKey = `question_${questionId}_${field}`;
//                 newErrors[errorKey] = err.message;
//                 console.log(`🔍 Added error for ${errorKey}:`, err.message);

//                 // Focus the question with error
//                 setTimeout(() => {
//                   console.log("🔍 Attempting to focus question:", questionId);
//                   const questionEl = questionRefs.current[questionId];
//                   if (questionEl) {
//                     console.log(
//                       "🔍 Question element found, scrolling into view"
//                     );
//                     questionEl.scrollIntoView({
//                       behavior: "smooth",
//                       block: "center",
//                     });
//                     setActivePanel(questionId);
//                     console.log("🔍 Set active panel to:", questionId);
//                   } else {
//                     console.log("❌ Question element not found in refs");
//                   }
//                 }, 100);
//               }
//             } else {
//               // General questions array error
//               newErrors._form = err.message;
//               console.log("🔍 Added form-level error:", err.message);
//             }
//           }
//         });

//         // Add a generic _form error to ensure it's displayed by FormErrorBoundary
//         if (!newErrors._form && Object.keys(newErrors).length > 0) {
//           newErrors._form =
//             "Please correct the errors in the form before continuing.";
//           console.log("🔍 Added generic form error message");
//         }

//         console.log("🔍 Setting errors state with:", newErrors);
//         setErrorsWithTracking(newErrors);

//         // Show a toast to make the error more visible
//         console.log("🔍 Showing toast notification");
//         toast({
//           title: "Validation Error",
//           description:
//             "Please correct the errors in the form before continuing.",
//           variant: "destructive",
//         });
//       }

//       return false;
//     }
//   }, [questions, toast, questionRefs, setActivePanel]);

//   const addQuestion = useCallback(() => {
//     setQuestions((prev) => [
//       ...prev,
//       {
//         id: Date.now().toString(),
//         text: "",
//         wordLimit: null,
//         charLimit: null,
//         category: null,
//       },
//     ]);
//   }, []);

//   const removeQuestion = useCallback((id: string) => {
//     setQuestions((prev) => prev.filter((q) => q.id !== id));
//   }, []);

//   const updateQuestion = useCallback(
//     (id: string, updates: Partial<Omit<Question, "id">>) => {
//       setQuestions((prev) =>
//         prev.map((q) => (q.id === id ? { ...q, ...updates } : q))
//       );
//     },
//     []
//   );

//   const moveQuestionUp = useCallback((id: string) => {
//     setQuestions((prev) => {
//       const index = prev.findIndex((q) => q.id === id);
//       if (index <= 0) return prev;

//       const newArray = [...prev];
//       [newArray[index - 1], newArray[index]] = [
//         newArray[index],
//         newArray[index - 1],
//       ];
//       return newArray;
//     });
//   }, []);

//   const moveQuestionDown = useCallback((id: string) => {
//     setQuestions((prev) => {
//       const index = prev.findIndex((q) => q.id === id);
//       if (index < 0 || index >= prev.length - 1) return prev;

//       const newArray = [...prev];
//       [newArray[index], newArray[index + 1]] = [
//         newArray[index + 1],
//         newArray[index],
//       ];
//       return newArray;
//     });
//   }, []);

//   const handleSubmit = useCallback(() => {
//     console.log("🔥 DIRECT: handleSubmit called");

//     // Check for empty questions using the most direct approach
//     const emptyQuestions = questions.filter((q) => !q.text.trim());
//     console.log(`🔥 DIRECT: Found ${emptyQuestions.length} empty questions`);

//     // ALWAYS force validation in debug mode
//     const debugMode = true; // Set to false in production

//     if (emptyQuestions.length > 0 || debugMode) {
//       console.log("🔥 DIRECT: Preparing validation errors");

//       // Create a new error object
//       const newErrors: Record<string, string> = {};

//       // Add error for each empty question
//       emptyQuestions.forEach((q) => {
//         const errorKey = `question_${q.id}_text`;
//         newErrors[errorKey] = "Question text is required";
//         console.log(`🔥 DIRECT: Added error for ${errorKey}`);
//       });

//       // In debug mode, add a test error even if there are no empty questions
//       if (debugMode && emptyQuestions.length === 0) {
//         // Add at least one test error
//         if (questions.length > 0) {
//           const firstQuestion = questions[0];
//           newErrors[`question_${firstQuestion.id}_text`] =
//             "DEBUG TEST: Validation error";
//           console.log(`🔥 DIRECT: Added debug test error for first question`);
//         }
//       }

//       // Always add form-level error
//       newErrors._form =
//         emptyQuestions.length > 0
//           ? "Please fill out all question fields before continuing"
//           : "DEBUG MODE: Test validation error";

//       console.log("🔥 DIRECT: Setting errors:", JSON.stringify(newErrors));

//       // CRITICAL: Use the most direct setter approach
//       setErrorsWithTracking((prev) => {
//         // Store to global for debugging
//         try {
//           (window as any)["__DEBUG_ERRORS__"] = newErrors;
//           console.log("🔥 DIRECT: Saved to window.__DEBUG_ERRORS__");
//         } catch (e) {}

//         // Log the update for debugging
//         console.log("🔥 DIRECT: Error update", {
//           prev: JSON.stringify(prev),
//           new: JSON.stringify(newErrors),
//         });

//         return newErrors;
//       });

//       // Force a check after setting
//       setTimeout(() => {
//         console.log("🔥 DIRECT: Errors after timeout:", {
//           errors: JSON.stringify(errors),
//           windowDebug:
//             typeof window !== "undefined"
//               ? (window as any)["__DEBUG_ERRORS__"]
//               : null,
//         });
//       }, 100);

//       // Show toast notification
//       toast({
//         title:
//           emptyQuestions.length > 0 ? "Validation Error" : "Debug Validation",
//         description: newErrors._form,
//         variant: "destructive",
//       });

//       return;
//     }

//     // Normal submission flow if validation passes
//     console.log("🔥 DIRECT: Validation passed, running full form check");
//     if (validateForm()) {
//       console.log("🔥 DIRECT: Form is valid, submitting");
//       // Submit the form
//       onSubmit({
//         questions: questions.map(({ id, ...rest }) => rest),
//       });
//     }
//   }, [
//     questions,
//     validateForm,
//     onSubmit,
//     errors,
//     toast,
//     questionRefs,
//     setErrorsWithTracking,
//     setActivePanel,
//   ]);

//   const handleBack = useCallback(() => {
//     onBack();
//   }, [onBack]);

//   const openBulkImport = useCallback(() => {
//     setBulkImportOpen(true);
//   }, []);

//   const closeBulkImport = useCallback(() => {
//     setBulkImportOpen(false);
//     setBulkImportText("");
//   }, []);

//   const updateBulkImportText = useCallback((text: string) => {
//     setBulkImportText(text);
//   }, []);

//   const processBulkImport = useCallback(() => {
//     if (!bulkImportText.trim()) return;

//     const lines = bulkImportText
//       .split("\n")
//       .map((line) => line.trim())
//       .filter(Boolean);

//     if (lines.length === 0) return;

//     // Create question objects from each line
//     const newQuestions = lines.map((text) => ({
//       id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
//       text,
//       wordLimit: null,
//       charLimit: null,
//       category: null,
//     }));

//     setQuestions((prev) => [...prev, ...newQuestions]);
//     closeBulkImport();

//     toast({
//       title: "Questions imported",
//       description: `${newQuestions.length} question${
//         newQuestions.length === 1 ? "" : "s"
//       } added.`,
//     });
//   }, [bulkImportText, closeBulkImport, toast]);

//   const togglePanel = useCallback((id: string) => {
//     setActivePanel((prev) => (prev === id ? null : id));
//   }, []);

//   const handleFocus = useCallback(
//     (
//       e: React.FocusEvent<
//         HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement
//       >
//     ) => {
//       // Get the field name from the ID or name attribute
//       const fieldId = e.target.id || e.target.name;

//       if (fieldId && errors) {
//         // Clear error for this specific field
//         const errorKey = Object.keys(errors).find(
//           (key) => key === fieldId || key.includes(fieldId)
//         );
//         if (errorKey) {
//           setErrorsWithTracking((prev) => {
//             const newErrors = { ...prev };
//             delete newErrors[errorKey];

//             // If this was the last field error, also clear the _form error
//             if (
//               Object.keys(newErrors).filter((k) => k !== "_form").length === 0
//             ) {
//               delete newErrors._form;
//             }

//             return newErrors;
//           });
//         }
//       }
//     },
//     [errors, setErrorsWithTracking]
//   );

//   // Add logging to track error state changes
//   useEffect(() => {
//     console.log("🔄 Errors state changed:", errors);
//   }, [errors]);

//   return {
//     questions,
//     errors,
//     bulkImportOpen,
//     bulkImportText,
//     activePanel,
//     isSaving,
//     lastSaved,
//     addQuestion,
//     removeQuestion,
//     updateQuestion,
//     moveQuestionUp,
//     moveQuestionDown,
//     handleSubmit,
//     handleBack,
//     validateForm,
//     openBulkImport,
//     closeBulkImport,
//     updateBulkImportText,
//     processBulkImport,
//     togglePanel,
//     questionRefs,
//     handleFocus,
//   };
// }

// interface ApplicationQuestionsViewComponentProps
//   extends ApplicationQuestionsViewProps {
//   questions: Question[];
//   errors: Record<string, string>;
//   bulkImportOpen: boolean;
//   bulkImportText: string;
//   activePanel: string | null;
//   isSaving: boolean;
//   lastSaved: Date | null;
//   addQuestion: () => void;
//   removeQuestion: (id: string) => void;
//   updateQuestion: (id: string, updates: Partial<Omit<Question, "id">>) => void;
//   moveQuestionUp: (id: string) => void;
//   moveQuestionDown: (id: string) => void;
//   handleSubmit: () => void;
//   handleBack: () => void;
//   openBulkImport: () => void;
//   closeBulkImport: () => void;
//   updateBulkImportText: (text: string) => void;
//   processBulkImport: () => void;
//   togglePanel: (id: string) => void;
//   questionRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
//   handleFocus: (
//     e: React.FocusEvent<
//       HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement
//     >
//   ) => void;
// }

// function ApplicationQuestionsViewComponent({
//   questions,
//   errors,
//   bulkImportOpen,
//   bulkImportText,
//   activePanel,
//   isSaving,
//   lastSaved,
//   addQuestion,
//   removeQuestion,
//   updateQuestion,
//   moveQuestionUp,
//   moveQuestionDown,
//   handleSubmit,
//   handleBack,
//   openBulkImport,
//   closeBulkImport,
//   updateBulkImportText,
//   processBulkImport,
//   togglePanel,
//   questionRefs,
//   handleFocus,
// }: ApplicationQuestionsViewComponentProps) {
//   console.log("🚨 RENDER: ApplicationQuestionsViewComponent rendering");
//   console.log("🚨 RENDER: Errors state:", JSON.stringify(errors));
//   console.log("🚨 RENDER: Errors keys:", Object.keys(errors));
//   console.log("🚨 RENDER: Has form error:", !!errors._form);

//   // Calculate completion percentage
//   const completedQuestions = questions.filter((q) => q.text.trim().length > 0);
//   const completionPercentage =
//     questions.length > 0
//       ? Math.round((completedQuestions.length / questions.length) * 100)
//       : 0;

//   return (
//     <TooltipProvider>
//       {/* EMERGENCY TEST VALIDATION PANEL - ALWAYS VISIBLE FOR DEBUGGING */}
//       <div className="p-4 mb-6 border-2 border-yellow-500 rounded-md shadow-md bg-yellow-50">
//         <h3 className="mb-2 text-lg font-bold text-yellow-800">Debug Tools</h3>
//         <div className="flex flex-wrap gap-2 mb-2">
//           <Button
//             variant="destructive"
//             size="sm"
//             onClick={() => {
//               console.log("🔥 FORCE TEST: Adding test validation errors");

//               // Direct error injection - bypassing normal state flow
//               // Create test errors
//               const testErrors = {
//                 _form:
//                   "TEST VALIDATION ERROR - These are test errors to verify display",
//                 question_1_text: "Question 1 text is required",
//                 question_2_category: "Question 2 must have a category",
//               };

//               // Force set errors using multiple approaches
//               // 1. Direct component errors state update
//               setErrorsWithTracking(testErrors);

//               // 2. Store in global variable for inspection
//               try {
//                 (window as any)["__DEBUG_ERRORS__"] = testErrors;
//               } catch (e) {}

//               // 3. Force render with timeout
//               setTimeout(() => {
//                 console.log("🔥 FORCE TEST: Post-timeout error check:", errors);
//               }, 100);

//               // Show toast for visibility
//               toast({
//                 title: "Test Validation Errors Added",
//                 description: "Check console for details",
//                 variant: "destructive",
//               });
//             }}
//           >
//             Force Test Validation
//           </Button>

//           <Button
//             variant="outline"
//             size="sm"
//             onClick={() => {
//               console.log("🔥 FORCE TEST: Clearing errors");
//               setErrorsWithTracking({});
//               toast({
//                 title: "Errors Cleared",
//                 description: "All validation errors have been cleared",
//               });
//             }}
//           >
//             Clear Errors
//           </Button>

//           <Button
//             variant="secondary"
//             size="sm"
//             onClick={() => {
//               console.log("🔥 FORCE TEST: Current state", {
//                 errors,
//                 questions,
//                 activePanel,
//               });
//               toast({
//                 title: "State Logged",
//                 description: "Check console for current state",
//               });
//             }}
//           >
//             Log State
//           </Button>
//         </div>

//         {/* FORCE DISPLAY current error state regardless of FormErrorBoundary */}
//         {Object.keys(errors).length > 0 && (
//           <div className="p-3 mt-2 bg-white border border-yellow-300 rounded">
//             <h4 className="mb-1 font-semibold text-red-600">Current Errors:</h4>
//             <pre className="overflow-auto text-xs max-h-32">
//               {JSON.stringify(errors, null, 2)}
//             </pre>
//           </div>
//         )}
//       </div>

//       <div className="pb-10 space-y-8">
//         {/* Direct error display outside FormErrorBoundary - make it more visible */}
//         {errors._form && (
//           <Alert
//             variant="destructive"
//             className="mb-6 border-2 shadow-sm border-destructive bg-destructive/5"
//           >
//             <div className="flex items-start gap-2">
//               <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-destructive" />
//               <div className="flex-1">
//                 <div className="mb-1 font-medium text-destructive">
//                   {errors._form}
//                 </div>
//                 {Object.keys(errors).filter((key) => key !== "_form").length >
//                   0 && (
//                   <ul className="list-disc pl-5 text-sm space-y-0.5 text-destructive/90">
//                     {Object.entries(errors)
//                       .filter(
//                         ([key]) => key !== "_form" && key !== "submission"
//                       )
//                       .slice(0, 5) // Show more errors for clarity
//                       .map(([field, message]) => {
//                         // Extract a more readable field name from the error key
//                         let readableField = field;
//                         const match = field.match(/question_(\w+)_(\w+)/);
//                         if (match) {
//                           const questionId = match[1];
//                           const fieldType = match[2];
//                           const questionIndex = questions.findIndex(
//                             (q) => q.id === questionId
//                           );
//                           if (questionIndex !== -1) {
//                             readableField = `Question ${questionIndex + 1} ${fieldType}`;
//                           }
//                         }

//                         return (
//                           <li key={field} className="text-xs">
//                             <span className="font-medium">
//                               {readableField}:
//                             </span>{" "}
//                             {message}
//                           </li>
//                         );
//                       })}
//                     {Object.keys(errors).filter(
//                       (key) => key !== "_form" && key !== "submission"
//                     ).length > 5 && (
//                       <li className="text-xs">
//                         ...and{" "}
//                         {Object.keys(errors).filter(
//                           (key) => key !== "_form" && key !== "submission"
//                         ).length - 5}{" "}
//                         more errors
//                       </li>
//                     )}
//                   </ul>
//                 )}

//                 <div className="mt-2">
//                   <Button
//                     variant="secondary"
//                     size="sm"
//                     className="bg-background hover:bg-background/80 border-border text-foreground"
//                     onClick={() => setErrorsWithTracking({})}
//                   >
//                     <X className="w-3 h-3 mr-1" />
//                     Dismiss Errors
//                   </Button>
//                 </div>
//               </div>
//             </div>
//           </Alert>
//         )}

//         {/* Debug display of errors (REMOVE IN PRODUCTION) */}
//         {Object.keys(errors).length > 0 && (
//           <div className="p-4 mb-4 border border-yellow-200 rounded-md bg-yellow-50">
//             <h3 className="mb-2 font-medium text-yellow-800">
//               Debug: Current Errors
//             </h3>
//             <pre className="p-2 overflow-auto text-xs bg-white border rounded max-h-32">
//               {JSON.stringify(errors, null, 2)}
//             </pre>
//           </div>
//         )}

//         {/* Now wrap everything in FormErrorBoundary without a key */}
//         <FormErrorBoundary initialErrors={errors}>
//           {console.log(
//             "🚨 RENDER: Passed to FormErrorBoundary:",
//             JSON.stringify(errors)
//           )}

//           <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
//             <div>
//               <h1 className="text-2xl font-bold tracking-tight">
//                 Application Questions
//               </h1>
//               <p className="text-muted-foreground">
//                 Add the questions from the grant application
//               </p>
//             </div>

//             <div className="flex items-center gap-2">
//               <Tooltip>
//                 <TooltipTrigger asChild>
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={handleBack}
//                     type="button"
//                   >
//                     Back
//                   </Button>
//                 </TooltipTrigger>
//                 <TooltipContent>Return to the previous step</TooltipContent>
//               </Tooltip>

//               <Button
//                 onClick={(e) => {
//                   console.log("🚨 CLICK: Next button clicked");
//                   console.log(
//                     "🚨 CLICK: Current errors before submit:",
//                     JSON.stringify(errors)
//                   );
//                   e.preventDefault();

//                   // Store debug info for detecting clicks
//                   try {
//                     (window as any)["__DEBUG_CLICK_INFO__"] = {
//                       timestamp: new Date().toISOString(),
//                       questionsCount: questions.length,
//                       emptyQuestionsCount: questions.filter(
//                         (q) => !q.text.trim()
//                       ).length,
//                       hasErrors: Object.keys(errors).length > 0,
//                       errorKeys: Object.keys(errors),
//                     };
//                     console.log(
//                       "🚨 CLICK: Stored click debug info in window.__DEBUG_CLICK_INFO__"
//                     );
//                   } catch (e) {}

//                   handleSubmit();

//                   // Check errors after submit
//                   setTimeout(() => {
//                     console.log(
//                       "🚨 CLICK: Errors after submit (timeout):",
//                       JSON.stringify(errors)
//                     );

//                     // Update click debug info post-submit
//                     try {
//                       const debugInfo =
//                         (window as any)["__DEBUG_CLICK_INFO__"] || {};
//                       debugInfo.afterSubmitTimestamp = new Date().toISOString();
//                       debugInfo.afterSubmitErrors = JSON.stringify(errors);
//                       debugInfo.afterSubmitErrorCount =
//                         Object.keys(errors).length;
//                       console.log(
//                         "🚨 CLICK: Updated debug info post-submit",
//                         debugInfo
//                       );
//                     } catch (e) {}
//                   }, 0);
//                 }}
//                 size="lg"
//                 className="w-full"
//                 type="button"
//                 data-testid="next-button"
//               >
//                 Next
//               </Button>
//             </div>
//           </div>

//           {/* Auto-save indicator */}
//           <div className="flex items-center justify-between">
//             <div className="flex items-center gap-4">
//               <ProgressCircle
//                 value={completionPercentage}
//                 size="sm"
//                 showValue={false}
//               />
//               <div>
//                 <div className="text-sm font-medium">
//                   {questions.length}{" "}
//                   {questions.length === 1 ? "question" : "questions"} added
//                 </div>
//                 <div className="text-xs text-muted-foreground">
//                   {completionPercentage}% complete
//                 </div>
//               </div>
//             </div>

//             <div className="flex items-center space-x-4">
//               {isSaving ? (
//                 <span className="text-xs text-muted-foreground">Saving...</span>
//               ) : lastSaved ? (
//                 <span className="text-xs text-muted-foreground">
//                   Last saved:{" "}
//                   {lastSaved.toLocaleTimeString([], {
//                     hour: "2-digit",
//                     minute: "2-digit",
//                   })}
//                 </span>
//               ) : null}
//             </div>
//           </div>

//           {errors.questions && (
//             <Alert variant="destructive">
//               <AlertCircle className="w-4 h-4" />
//               <AlertTitle>Error</AlertTitle>
//               <AlertDescription>{errors.questions}</AlertDescription>
//             </Alert>
//           )}

//           {/* Empty state */}
//           {questions.length === 0 ? (
//             <Card className="border-dashed">
//               <CardContent className="pt-6 text-center">
//                 <Info className="w-10 h-10 mx-auto text-muted-foreground" />
//                 <h3 className="mt-3 text-lg font-medium">No questions added</h3>
//                 <p className="mt-1 text-sm text-muted-foreground">
//                   Start by adding questions from the grant application.
//                 </p>
//                 <Button onClick={addQuestion} className="mt-4">
//                   <Plus className="w-4 h-4 mr-2" />
//                   Add First Question
//                 </Button>
//               </CardContent>
//             </Card>
//           ) : (
//             <div className="space-y-4">
//               {questions.map((question, index) => {
//                 console.log(`🎨 Rendering question ${index}:`, {
//                   id: question.id,
//                   isActive: activePanel === question.id,
//                   hasError: !!errors[`question_${question.id}_text`],
//                 });

//                 return (
//                   <Collapsible
//                     key={question.id}
//                     open={activePanel === question.id}
//                     onOpenChange={() => togglePanel(question.id)}
//                     className={cn(
//                       "rounded-lg border bg-card text-card-foreground shadow-sm",
//                       errors[`question_${question.id}_text`] &&
//                         "border-destructive/70"
//                     )}
//                   >
//                     <div
//                       ref={(el) => {
//                         if (el) {
//                           questionRefs.current[question.id] = el;
//                           console.log(`🎨 Ref set for question ${question.id}`);
//                         }
//                       }}
//                       className="p-4"
//                     >
//                       <div className="flex items-center justify-between">
//                         <div className="flex items-center gap-2">
//                           <div className="flex items-center justify-center w-6 h-6 text-xs font-medium border rounded-full">
//                             {index + 1}
//                           </div>
//                           <h3 className="font-medium">
//                             {question.text
//                               ? question.text.length > 40
//                                 ? question.text.substring(0, 40) + "..."
//                                 : question.text
//                               : `Question ${index + 1}`}
//                           </h3>
//                           {question.category && (
//                             <Badge variant="outline">{question.category}</Badge>
//                           )}
//                         </div>
//                         <div className="flex items-center gap-1">
//                           <Button
//                             variant="ghost"
//                             size="icon"
//                             onClick={() => moveQuestionUp(question.id)}
//                             disabled={index === 0}
//                             className="w-8 h-8"
//                           >
//                             <ArrowUp className="w-4 h-4" />
//                             <span className="sr-only">Move up</span>
//                           </Button>
//                           <Button
//                             variant="ghost"
//                             size="icon"
//                             onClick={() => moveQuestionDown(question.id)}
//                             disabled={index === questions.length - 1}
//                             className="w-8 h-8"
//                           >
//                             <ArrowDown className="w-4 h-4" />
//                             <span className="sr-only">Move down</span>
//                           </Button>
//                           <Button
//                             variant="ghost"
//                             size="icon"
//                             onClick={() => removeQuestion(question.id)}
//                             className="w-8 h-8 text-destructive"
//                           >
//                             <Trash className="w-4 h-4" />
//                             <span className="sr-only">Remove</span>
//                           </Button>
//                           <CollapsibleTrigger asChild>
//                             <Button
//                               variant="ghost"
//                               size="icon"
//                               className="w-8 h-8"
//                             >
//                               {activePanel === question.id ? (
//                                 <ChevronUp className="w-4 h-4" />
//                               ) : (
//                                 <ChevronDown className="w-4 h-4" />
//                               )}
//                             </Button>
//                           </CollapsibleTrigger>
//                         </div>
//                       </div>

//                       <CollapsibleContent className="pt-4">
//                         <div className="space-y-4">
//                           <div className="space-y-2">
//                             <Label
//                               htmlFor={`question_${question.id}_text`}
//                               className={cn(
//                                 errors[`question_${question.id}_text`] &&
//                                   "text-destructive"
//                               )}
//                             >
//                               Question Text
//                               <span className="text-destructive">*</span>
//                             </Label>
//                             <Textarea
//                               id={`question_${question.id}_text`}
//                               name={`question_${question.id}_text`}
//                               value={question.text || ""}
//                               onChange={(e) =>
//                                 updateQuestion(question.id, {
//                                   text: e.target.value,
//                                 })
//                               }
//                               onFocus={(e) => {
//                                 console.log(
//                                   `🎨 Text field focused for question ${question.id}`
//                                 );
//                                 handleFocus(e);
//                               }}
//                               className={cn(
//                                 "min-h-[100px]",
//                                 errors[`question_${question.id}_text`] &&
//                                   "border-destructive/70 ring-0 focus-visible:ring-destructive/30"
//                               )}
//                               placeholder="Enter the question text from the application form"
//                             />
//                             {console.log(
//                               `🎨 Error for question ${question.id}:`,
//                               errors[`question_${question.id}_text`]
//                             )}
//                             {errors[`question_${question.id}_text`] && (
//                               <FieldError
//                                 error={errors[`question_${question.id}_text`]}
//                                 id={`question_${question.id}_text_error`}
//                               />
//                             )}
//                           </div>

//                           <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
//                             <div className="space-y-2">
//                               <Label
//                                 htmlFor={`question_${question.id}_category`}
//                               >
//                                 Category (Optional)
//                               </Label>
//                               <Select
//                                 value={question.category || ""}
//                                 onValueChange={(value) =>
//                                   updateQuestion(question.id, {
//                                     category: value || null,
//                                   })
//                                 }
//                               >
//                                 <SelectTrigger
//                                   id={`question_${question.id}_category`}
//                                   className={cn(
//                                     errors[
//                                       `question_${question.id}_category`
//                                     ] &&
//                                       "border-destructive/70 ring-0 focus-visible:ring-destructive/30"
//                                   )}
//                                 >
//                                   <SelectValue placeholder="Select category" />
//                                 </SelectTrigger>
//                                 <SelectContent>
//                                   <SelectItem value="">None</SelectItem>
//                                   {QUESTION_CATEGORIES.map((category) => (
//                                     <SelectItem key={category} value={category}>
//                                       {category}
//                                     </SelectItem>
//                                   ))}
//                                 </SelectContent>
//                               </Select>
//                               {errors[`question_${question.id}_category`] && (
//                                 <FieldError
//                                   error={
//                                     errors[`question_${question.id}_category`]
//                                   }
//                                   id={`question_${question.id}_category_error`}
//                                 />
//                               )}
//                             </div>
//                             <div className="space-y-2">
//                               <Label
//                                 htmlFor={`question_${question.id}_wordLimit`}
//                               >
//                                 Word Limit (Optional)
//                               </Label>
//                               <Input
//                                 id={`question_${question.id}_wordLimit`}
//                                 type="number"
//                                 min="0"
//                                 value={question.wordLimit || ""}
//                                 onChange={(e) =>
//                                   updateQuestion(question.id, {
//                                     wordLimit: e.target.value
//                                       ? parseInt(e.target.value)
//                                       : null,
//                                   })
//                                 }
//                                 onFocus={handleFocus}
//                                 className={cn(
//                                   errors[`question_${question.id}_wordLimit`] &&
//                                     "border-destructive/70 ring-0 focus-visible:ring-destructive/30"
//                                 )}
//                                 placeholder="e.g., 500"
//                               />
//                               {errors[`question_${question.id}_wordLimit`] && (
//                                 <FieldError
//                                   error={
//                                     errors[`question_${question.id}_wordLimit`]
//                                   }
//                                   id={`question_${question.id}_wordLimit_error`}
//                                 />
//                               )}
//                             </div>
//                             <div className="space-y-2">
//                               <Label
//                                 htmlFor={`question_${question.id}_charLimit`}
//                               >
//                                 Character Limit (Optional)
//                               </Label>
//                               <Input
//                                 id={`question_${question.id}_charLimit`}
//                                 type="number"
//                                 min="0"
//                                 value={question.charLimit || ""}
//                                 onChange={(e) =>
//                                   updateQuestion(question.id, {
//                                     charLimit: e.target.value
//                                       ? parseInt(e.target.value)
//                                       : null,
//                                   })
//                                 }
//                                 onFocus={handleFocus}
//                                 className={cn(
//                                   errors[`question_${question.id}_charLimit`] &&
//                                     "border-destructive/70 ring-0 focus-visible:ring-destructive/30"
//                                 )}
//                                 placeholder="e.g., 2000"
//                               />
//                               {errors[`question_${question.id}_charLimit`] && (
//                                 <FieldError
//                                   error={
//                                     errors[`question_${question.id}_charLimit`]
//                                   }
//                                   id={`question_${question.id}_charLimit_error`}
//                                 />
//                               )}
//                             </div>
//                           </div>
//                         </div>
//                       </CollapsibleContent>
//                     </div>
//                   </Collapsible>
//                 );
//               })}

//               <div className="flex justify-center pt-2">
//                 <Button
//                   variant="outline"
//                   onClick={addQuestion}
//                   className="w-full max-w-md"
//                 >
//                   <Plus className="w-4 h-4 mr-2" />
//                   Add Another Question
//                 </Button>
//               </div>
//             </div>
//           )}

//           <div className="flex justify-end space-x-2">
//             <Button
//               variant="outline"
//               onClick={openBulkImport}
//               className="mr-auto"
//               type="button"
//             >
//               <Import className="w-4 h-4 mr-2" />
//               Bulk Import
//             </Button>
//             <Button variant="outline" onClick={handleBack} type="button">
//               Back
//             </Button>
//             <Button
//               onClick={(e) => {
//                 e.preventDefault();
//                 handleSubmit();
//               }}
//               size="lg"
//               className="w-full"
//               type="button"
//             >
//               Next
//             </Button>
//           </div>

//           {/* Test button for debugging validation */}
//           <div className="pt-4 mt-4 border-t">
//             <p className="mb-2 text-xs text-muted-foreground">Debug Tools</p>
//             <div className="flex gap-2">
//               <Button
//                 variant="outline"
//                 size="sm"
//                 onClick={() => {
//                   console.log("🐞 Test validation button clicked");

//                   // Create a complete test case with multiple errors
//                   const testErrors: Record<string, string> = {
//                     _form:
//                       "Please correct the following validation errors before continuing",
//                   };

//                   // Add specific errors for questions
//                   if (questions.length > 0) {
//                     // Error for first question
//                     const firstQuestionId = questions[0].id;
//                     testErrors[`question_${firstQuestionId}_text`] =
//                       "Question text cannot be empty";

//                     // If we have multiple questions, add more errors
//                     if (questions.length > 1) {
//                       const secondQuestionId = questions[1].id;
//                       testErrors[`question_${secondQuestionId}_category`] =
//                         "Please select a category";

//                       if (questions.length > 2) {
//                         const thirdQuestionId = questions[2].id;
//                         testErrors[`question_${thirdQuestionId}_wordLimit`] =
//                           "Word limit must be a positive number";
//                       }
//                     }

//                     // Open the panel for the first question
//                     setActivePanel(firstQuestionId);

//                     // Focus the first question
//                     setTimeout(() => {
//                       const questionEl = questionRefs.current[firstQuestionId];
//                       if (questionEl) {
//                         questionEl.scrollIntoView({
//                           behavior: "smooth",
//                           block: "center",
//                         });
//                       }
//                     }, 100);
//                   }

//                   // Use the direct, synchronous approach to set errors
//                   console.log(
//                     "🐞 Setting test errors:",
//                     JSON.stringify(testErrors)
//                   );
//                   setErrorsWithTracking(() => {
//                     // Force store in ref first
//                     errorsRef.current = testErrors;
//                     // Store in global debug
//                     if (typeof window !== "undefined") {
//                       try {
//                         (window as any)[KEY_DEBUG] = {
//                           errors: testErrors,
//                           source: "test_validation",
//                         };
//                       } catch (e) {}
//                     }
//                     return testErrors;
//                   });

//                   // Force a state update cycle check
//                   setTimeout(() => {
//                     console.log(
//                       "🐞 Test validation state check (after timeout):",
//                       {
//                         errors: JSON.stringify(errors),
//                         refErrors: errorsRef?.current
//                           ? JSON.stringify(errorsRef.current)
//                           : "no ref",
//                         windowDebug:
//                           typeof window !== "undefined"
//                             ? (window as any)[KEY_DEBUG]
//                             : "no window",
//                         hasFormError: !!errors._form,
//                         errorCount: Object.keys(errors).length,
//                       }
//                     );
//                   }, 10);

//                   // Show a toast for visibility
//                   toast({
//                     title: "Test Validation Errors",
//                     description: "Added test validation errors for debugging",
//                     variant: "destructive",
//                   });
//                 }}
//               >
//                 Test Validation
//               </Button>
//               <Button
//                 variant="outline"
//                 size="sm"
//                 onClick={() => {
//                   console.log("🐞 Clearing errors");
//                   setErrorsWithTracking({});
//                   toast({
//                     title: "Errors cleared",
//                     description: "All validation errors have been cleared",
//                   });
//                 }}
//               >
//                 Clear Errors
//               </Button>
//               <Button
//                 variant="outline"
//                 size="sm"
//                 onClick={() => {
//                   console.log("🐞 Current state:", {
//                     questions,
//                     errors,
//                     activePanel,
//                     refs: Object.keys(questionRefs.current),
//                   });
//                   toast({
//                     title: "Debug info",
//                     description: "Check console for current state information",
//                   });
//                 }}
//               >
//                 Log State
//               </Button>
//             </div>
//           </div>

//           {/* Bulk import dialog */}
//           <Dialog open={bulkImportOpen} onOpenChange={closeBulkImport}>
//             <DialogContent
//               className="sm:max-w-md"
//               aria-labelledby="bulk-import-v2-dialog-title"
//               aria-describedby="bulk-import-v2-dialog-description"
//             >
//               <DialogTitle id="bulk-import-v2-dialog-title">
//                 Bulk Import Questions
//               </DialogTitle>
//               <DialogDescription id="bulk-import-v2-dialog-description">
//                 Enter one question per line. Each line will be added as a
//                 separate question.
//               </DialogDescription>
//               <div className="py-4 space-y-4">
//                 <Textarea
//                   placeholder="Enter one question per line..."
//                   className="min-h-[200px]"
//                   value={bulkImportText}
//                   onChange={(e) => updateBulkImportText(e.target.value)}
//                 />
//               </div>
//               <DialogFooter>
//                 <Button variant="outline" onClick={closeBulkImport}>
//                   Cancel
//                 </Button>
//                 <Button
//                   onClick={processBulkImport}
//                   disabled={!bulkImportText.trim()}
//                 >
//                   Import Questions
//                 </Button>
//               </DialogFooter>
//             </DialogContent>
//           </Dialog>
//         </FormErrorBoundary>
//       </div>
//     </TooltipProvider>
//   );
// }

// export default function ApplicationQuestionsView(
//   props: ApplicationQuestionsViewProps
// ) {
//   const model = useApplicationQuestions(props);

//   // Debug hook to track error state inconsistencies
//   const { errors } = model;
//   const lastSetErrorsRef = useRef<Record<string, string>>({});

//   useEffect(() => {
//     console.log("🔄 DEBUG: State tracker detected error change:", {
//       current: JSON.stringify(errors),
//       last: JSON.stringify(lastSetErrorsRef.current),
//       isIdentical:
//         JSON.stringify(errors) === JSON.stringify(lastSetErrorsRef.current),
//       currentKeys: Object.keys(errors),
//       lastKeys: Object.keys(lastSetErrorsRef.current),
//     });

//     // Store the current errors for next comparison
//     lastSetErrorsRef.current = { ...errors };
//   }, [errors]);

//   return <ApplicationQuestionsViewComponent {...props} {...model} />;
// }
