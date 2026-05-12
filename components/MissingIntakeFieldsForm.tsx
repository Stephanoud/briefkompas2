"use client";

import { type ChangeEvent, useMemo, useState } from "react";
import { MissingCriticalInfoField } from "@/lib/intake/completeness";
import { IntakeFormData } from "@/types";
import { Alert } from "@/components/Alerts";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";

interface MissingIntakeFieldsFormProps {
  fields: MissingCriticalInfoField[];
  intakeData: IntakeFormData;
  onSave: (updatedIntakeData: IntakeFormData) => void;
}

function isEditableField(
  field: MissingCriticalInfoField
): field is MissingCriticalInfoField & { field: keyof IntakeFormData } {
  return field.field !== "decisionDocument" && field.field !== "procedureType" && field.inputType !== "upload";
}

export function MissingIntakeFieldsForm({
  fields,
  intakeData,
  onSave,
}: MissingIntakeFieldsFormProps) {
  const editableFields = useMemo(() => fields.filter(isEditableField), [fields]);
  const uploadFields = useMemo(() => fields.filter((field) => field.inputType === "upload"), [fields]);
  const initialValues = useMemo(() => {
    const nextValues: Record<string, string> = {};
    editableFields.forEach((field) => {
      const value = intakeData[field.field];
      nextValues[String(field.field)] = typeof value === "string" ? value : "";
    });
    return nextValues;
  }, [editableFields, intakeData]);
  const [values, setValues] = useState<Record<string, string>>(() => initialValues);
  const [error, setError] = useState("");

  if (fields.length === 0) {
    return null;
  }

  const handleSubmit = () => {
    const missing = editableFields.filter((field) => !values[String(field.field)]?.trim());
    if (missing.length > 0) {
      setError(`Vul deze velden nog in: ${missing.map((field) => field.label).join(", ")}.`);
      return;
    }

    const updatedData: IntakeFormData = {
      ...intakeData,
      files: intakeData.files ?? {},
    };

    editableFields.forEach((field) => {
      const value = values[String(field.field)]?.trim();
      if (value) {
        (updatedData as unknown as Record<string, unknown>)[field.field] = value;
      }
    });

    onSave(updatedData);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-[var(--foreground)]">Ontbrekende gegevens aanvullen</h4>
        <p className="mt-1 text-sm leading-6 text-[var(--muted-strong)]">
          Vul alleen de ontbrekende punten in. Je eerdere intakegegevens blijven behouden.
        </p>
      </div>

      {uploadFields.length > 0 && (
        <Alert type="warning" title="Upload nodig">
          Upload of vervang het besluit via de intakepagina. De overige gegevens kun je hieronder aanvullen.
        </Alert>
      )}

      {editableFields.length > 0 && (
        <div className="mt-4 space-y-4">
          {editableFields.map((field) => {
            const fieldKey = String(field.field);
            const value = values[fieldKey] ?? "";
            const commonProps = {
              label: field.question,
              value,
              onChange: (
                event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
              ) => {
                setValues((current) => ({
                  ...current,
                  [fieldKey]: event.target.value,
                }));
                setError("");
              },
            };

            return field.inputType === "textarea" ? (
              <Textarea key={fieldKey} {...commonProps} />
            ) : (
              <Input key={fieldKey} {...commonProps} />
            );
          })}

          {error && (
            <Alert type="error" title="Nog niet compleet">
              {error}
            </Alert>
          )}

          <Button type="button" onClick={handleSubmit} className="w-full">
            Aanvullingen opslaan
          </Button>
        </div>
      )}
    </div>
  );
}
