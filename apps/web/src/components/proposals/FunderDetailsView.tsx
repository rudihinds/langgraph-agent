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
  FileText
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { z } from "zod";

// MODEL
export interface FunderDetailsViewProps {
  onSubmit: (data: FunderDetails) => void;
  onBack: () => void;
}

export interface FunderDetails {
  organizationName: string;
  fundingTitle: string;
  deadline: Date | null;
  budgetRange: string;
  focusArea: string;
}

const BUDGET_RANGES = [
  "Under $10,000",
  "$10,000 - $50,000",
  "$50,000 - $100,000",
  "$100,000 - $250,000",
  "$250,000 - $500,000",
  "$500,000 - $1 million",
  "Over $1 million",
  "Not specified"
];

// Define Zod schema for validation
const funderDetailsSchema = z.object({
  organizationName: z.string().min(1, { message: "Organization name is required" }),
  fundingTitle: z.string().min(1, { message: "Grant/funding opportunity title is required" }),
  deadline: z.date().nullable().refine(val => val !== null, { 
    message: "Submission deadline is required" 
  }),
  budgetRange: z.string().min(1, { message: "Budget range is required" }),
  focusArea: z.string().min(1, { message: "Primary focus area is required" })
});

interface UseFunderDetailsModel {
  formData: FunderDetails;
  errors: Record<string, string>;
  isSaving: boolean;
  lastSaved: Date | null;
  handleChange: <K extends keyof FunderDetails>(field: K, value: FunderDetails[K]) => void;
  handleSubmit: () => void;
  handleBack: () => void;
  validateForm: () => boolean;
}

