import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export const signupSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  username: z
    .string()
    .min(3, 'At least 3 characters')
    .max(32, 'At most 32 characters')
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
      'Lowercase letters, numbers and hyphens; no leading or trailing hyphen',
    ),
  password: z.string().min(12, 'At least 12 characters').max(128, 'At most 128 characters'),
  displayName: z.string().max(80, 'At most 80 characters').optional(),
})

export type LoginValues = z.infer<typeof loginSchema>
export type SignupValues = z.infer<typeof signupSchema>
