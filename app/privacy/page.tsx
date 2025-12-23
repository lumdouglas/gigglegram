export default function Privacy() {
  return (
    <div className="min-h-screen p-6 sm:p-12 bg-white text-slate-900 font-sans">
      <div className="max-w-2xl mx-auto">
        <a href="/" className="inline-block text-teal-600 font-bold text-lg mb-8 hover:underline px-4 py-2 -ml-4">
          ← Back to Magic
        </a>
        
        <h1 className="text-3xl sm:text-4xl font-black mb-2 tracking-tight">MyGiggleGram Privacy Notice</h1>
        <p className="text-sm text-slate-500 mb-8 font-medium">Last Updated: November 26, 2025</p>
        
        <div className="prose prose-slate prose-lg">
          <p className="mb-4">
            We use your photo only to create your video, then we delete it right after. We never sell your data or share it with advertisers.
          </p>
          <p className="mb-4">
            Payments are processed securely by Lemon Squeezy; we never see your card details. We use Replicate to swap faces and Supabase to store your email and credits. We use device identifiers to manage free trial eligibility.
          </p>
          <p className="mb-8">
            You can request deletion of your account anytime by emailing <a href="mailto:privacy@mygigglegram.com" className="text-teal-600 font-bold">privacy@mygigglegram.com</a>. We follow GDPR and US privacy laws. That&apos;s it.
          </p>
        </div>
      </div>
    </div>
  );
}