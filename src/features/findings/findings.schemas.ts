import { z } from 'zod'

// One sentence is the whole ask — the evidence attaches itself, so the form is
// deliberately shorter than the thing it produces.
export const createFindingSchema = z.object({
  title: z.string().min(1, 'Say what went wrong').max(200, 'At most 200 characters'),
  body: z.string().max(5000, 'At most 5000 characters').optional().or(z.literal('')),
})

export type CreateFindingValues = z.infer<typeof createFindingSchema>
