import React from "react";
import { Textarea } from "@/features/ui/components/textarea";
import { Switch } from "@/features/ui/components/switch";
import { Label } from "@/features/ui/components/label";
import { FieldError } from "@/features/ui/components/form-error";
import { cn } from "@/lib/utils/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/ui/components/select";
import { Button } from "@/features/ui/components/button";
import { Trash } from "lucide-react";

export type Question = {
  id: string;
  text: string;
  type: "text" | "multiline";
  required: boolean;
};

type QuestionFieldProps = {
  question: Question;
  index: number;
  onUpdate: (question: Question) => void;
  onDelete: () => void;
  error?: string;
  className?: string;
};

export function QuestionField({
  question,
  index,
  onUpdate,
  onDelete,
  error,
  className,
}: QuestionFieldProps) {
  const handleTextChange = (value: string) => {
    onUpdate({ ...question, text: value });
  };

  const handleTypeChange = (value: "text" | "multiline") => {
    onUpdate({ ...question, type: value });
  };

  const handleRequiredChange = (checked: boolean) => {
    onUpdate({ ...question, required: checked });
  };

  const id = `question_${question.id}_text`;

  return (
    <div
      className={cn(
        "space-y-3 p-4 border rounded-md",
        error ? "border-destructive/70" : "border-border",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Question {index + 1}</Label>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={onDelete}
          className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
          aria-label={`Delete question ${index + 1}`}
        >
          <Trash className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1.5">
        <Textarea
          id={id}
          value={question.text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Enter your question here"
          className={cn(
            error
              ? "border-destructive/70 ring-0 focus-visible:ring-destructive/30"
              : ""
          )}
          aria-invalid={!!error}
        />
        {error && <FieldError error={error} id={`${id}-error`} />}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`question_${question.id}_type`} className="text-sm">
            Answer Type
          </Label>
          <Select
            value={question.type}
            onValueChange={(value) =>
              handleTypeChange(value as "text" | "multiline")
            }
          >
            <SelectTrigger id={`question_${question.id}_type`} className="mt-1">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Short Text</SelectItem>
              <SelectItem value="multiline">Long Text</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col justify-end">
          <div className="flex items-center justify-end space-x-2 h-10 mt-auto">
            <Label
              htmlFor={`question_${question.id}_required`}
              className="text-sm cursor-pointer"
            >
              Required
            </Label>
            <Switch
              id={`question_${question.id}_required`}
              checked={question.required}
              onCheckedChange={handleRequiredChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
