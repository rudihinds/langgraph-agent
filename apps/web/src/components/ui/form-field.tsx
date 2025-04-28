import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/form-error";
import { cn } from "@/lib/utils/utils";

type FieldBaseProps = {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  description?: string;
  className?: string;
};

type InputFieldProps = FieldBaseProps & {
  type: "text" | "email" | "password" | "number" | "tel" | "url";
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
};

type TextareaFieldProps = FieldBaseProps & {
  type: "textarea";
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  rows?: number;
};

type DateFieldProps = FieldBaseProps & {
  type: "date";
  value: Date | undefined;
  onChange: (value: Date | undefined) => void;
  DatePickerComponent: React.ComponentType<{
    date: Date | undefined;
    onDateChange: (date: Date | undefined) => void;
    label: string;
    error?: string;
    className?: string;
    allowManualInput?: boolean;
  }>;
  allowManualInput?: boolean;
};

type FormFieldProps = InputFieldProps | TextareaFieldProps | DateFieldProps;

export function FormField(props: FormFieldProps) {
  const { id, label, error, required, description, className } = props;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-base font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {props.type === "textarea" && (
        <Textarea
          id={id}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          rows={props.rows || 4}
          className={cn(
            error
              ? "border-destructive/70 ring-0 focus-visible:ring-destructive/30"
              : "border-input"
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      )}

      {(props.type === "text" ||
        props.type === "email" ||
        props.type === "password" ||
        props.type === "number" ||
        props.type === "tel" ||
        props.type === "url") && (
        <Input
          id={id}
          type={props.type}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          autoComplete={props.autoComplete}
          inputMode={props.inputMode}
          className={cn(
            error
              ? "border-destructive/70 ring-0 focus-visible:ring-destructive/30"
              : "border-input"
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      )}

      {props.type === "date" && (
        <div className={cn("rounded-md", error ? "border-destructive/70" : "")}>
          <props.DatePickerComponent
            date={props.value}
            onDateChange={props.onChange}
            label=""
            error={error}
            className="w-full"
            allowManualInput={props.allowManualInput}
          />
        </div>
      )}

      {error && <FieldError error={error} id={`${id}-error`} />}
    </div>
  );
}
