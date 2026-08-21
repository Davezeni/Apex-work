'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MobileShell } from '@/components/mobile/mobile-shell';
import { Package, Loader2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMyOrders, type OrderStatus, type OrderSummary } from '@/hooks/use-orders';
import { useMe } from '@/hooks/use-me';
import { cn, formatEtb, timeAgo } from '@/lib/utils';

const STATUS_STYLE: Record<OrderStatus, { label: string; className: string }> = {
  PENDING: { label: 'Awaiting payment', className: 'bg-amber-500/15 text-amber-500' },
  ACTIVE: { label: 'In progress', className: 'bg-blue-500/15 text-blue-500' },
  IN_REVIEW: { label: 'In review', className: 'bg-violet-500/15 text-violet-500' },
  DELIVERED: { label: 'Delivered', className: 'bg-emerald-500/15 text-emerald-500' },
  COMPLETED: { label: 'Completed', className: 'bg-emerald-500/15 text-emerald-500' },
  CANCELLED: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
  DISPUTED: { label: 'Disputed', className: 'bg-red-500/15 text-red-500' },
};

export default function OrdersPage() {
  const { data: me, isAuthed } = useMe();
  const [role, setRole] = useState<'client' | 'seller'>('client');
  const { data, isLoading } = useMyOrders(role);

  // If the user is a freelancer, default to their seller view
  const showRoleTabs = me?.role === 'FREELANCER';

  if (!isAuthed) {
    return (
      <MobileShell activeTab="profile">
        <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
          <ShoppingBag className="h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-extrabold">Sign in to see your orders</h1>
          <Button asChild variant="brand" size="lg" className="mt-6">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </MobileShell>
    );
  }

  const items = data?.items ?? [];

  return (
    <MobileShell activeTab="profile">
      <header className="safe-top px-5 pb-3 pt-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Orders</h1>
      </header>

      {showRoleTabs && (
        <div className="mx-5 mb-4 flex gap-1 rounded-full border border-border bg-card p-1">
          <button
            onClick={() => setRole('client')}
            className={cn(
              'flex-1 rounded-full py-2 text-xs font-bold transition-colors',
              role === 'client' ? 'grad-hero text-white shadow' : 'text-muted-foreground',
            )}
          >
            As Client
          </button>
          <button
            onClick={() => setRole('seller')}
            className={cn(
              'flex-1 rounded-full py-2 text-xs font-bold transition-colors',
              role === 'seller' ? 'grad-hero text-white shadow' : 'text-muted-foreground',
            )}
          >
            As Freelancer
          </button>
        </div>
      )}

      {isLoading && (
        <div className="grid h-40 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="mx-5 mt-10 rounded-2xl border border-dashed border-border p-8 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">No orders yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {role === 'client'
              ? 'Hire a freelancer to see orders here.'
              : 'You will see incoming orders here.'}
          </p>
          <Button asChild variant="brand" size="sm" className="mt-4">
            <Link href="/">Explore gigs</Link>
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 px-4 pb-8">
        {items.map((o) => (
          <OrderRow key={o.id} o={o} role={role} />
        ))}
      </div>
    </MobileShell>
  );
}

function OrderRow({ o, role }: { o: OrderSummary; role: 'client' | 'seller' }) {
  const other = role === 'client' ? o.seller : o.client;
  const status = STATUS_STYLE[o.status];
  return (
    <Link
      href={`/orders/${o.id}`}
      className="flex gap-3 rounded-2xl border border-border bg-card p-3 active:scale-[.99]"
    >
      <div className="grad-hero grid h-14 w-14 shrink-0 place-items-center rounded-xl text-white">
        <Package className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-sm font-semibold leading-tight">{o.title}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {role === 'client' ? 'Seller' : 'Client'}:{' '}
          <span className="font-semibold text-foreground">{other.fullName}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              status.className,
            )}
          >
            {status.label}
          </span>
          <span className="text-xs text-muted-foreground">{timeAgo(o.createdAt)}</span>
        </div>
        <div className="mt-1 text-xs font-extrabold text-foreground">{formatEtb(o.amountEtb)}</div>
      </div>
    </Link>
  );
}
