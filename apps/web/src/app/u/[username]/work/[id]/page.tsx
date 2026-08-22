'use client';

import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { usePublicPortfolioItem } from '@/hooks/use-portfolio';
import { useI18n } from '@/i18n';
import { timeAgo } from '@/lib/utils';

export default function PortfolioItemPage() {
  const { username, id } = useParams<{ username: string; id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { data: item, isLoading, error } = usePublicPortfolioItem(username, id);

  if (isLoading || !item) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        {error ? <p className="text-sm text-destructive">Not found</p>
          : <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="safe-top absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3">
        <button onClick={() => router.back()} aria-label={t('common.back')} className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {item.externalUrl && (
          <a href={item.externalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-black/50 px-3 py-2 text-xs font-bold text-white backdrop-blur">
            <ExternalLink className="h-3 w-3" /> Visit
          </a>
        )}
      </header>

      <div className="relative aspect-square bg-black">
        <Image src={item.imageUrl} alt={item.title} fill unoptimized className="object-cover" priority />
      </div>

      <div className="mx-4 mt-4">
        <h1 className="text-xl font-extrabold leading-tight tracking-tight">{item.title}</h1>
        <Link href={`/u/${item.owner.username}`} className="mt-3 flex items-center gap-2">
          {item.owner.avatarUrl ? (
            <Image src={item.owner.avatarUrl} alt={item.owner.fullName} width={36} height={36} unoptimized className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="grad-hero grid h-9 w-9 place-items-center rounded-full text-xs font-bold text-white">
              {(item.owner.fullName[0] ?? '?').toUpperCase()}
            </div>
          )}
          <div className="text-xs">
            <div className="font-semibold">{item.owner.fullName}</div>
            <div className="text-muted-foreground">{item.owner.title ?? '@' + item.owner.username}</div>
          </div>
          <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(item.createdAt)}</span>
        </Link>
        {item.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{item.description}</p>
        )}
      </div>
    </div>
  );
}
