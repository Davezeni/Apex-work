import {
  BarChart3,
  Briefcase,
  Clapperboard,
  Code2,
  Megaphone,
  Mic,
  Palette,
  PenLine,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

/** Category id -> lucide icon. Replaces emoji icons everywhere categories
 * or cards render (chips, pickers, card art, badges). */
const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  development: Code2,
  design: Palette,
  writing: PenLine,
  video: Clapperboard,
  marketing: Megaphone,
  audio: Mic,
  data: BarChart3,
  business: Briefcase,
};

export function CategoryIcon({ id, className }: { id?: string | null; className?: string }) {
  const Icon = (id ? CATEGORY_ICON_MAP[id] : undefined) ?? Sparkles;
  return <Icon className={className} aria-hidden />;
}
