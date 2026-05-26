import { z } from 'zod'

// Mirrors CreateDatabaseDto on the API (discriminated union on `mode`).
// Field constraints match the DTO: name/version 1–64 chars, ids are UUIDs.
const name = z.string().min(1, 'Name is required').max(64, 'At most 64 characters')

export const createDatabaseSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('create-empty'),
    type: z.enum(['POSTGRES', 'MYSQL', 'REDIS', 'MONGO']),
    version: z.string().min(1, 'Version is required').max(64, 'At most 64 characters'),
    name,
    runMigrate: z.boolean().optional(),
  }),
  z.object({
    mode: z.literal('attach-existing'),
    databaseId: z.string().uuid('Select a database to attach'),
  }),
  z.object({
    mode: z.literal('copy'),
    sourceDatabaseId: z.string().uuid('Select a database to copy'),
    name,
  }),
  z.object({
    mode: z.literal('create-from-snapshot'),
    snapshotId: z.string().uuid('Select a snapshot'),
    name,
  }),
])

export type CreateDatabaseValues = z.infer<typeof createDatabaseSchema>
