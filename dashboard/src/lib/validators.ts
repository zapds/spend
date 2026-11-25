import { z } from "zod"

const moneyString = z
  .string()
  .trim()
  .transform((value) => value.replace(/,/g, ""))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Use a non-negative amount with up to two decimals")

export const transactionTypeSchema = z.enum(["debit", "credit"])

export const authSchema = z.object({ password: z.string() })

export const transactionPatchSchema = z
  .object({
    amount: moneyString.optional(),
    type: transactionTypeSchema.optional(),
    note: z.string().nullable().optional(),
    tag: z.string().trim().min(1).optional(),
    clearTag: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No update provided")

export const spendCreateSchema = z.object({
  amount: moneyString,
  payee: z.string().trim().min(1),
  type: transactionTypeSchema.default("debit"),
  tag: z.string().trim().min(1).optional(),
  timestamp: z.string().datetime({ offset: true }).optional(),
  note: z.string().trim().optional(),
  externalRef: z.string().trim().min(1).optional(),
  allowDuplicate: z.boolean().optional(),
})

export const mergeCreditSchema = z.object({
  creditId: z.number().int().positive(),
  debitId: z.number().int().positive(),
})

export const unmergeCreditSchema = z.object({
  creditId: z.number().int().positive(),
})

export const payeeCreateSchema = z.object({
  name: z.string().trim().min(1),
  tag: z.string().trim().min(1),
})

export const payeePatchSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    tag: z.string().trim().min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No update provided")

export function parseId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function validationError(error: unknown) {
  if (error instanceof z.ZodError) {
    return Response.json({ error: error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }

  return Response.json({ error: "Invalid request" }, { status: 400 })
}
