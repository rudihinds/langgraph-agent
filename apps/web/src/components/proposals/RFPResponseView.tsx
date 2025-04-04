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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  File,
  FileText,
  Trash,
  Plus,
  Info,
  Check,
  ChevronRight,
  Save,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

// MODEL
export interface RFPResponseViewProps {
  onSubmit: (data: {
    rfpUrl: string;
    rfpText: string;
    companyName: string;
  }) => void;
  onBack: () => void;
}

interface UseRFPResponseModel {
  rfpUrl: string;
  rfpText: string;
  companyName: string;
  fileName: string | null;
  isUploading: boolean;
  confirmClearOpen: boolean;
  errors: Record<string, string>;
  isSaving: boolean;
  lastSaved: Date | null;
  setRfpUrl: (url: string) => void;
  setRfpText: (text: string) => void;
  setCompanyName: (name: string) => void;
  handleSubmit: () => void;
  handleBack: () => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveFile: () => void;
  validateForm: () => boolean;
  openConfirmClear: () => void;
  closeConfirmClear: () => void;
  confirmClear: () => void;
}

function useRFPResponse({
  onSubmit,
  onBack,
}: RFPResponseViewProps): UseRFPResponseModel {
  const [rfpUrl, setRfpUrl] = useState("");
  const [rfpText, setRfpText] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load saved data from localStorage on mount
  useState(() => {
    const savedData = localStorage.getItem("rfpResponseData");
    if (savedData) {
      try {
        const { rfpUrl, rfpText, companyName } = JSON.parse(savedData);
        if (rfpUrl) setRfpUrl(rfpUrl);
        if (rfpText) setRfpText(rfpText);
        if (companyName) setCompanyName(companyName);
      } catch (e) {
        console.error("Failed to parse saved RFP data:", e);
      }
    }
  });

  // Auto-save to localStorage when data changes
  useState(() => {
    const saveTimeout = setTimeout(() => {
      if (rfpUrl || rfpText || companyName) {
        setIsSaving(true);
        localStorage.setItem(
          "rfpResponseData",
          JSON.stringify({ rfpUrl, rfpText, companyName })
        );

        // Simulate a short delay to show the saving indicator
        setTimeout(() => {
          setIsSaving(false);
          setLastSaved(new Date());
        }, 600);
      }
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(saveTimeout);
  }, [rfpUrl, rfpText, companyName]);

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (!rfpUrl && !rfpText) {
      newErrors.rfpSource = "Please provide either a URL or the RFP text";
      isValid = false;
    }

    if (!companyName) {
      newErrors.companyName = "Company name is required";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  }, [rfpUrl, rfpText, companyName]);

  const handleSubmit = useCallback(() => {
    if (validateForm()) {
      onSubmit({ rfpUrl, rfpText, companyName });
    }
  }, [rfpUrl, rfpText, companyName, validateForm, onSubmit]);

  const handleBack = useCallback(() => {
    onBack();
  }, [onBack]);

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
          setRfpText(content);
        }
        setIsUploading(false);
      };

      reader.onerror = () => {
        setIsUploading(false);
        // Reset file input
        e.target.value = "";
        setFileName(null);
        setErrors({
          ...errors,
          fileUpload: "Failed to read file. Please try again.",
        });
      };

      reader.readAsText(file);
    },
    [errors]
  );

  const handleRemoveFile = useCallback(() => {
    setFileName(null);
    setRfpText("");

    // Clear any error related to file upload
    if (errors.fileUpload) {
      const newErrors = { ...errors };
      delete newErrors.fileUpload;
      setErrors(newErrors);
    }
  }, [errors]);

  const openConfirmClear = useCallback(() => {
    if (rfpText.trim()) {
      setConfirmClearOpen(true);
    }
  }, [rfpText]);

  const closeConfirmClear = useCallback(() => {
    setConfirmClearOpen(false);
  }, []);

  const confirmClear = useCallback(() => {
    setRfpText("");
    setFileName(null);
    closeConfirmClear();
  }, [closeConfirmClear]);

  return {
    rfpUrl,
    rfpText,
    companyName,
    fileName,
    isUploading,
    confirmClearOpen,
    errors,
    isSaving,
    lastSaved,
    setRfpUrl,
    setRfpText,
    setCompanyName,
    handleSubmit,
    handleBack,
    handleFileUpload,
    handleRemoveFile,
    validateForm,
    openConfirmClear,
    closeConfirmClear,
    confirmClear,
  };
}

