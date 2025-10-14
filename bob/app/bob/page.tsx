import Bob from './bob';

export const dynamic = 'force-dynamic';

export default function Page({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const publicIdParam = (searchParams?.publicId ?? searchParams?.pid) as
    | string
    | undefined;
  return <Bob publicId={publicIdParam} />;
}
