import { dbErrorResponse, query } from "@/lib/db"
import { parseId, payeePatchSchema, validationError } from "@/lib/validators"

export async function PATCH(request: Request, ctx: RouteContext<"/api/payees/[id]">) {
  const { id: rawId } = await ctx.params
  const id = parseId(rawId)
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 })

  const parsed = payeePatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error)

  try {
    const updates: string[] = []
    const values: unknown[] = []
    if (parsed.data.name) {
      values.push(parsed.data.name)
      updates.push(`name = $${values.length}`)
    }
    if (parsed.data.tag) {
      const tagResult = await query<{ id: number }>("SELECT id FROM tags WHERE name = $1", [parsed.data.tag])
      if (!tagResult.rows[0]) return Response.json({ error: "Unknown tag" }, { status: 400 })
      values.push(tagResult.rows[0].id)
      updates.push(`tag_id = $${values.length}`)
    }

    values.push(id)
    const result = await query(`UPDATE payees SET ${updates.join(", ")} WHERE id = $${values.length}`, values)
    if (result.rowCount === 0) return Response.json({ error: "Payee not found" }, { status: 404 })
    return Response.json({ ok: true })
  } catch (error) {
    return dbErrorResponse(error)
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/payees/[id]">) {
  const { id: rawId } = await ctx.params
  const id = parseId(rawId)
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 })

  try {
    const result = await query("DELETE FROM payees WHERE id = $1", [id])
    if (result.rowCount === 0) return Response.json({ error: "Payee not found" }, { status: 404 })
    return Response.json({ ok: true })
  } catch (error) {
    return dbErrorResponse(error)
  }
}
