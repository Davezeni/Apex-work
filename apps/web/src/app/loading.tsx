/**
 * Root-level loading UI — shown by Next.js while a client segment's JS is
 * being downloaded / parsed. Deliberately minimal so it appears instantly
 * even on 2G, and matches our dark app shell so there's no color flash.
 */
export default function RootLoading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
      </div>
    </div>
  );
}