function useFunderDetails({ onSubmit, onBack }: FunderDetailsViewProps): UseFunderDetailsModel {
  const [formData, setFormData] = useState<FunderDetails>({
    organizationName: "",
    fundingTitle: "",
    deadline: null,
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
          parsedData.deadline = new Date(parsedData.deadline);
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
    if (Object.values(formData).every(v => !v)) return;
    
    const saveTimeout = setTimeout(() => {
      setIsSaving(true);
      
      // Create a copy for localStorage that handles Date objects
      const dataToSave = {
        ...formData,
        // Convert Date to ISO string for storage
        deadline: formData.deadline ? formData.deadline.toISOString() : null,
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
  
  const handleChange = useCallback(<K extends keyof FunderDetails>(field: K, value: FunderDetails[K]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field if it was previously set
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);
  
  const validateForm = useCallback(() => {
    try {
      // Validate with Zod
      funderDetailsSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Convert Zod errors to our error format
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
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
  
  return {
    formData,
    errors,
    isSaving,
    lastSaved,
    handleChange,
    handleSubmit,
    handleBack,
    validateForm,
  };
}

// VIEW
interface FunderDetailsViewComponentProps extends FunderDetailsViewProps {
  formData: FunderDetails;
  errors: Record<string, string>;
  isSaving: boolean;
  lastSaved: Date | null;
  handleChange: <K extends keyof FunderDetails>(field: K, value: FunderDetails[K]) => void;
  handleSubmit: () => void;
  handleBack: () => void;
}

function FunderDetailsViewComponent({
  formData,
  errors,
  isSaving,
  lastSaved,
  handleChange,
  handleSubmit,
  handleBack,
}: FunderDetailsViewComponentProps) {
  return (
    <div className="container max-w-5xl px-4 py-8 mx-auto sm:px-6 lg:px-8">
      {/* Progress steps */}
      <div className="mb-8">
        <div className="relative">
          <div className="flex h-2 mb-6 overflow-hidden text-xs bg-gray-100 rounded">
            <div className="flex flex-col justify-center w-1/3 text-center text-white shadow-none whitespace-nowrap bg-primary"></div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <div className="flex flex-col items-center font-medium text-primary">
              <div className="flex items-center justify-center w-6 h-6 mb-1 text-white border-2 rounded-full border-primary bg-primary">
                1
              </div>
              <span>Funder Details</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center w-6 h-6 mb-1 border-2 border-gray-300 rounded-full">
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
              Funder Details
            </h1>
            <p className="text-lg text-muted-foreground">
              Enter information about the funding organization and opportunity.
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
                    className="text-base font-medium flex items-center mb-2"
                  >
                    Organization Name
                    <span className="text-destructive ml-1">*</span>
                    <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5" />
                  </Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                      <Building className="w-5 h-5" />
                    </span>
                    <Input
                      id="organizationName"
                      value={formData.organizationName}
                      onChange={(e) => handleChange("organizationName", e.target.value)}
                      placeholder="Enter the name of the funding organization"
                      className={cn(
                        "pl-10",
                        errors.organizationName ? "border-destructive" : "border-input"
                      )}
                      aria-invalid={!!errors.organizationName}
                      aria-describedby={errors.organizationName ? "org-name-error" : undefined}
                    />
                  </div>
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
                    className="text-base font-medium flex items-center mb-2"
                  >
                    Grant/Funding Opportunity Title
                    <span className="text-destructive ml-1">*</span>
                    <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5" />
                  </Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                      <FileText className="w-5 h-5" />
                    </span>
                    <Input
                      id="fundingTitle"
                      value={formData.fundingTitle}
                      onChange={(e) => handleChange("fundingTitle", e.target.value)}
                      placeholder="Enter the title of the grant or funding opportunity"
                      className={cn(
                        "pl-10",
                        errors.fundingTitle ? "border-destructive" : "border-input"
                      )}
                      aria-invalid={!!errors.fundingTitle}
                      aria-describedby={errors.fundingTitle ? "funding-title-error" : undefined}
                    />
                  </div>
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
                    Submission Deadline
                    <span className="text-destructive ml-1">*</span>
                    <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5" />
                  </Label>
                  <div className="relative">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="deadline"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal pl-10",
                            !formData.deadline && "text-muted-foreground",
                            errors.deadline && "border-destructive"
                          )}
                          aria-invalid={!!errors.deadline}
                          aria-describedby={errors.deadline ? "deadline-error" : undefined}
                        >
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                            <Calendar className="w-5 h-5" />
                          </span>
                          {formData.deadline ? (
                            format(formData.deadline, "PPP")
                          ) : (
                            "Select deadline date"
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={formData.deadline || undefined}
                          onSelect={(date) => handleChange("deadline", date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  {errors.deadline && (
                    <p
                      id="deadline-error"
                      className="flex items-center mt-1 text-sm text-destructive"
                    >
                      <Info className="w-3 h-3 mr-1" />
                      {errors.deadline}
                    </p>
                  )}
                </div>

                <div>
                  <Label 
                    htmlFor="budgetRange"
                    className="text-base font-medium flex items-center mb-2"
                  >
                    Approximate Budget Range
                    <span className="text-destructive ml-1">*</span>
                    <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5" />
                  </Label>
                  <div className="relative">
                    <Select
                      value={formData.budgetRange}
                      onValueChange={(value) => handleChange("budgetRange", value)}
                    >
                      <SelectTrigger 
                        id="budgetRange"
                        className={cn(
                          "pl-10",
                          errors.budgetRange ? "border-destructive" : "border-input"
                        )}
                        aria-invalid={!!errors.budgetRange}
                        aria-describedby={errors.budgetRange ? "budget-error" : undefined}
                      >
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                          <DollarSign className="w-5 h-5" />
                        </span>
                        <SelectValue placeholder="Select budget range" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUDGET_RANGES.map((range) => (
                          <SelectItem key={range} value={range}>
                            {range}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                    className="text-base font-medium flex items-center mb-2"
                  >
                    Primary Focus Area
                    <span className="text-destructive ml-1">*</span>
                    <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5" />
                  </Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                      <Target className="w-5 h-5" />
                    </span>
                    <Input
                      id="focusArea"
                      value={formData.focusArea}
                      onChange={(e) => handleChange("focusArea", e.target.value)}
                      placeholder="e.g., Education, Healthcare, Climate Action"
                      className={cn(
                        "pl-10",
                        errors.focusArea ? "border-destructive" : "border-input"
                      )}
                      aria-invalid={!!errors.focusArea}
                      aria-describedby={errors.focusArea ? "focus-area-error" : undefined}
                    />
                  </div>
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
          <div className="sticky space-y-4 top-8">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Navigation</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center px-4 py-2.5 font-medium rounded-md bg-primary/10 text-primary">
                    <span className="flex items-center justify-center w-6 h-6 mr-3 text-xs text-white rounded-full bg-primary">
                      1
                    </span>
                    Funder Details
                  </div>
                  <div className="flex items-center px-4 py-2.5">
                    <span className="flex items-center justify-center w-6 h-6 mr-3 text-xs border border-gray-300 rounded-full">
                      2
                    </span>
                    Application Questions
                  </div>
                  <div className="flex items-center px-4 py-2.5">
                    <span className="flex items-center justify-center w-6 h-6 mr-3 text-xs border border-gray-300 rounded-full">
                      3
                    </span>
                    Review & Create
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Help & Tips</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="space-y-2.5">
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2.5 mt-0.5" />
                    Enter the official name of the funding organization
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2.5 mt-0.5" />
                    Include the exact title of the grant or funding opportunity
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2.5 mt-0.5" />
                    Double-check the submission deadline
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2.5 mt-0.5" />
                    The focus area helps tailor your proposal to the funder's priorities
                  </li>
                </ul>
              </CardContent>
            </Card>

            <div className="flex flex-col space-y-3 pt-2">
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
  );
}

// COMPONENT
export default function FunderDetailsView(props: FunderDetailsViewProps) {
  const model = useFunderDetails(props);
  return <FunderDetailsViewComponent {...props} {...model} />;
}