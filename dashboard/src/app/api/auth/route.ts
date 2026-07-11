import { authSchema } from "@/lib/validators"

export async function POST(request: Request) {
  const body = authSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }

  const expected = process.env.DASHBOARD_PASSWORD
  if (!expected || body.data.password !== expected) {
    return Response.json({ error: "Invalid password" }, { status: 401 })
  }

  return Response.json({ ok: true })
}
