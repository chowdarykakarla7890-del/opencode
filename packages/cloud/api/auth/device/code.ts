import { createDeviceAuthorization, supportedClient } from "../../../src/device.js"
import { json, methodNotAllowed, readObject, run } from "../../../src/response.js"

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "POST") return methodNotAllowed(request)
    const body = await readObject(request)
    if (!supportedClient(body?.client_id)) return json(request, { error: "invalid_client" }, 400)
    return json(request, await createDeviceAuthorization(), 201)
  })

export const POST = handler
export const OPTIONS = handler
