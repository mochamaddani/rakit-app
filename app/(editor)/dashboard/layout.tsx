import { signOut } from '../actions';
import { SignOutButton } from './sign-out-button';

export default function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  return (
    <>
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold">Rakit</span>
        <form action={signOut}>
          <SignOutButton />
        </form>
      </header>
      <div className="flex-1 p-4">{children}</div>
    </>
  );
}
