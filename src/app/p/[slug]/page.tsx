import { PhotographerBoard } from "./PhotographerBoard";

export default async function PhotographerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PhotographerBoard slug={slug} />;
}
