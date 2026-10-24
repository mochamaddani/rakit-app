'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { LatestExport } from '@/lib/export/record';

interface ExportState {
  pageId: string;
  slug: string;
  setSlug(slug: string): void;
  latest: LatestExport | null;
  setLatest(latest: LatestExport): void;
}

const ExportContext = createContext<ExportState | null>(null);

/** The page's file name and latest export, shared by the top bar and the export dialog. */
export function ExportProvider({
  pageId,
  slug: initialSlug,
  latest: initialLatest,
  children,
}: {
  pageId: string;
  slug: string;
  latest: LatestExport | null;
  children: ReactNode;
}) {
  const [slug, setSlug] = useState(initialSlug);
  const [latest, setLatest] = useState(initialLatest);
  return (
    <ExportContext.Provider value={{ pageId, slug, setSlug, latest, setLatest }}>
      {children}
    </ExportContext.Provider>
  );
}

export function useExportState(): ExportState {
  const state = useContext(ExportContext);
  if (!state) throw new Error('useExportState must be used inside <ExportProvider>');
  return state;
}
