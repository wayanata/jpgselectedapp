import { JobWorkspace } from "./JobWorkspace";

export default async function CustomerJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return <JobWorkspace jobId={jobId} />;
}
