"use client";

import { useState } from "react";
import { submitToGoogleForm } from "@/lib/google-form";
import { getGoogleFormConfig } from "@/lib/site-config";
import { Button } from "./Button";
import { Section, SectionHeader } from "./Section";

const initialForm = {
  fullName: "",
  businessName: "",
  mobile: "",
  email: "",
  city: "",
  state: "",
  numUsers: "",
  currentSoftware: "",
  message: "",
};

export function RequestForm() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const { isConfigured } = getGoogleFormConfig();

  function validate() {
    const next: Record<string, string> = {};
    if (!form.fullName.trim()) next.fullName = "Full name is required.";
    if (!form.businessName.trim())
      next.businessName = "Business / agency name is required.";
    if (!form.mobile.trim()) next.mobile = "Mobile number is required.";
    if (!form.email.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Enter a valid email address.";
    if (!form.city.trim()) next.city = "City is required.";
    if (!form.state.trim()) next.state = "State is required.";
    if (!form.numUsers.trim()) next.numUsers = "Number of users is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading" || status === "success") return;
    if (!validate()) return;

    setStatus("loading");
    setErrorMessage("");

    const result = await submitToGoogleForm(form);
    if (result.ok) {
      setStatus("success");
      setForm(initialForm);
      setErrors({});
      return;
    }

    setStatus("error");
    setErrorMessage(result.error);
  }

  function updateField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#0f3d3e] focus:ring-2 focus:ring-[#0f3d3e]/15";

  return (
    <Section id="contact" className="bg-white/60">
      <SectionHeader
        title="Request Insurance Desk"
        subtitle="Tell us about your business and we’ll get back to you with setup details."
      />

      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        {status === "success" ? (
          <div
            className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-6 text-center"
            role="status"
          >
            <p className="text-base font-medium text-[#0f3d3e]">
              Thank you! Your request has been submitted.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Our team will contact you shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {!isConfigured ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                The request form is not configured yet. Please contact E26
                directly while setup is in progress.
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name *" error={errors.fullName}>
                <input
                  className={inputClass}
                  value={form.fullName}
                  onChange={(e) => updateField("fullName", e.target.value)}
                  autoComplete="name"
                />
              </Field>
              <Field label="Business / Agency Name *" error={errors.businessName}>
                <input
                  className={inputClass}
                  value={form.businessName}
                  onChange={(e) => updateField("businessName", e.target.value)}
                  autoComplete="organization"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mobile Number *" error={errors.mobile}>
                <input
                  className={inputClass}
                  type="tel"
                  value={form.mobile}
                  onChange={(e) => updateField("mobile", e.target.value)}
                  autoComplete="tel"
                />
              </Field>
              <Field label="Email *" error={errors.email}>
                <input
                  className={inputClass}
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  autoComplete="email"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City *" error={errors.city}>
                <input
                  className={inputClass}
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  autoComplete="address-level2"
                />
              </Field>
              <Field label="State *" error={errors.state}>
                <input
                  className={inputClass}
                  value={form.state}
                  onChange={(e) => updateField("state", e.target.value)}
                  autoComplete="address-level1"
                />
              </Field>
            </div>

            <Field label="Number of Users *" error={errors.numUsers}>
              <input
                className={inputClass}
                type="number"
                min="1"
                value={form.numUsers}
                onChange={(e) => updateField("numUsers", e.target.value)}
              />
            </Field>

            <Field label="Current Software (optional)">
              <input
                className={inputClass}
                value={form.currentSoftware}
                onChange={(e) => updateField("currentSoftware", e.target.value)}
              />
            </Field>

            <Field label="Requirements / Message (optional)">
              <textarea
                className={`${inputClass} min-h-[100px] resize-y`}
                value={form.message}
                onChange={(e) => updateField("message", e.target.value)}
              />
            </Field>

            {status === "error" && errorMessage ? (
              <p className="text-sm text-red-600" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={status === "loading" || !isConfigured}
            >
              {status === "loading" ? "Submitting…" : "Submit Request"}
            </Button>
          </form>
        )}
      </div>
    </Section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-slate-700">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : null}
    </label>
  );
}
