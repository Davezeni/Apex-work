'use client';

import { dt } from '@/i18n/auto';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Sparkles, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { formatEtb } from '@/lib/utils';
import { safeBack } from '@/lib/safe-back';
/**
 * AI Contract Generator — client + freelancer agree, we produce a
 * simple, plain-English service agreement fit for informal Ethiopian
 * freelance work. Uses a deterministic template so output is legal-
 * enough to sign; a lawyer should still review high-value contracts.
 */
export default function AIContractPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [client, setClient] = useState('');
  const [freelancer, setFreelancer] = useState('');
  const [scope, setScope] = useState('');
  const [price, setPrice] = useState('');
  const [days, setDays] = useState('14');
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState('');

  const generate = async () => {
    if (!client.trim() || !freelancer.trim()) return toast.error(dt('Both names required'));
    if (!scope.trim() || scope.trim().length < 30) return toast.error(dt('Add more scope detail'));
    const p = Number(price);
    if (!p || p < 100) return toast.error(dt('Enter a valid price'));
    setBusy(true);
    await new Promise((r) => setTimeout(r, 500));
    setOutput(buildContract({ client, freelancer, scope, price: p, days: Number(days) || 14 }));
    setBusy(false);
  };

  const download = () => {
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apex-work-contract-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-dvh bg-background pb-24 md:mx-auto md:max-w-5xl">
      <header className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl">
        <button
          onClick={() => safeBack(router)}
          aria-label={t('common.back')}
          className="grid h-9 w-9 place-items-center rounded-full active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">{dt('Contract Generator')}</h1>
          <div className="text-[10px] text-muted-foreground">
            {dt('Simple, fair, in plain English')}
          </div>
        </div>
      </header>

      <div className="mx-3 mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label={dt('Client name')}>
            <input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder={dt('Habesha Ltd')}
              className="input"
            />
          </Field>
          <Field label={dt('Freelancer name')}>
            <input
              value={freelancer}
              onChange={(e) => setFreelancer(e.target.value)}
              placeholder={dt('Kaleb Girma')}
              className="input"
            />
          </Field>
        </div>
        <Field label={dt('Scope of work')}>
          <textarea
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            rows={5}
            placeholder={dt('Describe deliverables, revisions included, exclusions…')}
            className="input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={dt('Total price (ETB)')}>
            <input
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))}
              className="input"
            />
          </Field>
          <Field label={dt('Delivery days')}>
            <input
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ''))}
              className="input"
            />
          </Field>
        </div>

        <Button variant="brand" size="lg" className="w-full" onClick={generate} disabled={busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Generate contract
            </>
          )}
        </Button>
      </div>

      {output && (
        <section className="mx-3 mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {dt('Contract')}
            </div>
            <button
              onClick={download}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-primary active:bg-primary/10"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </button>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-relaxed">{output}</pre>
        </section>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 12px;
          border: 1px solid hsl(var(--border));
          background-color: hsl(var(--card));
          padding: 10px 12px;
          font-size: 14px;
          outline: none;
          resize: none;
        }
        .input:focus {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 4px hsl(var(--primary) / 0.2);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function buildContract({
  client,
  freelancer,
  scope,
  price,
  days,
}: {
  client: string;
  freelancer: string;
  scope: string;
  price: number;
  days: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const platformFee = Math.round(price * 0.1);
  const net = price - platformFee;
  return `SERVICE AGREEMENT
Date: ${today}

Between
  Client:     ${client}
  Freelancer: ${freelancer}
This agreement is entered into under the Apex-Work platform terms.

1. SCOPE OF WORK
${scope
  .split('\n')
  .map((l) => `   ${l}`)
  .join('\n')}

2. TIMELINE
   The freelancer will deliver the work within ${days} calendar days of this
   agreement being funded via Apex-Work escrow.

3. PAYMENT
   Total price:      ${formatEtb(price)}
   Platform fee:     ${formatEtb(platformFee)} (10%, deducted by Apex-Work)
   Freelancer net:   ${formatEtb(net)}
   Funds are held in escrow by Apex-Work and released to the freelancer
   when the client accepts delivery, or automatically after 7 days of
   inactivity following delivery.

4. REVISIONS
   Included revisions are specified in the scope. Additional revisions
   are billed separately by mutual agreement.

5. INTELLECTUAL PROPERTY
   All final deliverables become the property of the client upon full
   payment. The freelancer retains the right to display the work in
   their portfolio unless the parties agree otherwise in writing.

6. CONFIDENTIALITY
   Both parties agree to keep any non-public information exchanged
   during the engagement confidential.

7. DISPUTE RESOLUTION
   Disputes are first mediated by Apex-Work Support within 48 hours.
   Unresolved disputes are subject to the laws of the Federal Democratic
   Republic of Ethiopia.

8. TERMINATION
   Either party may terminate this agreement with 48 hours notice.
   Payment for work already completed is due upon termination.

9. SIGNATURES
   Client:     _____________________________  Date: __________
   Freelancer: _____________________________  Date: __________

Generated via Apex-Work · apex-work.com
This template is provided as-is. For high-value contracts consult a
qualified lawyer.`;
}
