'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { safeNextPath } from '@/lib/auth/routing';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type SignInState = { error: string | null };

const SignInInput = z.object({
  email: z.email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = SignInInput.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  });
  if (!parsed.success) return { error: 'Enter your email and password.' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: 'Wrong email or password.' };

  redirect(safeNextPath(parsed.data.next));
}
