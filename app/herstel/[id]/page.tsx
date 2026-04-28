import { RestoreLetterView } from "@/components/RestoreLetterView";

type RestoreLetterPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    token?: string | string[];
  }>;
};

export default async function RestoreLetterPage({
  params,
  searchParams,
}: RestoreLetterPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const tokenValue = resolvedSearchParams.token;
  const token = Array.isArray(tokenValue) ? tokenValue[0] : tokenValue ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      <RestoreLetterView id={id} token={token} />
    </div>
  );
}
