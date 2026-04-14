"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Button,
  Input,
  Select,
  Alert,
  LoadingSpinner,
  Card,
  Stack,
} from "@/components/ui";
import { workflowService, type CaseRecord } from "@/lib/api";
import { useFocusTrap } from "@/lib/accessibility-hooks";
import { X, CheckCircle, AlertTriangle } from "lucide-react";

export interface CaseResolutionModalProps {
  case: CaseRecord;
  isOpen: boolean;
  onClose: () => void;
  onResolved?: (resolved: CaseRecord) => void;
  isAr?: boolean;
  actor?: string;
}

export function CaseResolutionModal({
  case: caseData,
  isOpen,
  onClose,
  onResolved,
  isAr = false,
  actor,
}: CaseResolutionModalProps) {
  const [resolution, setResolution] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"open" | "pending" | "closed">("closed");
  const [isFaqCandidate, setIsFaqCandidate] = useState(caseData.is_faq_candidate || false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const modalRef = useFocusTrap(isOpen, onClose);

  const handleResolve = async () => {
    if (!resolution.trim()) {
      setError(isAr ? "يرجى إدخال إجابة الحل" : "Please enter a resolution answer");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      // Resolve the case
      const resolved = await workflowService.resolveCase(caseData.case_id, {
        resolution_answer: resolution,
        resolution_note: notes || undefined,
        actor: actor || "expert-user",
      });

      // Update status if needed
      if (status !== caseData.status) {
        await workflowService.updateCase(caseData.case_id, { status });
      }

      // Mark FAQ candidate if checked
      if (isFaqCandidate !== caseData.is_faq_candidate) {
        await workflowService.markFaqCandidate(caseData.case_id, isFaqCandidate);
      }

      setSuccess(true);
      onResolved?.(resolved);

      // Close modal after success
      setTimeout(() => {
        onClose();
        setResolution("");
        setNotes("");
        setStatus("closed");
        setIsFaqCandidate(false);
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(
        isAr
          ? "فشل حفظ الحل. يرجى المحاولة مرة أخرى."
          : "Failed to resolve case. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          aria-hidden="true"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="case-resolution-title"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
              <h2
                id="case-resolution-title"
                className="text-lg font-bold text-gray-900"
                style={{ color: "var(--text-primary)" }}
              >
                {isAr ? "حل الاستفسار" : "Resolve Inquiry"}
              </h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={isAr ? "إغلاق" : "Close"}
                type="button"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Case Summary */}
              <div style={{ borderLeft: "4px solid var(--info-500)" }}>
                <Card padding="md" className="">
                  <Stack direction="column" gap="sm">
                    <div className="text-sm font-semibold text-gray-600">
                      {isAr ? "ملخص الاستفسار" : "Query Summary"}
                    </div>
                    <p className="text-sm text-gray-900">{caseData.query}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap mt-2">
                      <span>
                        {isAr ? "رقم الحالة" : "Case ID"}: {caseData.case_id.slice(0, 8)}
                      </span>
                      <span>
                        {isAr ? "الأولوية" : "Priority"}: {caseData.priority}
                      </span>
                      <span>
                        {isAr ? "القطاع" : "Sector"}: {caseData.sector_primary}
                      </span>
                    </div>
                  </Stack>
                </Card>
              </div>

              {/* Escalation Context */}
              {caseData.escalation_reason && (
                <div style={{ borderLeft: "4px solid var(--warning-500)" }}>
                  <Card padding="md" className="">
                    <Stack direction="column" gap="sm">
                      <div className="text-sm font-semibold text-gray-600">
                        {isAr ? "سبب التصعيد" : "Escalation Reason"}
                      </div>
                      <p className="text-sm text-gray-700">
                        {caseData.escalation_reason}
                      </p>
                    </Stack>
                  </Card>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <Alert variant="error" title={isAr ? "خطأ" : "Error"}>
                  {error}
                </Alert>
              )}

              {/* Success Alert */}
              {success && (
                <Alert variant="success" title={isAr ? "نجاح" : "Success"}>
                  {isAr ? "تم حفظ الحل بنجاح" : "Resolution saved successfully"}
                </Alert>
              )}

              {/* Resolution Form */}
              {!success && (
                <Stack direction="column" gap="md">
                  {/* Resolution Answer */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {isAr ? "إجابة الحل *" : "Resolution Answer *"}
                    </label>
                    <textarea
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      placeholder={
                        isAr
                          ? "أدخل الإجابة الموثقة والمفصلة..."
                          : "Enter the detailed, documented response..."
                      }
                      className="w-full h-40 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                      disabled={loading}
                    />
                    <p className="text-xs text-gray-500">
                      {isAr
                        ? "قدم إجابة شاملة وموثقة بالمراجع القانونية"
                        : "Provide a comprehensive answer with legal references"}
                    </p>
                  </div>

                  {/* Internal Notes */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {isAr ? "ملاحظات داخلية" : "Internal Notes (Optional)"}
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={
                        isAr
                          ? "ملاحظات للخبراء الآخرين أو التوثيق الداخلي..."
                          : "Notes for other experts or internal documentation..."
                      }
                      className="w-full h-24 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                      disabled={loading}
                    />
                  </div>

                  {/* Status Update */}
                  <Select
                    label={isAr ? "حالة الحالة" : "Case Status"}
                    options={[
                      { value: "open", label: isAr ? "مفتوح" : "Open" },
                      {
                        value: "pending",
                        label: isAr ? "قيد الانتظار" : "Pending",
                      },
                      { value: "closed", label: isAr ? "مُغلق" : "Closed" },
                    ]}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    disabled={loading}
                  />

                  {/* FAQ Candidate Checkbox */}
                  <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <input
                      type="checkbox"
                      id="faq-candidate"
                      checked={isFaqCandidate}
                      onChange={(e) => setIsFaqCandidate(e.target.checked)}
                      disabled={loading}
                      className="mt-1 rounded cursor-pointer"
                    />
                    <label htmlFor="faq-candidate" className="text-sm cursor-pointer flex-1">
                      <div className="font-semibold text-gray-900">
                        {isAr ? "مرشح FAQ" : "FAQ Candidate"}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {isAr
                          ? "وضع علامة على هذا الاستفسار كسؤال شائع لإعادة استخدام الإجابة في المستقبل"
                          : "Mark this inquiry as a frequently asked question for future reuse"}
                      </div>
                    </label>
                  </div>
                </Stack>
              )}

              {/* Actions */}
              {!success && (
                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Button
                    variant="ghost"
                    onClick={onClose}
                    disabled={loading}
                  >
                    {isAr ? "إلغاء" : "Cancel"}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleResolve}
                    disabled={loading || !resolution.trim()}
                  >
                    {loading ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        {isAr ? "حفظ الحل" : "Save Resolution"}
                      </>
                    )}
                  </Button>
                </div>
              )}

              {success && (
                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Button variant="primary" onClick={onClose}>
                    {isAr ? "إغلاق" : "Close"}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
