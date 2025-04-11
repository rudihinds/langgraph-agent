// "use client";

// import { useState, useCallback, useEffect } from "react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea";
// import { Label } from "@/components/ui/label";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardFooter,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import { EnhancedFormBanner } from "./EnhancedFormBanner";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import {
//   Upload,
//   File,
//   FileText,
//   Trash,
//   Plus,
//   Info,
//   Check,
//   ChevronRight,
//   Save,
//   HelpCircle,
//   CheckCircle2,
//   AlertCircle,
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
// import { FormErrorBoundary, FieldError } from "@/components/ui/form-error";
// import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// import { useToast } from "@/components/ui/use-toast";

// // MODEL
// export interface RFPResponseViewProps {
//   onSubmit: (
//     data:
//       | {
//           rfpUrl: string;
//           rfpText: string;
//           companyName: string;
//           file?: File;
//           document?: {
//             name: string;
//             type: string;
//             size: number;
//             lastModified: number;
//           };
//         }
//       | { errors: Record<string, string> }
//   ) => void;
//   onBack: () => void;
//   formErrors?: Record<string, string>;
// }

// interface UseRFPResponseModel {
//   rfpUrl: string;
//   rfpText: string;
//   companyName: string;
//   fileName: string | null;
//   isUploading: boolean;
//   confirmClearOpen: boolean;
//   errors: Record<string, string>;
//   isSaving: boolean;
//   lastSaved: Date | null;
//   setRfpUrl: (url: string) => void;
//   setRfpText: (text: string) => void;
//   setCompanyName: (name: string) => void;
//   handleSubmit: () => void;
//   handleBack: () => void;
//   handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
//   handleRemoveFile: () => void;
//   validateForm: () => boolean;
//   openConfirmClear: () => void;
//   closeConfirmClear: () => void;
//   confirmClear: () => void;
//   handleFocus: (
//     e: React.FocusEvent<
//       HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement
//     >
//   ) => void;
// }

// function useRFPResponse({
//   onSubmit,
//   onBack,
//   formErrors,
// }: RFPResponseViewProps): UseRFPResponseModel {
//   const [rfpUrl, setRfpUrl] = useState("");
//   const [rfpText, setRfpText] = useState("");
//   const [companyName, setCompanyName] = useState("");
//   const [fileName, setFileName] = useState<string | null>(null);
//   const [isUploading, setIsUploading] = useState(false);
//   const [confirmClearOpen, setConfirmClearOpen] = useState(false);
//   const [errors, setErrors] = useState<Record<string, string>>({});
//   const [isSaving, setIsSaving] = useState(false);
//   const [lastSaved, setLastSaved] = useState<Date | null>(null);
//   const [rfpDetails, setRfpDetails] = useState<Record<string, any>>({});
//   const { toast } = useToast();

//   // Load saved data from localStorage on mount
//   useEffect(() => {
//     const savedData = localStorage.getItem("rfpResponseData");
//     if (savedData) {
//       try {
//         const { rfpUrl, rfpText, companyName } = JSON.parse(savedData);
//         if (rfpUrl) setRfpUrl(rfpUrl);
//         if (rfpText) setRfpText(rfpText);
//         if (companyName) setCompanyName(companyName);
//       } catch (e) {
//         console.error("Failed to parse saved RFP data:", e);
//       }
//     }
//   }, []);

//   // Auto-save to localStorage when data changes
//   useEffect(() => {
//     const saveTimeout = setTimeout(() => {
//       if (rfpUrl || rfpText || companyName) {
//         setIsSaving(true);
//         localStorage.setItem(
//           "rfpResponseData",
//           JSON.stringify({ rfpUrl, rfpText, companyName })
//         );

//         // Simulate a short delay to show the saving indicator
//         setTimeout(() => {
//           setIsSaving(false);
//           setLastSaved(new Date());
//         }, 600);
//       }
//     }, 1000); // Debounce for 1 second

