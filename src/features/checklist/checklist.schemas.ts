import { z } from 'zod'

// One line is the whole ask. Everything a seeded item carries — ticket key,
// link, source — is the server's to attach, so there is nothing else to type.
export const createChecklistItemSchema = z.object({
  title: z.string().min(1, 'Say what needs testing').max(200, 'At most 200 characters'),
})

export type CreateChecklistItemValues = z.infer<typeof createChecklistItemSchema>
