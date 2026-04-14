"use client";
import { AppShell } from "@/components/AppShell";
import { PageHeader, StatusBadge, EmptyState, Button } from "@/components/ui";
import { useApp } from "@/components/AppShell";
import { Upload, FileText, Tag, Shield, AlertTriangle, CheckCircle, RefreshCw, Activity, Clock3, CheckCircle2, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeOwnerId } from "@/lib/user-context";
import { listJobs, upsertJob, updateJob, UploadJob } from "@/lib/processing-status";
import { getServiceBaseUrl } from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";

type IngestResponseBody = {
  detail?: string;
  source_id?: string;
};

export default function KnowledgeUploadPage() {
  const { lang, isLoggedIn, userEmail } = useApp();
  const isAr = lang === "ar";
  const ownerId = useMemo(() => normalizeOwnerId(isLoggedIn, userEmail), [isLoggedIn, userEmail]);
  const knowledgeBaseUrl = getServiceBaseUrl("knowledge");
  
  const [file, setFile] = useState<File | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<"public" | "internal" | "confidential">("public");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);

  const refreshJobs = useCallback(() => {
    setJobs(listJobs(ownerId));
  }, [ownerId]);

  useEffect(() => {
    refreshJobs();
    const interval = window.setInterval(refreshJobs, 2000);
    return () => window.clearInterval(interval);
  }, [refreshJobs]);

  const statusToBadge = (status: UploadJob["status"]) => {
    if (status === "completed") return "resolved";
    if (status === "failed") return "critical";
    if (status === "processing") return "in_review";
    return "pending";
  };

  const statusLabel = (status: UploadJob["status"]) => {
    if (status === "completed") return isAr ? "مكتمل" : "Completed";
    if (status === "failed") return isAr ? "فشل" : "Failed";
    if (status === "processing") return isAr ? "قيد الفهرسة" : "Indexing";
    return isAr ? "جارٍ الرفع" : "Uploading";
  };

  const uploadWithProgress = (formData: FormData): Promise<{ status: number; body: IngestResponseBody }> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${knowledgeBaseUrl}/ingest`);
      xhr.responseType = "text";

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const pct = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
        setProgress(pct);
      };

      xhr.onerror = () => reject(new Error(isAr ? "تعذر الاتصال بالخادم" : "Network error"));
      xhr.onload = () => {
        let parsed: IngestResponseBody = {};
        try {
          const json: unknown = xhr.responseText ? JSON.parse(xhr.responseText) : {};
          parsed = typeof json === "object" && json !== null ? (json as IngestResponseBody) : {};
        } catch {
          parsed = {};
        }
        resolve({ status: xhr.status, body: parsed });
      };

      xhr.send(formData);
    });

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError(isAr ? "يرجى اختيار ملف" : "Please select a file");
      return;
    }

    setLoading(true);
    setProgress(0);
    setError(null);
    setSuccess(false);

    const jobId = `job-${Date.now()}`;
    upsertJob({
      id: jobId,
      ownerId,
      filename: file.name,
      sourceName: sourceName || file.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: 0,
      status: "uploading",
      message: isAr ? "جاري الرفع" : "Uploading",
    });
    refreshJobs();

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source_name", sourceName || file.name);
      formData.append("tags", tags);
      formData.append("visibility", visibility);

      const { status, body } = await uploadWithProgress(formData);
      updateJob(jobId, {
        progress: 100,
        status: "processing",
        message: isAr ? "جاري المعالجة والفهرسة" : "Processing and indexing",
      });
      refreshJobs();

      if (status < 200 || status >= 300) {
        const detail = typeof body?.detail === "string" ? body.detail : "";

        const duplicateError = /duplicate file detected|already ingested|already exists/i.test(detail);
        if (status === 409 || duplicateError) {
          updateJob(jobId, {
            status: "failed",
            message: isAr ? "الملف مكرر في المكتبة" : "Duplicate file in library",
          });
          refreshJobs();
          throw new Error(
            isAr
              ? "هذا الملف موجود بالفعل في المكتبة (تطابق محتوى). ارفع نسخة محدثة بمحتوى مختلف."
              : "This file already exists in the library (content match). Upload an updated file with different content."
          );
        }

        if (detail) {
          updateJob(jobId, {
            status: "failed",
            message: detail,
          });
          refreshJobs();
          throw new Error(detail);
        }

        updateJob(jobId, {
          status: "failed",
          message: isAr ? "فشل رفع الملف" : "Upload failed",
        });
        refreshJobs();
        throw new Error(isAr ? "فشل رفع الملف. يرجى المحاولة مرة أخرى." : "Failed to upload file. Please try again.");
      }

      updateJob(jobId, {
        status: "completed",
        sourceId: body?.source_id,
        message: isAr ? "تمت المعالجة بنجاح" : "Processed successfully",
      });
      refreshJobs();
      
      setSuccess(true);
      setFile(null);
      setSourceName("");
      setTags("");
      setVisibility("public");
      setProgress(0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : null;
      setError(message || (isAr ? "فشل رفع الملف" : "Failed to upload file"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute allowed={["operator", "admin"]} requireAuth>
    <AppShell title={isAr ? "الرفع والمعالجة" : "Upload & Processing"}>
      <div className="page-container" style={{ maxWidth: 920 }}>
        <PageHeader
          title={isAr ? "رفع الوثائق ومتابعة المعالجة" : "Upload Documents & Track Processing"}
          subtitle={isAr
            ? "ارفع وثائق جديدة وتابع حالة الفهرسة من نفس الصفحة."
            : "Upload new documents and monitor indexing status from one page."}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <form onSubmit={handleUpload} className="surface-card" style={{ padding: 32 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {error && (
                <div style={{ padding: 16, borderRadius: "var(--radius-lg)", background: "var(--error-50)", border: "1px solid var(--error-100)", color: "var(--error-500)", display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
                  <AlertTriangle size={18} />
                  {error}
                </div>
              )}

              {success && (
                <div style={{ padding: 16, borderRadius: "var(--radius-lg)", background: "var(--success-50)", border: "1px solid var(--success-100)", color: "var(--success-500)", display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
                  <CheckCircle size={18} />
                  {isAr ? "تم الرفع بنجاح! يمكنك متابعة الحالة أدناه." : "Upload successful! You can track progress below."}
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>{isAr ? "الملف" : "File"}</label>
                <div style={{ border: file ? "2px dashed var(--success-200)" : "2px dashed var(--border-medium)", borderRadius: "var(--radius-xl)", padding: 32, textAlign: "center", transition: "all 0.2s", background: file ? "var(--success-50)" : "var(--bg-subtle)", cursor: "pointer" }}>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.html,.htm,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    style={{ display: "none" }}
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 56, height: 56, borderRadius: "var(--radius-xl)", background: file ? "var(--success-100)" : "var(--bg-muted)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                      <Upload size={24} style={{ color: file ? "var(--success-500)" : "var(--text-muted)" }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                      {file ? file.name : (isAr ? "اضغط لاختيار ملف أو اسحبه هنا" : "Click to choose a file or drag here")}
                    </span>
                    <span style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>PDF, DOCX, TXT, HTML, Images</span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>{isAr ? "اسم المصدر" : "Source Name"}</label>
                <div style={{ position: "relative" }}>
                  <FileText size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder={isAr ? "مثال: نظام الخدمة المدنية 2023" : "e.g. Civil Service Regulations 2023"}
                    className="input"
                    style={{ paddingLeft: 42 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>{isAr ? "الكلمات المفتاحية" : "Tags"}</label>
                  <div style={{ position: "relative" }}>
                    <Tag size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--text-muted)" }} />
                    <input
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder={isAr ? "مالية، قوانين، إجازات" : "finance, laws, leave"}
                      className="input"
                      style={{ paddingLeft: 42 }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>{isAr ? "مستوى السرية" : "Visibility"}</label>
                  <div style={{ position: "relative" }}>
                    <Shield size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--text-muted)", zIndex: 1 }} />
                    <select
                      value={visibility}
                      onChange={(e) => {
                        const nextVisibility = e.target.value;
                        if (nextVisibility === "public" || nextVisibility === "internal" || nextVisibility === "confidential") {
                          setVisibility(nextVisibility);
                        }
                      }}
                      className="input"
                      style={{ paddingLeft: 42, appearance: "none", cursor: "pointer" }}
                    >
                      <option value="public">{isAr ? "عام" : "Public"}</option>
                      <option value="internal">{isAr ? "داخلي" : "Internal"}</option>
                      <option value="confidential">{isAr ? "سري" : "Confidential"}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ paddingTop: 20, borderTop: "1px solid var(--border-light)" }}>
                {loading && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 20 }}>
                    <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx="26" cy="26" r="22" stroke="var(--border-light)" strokeWidth="4" fill="none" />
                      <circle
                        cx="26"
                        cy="26"
                        r="22"
                        stroke="var(--primary-700)"
                        strokeWidth="4"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 22}
                        strokeDashoffset={(2 * Math.PI * 22) * (1 - progress / 100)}
                        style={{ transition: "stroke-dashoffset 0.15s linear" }}
                      />
                    </svg>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", minWidth: 56 }}>{progress}%</div>
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={loading || !file}
                  style={{ width: "100%", justifyContent: "center", padding: "14px 24px" }}
                  icon={loading ? RefreshCw : Upload}
                >
                  {loading ? (isAr ? "جاري الرفع..." : "Uploading...") : (isAr ? "رفع ومعالجة الوثيقة" : "Upload & Process Document")}
                </Button>
              </div>
            </div>
          </form>

          <div className="surface-card" style={{ padding: 24 }}>
            <PageHeader
              title={isAr ? "حالة معالجة الوثائق" : "Document Processing Status"}
              subtitle={isAr ? "متابعة حالة الرفع والفهرسة لكل وثيقة." : "Track upload and indexing progress for each document."}
              actions={
                <button onClick={refreshJobs} className="btn btn-sm btn-secondary" type="button">
                  <RefreshCw size={14} /> {isAr ? "تحديث" : "Refresh"}
                </button>
              }
            />

            {jobs.length === 0 ? (
              <EmptyState
                icon={Activity}
                title={isAr ? "لا توجد مهام معالجة" : "No processing jobs yet"}
                description={isAr ? "عند رفع وثيقة ستظهر هنا حالتها لحظيًا." : "When you upload a document, its live status will appear here."}
                action={
                  <Button size="sm" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                    {isAr ? "اذهب إلى نموذج الرفع" : "Go to Upload Form"}
                  </Button>
                }
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {jobs.map((job) => (
                  <div key={job.id} className="surface-card" style={{ padding: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "start", gap: 14, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 48, height: 48, borderRadius: "var(--radius-xl)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: job.status === "completed" ? "var(--success-50)" : job.status === "failed" ? "var(--error-50)" : "var(--primary-50)", border: `1px solid ${job.status === "completed" ? "var(--success-100)" : job.status === "failed" ? "var(--error-100)" : "var(--primary-100)"}` }}>
                          {job.status === "completed" ? (
                            <CheckCircle2 size={22} style={{ color: "var(--success-500)" }} />
                          ) : job.status === "failed" ? (
                            <XCircle size={22} style={{ color: "var(--error-500)" }} />
                          ) : (
                            <FileText size={22} style={{ color: "var(--primary-700)" }} />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{job.sourceName}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{job.filename}</div>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
                            <Clock3 size={12} />
                            {new Date(job.updatedAt).toLocaleString(isAr ? "ar-JO" : "en-US")}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <StatusBadge status={statusToBadge(job.status)} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", minWidth: 100, textAlign: "right" }}>{statusLabel(job.status)}</span>
                      </div>
                    </div>

                    <div>
                      <div className="progress-bar">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${Math.max(0, Math.min(100, job.progress))}%`,
                            background: job.status === "completed" ? "var(--success-500)" : job.status === "failed" ? "var(--error-500)" : "var(--primary-700)"
                          }}
                        />
                      </div>
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{job.message || (isAr ? "جاري المعالجة..." : "Processing...")}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{job.progress}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
    </ProtectedRoute>
  );
}
