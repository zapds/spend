import { dbErrorResponse, getPool, toNumber } from "@/lib/db"
import { unmergeCreditSchema, validationError } from "@/lib/validators"

export async function POST(request: Request) {
  const parsed = unmergeCreditSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)

  const { creditId } = parsed.data
  const client = await getPool().connect()
  try {
    await client.query("BEGIN")

    const creditRes = await client.query<{
      id: string
      type: string
      amount: string
      merged_into_id: string | null
    }>(
      "SELECT id::text, type, amount::text, merged_into_id::text FROM spends WHERE id = $1 FOR UPDATE",
      [creditId]
    )
    const credit = creditRes.rows[0]
    if (!credit) {
      await client.query("ROLLBACK")
      return Response.json({ error: "Credit transaction not found" }, { status: 404 })
    }
    if (credit.type !== "credit" || !credit.merged_into_id) {
      await client.query("ROLLBACK")
      return Response.json({ error: "Transaction is not a merged credit" }, { status: 400 })
    }

    const debitId = Number(credit.merged_into_id)
    const debitRes = await client.query<{ amount: string }>(
      "SELECT amount::text FROM spends WHERE id = $1 FOR UPDATE",
      [debitId]
    )
    if (!debitRes.rows[0]) {
      await client.query("ROLLBACK")
      return Response.json({ error: "Original debit transaction not found" }, { status: 404 })
    }

    const restoredAmount = (toNumber(debitRes.rows[0].amount) + toNumber(credit.amount)).toFixed(2)
    await client.query("UPDATE spends SET amount = $1::numeric WHERE id = $2", [restoredAmount, debitId])
    await client.query("UPDATE spends SET merged_into_id = NULL WHERE id = $1", [creditId])

    await client.query("COMMIT")
    return Response.json({ ok: true, debitId, creditId, restoredDebitAmount: Number(restoredAmount) })
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    return dbErrorResponse(error)
  } finally {
    client.release()
  }
}
