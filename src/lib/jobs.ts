import crypto from "crypto";

export type JobStatus = "queued" | "processing" | "done" | "failed";

export interface Job {
  id: string;
  fileId: string;
  inputPath: string;
  outputPath?: string;
  status: JobStatus;
  progress: number;
  error?: string;
}

// Module-level map — persists for the lifetime of the Node.js process
const jobs = new Map<string, Job>();

export function createJob(fields: Omit<Job, "id" | "status" | "progress">): Job {
  const job: Job = { ...fields, id: crypto.randomUUID(), status: "queued", progress: 0 };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<Job>): void {
  const job = jobs.get(id);
  if (job) jobs.set(id, { ...job, ...patch });
}
