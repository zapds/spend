import { dbErrorResponse, query } from "@/lib/db"

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return Response.json({ status: "missing_database_url" })
  }

  try {
    await query("SELECT 1")
    return Response.json({ status: "connected" })
  } catch (error) {
    return dbErrorResponse(error)
  }
}