//     return () => clearTimeout(saveTimeout);
//   }, [rfpUrl, rfpText, companyName]);

//   // Update local errors when external formErrors change
//   useEffect(() => {
//     if (formErrors && Object.keys(formErrors).length > 0) {
//       setErrors((prev) => ({
//         ...prev,
//         ...formErrors,
//       }));

//       // Display a toast for external errors
//       if (formErrors.submission) {
//         toast({
//           title: "Error",
//           description: formErrors.submission,
//           variant: "destructive",
//         });
//       }
//     }
//   }, [formErrors, toast]);

//   const validateForm = useCallback(() => {
//     try {
//       console.log("Validating RFP form data");

//       const newErrors: Record<string, string> = {};
//       let isValid = true;

//       // Validate company name
//       if (!companyName.trim()) {
//         console.log("Validation error: Company name is missing");
//         newErrors.companyName = "Company name is required";
//         isValid = false;
//       }

//       // Validate RFP source (either URL or text)
//       if (!rfpUrl.trim() && !rfpText.trim()) {
//         console.log("Validation error: No RFP source provided");
//         newErrors.rfpSource = "Please provide either a URL or the RFP text";
//         isValid = false;
//       }

//       // If there are any errors, add a generic _form error
//       if (!isValid) {
//         console.log("Form validation failed with errors:", newErrors);
//         newErrors._form =
//           "Please correct the errors in the form before continuing.";
//       } else {
//         console.log("Form validation successful");
//       }

//       setErrors(newErrors);
//       return isValid;
//     } catch (error) {
//       console.error("Unexpected error during form validation:", error);
//       setErrors({
//         _form: "An unexpected error occurred during validation.",
//       });
//       return false;
//     }
//   }, [rfpUrl, rfpText, companyName]);

//   const handleSubmit = useCallback(() => {
//     console.log("Submit button clicked, validating form...");

//     const isValid = validateForm();
//     console.log(
//       "Form validation result:",
//       isValid ? "Valid" : "Invalid",
//       isValid ? "" : "Errors:",
//       isValid ? "" : errors
//     );

//     if (isValid) {
//       console.log("Form is valid, submitting data");
//       onSubmit({
//         companyName,
//         rfpUrl,
//         rfpText,
//         file: rfpDetails.file,
//         document: rfpDetails.document,
//       });
//     } else {
//       // Focus the first field with an error
//       console.log("Attempting to focus the first field with an error");
//       const firstErrorField = Object.keys(errors).filter(
//         (key) => key !== "_form"
//       )[0];

//       if (firstErrorField === "companyName") {
//         const field = document.getElementById("companyName");
//         if (field) {
//           console.log("Focusing on company name field");
//           field.focus();
//           field.scrollIntoView({ behavior: "smooth", block: "center" });
//         }
//       } else if (firstErrorField === "rfpSource") {
//         const field = document.getElementById("rfpText");
//         if (field) {
//           console.log("Focusing on RFP text field");
//           field.focus();
//           field.scrollIntoView({ behavior: "smooth", block: "center" });
//         }
//       }

//       // Show a toast to make the error more visible
//       toast({
//         title: "Validation Error",
//         description: "Please correct the errors in the form before continuing.",
//         variant: "destructive",
//       });
//     }
//   }, [
//     rfpUrl,
//     rfpText,
//     companyName,
//     validateForm,
//     onSubmit,
//     rfpDetails,
//     toast,
//     errors,
//   ]);

//   const handleBack = useCallback(() => {
//     onBack();
//   }, [onBack]);

//   const handleFileUpload = useCallback(
//     (e: React.ChangeEvent<HTMLInputElement>) => {
//       const file = e.target.files?.[0];
//       if (!file) return;

//       setFileName(file.name);
//       setIsUploading(true);

//       // Store the actual file object for upload
//       const fileForUpload = file;

//       const reader = new FileReader();
//       reader.onload = (event) => {
//         const content = event.target?.result as string;
//         if (content) {
//           setRfpText(content);

