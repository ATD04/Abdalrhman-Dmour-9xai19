export type UploadStatus = "uploading" | "processing" | "completed" | "failed";

export type UploadJob = {
  id: string;
  ownerId: string;
  filename: string;
  sourceName: string;
  createdAt: string;
  updatedAt: string;
  progress: number;
  status: UploadStatus;
  sourceId?: string;
  message?: string;
};

const KEY = "shahem.upload.jobs";

function loadAllJobs(): UploadJob[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as UploadJob[];
  } catch {
    return [];
  }
}

function saveAllJobs(jobs: UploadJob[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(jobs));
}

export function listJobs(ownerId: string): UploadJob[] {
  return loadAllJobs()
    .filter((job) => job.ownerId === ownerId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function upsertJob(job: UploadJob): UploadJob[] {
  const all = loadAllJobs();
  const filtered = all.filter((item) => item.id !== job.id);
  const next = [job, ...filtered].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  saveAllJobs(next);
  return next;
}

export function updateJob(jobId: string, patch: Partial<UploadJob>): UploadJob | null {
  const all = loadAllJobs();
  const index = all.findIndex((item) => item.id === jobId);
  if (index < 0) return null;

  const nextJob = {
    ...all[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  all[index] = nextJob;
  saveAllJobs(all);
  return nextJob;
}
