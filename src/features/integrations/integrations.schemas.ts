import { z } from 'zod'

// Only emptiness is checked here. Whether the token is real, already stored or
// still live is GitHub's answer to give, and the server relays it verbatim.
export const createGitCredentialSchema = z.object({
  token: z.string().trim().min(1, 'Paste a token'),
  label: z.string().trim().max(60, 'At most 60 characters').optional().or(z.literal('')),
})

export type CreateGitCredentialValues = z.infer<typeof createGitCredentialSchema>