//           // Create a document object with file metadata that can be saved to the proposal
//           const document = {
//             name: file.name,
//             type: file.type,
//             size: file.size,
//             lastModified: file.lastModified,
//           };

//           // Store both the file for upload and the document metadata
//           setRfpDetails((prev) => ({
//             ...prev,
//             file: fileForUpload,
//             document: document,
//             companyName,
//             rfpUrl,
//             rfpText: content,
//           }));
//         }
//         setIsUploading(false);
//       };

//       reader.onerror = () => {
//         setIsUploading(false);
//         // Reset file input
//         e.target.value = "";
//         setFileName(null);
//         setErrors({
//           ...errors,
//           fileUpload: "Failed to read file. Please try again.",
//         });
//       };

//       reader.readAsText(file);
//     },
//     [errors, companyName, rfpUrl]
//   );

//   const handleRemoveFile = useCallback(() => {
//     setFileName(null);
//     setRfpText("");

//     // Clear any error related to file upload
//     if (errors.fileUpload) {
//       const newErrors = { ...errors };
//       delete newErrors.fileUpload;
//       setErrors(newErrors);
//     }
//   }, [errors]);

//   const openConfirmClear = useCallback(() => {
//     if (rfpText.trim()) {
//       setConfirmClearOpen(true);
//     }
//   }, [rfpText]);

//   const closeConfirmClear = useCallback(() => {
//     setConfirmClearOpen(false);
//   }, []);

//   const confirmClear = useCallback(() => {
//     setRfpText("");
//     setFileName(null);
//     closeConfirmClear();
//   }, [closeConfirmClear]);

//   const handleFocus = useCallback(
//     (
//       e: React.FocusEvent<
//         HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement
//       >
//     ) => {
//       // Move cursor to the end of text on focus if it's an input or textarea
//       if (
//         e.target instanceof HTMLInputElement ||
//         e.target instanceof HTMLTextAreaElement
//       ) {
//         const target = e.target;
//         const length = target.value.length;

//         // Use setTimeout to ensure this happens after the default focus behavior
//         setTimeout(() => {
//           target.selectionStart = length;
//           target.selectionEnd = length;
//         }, 0);
//       }
//     },
//     []
//   );

//   return {
//     rfpUrl,
//     rfpText,
//     companyName,
//     fileName,
//     isUploading,
//     confirmClearOpen,
//     errors,
//     isSaving,
//     lastSaved,
//     setRfpUrl,
//     setRfpText,
//     setCompanyName,
//     handleSubmit,
//     handleBack,
//     handleFileUpload,
//     handleRemoveFile,
//     validateForm,
//     openConfirmClear,
//     closeConfirmClear,
//     confirmClear,
//     handleFocus,
//   };
// }

// // VIEW
// interface RFPResponseViewComponentProps extends RFPResponseViewProps {
//   rfpUrl: string;
//   rfpText: string;
//   companyName: string;
//   fileName: string | null;
//   isUploading: boolean;
//   confirmClearOpen: boolean;
//   errors: Record<string, string>;
//   isSaving: boolean;
//   lastSaved: Date | null;
//   setRfpUrl: (url: string) => void;
//   setRfpText: (text: string) => void;
//   setCompanyName: (name: string) => void;
//   handleSubmit: () => void;
//   handleBack: () => void;
//   handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
//   handleRemoveFile: () => void;
//   openConfirmClear: () => void;
//   closeConfirmClear: () => void;
//   confirmClear: () => void;
//   handleFocus: (
//     e: React.FocusEvent<
//       HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement
//     >
//   ) => void;
// }

