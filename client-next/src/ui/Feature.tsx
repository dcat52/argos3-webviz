import { useFeature } from '@/stores/featureStore'
import type { ReactNode } from 'react'

/** Renders children only if the feature is enabled */
export function Feature({ id, children }: { id: string; children: ReactNode }) {
  const enabled = useFeature(id)
  return enabled ? <>{children}</> : null
}
