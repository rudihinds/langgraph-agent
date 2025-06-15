import { RFPSynthesisInterrupt } from "./rfp-synthesis-interrupt";
import { GenericInterruptView } from "./generic-interrupt";
import { BaseInterruptPayload, SynthesisInterruptPayload } from "../../providers/StreamProvider";

interface GenericInterruptHandlerProps {
  interrupt: BaseInterruptPayload | string;
  onResume: (action: string, feedback?: string) => Promise<void>;
  isLoading?: boolean;
}

export function GenericInterruptHandler({ 
  interrupt, 
  onResume, 
  isLoading = false 
}: GenericInterruptHandlerProps) {
  // Handle string interrupts (legacy)
  if (typeof interrupt === 'string') {
    return (
      <GenericInterruptView interrupt={{ message: interrupt }} />
    );
  }

  // Handle specific interrupt types with custom components
  switch (interrupt.type) {
    case 'rfp_analysis_review':
      return (
        <RFPSynthesisInterrupt
          interrupt={interrupt as SynthesisInterruptPayload}
          onResume={onResume}
          isLoading={isLoading}
        />
      );
    
    // Add other interrupt types here as needed
    // case 'document_review':
    //   return <DocumentReviewInterrupt ... />;
    // case 'approval_required':
    //   return <ApprovalInterrupt ... />;
    
    default:
      // Fallback to generic interrupt view for unknown types
      return (
        <GenericInterruptView interrupt={interrupt} />
      );
  }
}