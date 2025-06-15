import { useState } from "react";
import { Button } from "@/features/ui/components/button";
import { Textarea } from "@/features/ui/components/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/features/ui/components/card";
import { Badge } from "@/features/ui/components/badge";
import { CheckCircle, AlertTriangle, Target, Clock } from "lucide-react";
import { SynthesisInterruptPayload } from "../../providers/StreamProvider";

interface RFPSynthesisInterruptProps {
  interrupt: SynthesisInterruptPayload;
  onResume: (action: string, feedback?: string) => Promise<void>;
  isLoading?: boolean;
}

export function RFPSynthesisInterrupt({ 
  interrupt, 
  onResume, 
  isLoading = false 
}: RFPSynthesisInterruptProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);

  const handleActionSelect = (action: string) => {
    setSelectedAction(action);
    if (action === "modify") {
      setShowFeedback(true);
    } else {
      setShowFeedback(false);
      handleSubmit(action);
    }
  };

  const handleSubmit = async (action: string, userFeedback?: string) => {
    if (action === "modify" && !userFeedback?.trim()) {
      return; // Don't submit without feedback for modify action
    }
    
    try {
      await onResume(action, userFeedback);
    } catch (error) {
      console.error("Error submitting interrupt response:", error);
    }
  };

  const synthesis = interrupt.synthesisData;
  
  return (
    <Card className="w-full max-w-4xl mx-auto mb-6 border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-600" />
          <CardTitle className="text-blue-900">RFP Analysis Complete - Review Required</CardTitle>
        </div>
        <p className="text-sm text-blue-700">{interrupt.question}</p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Executive Summary */}
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="font-semibold text-gray-900 mb-2">📋 Executive Summary</h3>
          <p className="text-sm text-gray-700">{synthesis?.executive_summary?.strategic_recommendation}</p>
        </div>

        {/* Key Insights */}
        {synthesis?.executive_summary?.key_insights && (
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="font-semibold text-gray-900 mb-2">🔍 Key Insights</h3>
            <ul className="space-y-1">
              {synthesis.executive_summary.key_insights.slice(0, 3).map((insight: string, idx: number) => (
                <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Critical Risks and Opportunities */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Risks */}
          {synthesis?.critical_elimination_risks && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h3 className="font-semibold text-red-900">Critical Elimination Risks</h3>
                <Badge variant="destructive" className="text-xs">
                  {synthesis.critical_elimination_risks.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {synthesis.critical_elimination_risks.slice(0, 2).map((risk: any, idx: number) => (
                  <div key={idx} className="text-sm">
                    <div className="font-medium text-red-800">{risk.risk_id}</div>
                    <div className="text-red-700">{risk.risk_description}</div>
                    <Badge variant="outline" className="text-xs mt-1">{risk.impact}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Opportunities */}
          {synthesis?.highest_scoring_opportunities && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <h3 className="font-semibold text-green-900">High-Scoring Opportunities</h3>
                <Badge variant="default" className="text-xs bg-green-600">
                  {synthesis.highest_scoring_opportunities.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {synthesis.highest_scoring_opportunities.slice(0, 2).map((opp: any, idx: number) => (
                  <div key={idx} className="text-sm">
                    <div className="font-medium text-green-800">{opp.opportunity_id}</div>
                    <div className="text-green-700">{opp.opportunity_description}</div>
                    <Badge variant="outline" className="text-xs mt-1">{opp.scoring_potential}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Immediate Actions */}
        {synthesis?.implementation_roadmap?.immediate_actions && (
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <h3 className="font-semibold text-orange-900">Immediate Actions Required</h3>
            </div>
            <ul className="space-y-1">
              {synthesis.implementation_roadmap.immediate_actions.slice(0, 3).map((action: any, idx: number) => (
                <li key={idx} className="text-sm text-orange-700 flex items-start gap-2">
                  <span className="text-orange-500 mt-1">•</span>
                  <span>
                    <strong>{action.action}</strong> - {action.urgency_reason}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Win Probability */}
        {synthesis?.executive_summary?.win_probability_factors && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">🎯 Win Probability Assessment</h3>
            <p className="text-sm text-blue-700">{synthesis.executive_summary.win_probability_factors.overall_assessment}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="border-t pt-4">
          <div className="flex flex-wrap gap-3 mb-4">
            <Button
              onClick={() => handleActionSelect("approve")}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve Analysis
            </Button>
            
            <Button
              onClick={() => handleActionSelect("modify")}
              disabled={isLoading}
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              Request Modifications
            </Button>
            
            <Button
              onClick={() => handleActionSelect("reject")}
              disabled={isLoading}
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Reject & Restart
            </Button>
          </div>

          {/* Feedback Input */}
          {showFeedback && (
            <div className="space-y-3 bg-orange-50 p-4 rounded-lg border border-orange-200">
              <label className="block text-sm font-medium text-orange-900">
                Please provide specific feedback for modifications:
              </label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Describe what aspects you'd like modified or what additional analysis you need..."
                rows={3}
                className="resize-none"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => handleSubmit("modify", feedback)}
                  disabled={isLoading || !feedback.trim()}
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Submit Feedback
                </Button>
                <Button
                  onClick={() => {
                    setShowFeedback(false);
                    setSelectedAction(null);
                    setFeedback("");
                  }}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}