// function RFPResponseViewComponent({
//   rfpUrl,
//   rfpText,
//   companyName,
//   fileName,
//   isUploading,
//   confirmClearOpen,
//   errors,
//   isSaving,
//   lastSaved,
//   setRfpUrl,
//   setRfpText,
//   setCompanyName,
//   handleSubmit,
//   handleBack,
//   handleFileUpload,
//   handleRemoveFile,
//   openConfirmClear,
//   closeConfirmClear,
//   confirmClear,
//   handleFocus,
// }: RFPResponseViewComponentProps) {
//   return (
//     <TooltipProvider>
//       <div className="container max-w-5xl px-4 py-6 mx-auto sm:px-6 lg:px-8">
//         <FormErrorBoundary initialErrors={errors}>
//           <div className="flex flex-col gap-4 lg:flex-row">
//             <div className="w-full">
//               <div className="mb-4">
//                 <h1 className="mb-2 text-3xl font-bold tracking-tight">
//                   RFP Details
//                 </h1>
//                 <p className="text-lg text-muted-foreground">
//                   Upload or paste the RFP document to generate a response
//                 </p>
//               </div>

//               <EnhancedFormBanner className="mb-4" />

//               <motion.div
//                 initial={{ opacity: 0, y: 20 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 transition={{ duration: 0.3 }}
//               >
//                 <Card className="mb-4 border-0 shadow-md">
//                   <CardHeader className="pb-3 border-b bg-muted/30">
//                     <div className="flex items-center justify-between">
//                       <CardTitle className="text-xl">RFP Information</CardTitle>
//                       <div className="flex items-center gap-2">
//                         {isSaving && (
//                           <span className="flex items-center text-xs text-muted-foreground animate-pulse">
//                             <Save className="w-3 h-3 mr-1" />
//                             Saving...
//                           </span>
//                         )}
//                         {!isSaving && lastSaved && (
//                           <span className="flex items-center text-xs text-muted-foreground">
//                             <Check className="w-3 h-3 mr-1 text-green-500" />
//                             Saved {lastSaved.toLocaleTimeString()}
//                           </span>
//                         )}
//                       </div>
//                     </div>
//                     <CardDescription>
//                       Provide the RFP details to generate a tailored response
//                     </CardDescription>
//                   </CardHeader>
//                   <CardContent className="pt-6 bg-white">
//                     {/* Required fields indicator */}
//                     <p className="mb-2 text-xs text-muted-foreground">
//                       <span className="text-destructive">*</span> Required
//                       fields
//                     </p>

//                     {/* Preserve only submission errors, remove duplicated validation errors */}
//                     {errors.submission && (
//                       <Alert variant="destructive" className="mb-4">
//                         <AlertCircle className="w-4 h-4" />
//                         <AlertTitle>Submission Error</AlertTitle>
//                         <AlertDescription>{errors.submission}</AlertDescription>
//                       </Alert>
//                     )}

//                     <div>
//                       <Label
//                         htmlFor="companyName"
//                         className="flex items-center mb-1.5 text-base font-medium"
//                       >
//                         Company or Organization Name
//                         <span className="ml-1 text-destructive">*</span>
//                         <TooltipProvider>
//                           <Tooltip>
//                             <TooltipTrigger asChild>
//                               <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5 cursor-help" />
//                             </TooltipTrigger>
//                             <TooltipContent
//                               side="top"
//                               className="p-3 text-sm w-80"
//                             >
//                               <p>
//                                 Enter the full official name of the organization
//                                 issuing the RFP. This helps tailor the response
//                                 to the specific company's needs and industry
//                                 context.
//                               </p>
//                             </TooltipContent>
//                           </Tooltip>
//                         </TooltipProvider>
//                       </Label>
//                       <Input
//                         id="companyName"
//                         value={companyName}
//                         onChange={(e) => setCompanyName(e.target.value)}
//                         placeholder="Enter the name of the company or organization issuing the RFP"
//                         className={cn(
//                           errors.companyName
//                             ? "border-destructive"
//                             : "border-input"
//                         )}
//                         aria-invalid={!!errors.companyName}
//                         aria-describedby={
//                           errors.companyName ? "company-name-error" : undefined
//                         }
//                         onFocus={handleFocus}
//                       />
//                       {errors.companyName && (
//                         <FieldError
//                           error={errors.companyName}
//                           id="company-name-error"
//                         />
//                       )}
//                     </div>

