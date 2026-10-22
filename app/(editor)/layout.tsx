import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth/require-user';
import { signOut } from './actions';

export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold">LaunchPad</span>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </header>
      <div className="flex-1 p-4">{children}</div>
    </div>
  );
}
