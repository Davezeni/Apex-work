import { z } from 'zod';

export const uploadBucketSchema = z.enum(['portfolio', 'chat-attachments', 'avatars']);
export type UploadBucket = z.infer<typeof uploadBucketSchema>;

/** Client asks for a one-shot signed upload URL. Client will then PUT directly to Supabase. */
export const signUploadSchema = z.object({
  bucket: uploadBucketSchema,
  filename: z.string().trim().min(1).max(120),
  contentType: z.string().min(3).max(100),
  sizeBytes: z
    .number()
    .int()
    .min(1)
    .max(100 * 1024 * 1024), // hard 100MB cap; per-bucket limits enforced server-side
});
export type SignUploadInput = z.infer<typeof signUploadSchema>;

/** Add a portfolio item after the upload URL succeeds. */
export const addPortfolioItemSchema = z.object({
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1600).optional(),
  imageUrl: z.string().url().max(500),
  externalUrl: z.string().url().max(500).optional(),
  role: z.string().trim().max(120).optional(),
  tools: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  outcome: z.string().trim().max(1200).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  featured: z.boolean().optional(),
});
export type AddPortfolioItemInput = z.infer<typeof addPortfolioItemSchema>;
