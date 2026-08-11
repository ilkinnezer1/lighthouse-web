import { z } from 'zod'

// Mirrors the API's SUBDOMAIN_RE: 3–32 chars, starts with a letter, ends
// alphanumeric, only [a-z0-9-].
const subdomainRe = /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(80, 'At most 80 characters'),
  repoUrl: z
    .string()
    .min(1, 'Repository URL is required')
    .regex(/^https?:\/\/.+/, 'Must be an http(s) URL'),
  subdomain: z
    .string()
    .regex(subdomainRe, '3–32 chars, start with a letter, end alphanumeric, [a-z0-9-]')
    .optional()
    .or(z.literal('')),
  defaultBranch: z.string().max(64, 'At most 64 characters').optional().or(z.literal('')),
})

export type CreateProjectValues = z.infer<typeof createProjectSchema>
