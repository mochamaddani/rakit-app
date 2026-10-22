import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to LaunchPad</CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm next={typeof next === 'string' ? next : ''} />
        </CardContent>
      </Card>
    </main>
  );
}
