import { useState, useEffect, useRef } from "react";
import { Button } from "@/features/ui/components/button";
import { Textarea } from "@/features/ui/components/textarea";
import { haveArgsChanged } from "../../utils/agent-inbox-utils";
import { SubmitType } from "@/features/chat-ui/types/index";
import { ArrowUpRight } from "lucide-react";

interface InboxItemInputProps {
  initialValue: string | Record<string, unknown>;
  inputType: SubmitType;
  onSubmit: (value: string | Record<string, unknown>) => void;
  hasAccept?: boolean;
  editsMade?: boolean;
  disableEdits?: boolean;
}

export function InboxItemInput({
  initialValue,
  inputType,
  onSubmit,
  hasAccept,
  editsMade,
  disableEdits,
}: InboxItemInputProps) {
  const isRecord = typeof initialValue !== "string";
  const [value, setValue] = useState<string | Record<string, unknown>>(
    isRecord ? { ...initialValue } : (initialValue ?? "")
  );
  const [submitIsAccept, setSubmitIsAccept] = useState(false);
  const initialValuesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (isRecord && typeof initialValue === "object") {
      Object.entries(initialValue).forEach(([k, v]) => {
        initialValuesRef.current[k] = ["string", "number"].includes(typeof v)
          ? String(v)
          : JSON.stringify(v, null);
      });
    }
  }, [initialValue, isRecord]);

  const handleSubmit = () => {
    if (submitIsAccept) {
      onSubmit(initialValue);
    } else {
      onSubmit(value);
    }
  };

  const isArgsEdited = isRecord
    ? haveArgsChanged(value, initialValuesRef.current)
    : value !== initialValue;

  const isAcceptButtonEnabled = hasAccept && !isArgsEdited;

  if (inputType === "response") {
    return (
      <div className="flex w-full flex-col gap-1">
        <Textarea
          placeholder="Type your response..."
          rows={3}
          className="resize-none"
          value={value as string}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleSubmit();
            }
          }}
        />
        <div className="flex flex-row justify-end">
          <Button
            onClick={handleSubmit}
            className="flex flex-row items-center gap-1"
          >
            <span>Send</span>
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (inputType === "edit") {
    return (
      <div className="flex w-full flex-col gap-1">
        {isRecord ? (
          <div className="flex w-full flex-col gap-1">
            {Object.entries(value as Record<string, unknown>).map(
              ([key, val]) => {
                return (
                  <div key={key} className="flex w-full flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">
                      {key}
                    </label>
                    <Textarea
                      value={
                        typeof val === "string"
                          ? val
                          : JSON.stringify(val, null, 2)
                      }
                      disabled={disableEdits}
                      rows={3}
                      className="resize-none"
                      onChange={(e) => {
                        let parsed: unknown;
                        try {
                          parsed = JSON.parse(e.target.value);
                        } catch (err) {
                          parsed = e.target.value;
                        }
                        setValue((prev) => ({
                          ...(prev as Record<string, unknown>),
                          [key]: parsed,
                        }));
                      }}
                    />
                  </div>
                );
              }
            )}
          </div>
        ) : (
          <Textarea
            placeholder="Type your response..."
            rows={3}
            className="resize-none"
            value={value as string}
            disabled={disableEdits}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
          />
        )}
        <div className="flex flex-row justify-end items-center gap-2">
          {isAcceptButtonEnabled && (
            <Button
              onClick={() => {
                setSubmitIsAccept(true);
                handleSubmit();
              }}
              className="flex flex-row items-center gap-1"
              variant="outline"
            >
              <span>Accept</span>
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={disableEdits}
            variant={isAcceptButtonEnabled ? "outline" : "default"}
            className="flex flex-row items-center gap-1"
          >
            <span>
              {editsMade || isArgsEdited ? "Continue with edits" : "Submit"}
            </span>
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-row justify-end">
      <Button
        onClick={handleSubmit}
        className="flex flex-row items-center gap-1"
      >
        <span>Continue</span>
        <ArrowUpRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
