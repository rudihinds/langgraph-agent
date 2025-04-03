"use client";

import { useState, useCallback } from "react";
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
  Save
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

// MODEL
export interface OrganizationInfoViewProps {
  onSubmit: (data: OrganizationInfo) => void;
  onBack: () => void;
}

export interface OrganizationInfo {
  name: string;
  type: string;
  mission: string;
  yearFounded: string;
  employeeCount: string;
  website: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
}

const ORG_TYPES = [
  "Nonprofit / NGO",
  "Educational Institution",
  "Government Agency",
  "For-profit Business",
  "Social Enterprise",
  "Foundation",
  "Research Institution",
  "Community Group",
  "Other"
];

interface UseOrganizationInfoModel {
  formData: OrganizationInfo;
  errors: Record<string, string>;
  isSaving: boolean;
  lastSaved: Date | null;
  handleChange: (field: keyof OrganizationInfo, value: string) => void;
  handleSubmit: () => void;
  handleBack: () => void;
  validateForm: () => boolean;
}

function useOrganizationInfo({ onSubmit, onBack }: OrganizationInfoViewProps): UseOrganizationInfoModel {
  const [formData, setFormData] = useState<OrganizationInfo>({
    name: "",
    type: "",
    mission: "",
    yearFounded: "",
    employeeCount: "",
    website: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Load saved data from localStorage on mount
  useState(() => {
    const savedData = localStorage.getItem("organizationInfoData");
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setFormData(parsedData);
      } catch (e) {
        console.error("Failed to parse saved organization data:", e);
      }
    }
  });
  
  // Auto-save to localStorage when data changes
  useState(() => {
    // Don't save if all fields are empty
    if (Object.values(formData).every(v => !v)) return;
    
    const saveTimeout = setTimeout(() => {
      setIsSaving(true);
      localStorage.setItem("organizationInfoData", JSON.stringify(formData));
      
      // Simulate a short delay to show the saving indicator
      setTimeout(() => {
        setIsSaving(false);
        setLastSaved(new Date());
      }, 600);
    }, 1000); // Debounce for 1 second
    
    return () => clearTimeout(saveTimeout);
  }, [formData]);
  
  const handleChange = useCallback((field: keyof OrganizationInfo, value: string) => {
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
    const newErrors: Record<string, string> = {};
    let isValid = true;
    
    // Required fields
    if (!formData.name) {
      newErrors.name = "Organization name is required";
      isValid = false;
    }
    
    if (!formData.type) {
      newErrors.type = "Organization type is required";
      isValid = false;
    }
    
    if (!formData.mission) {
      newErrors.mission = "Mission statement is required";
      isValid = false;
    }
    
    // Optional but validated fields
    if (formData.yearFounded && !/^\d{4}$/.test(formData.yearFounded)) {
      newErrors.yearFounded = "Please enter a valid 4-digit year";
      isValid = false;
    }
    
    if (formData.employeeCount && !/^\d+$/.test(formData.employeeCount)) {
      newErrors.employeeCount = "Please enter a valid number";
      isValid = false;
    }
    
    if (formData.website && !isValidUrl(formData.website)) {
      newErrors.website = "Please enter a valid URL";
      isValid = false;
    }
    
    if (formData.contactEmail && !isValidEmail(formData.contactEmail)) {
      newErrors.contactEmail = "Please enter a valid email address";
      isValid = false;
    }
    
    setErrors(newErrors);
    return isValid;
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

// Helper functions for validation
function isValidUrl(value: string): boolean {
  try {
    new URL(value.startsWith('http') ? value : `http://${value}`);
    return true;
  } catch {
    return false;
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// VIEW
interface OrganizationInfoViewComponentProps extends OrganizationInfoViewProps {
  formData: OrganizationInfo;
  errors: Record<string, string>;
  isSaving: boolean;
  lastSaved: Date | null;
  handleChange: (field: keyof OrganizationInfo, value: string) => void;
  handleSubmit: () => void;
  handleBack: () => void;
}

function OrganizationInfoViewComponent({
  formData,
  errors,
  isSaving,
  lastSaved,
  handleChange,
  handleSubmit,
  handleBack,
}: OrganizationInfoViewComponentProps) {
  return (
    <div className="container max-w-5xl px-4 py-8 mx-auto sm:px-6 lg:px-8">
      {/* Progress steps */}
      <div className="mb-8">
        <div className="relative">
          <div className="flex h-2 mb-6 overflow-hidden text-xs bg-gray-100 rounded">
            <div className="flex flex-col justify-center w-2/3 text-center text-white shadow-none whitespace-nowrap bg-primary"></div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center w-6 h-6 mb-1 border-2 border-gray-300 rounded-full bg-primary/10">
                <Check className="w-3 h-3 text-primary" />
              </div>
              <span>Application Questions</span>
            </div>
            <div className="flex flex-col items-center font-medium text-primary">
              <div className="flex items-center justify-center w-6 h-6 mb-1 text-white border-2 rounded-full border-primary bg-primary">
                2
              </div>
              <span>Organization Info</span>
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
              Organization Information
            </h1>
            <p className="text-lg text-muted-foreground">
              Tell us about your organization to help tailor your proposal.
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
                    Basic Information
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
                  Provide the essential details about your organization
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6 bg-white">
                <div>
                  <Label 
                    htmlFor="name"
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
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      placeholder="Enter your organization's name"
                      className={cn(
                        "pl-10",
                        errors.name ? "border-destructive" : "border-input"
                      )}
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? "name-error" : undefined}
                    />
                  </div>
                  {errors.name && (
                    <p
                      id="name-error"
                      className="flex items-center mt-1 text-sm text-destructive"
                    >
                      <Info className="w-3 h-3 mr-1" />
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <Label 
                    htmlFor="type"
                    className="text-base font-medium flex items-center mb-2"
                  >
                    Organization Type
                    <span className="text-destructive ml-1">*</span>
                    <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5" />
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => handleChange("type", value)}
                  >
                    <SelectTrigger 
                      id="type"
                      className={cn(
                        errors.type ? "border-destructive" : "border-input"
                      )}
                      aria-invalid={!!errors.type}
                      aria-describedby={errors.type ? "type-error" : undefined}
                    >
                      <SelectValue placeholder="Select organization type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ORG_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.type && (
                    <p
                      id="type-error"
                      className="flex items-center mt-1 text-sm text-destructive"
                    >
                      <Info className="w-3 h-3 mr-1" />
                      {errors.type}
                    </p>
                  )}
                </div>

                <div>
                  <Label 
                    htmlFor="mission"
                    className="text-base font-medium flex items-center mb-2"
                  >
                    Mission Statement
                    <span className="text-destructive ml-1">*</span>
                    <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5" />
                  </Label>
                  <Textarea
                    id="mission"
                    value={formData.mission}
                    onChange={(e) => handleChange("mission", e.target.value)}
                    placeholder="Describe your organization's mission and purpose"
                    className={cn(
                      "min-h-[120px]",
                      errors.mission ? "border-destructive" : "border-input"
                    )}
                    aria-invalid={!!errors.mission}
                    aria-describedby={errors.mission ? "mission-error" : undefined}
                  />
                  {errors.mission && (
                    <p
                      id="mission-error"
                      className="flex items-center mt-1 text-sm text-destructive"
                    >
                      <Info className="w-3 h-3 mr-1" />
                      {errors.mission}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <Label 
                      htmlFor="yearFounded"
                      className="text-base font-medium flex items-center mb-2"
                    >
                      Year Founded
                      <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5" />
                    </Label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                        <Calendar className="w-5 h-5" />
                      </span>
                      <Input
                        id="yearFounded"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={formData.yearFounded}
                        onChange={(e) => handleChange("yearFounded", e.target.value)}
                        placeholder="e.g., 2010"
                        className={cn(
                          "pl-10",
                          errors.yearFounded ? "border-destructive" : "border-input"
                        )}
                        aria-invalid={!!errors.yearFounded}
                        aria-describedby={errors.yearFounded ? "year-error" : undefined}
                      />
                    </div>
                    {errors.yearFounded && (
                      <p
                        id="year-error"
                        className="flex items-center mt-1 text-sm text-destructive"
                      >
                        <Info className="w-3 h-3 mr-1" />
                        {errors.yearFounded}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label 
                      htmlFor="employeeCount"
                      className="text-base font-medium flex items-center mb-2"
                    >
                      Number of Employees
                      <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5" />
                    </Label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                        <Users className="w-5 h-5" />
                      </span>
                      <Input
                        id="employeeCount"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={formData.employeeCount}
                        onChange={(e) => handleChange("employeeCount", e.target.value)}
                        placeholder="e.g., 25"
                        className={cn(
                          "pl-10",
                          errors.employeeCount ? "border-destructive" : "border-input"
                        )}
                        aria-invalid={!!errors.employeeCount}
                        aria-describedby={errors.employeeCount ? "employee-error" : undefined}
                      />
                    </div>
                    {errors.employeeCount && (
                      <p
                        id="employee-error"
                        className="flex items-center mt-1 text-sm text-destructive"
                      >
                        <Info className="w-3 h-3 mr-1" />
                        {errors.employeeCount}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label 
                    htmlFor="website"
                    className="text-base font-medium flex items-center mb-2"
                  >
                    Website
                    <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5" />
                  </Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                      <Globe className="w-5 h-5" />
                    </span>
                    <Input
                      id="website"
                      type="url"
                      value={formData.website}
                      onChange={(e) => handleChange("website", e.target.value)}
                      placeholder="https://example.org"
                      className={cn(
                        "pl-10",
                        errors.website ? "border-destructive" : "border-input"
                      )}
                      aria-invalid={!!errors.website}
                      aria-describedby={errors.website ? "website-error" : undefined}
                    />
                  </div>
                  {errors.website && (
                    <p
                      id="website-error"
                      className="flex items-center mt-1 text-sm text-destructive"
                    >
                      <Info className="w-3 h-3 mr-1" />
                      {errors.website}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="mb-6 border-0 shadow-md">
              <CardHeader className="pb-3 border-b bg-muted/30">
                <CardTitle className="text-xl">Contact Information</CardTitle>
                <CardDescription>
                  Provide contact details for your organization
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6 bg-white">
                <div>
                  <Label 
                    htmlFor="contactName"
                    className="text-base font-medium flex items-center mb-2"
                  >
                    Primary Contact Name
                    <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5" />
                  </Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                      <User className="w-5 h-5" />
                    </span>
                    <Input
                      id="contactName"
                      value={formData.contactName}
                      onChange={(e) => handleChange("contactName", e.target.value)}
                      placeholder="Full name of primary contact"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <Label 
                      htmlFor="contactEmail"
                      className="text-base font-medium flex items-center mb-2"
                    >
                      Email Address
                      <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5" />
                    </Label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                        <Mail className="w-5 h-5" />
                      </span>
                      <Input
                        id="contactEmail"
                        type="email"
                        value={formData.contactEmail}
                        onChange={(e) => handleChange("contactEmail", e.target.value)}
                        placeholder="contact@example.org"
                        className={cn(
                          "pl-10",
                          errors.contactEmail ? "border-destructive" : "border-input"
                        )}
                        aria-invalid={!!errors.contactEmail}
                        aria-describedby={errors.contactEmail ? "email-error" : undefined}
                      />
                    </div>
                    {errors.contactEmail && (
                      <p
                        id="email-error"
                        className="flex items-center mt-1 text-sm text-destructive"
                      >
                        <Info className="w-3 h-3 mr-1" />
                        {errors.contactEmail}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label 
                      htmlFor="contactPhone"
                      className="text-base font-medium flex items-center mb-2"
                    >
                      Phone Number
                      <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5" />
                    </Label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                        <Phone className="w-5 h-5" />
                      </span>
                      <Input
                        id="contactPhone"
                        type="tel"
                        value={formData.contactPhone}
                        onChange={(e) => handleChange("contactPhone", e.target.value)}
                        placeholder="(123) 456-7890"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label 
                    htmlFor="address"
                    className="text-base font-medium flex items-center mb-2"
                  >
                    Address
                    <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5" />
                  </Label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                      <MapPin className="w-5 h-5" />
                    </span>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleChange("address", e.target.value)}
                      placeholder="Full address of your organization"
                      className="min-h-[100px] pl-10"
                    />
                  </div>
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
                  <div className="flex items-center px-4 py-2.5">
                    <span className="flex items-center justify-center w-6 h-6 mr-3 border-2 rounded-full bg-primary/10 border-primary">
                      <Check className="w-3 h-3 text-primary" />
                    </span>
                    Application Questions
                  </div>
                  <div className="flex items-center px-4 py-2.5 font-medium rounded-md bg-primary/10 text-primary">
                    <span className="flex items-center justify-center w-6 h-6 mr-3 text-xs text-white rounded-full bg-primary">
                      2
                    </span>
                    Organization Info
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
                    Enter your organization's legal name as it appears on official documents
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2.5 mt-0.5" />
                    Provide a clear and concise mission statement
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2.5 mt-0.5" />
                    Include up-to-date contact information
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2.5 mt-0.5" />
                    All fields marked with * are required
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
export default function OrganizationInfoView(props: OrganizationInfoViewProps) {
  const model = useOrganizationInfo(props);
  return <OrganizationInfoViewComponent {...props} {...model} />;
}