//                     <div className="mt-4">
//                       <Label
//                         htmlFor="rfpUrl"
//                         className="flex items-center mb-1.5 text-base font-medium"
//                       >
//                         RFP URL (Optional)
//                         <TooltipProvider>
//                           <Tooltip>
//                             <TooltipTrigger asChild>
//                               <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5 cursor-help" />
//                             </TooltipTrigger>
//                             <TooltipContent
//                               side="top"
//                               className="p-3 text-sm w-80"
//                             >
//                               <p>
//                                 If the RFP is available online, provide the
//                                 direct link to the document. This allows the
//                                 system to access the most up-to-date version of
//                                 the RFP.
//                               </p>
//                             </TooltipContent>
//                           </Tooltip>
//                         </TooltipProvider>
//                       </Label>
//                       <Input
//                         id="rfpUrl"
//                         type="url"
//                         value={rfpUrl}
//                         onChange={(e) => setRfpUrl(e.target.value)}
//                         placeholder="https://example.com/rfp-document"
//                         onFocus={handleFocus}
//                       />
//                       <p className="mt-1 text-xs text-muted-foreground">
//                         If the RFP is available online, enter the URL here
//                       </p>
//                     </div>

//                     <div className="relative mt-4">
//                       <Label
//                         htmlFor="rfpText"
//                         className="flex items-center mb-1.5 text-base font-medium"
//                       >
//                         RFP Document Text
//                         <TooltipProvider>
//                           <Tooltip>
//                             <TooltipTrigger asChild>
//                               <HelpCircle className="h-4 w-4 text-muted-foreground ml-1.5 cursor-help" />
//                             </TooltipTrigger>
//                             <TooltipContent
//                               side="top"
//                               className="p-3 text-sm w-80"
//                             >
//                               <p>
//                                 Copy and paste the content of the RFP document
//                                 or upload a file. Include all sections,
//                                 requirements, and evaluation criteria for the
//                                 most comprehensive analysis.
//                               </p>
//                             </TooltipContent>
//                           </Tooltip>
//                         </TooltipProvider>
//                       </Label>

//                       <div className="flex items-center gap-2 mb-1.5">
//                         <label
//                           htmlFor="file-upload"
//                           className={cn(
//                             "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-input bg-background",
//                             "hover:bg-muted cursor-pointer"
//                           )}
//                         >
//                           <Upload className="w-4 h-4" />
//                           Upload RFP File
//                         </label>
//                         <input
//                           id="file-upload"
//                           type="file"
//                           accept=".txt,.pdf,.doc,.docx"
//                           onChange={handleFileUpload}
//                           className="hidden"
//                           onFocus={handleFocus}
//                         />

//                         {fileName && (
//                           <div className="flex items-center gap-1.5 text-sm">
//                             <FileText className="w-4 h-4 text-muted-foreground" />
//                             <span className="text-muted-foreground truncate max-w-[200px]">
//                               {fileName}
//                             </span>
//                             <Button
//                               variant="ghost"
//                               size="icon"
//                               onClick={handleRemoveFile}
//                               className="w-6 h-6 rounded-full hover:bg-destructive/10 hover:text-destructive"
//                               aria-label="Remove file"
//                               onFocus={handleFocus}
//                             >
//                               <Trash className="h-3.5 w-3.5" />
//                             </Button>
//                           </div>
//                         )}
//                       </div>

//                       {isUploading ? (
//                         <div className="min-h-[200px] border rounded-md p-4 flex items-center justify-center">
//                           <div className="flex flex-col items-center gap-2">
//                             <div className="animate-pulse">
//                               <File className="w-12 h-12 text-muted-foreground" />
//                             </div>
//                             <p className="text-sm text-muted-foreground">
//                               Processing file...
//                             </p>
//                           </div>
//                         </div>
//                       ) : (
//                         <div className="relative">
//                           <Textarea
//                             id="rfpText"
//                             value={rfpText}
//                             onChange={(e) => setRfpText(e.target.value)}
//                             placeholder="Paste the content of the RFP document here..."
//                             className={cn(
//                               "min-h-[200px]",
//                               errors.rfpSource
//                                 ? "border-destructive"
//                                 : "border-input"
//                             )}
//                             aria-invalid={!!errors.rfpSource}
//                             aria-describedby={
//                               errors.rfpSource ? "rfp-source-error" : undefined
//                             }
//                             onFocus={handleFocus}
//                           />

