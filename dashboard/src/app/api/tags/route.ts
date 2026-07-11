import { dbErrorResponse, query } from "@/lib/db"

export async function GET() {
  try {
    const result = await query<{ id: string; name: string; description: string | null }>(
      "SELECT id::text, name, description FROM tags ORDER BY name"
    )
    return Response.json({
      rows: result.rows.map((row) => ({ ...row, id: Number(row.id) })),
    })
  } catch (error) {
    return dbErrorResponse(error)
  }
}
