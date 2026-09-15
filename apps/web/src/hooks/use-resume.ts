'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type {
  ResumeContent,
  ResumeInput,
  WorkExperienceInput,
  EducationInput,
  CertificationInput,
} from '@apex-work/shared';

export interface Resume {
  id: string;
  headline: string | null;
  summary: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  website: string | null;
  linkedin: string | null;
  github: string | null;
  languages: string[];
  theme: string;
  templateId: string;
  targetRole: string | null;
  accentColor: string | null;
  isPublic: boolean;
  content: ResumeContent;
  contentJson?: unknown;
  experiences: (WorkExperienceInput & { id: string; position: number })[];
  education: (EducationInput & { id: string; position: number })[];
  certifications: (CertificationInput & { id: string; position: number })[];
}

export function useMyResume() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery<Resume>({
    queryKey: ['me', 'resume'],
    queryFn: () => apiFetch('/me/resume', { token }),
    enabled: !!token,
    // The app-wide default is refetchOnMount:false, which made the preview
    // render a stale cached resume (just-added experience/education/skills
    // appeared "missing"). Always refetch on mount — it's a single cheap GET.
    refetchOnMount: 'always',
    staleTime: 5 * 1000,
  });
}

export function useUpdateResume() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<Resume, Error, ResumeInput>({
    mutationFn: (body) => apiFetch('/me/resume', { method: 'PATCH', token, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'resume'] }),
  });
}

// ---------- experience ----------
export function useAddExperience() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<unknown, Error, WorkExperienceInput>({
    mutationFn: (body) => apiFetch('/me/resume/experience', { method: 'POST', token, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'resume'] }),
  });
}
export function useUpdateExperience() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<unknown, Error, { id: string } & WorkExperienceInput>({
    mutationFn: ({ id, ...body }) =>
      apiFetch(`/me/resume/experience/${id}`, { method: 'PATCH', token, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'resume'] }),
  });
}
export function useDeleteExperience() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => apiFetch(`/me/resume/experience/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'resume'] }),
  });
}

// ---------- education ----------
export function useAddEducation() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<unknown, Error, EducationInput>({
    mutationFn: (body) => apiFetch('/me/resume/education', { method: 'POST', token, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'resume'] }),
  });
}
export function useUpdateEducation() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<unknown, Error, { id: string } & EducationInput>({
    mutationFn: ({ id, ...body }) =>
      apiFetch(`/me/resume/education/${id}`, { method: 'PATCH', token, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'resume'] }),
  });
}
export function useDeleteEducation() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => apiFetch(`/me/resume/education/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'resume'] }),
  });
}

// ---------- certifications ----------
export function useAddCertification() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<unknown, Error, CertificationInput>({
    mutationFn: (body) => apiFetch('/me/resume/certification', { method: 'POST', token, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'resume'] }),
  });
}
export function useDeleteCertification() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => apiFetch(`/me/resume/certification/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'resume'] }),
  });
}

export function usePublicResume(username: string | undefined) {
  return useQuery<Resume | null>({
    queryKey: ['user', username, 'resume'],
    queryFn: () => apiFetch(`/users/${username}/resume`),
    enabled: !!username,
    staleTime: 5 * 60 * 1000,
  });
}
