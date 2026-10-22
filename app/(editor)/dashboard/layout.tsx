import { Button } from '@/components/ui/button';
import { signOut } from '../actions';

export default function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  return (
    <>
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold">LaunchPad</span>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </header>
      <div className="flex-1 p-4">{children}</div>
    </>
  );
}
