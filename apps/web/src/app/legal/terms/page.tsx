'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  const router = useRouter();
  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight">Terms of Service</h1>
      </header>
      <article className="mx-4 mt-4 prose prose-invert max-w-none text-sm leading-relaxed">
        <p className="text-xs text-muted-foreground">Last updated: August 2026</p>
        <h2 className="mt-4 text-base font-bold">1. Acceptance</h2>
        <p>By using Apex-Work you agree to these Terms and our Privacy Policy.</p>
        <h2 className="mt-4 text-base font-bold">2. Platform Role</h2>
        <p>Apex-Work is a marketplace that connects clients with freelancers. We are not party to service contracts between users.</p>
        <h2 className="mt-4 text-base font-bold">3. Payments & Escrow</h2>
        <p>Client payments are held in escrow. Funds are released when the client accepts delivery, or automatically after 7 days of inactivity following delivery. Apex-Work charges a 10% platform fee on completed orders.</p>
        <h2 className="mt-4 text-base font-bold">4. Prohibited conduct</h2>
        <p>No spam, harassment, fraud, or off-platform payment circumvention. Violations may result in immediate account suspension.</p>
        <h2 className="mt-4 text-base font-bold">5. Content</h2>
        <p>You retain ownership of content you upload. You grant Apex-Work a limited license to host and display it for the purpose of operating the platform.</p>
        <h2 className="mt-4 text-base font-bold">6. Limitation of liability</h2>
        <p>Apex-Work is provided &ldquo;as is&rdquo;. We are not liable for indirect or consequential damages arising from your use of the platform.</p>
        <h2 className="mt-4 text-base font-bold">7. Governing law</h2>
        <p>These Terms are governed by the laws of the Federal Democratic Republic of Ethiopia.</p>
        <p className="mt-6 text-xs text-muted-foreground">Contact: legal@apex-work.com</p>
      </article>
    </div>
  );
}
