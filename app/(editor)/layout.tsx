import { requireUser } from '@/lib/auth/require-user';

// The dashboard adds its own header; the editor uses the whole window.
export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}
