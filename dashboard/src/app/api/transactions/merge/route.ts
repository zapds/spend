import { dbErrorResponse, getPool, toNumber } from "@/lib/db"
import { mergeCreditSchema, validationError } from "@/lib/validators"

export async function POST(request: Request) {
  const parsed = mergeCreditSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)

  const { creditId, debitId } = parsed.data
  if (creditId === debitId) {
    return Response.json({ error: "Credit and debit transactions must be different" }, { status: 400 })
  }

  const client = await getPool().connect()
  try {
    await client.query("BEGIN")

    const creditRes = await client.query<{
      id: string
      type: string
      amount: string
      payee: string
      merged_into_id: string | null
    }>(
      "SELECT id::text, type, amount::text, payee, merged_into_id::text FROM spends WHERE id = $1 FOR UPDATE",
      [creditId]
    )
    const credit = creditRes.rows[0]
    if (!credit) {
      await client.query("ROLLBACK")
      return Response.json({ error: "Credit transaction not found" }, { status: 404 })
    }
    if (credit.type !== "credit") {
      await client.query("ROLLBACK")
      return Response.json({ error: "Selected source transaction is not a credit" }, { status: 400 })
    }
    if (credit.merged_into_id) {
      await client.query("ROLLBACK")
      return Response.json({ error: "This credit has already been merged" }, { status: 400 })
    }

    const debitRes = await client.query<{
      id: string
      type: string
      amount: string
      note: string | null
      merged_into_id: string | null
    }>(
      "SELECT id::text, type, amount::text, note, merged_into_id::text FROM spends WHERE id = $1 FOR UPDATE",
      [debitId]
    )
    const debit = debitRes.rows[0]
    if (!debit) {
      await client.query("ROLLBACK")
      return Response.json({ error: "Debit transaction not found" }, { status: 404 })
    }
    if (debit.type !== "debit") {
      await client.query("ROLLBACK")
      return Response.json({ error: "Target transaction is not a debit" }, { status: 400 })
    }
    if (debit.merged_into_id) {
      await client.query("ROLLBACK")
      return Response.json({ error: "Target debit is already merged" }, { status: 400 })
    }

    const creditAmount = toNumber(credit.amount)
    const debitAmount = toNumber(debit.amount)
    if (creditAmount > debitAmount) {
      await client.query("ROLLBACK")
      return Response.json(
        {
          error: `Credit amount (₹${creditAmount.toFixed(2)}) exceeds debit amount (₹${debitAmount.toFixed(2)})`,
        },
        { status: 400 }
      )
    }

    const newDebitAmount = (debitAmount - creditAmount).toFixed(2)
    const mergeEntry = `Merged credit #${creditId} (₹${creditAmount.toFixed(2)} from ${credit.payee})`
    const updatedNote = debit.note && debit.note.trim() ? `${debit.note} | ${mergeEntry}` : mergeEntry

    await client.query(
      "UPDATE spends SET amount = $1::numeric, note = $2 WHERE id = $3",
      [newDebitAmount, updatedNote, debitId]
    )
    await client.query(
      "UPDATE spends SET merged_into_id = $1 WHERE id = $2",
      [debitId, creditId]
    )

    await client.query("COMMIT")
    return Response.json({ ok: true, debitId, creditId, newDebitAmount: Number(newDebitAmount) })
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    return dbErrorResponse(error)
  } finally {
    client.release()
  }
}
