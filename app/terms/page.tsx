export default function Terms() {
  return (
    <div className="min-h-screen p-6 sm:p-12 bg-white text-slate-900 font-sans">
      <div className="max-w-2xl mx-auto">
        <a href="/" className="inline-block text-teal-600 font-bold text-lg mb-8 hover:underline px-4 py-2 -ml-4">
          ← Back to Magic
        </a>
        
        <h1 className="text-3xl sm:text-4xl font-black mb-2 tracking-tight">MyGiggleGram Terms of Service</h1>
        <p className="text-sm text-slate-500 mb-8 font-medium">Last Updated: November 26, 2025</p>
        
        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-black mb-2 uppercase tracking-wide text-slate-800">The Basics</h2>
            <p className="text-slate-700">MyGiggleGram lets you put faces onto fun videos. It&apos;s simple, it&apos;s magic, and here&apos;s what you need to know.</p>
          </section>

          <section>
            <h2 className="text-xl font-black mb-2 uppercase tracking-wide text-slate-800">Your Photos</h2>
            <ul className="list-disc pl-5 text-slate-700 space-y-1">
              <li>We delete your photos right after we make your video.</li>
              <li>We never share, sell, or use your photos for any other purpose.</li>
              <li>By uploading, you promise you have permission to use the photo.</li>
              <li>For children&apos;s photos, you promise you are the parent or grandparent.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black mb-2 uppercase tracking-wide text-slate-800">How It Works</h2>
            <ul className="list-disc pl-5 text-slate-700 space-y-1">
              <li>Your first video is free (with watermark).</li>
              <li>Subsequent videos require credits or the &quot;Christmas Pass.&quot;</li>
              <li>All sales are final - no refunds once a video is generated.</li>
              <li>Christmas Pass expires January 1, 2026.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black mb-2 uppercase tracking-wide text-slate-800">The Rules</h2>
            <ul className="list-disc pl-5 text-slate-700 space-y-1">
              <li>Personal use only; no commercial ads or reselling.</li>
              <li>No inappropriate content.</li>
              <li>We may stop service for rule violations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black mb-2 uppercase tracking-wide text-slate-800">Legal</h2>
            <ul className="list-disc pl-5 text-slate-700 space-y-1">
              <li>Service is &quot;as is.&quot; Total liability is limited to amount paid.</li>
              <li>California law applies. Arbitration in San Francisco.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}