// VIEW
interface RFPResponseViewComponentProps extends RFPResponseViewProps {
  rfpUrl: string;
  rfpText: string;
  companyName: string;
  fileName: string | null;
  isUploading: boolean;
  confirmClearOpen: boolean;
  errors: Record<string, string>;
  isSaving: boolean;
  lastSaved: Date | null;
  setRfpUrl: (url: string) => void;
  setRfpText: (text: string) => void;
  setCompanyName: (name: string) => void;
  handleSubmit: () => void;
  handleBack: () => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveFile: () => void;
  openConfirmClear: () => void;
  closeConfirmClear: () => void;
  confirmClear: () => void;
}

function RFPResponseViewComponent({
  rfpUrl,
  rfpText,
  companyName,
  fileName,
  isUploading,
  confirmClearOpen,
  errors,
  isSaving,
  lastSaved,
  setRfpUrl,
  setRfpText,
  setCompanyName,
  handleSubmit,
  handleBack,
  handleFileUpload,
  handleRemoveFile,
  openConfirmClear,
  closeConfirmClear,
  confirmClear,
}: RFPResponseViewComponentProps) {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Progress steps */}
      <div className="mb-8">
        <div className="relative">
          <div className="overflow-hidden h-2 mb-6 text-xs flex rounded bg-gray-100">
            <div className="w-2/3 shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary"></div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 rounded-full border-2 border-gray-300 bg-primary/10 flex items-center justify-center mb-1">
                <Check className="h-3 w-3 text-primary" />
              </div>
              <span>Funder Details</span>
            </div>
            <div className="text-primary font-medium flex flex-col items-center">
              <div className="w-6 h-6 rounded-full border-2 border-primary bg-primary text-white flex items-center justify-center mb-1">
                2
              </div>
              <span>RFP Details</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center mb-1">
                3
              </div>
              <span>Review & Create</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-3/4">
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              RFP Response
            </h1>
            <p className="text-muted-foreground text-lg">
              Enter the details from the Request for Proposal (RFP) document to
              analyze and create your response.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="mb-6 border-0 shadow-md">
              <CardHeader className="bg-muted/30 pb-3 border-b">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl">RFP Details</CardTitle>
                  <div className="flex items-center gap-2">
                    {isSaving && (
                      <span className="text-xs text-muted-foreground animate-pulse flex items-center">
                        <Save className="h-3 w-3 mr-1" />
                        Saving...
                      </span>
                    )}
                    {!isSaving && lastSaved && (
                      <span className="text-xs text-muted-foreground flex items-center">
                        <Check className="h-3 w-3 mr-1 text-green-500" />
                        Saved {lastSaved.toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
                <CardDescription>
                  Provide the information from the RFP document you received
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 bg-white">
                <div className="space-y-6">
                  <div>
                    <Label
                      htmlFor="companyName"
                      className="text-base font-medium flex items-center mb-2"
                    >
                      Company or Organization Name
                      <span className="text-destructive ml-1">*</span>
                      <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5" />
                    </Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Enter the name of the company or organization issuing the RFP"
                      className={cn(
                        errors.companyName
                          ? "border-destructive"
                          : "border-input"
                      )}
                      aria-invalid={!!errors.companyName}
                      aria-describedby={
                        errors.companyName ? "company-name-error" : undefined
                      }
                    />
                    {errors.companyName && (
                      <p
                        id="company-name-error"
                        className="text-sm text-destructive mt-1 flex items-center"
                      >
                        <Info className="h-3 w-3 mr-1" />
                        {errors.companyName}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="rfpUrl"
                      className="text-base font-medium flex items-center mb-2"
                    >
                      RFP URL (Optional)
                      <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5" />
                    </Label>
                    <Input
                      id="rfpUrl"
                      type="url"
                      value={rfpUrl}
                      onChange={(e) => setRfpUrl(e.target.value)}
                      placeholder="https://example.com/rfp-document"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      If the RFP is available online, enter the URL here
                    </p>
                  </div>

                  <div className="relative">
                    <Label
                      htmlFor="rfpText"
                      className="text-base font-medium flex items-center mb-2"
                    >
                      RFP Document Text
                      <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5" />
                    </Label>

                    <div className="flex items-center gap-2 mb-2">
                      <label
                        htmlFor="file-upload"
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-input bg-background",
                          "hover:bg-muted cursor-pointer"
                        )}
                      >
                        <Upload className="h-4 w-4" />
                        Upload RFP File
                      </label>
                      <input
                        id="file-upload"
                        type="file"
                        accept=".txt,.pdf,.doc,.docx"
                        onChange={handleFileUpload}
                        className="hidden"
                      />

                      {fileName && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground truncate max-w-[200px]">
                            {fileName}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleRemoveFile}
                            className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {isUploading ? (
                      <div className="min-h-[200px] border rounded-md p-4 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="animate-pulse">
                            <File className="h-12 w-12 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Processing file...
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <Textarea
                          id="rfpText"
                          value={rfpText}
                          onChange={(e) => setRfpText(e.target.value)}
                          placeholder="Paste the content of the RFP document here..."
                          className={cn(
                            "min-h-[300px]",
                            errors.rfpSource
                              ? "border-destructive"
                              : "border-input"
                          )}
                          aria-invalid={!!errors.rfpSource}
                          aria-describedby={
                            errors.rfpSource ? "rfp-source-error" : undefined
                          }
                        />

                        {rfpText && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={openConfirmClear}
                            className="absolute top-2 right-2 h-6 w-6 p-0 rounded-full opacity-70 hover:opacity-100"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}

                    {errors.rfpSource && (
                      <p
                        id="rfp-source-error"
                        className="text-sm text-destructive mt-1 flex items-center"
                      >
                        <Info className="h-3 w-3 mr-1" />
                        {errors.rfpSource}
                      </p>
                    )}

                    {errors.fileUpload && (
                      <p className="text-sm text-destructive mt-1 flex items-center">
                        <Info className="h-3 w-3 mr-1" />
                        {errors.fileUpload}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="md:w-1/4">
          <div className="sticky top-8 space-y-6">
            <Card className="shadow-md border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Help & Tips</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="space-y-2.5">
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2.5 mt-0.5" />
                    Enter the exact name of the organization issuing the RFP
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2.5 mt-0.5" />
                    Upload the RFP document or paste the content directly
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2.5 mt-0.5" />
                    Include as much detail as possible for better results
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mr-2.5 mt-0.5" />
                    If available, include the URL to the original RFP
                  </li>
                </ul>
              </CardContent>
            </Card>

            <div className="flex flex-col space-y-3 pt-4">
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

      {/* Confirm Clear Dialog */}
      <Dialog open={confirmClearOpen} onOpenChange={closeConfirmClear}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clear RFP Text?</DialogTitle>
            <DialogDescription>
              Are you sure you want to clear the RFP text? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex space-x-2 justify-end">
            <Button variant="outline" onClick={closeConfirmClear}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmClear}>
              Yes, Clear Text
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// COMPONENT
export default function RFPResponseView(props: RFPResponseViewProps) {
  const model = useRFPResponse(props);
  return <RFPResponseViewComponent {...props} {...model} />;
}
