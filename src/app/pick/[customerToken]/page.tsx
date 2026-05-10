import { JobWorkspace } from "./JobWorkspace";

export default async function PickPage({
  params,
}: {
  params: Promise<{ customerToken: string }>;
}) {
  const { customerToken } = await params;
  return <JobWorkspace customerToken={customerToken} />;
}
