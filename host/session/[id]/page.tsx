import HostSession from "@/components/host/HostSession";

/**
 * Next 16: route params are async, so this stays a server component that
 * awaits them and hands the id to the client component doing the work.
 */
export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <HostSession sessionId={id} />;
}
