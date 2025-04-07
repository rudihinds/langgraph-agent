"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Info,
  Building,
  User,
  Users,
  MapPin,
  Calendar,
  Mail,
  Phone,
  Globe,
  Check,
  HelpCircle,
  Save,
  FileText,
  DollarSign,
  Target,
  CheckCircle2,
  ChevronLeft,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  AutoClosePopover,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { CheckItem } from "@/components/ui/check-item";
import { z } from "zod";
import {
  FunderDetailsFormSchema,
  type FunderDetailsForm,
} from "@shared/types/ProposalSchema";
import { DatePicker } from "@/components/ui/date-picker";
import { AppointmentPicker } from "@/components/ui/appointment-picker";
import { EnhancedAppointmentPicker } from "@/components/ui/enhanced-appointment-picker";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  formatDateForAPI,
  parseAPIDate,
  toDateObject,
} from "@/lib/utils/date-utils";

// MODEL
export interface FunderDetailsViewProps {
  onSubmit: (data: FunderDetailsForm) => void;
  onBack: () => void;
  proposalType?: "rfp" | "application";
}

// Keeping this for backward compatibility but using the shared schema type
export type FunderDetails = FunderDetailsForm;

const BUDGET_RANGES = [
  "Under $10,000",
  "$10,000 - $50,000",
  "$50,000 - $100,000",
  "$100,000 - $250,000",
  "$250,000 - $500,000",
  "$500,000 - $1 million",
  "Over $1 million",
  "Not specified",
];

// For validation, we use the shared schema
const funderDetailsSchema = FunderDetailsFormSchema;

interface UseFunderDetailsModel {
  formData: FunderDetailsForm;
  errors: Record<string, string>;
  isSaving: boolean;
  lastSaved: Date | null;
  handleChange: <K extends keyof FunderDetailsForm>(
    field: K,
    value: FunderDetailsForm[K]
  ) => void;
  handleSubmit: () => void;
  handleBack: () => void;
  validateForm: () => boolean;
  handleFocus: (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement
    >
  ) => void;
}

