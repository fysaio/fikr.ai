'use client';

// Last resort when the whole app fails to render. Plain styles, no app code.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0F4D3A', color: '#F8EEDC', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ maxWidth: 430, margin: '0 auto', padding: '96px 24px' }}>
          <h1 style={{ fontSize: 36, margin: 0 }}>That one&apos;s on me.</h1>
          <p style={{ fontSize: 16, lineHeight: 1.5 }}>Something broke on my side. Nothing you wrote is lost.</p>
          <button onClick={reset} style={{ minHeight: 48, padding: '0 22px', borderRadius: 24, border: '2px solid #06241B', background: '#D4F25A', color: '#3A0E1A', fontWeight: 800, fontSize: 16 }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
