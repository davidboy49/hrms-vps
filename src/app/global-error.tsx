"use client"

// Last resort: used only when the root layout itself fails, so it cannot rely on the app's fonts, theme or translations.
// Shows both languages.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="km">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#fafafa", color: "#171717" }}>
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 6px" }}>មានបញ្ហាកើតឡើង · Something went wrong</h1>
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "#525252" }}>សូមព្យាយាមម្តងទៀត។ · Please try again.</p>
          <button onClick={reset} style={{ padding: "8px 16px", fontSize: 14, borderRadius: 8, border: 0, background: "#171717", color: "#fff", cursor: "pointer" }}>
            ព្យាយាមម្តងទៀត · Try again
          </button>
          {error.digest && <p style={{ marginTop: 16, fontSize: 12, fontFamily: "monospace", color: "#737373" }}>{error.digest}</p>}
        </main>
      </body>
    </html>
  )
}