function useFunderDetails({
  onSubmit,
  onBack,
}: FunderDetailsViewProps): UseFunderDetailsModel {
  const [formData, setFormData] = useState<FunderDetailsForm>({
    organizationName: "",
    fundingTitle: "",
    deadline: new Date(),
    budgetRange: "",
    focusArea: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load saved data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem("funderDetailsData");
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        // Convert deadline string back to Date object if it exists
        if (parsedData.deadline) {
          parsedData.deadline = toDateObject(parsedData.deadline);
        }
        setFormData(parsedData);
      } catch (e) {
        console.error("Failed to parse saved funder details:", e);
      }
    }
  }, []);

  // Auto-save to localStorage when data changes
  useEffect(() => {
    // Don't save if all fields are empty
    if (Object.values(formData).every((v) => !v)) return;

    const saveTimeout = setTimeout(() => {
      setIsSaving(true);

      // Create a copy for localStorage that handles Date objects
      const dataToSave = {
        ...formData,
        // Convert Date to string for storage
        deadline: formData.deadline
          ? formatDateForAPI(formData.deadline)
          : null,
      };

      localStorage.setItem("funderDetailsData", JSON.stringify(dataToSave));

      // Simulate a short delay to show the saving indicator
      setTimeout(() => {
        setIsSaving(false);
        setLastSaved(new Date());
      }, 600);
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(saveTimeout);
  }, [formData]);

  const handleChange = useCallback(
    <K extends keyof FunderDetailsForm>(
      field: K,
      value: FunderDetailsForm[K]
    ) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));

      // Clear error for this field if it was previously set
      if (errors[field]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    },
    [errors]
  );

  const validateForm = useCallback(() => {
    try {
      // Validate with Zod using the shared schema
      funderDetailsSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Convert Zod errors to our error format
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path[0] as string;
          newErrors[path] = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  }, [formData]);

  const handleSubmit = useCallback(() => {
    if (validateForm()) {
      onSubmit(formData);
    }
  }, [formData, validateForm, onSubmit]);

  const handleBack = useCallback(() => {
    onBack();
  }, [onBack]);

  const handleFocus = useCallback(
    (
      e: React.FocusEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement
      >
    ) => {
      // Move cursor to the end of text on focus for input and textarea elements
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
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
    formData,
    errors,
    isSaving,
    lastSaved,
    handleChange,
    handleSubmit,
    handleBack,
    validateForm,
    handleFocus,
  };
}

// VIEW
interface FunderDetailsViewComponentProps extends FunderDetailsViewProps {
  formData: FunderDetailsForm;
  errors: Record<string, string>;
  isSaving: boolean;
  lastSaved: Date | null;
  handleChange: <K extends keyof FunderDetailsForm>(
    field: K,
    value: FunderDetailsForm[K]
  ) => void;
  handleSubmit: () => void;
  handleBack: () => void;
  handleFocus: (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement
    >
  ) => void;
}

function FunderDetailsViewComponent({
  formData,
  errors,
  isSaving,
  lastSaved,
  handleChange,
  handleSubmit,
  handleBack,
  handleFocus,
  proposalType = "application",
}: FunderDetailsViewComponentProps) {
  return (
    <TooltipProvider>
      <div className="container max-w-5xl px-4 py-8 mx-auto sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="lg:w-3/4">
            <div className="mb-6">
              <h1 className="mb-2 text-3xl font-bold tracking-tight">
                Funder Details
              </h1>
              <p className="text-lg text-muted-foreground">
                Enter information about the funding organization and
                opportunity.
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="mb-6 border-0 shadow-md">
                <CardHeader className="pb-3 border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">
                      Funding Information
                    </CardTitle>
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
                    </div>
                  </div>
                  <CardDescription>
                    Enter the details of the funder and the grant opportunity
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6 bg-white">
                  <div>
                    <Label
                      htmlFor="organizationName"
                      className="flex items-center mb-2 text-base font-medium"
                    >
                      Organization Name
                      <span className="ml-1 text-destructive">*</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="p-3 text-sm w-80">
                          <p>
                            Enter the official name of the funding organization
                            exactly as it appears in their documents. This
                            ensures proper identification and alignment with
                            their branding.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input
                      id="organizationName"
                      value={formData.organizationName}
                      onChange={(e) =>
                        handleChange("organizationName", e.target.value)
                      }
                      placeholder="Enter the name of the funding organization"
                      className={cn(
                        errors.organizationName
                          ? "border-destructive"
                          : "border-input"
                      )}
                      aria-invalid={!!errors.organizationName}
                      aria-describedby={
                        errors.organizationName ? "org-name-error" : undefined
                      }
                      onFocus={handleFocus}
                    />
                    {errors.organizationName && (
                      <p
                        id="org-name-error"
                        className="flex items-center mt-1 text-sm text-destructive"
                      >
                        <Info className="w-3 h-3 mr-1" />
                        {errors.organizationName}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="fundingTitle"
                      className="flex items-center mb-2 text-base font-medium"
                    >
                      Grant/Funding Opportunity Title
                      <span className="ml-1 text-destructive">*</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="p-3 text-sm w-80">
                          <p>
                            Enter the complete title of the grant or funding
                            opportunity. Using the exact title will help ensure
                            your proposal addresses the specific program and its
                            requirements.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input
                      id="fundingTitle"
                      value={formData.fundingTitle}
                      onChange={(e) =>
                        handleChange("fundingTitle", e.target.value)
                      }
                      placeholder="Enter the title of the grant or funding opportunity"
                      className={cn(
                        errors.fundingTitle
                          ? "border-destructive"
                          : "border-input"
                      )}
                      aria-invalid={!!errors.fundingTitle}
                      aria-describedby={
                        errors.fundingTitle ? "funding-title-error" : undefined
                      }
                      onFocus={handleFocus}
                    />
                    {errors.fundingTitle && (
                      <p
                        id="funding-title-error"
                        className="flex items-center mt-1 text-sm text-destructive"
                      >
                        <Info className="w-3 h-3 mr-1" />
                        {errors.fundingTitle}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="deadline"
                      className="text-base font-medium flex items-center mb-2"
                    >
                      Application Deadline
                      <span className="text-destructive ml-1">*</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="w-80 text-sm p-3">
                          <p>
                            Enter the submission deadline for the grant or
                            funding opportunity. This helps ensure your proposal
                            is completed and submitted on time.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <EnhancedAppointmentPicker
                      date={formData.deadline}
                      onDateChange={(date) =>
                        handleChange("deadline", date || new Date())
                      }
                      label=""
                      error={errors.deadline}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <Label
                      htmlFor="budgetRange"
                      className="flex items-center mb-2 text-base font-medium"
                    >
                      Approximate Budget ($)
                      <span className="ml-1 text-destructive">*</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="p-3 text-sm w-80">
                          <p>
                            Enter the total amount you're requesting in USD
                            (numbers only). This should align with the funder's
                            typical grant size and be realistic for your
                            proposed activities.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input
                      id="budgetRange"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formData.budgetRange}
                      onChange={(e) =>
                        handleChange(
                          "budgetRange",
                          e.target.value.replace(/[^0-9]/g, "")
                        )
                      }
                      placeholder="Enter budget amount (numbers only)"
                      className={cn(
                        errors.budgetRange
                          ? "border-destructive"
                          : "border-input"
                      )}
                      aria-invalid={!!errors.budgetRange}
                      aria-describedby={
                        errors.budgetRange ? "budget-error" : undefined
                      }
                      onFocus={handleFocus}
                    />
                    {errors.budgetRange && (
                      <p
                        id="budget-error"
                        className="flex items-center mt-1 text-sm text-destructive"
                      >
                        <Info className="w-3 h-3 mr-1" />
                        {errors.budgetRange}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="focusArea"
                      className="flex items-center mb-2 text-base font-medium"
                    >
                      Primary Focus Area
                      <span className="ml-1 text-destructive">*</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="p-3 text-sm w-80">
                          <p>
                            Enter the main category or field that your proposal
                            addresses (e.g., "Education", "Climate Action",
                            "Public Health"). This helps tailor your proposal to
                            align with the funder's priorities.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input
                      id="focusArea"
                      value={formData.focusArea}
                      onChange={(e) =>
                        handleChange("focusArea", e.target.value)
                      }
                      placeholder="e.g., Education, Healthcare, Climate Action"
                      className={cn(
                        errors.focusArea ? "border-destructive" : "border-input"
                      )}
                      aria-invalid={!!errors.focusArea}
                      aria-describedby={
                        errors.focusArea ? "focus-area-error" : undefined
                      }
                      onFocus={handleFocus}
                    />
                    {errors.focusArea && (
                      <p
                        id="focus-area-error"
                        className="flex items-center mt-1 text-sm text-destructive"
                      >
                        <Info className="w-3 h-3 mr-1" />
                        {errors.focusArea}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
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
                      Enter the official name of the funding organization
                    </CheckItem>
                    <CheckItem>
                      Include the exact title of the grant or funding
                      opportunity
                    </CheckItem>
                    <CheckItem>Double-check the submission deadline</CheckItem>
                    <CheckItem>
                      The focus area helps tailor your proposal to the funder's
                      priorities
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
      </div>
    </TooltipProvider>
  );
}

// COMPONENT
export default function FunderDetailsView(props: FunderDetailsViewProps) {
  const model = useFunderDetails(props);
  return <FunderDetailsViewComponent {...props} {...model} />;
}
