"use client"

import { ErrorView } from "@/components/error-view"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView kind="error" digest={error.digest} reset={reset} />
}