//                           {rfpText && (
//                             <Button
//                               variant="ghost"
//                               size="icon"
//                               onClick={openConfirmClear}
//                               className="absolute w-6 h-6 p-0 rounded-full top-2 right-2 opacity-70 hover:opacity-100"
//                               aria-label="Clear text"
//                               onFocus={handleFocus}
//                             >
//                               <Trash className="h-3.5 w-3.5" />
//                             </Button>
//                           )}
//                         </div>
//                       )}

//                       {errors.rfpSource && (
//                         <FieldError
//                           error={errors.rfpSource}
//                           id="rfp-source-error"
//                         />
//                       )}
//                     </div>
//                   </CardContent>
//                 </Card>
//               </motion.div>
//             </div>

//             <div className="lg:w-1/4">
//               <div className="sticky space-y-4 top-24">
//                 <Card className="border-0 shadow-md">
//                   <CardHeader className="pb-2">
//                     <CardTitle className="text-base">Help & Tips</CardTitle>
//                   </CardHeader>
//                   <CardContent className="py-2 text-sm text-muted-foreground">
//                     <ul className="space-y-1.5">
//                       <CheckItem>
//                         Enter the exact name of the organization issuing the RFP
//                       </CheckItem>
//                       <CheckItem>
//                         Upload the RFP document or paste the content directly
//                       </CheckItem>
//                       <CheckItem>
//                         Include evaluation criteria and requirements sections
//                       </CheckItem>
//                       <CheckItem>
//                         If available, include the URL to the original RFP
//                       </CheckItem>
//                     </ul>
//                   </CardContent>
//                 </Card>

//                 <div className="flex flex-col pt-2 space-y-3">
//                   <Button
//                     onClick={(e) => {
//                       e.preventDefault();
//                       handleSubmit();
//                     }}
//                     size="lg"
//                     className="w-full"
//                     type="button"
//                   >
//                     Next
//                   </Button>
//                   <Button
//                     variant="outline"
//                     onClick={handleBack}
//                     size="lg"
//                     className="w-full"
//                   >
//                     Back
//                   </Button>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Confirm Clear Dialog */}
//           <Dialog open={confirmClearOpen} onOpenChange={closeConfirmClear}>
//             <DialogContent
//               className="sm:max-w-md"
//               aria-labelledby="clear-rfp-dialog-title"
//               aria-describedby="clear-rfp-dialog-description"
//             >
//               <DialogTitle id="clear-rfp-dialog-title">
//                 Clear RFP Text?
//               </DialogTitle>
//               <DialogDescription id="clear-rfp-dialog-description">
//                 Are you sure you want to clear the RFP text? This action cannot
//                 be undone.
//               </DialogDescription>
//               <DialogFooter className="sm:justify-end">
//                 <Button
//                   type="button"
//                   variant="outline"
//                   onClick={closeConfirmClear}
//                 >
//                   Cancel
//                 </Button>
//                 <Button
//                   type="button"
//                   variant="destructive"
//                   onClick={confirmClear}
//                 >
//                   Clear Text
//                 </Button>
//               </DialogFooter>
//             </DialogContent>
//           </Dialog>
//         </FormErrorBoundary>
//       </div>
//     </TooltipProvider>
//   );
// }

// // COMPONENT
// export default function RFPResponseView(props: RFPResponseViewProps) {
//   const model = useRFPResponse(props);
//   return <RFPResponseViewComponent {...props} {...model} />;
// }
