import { createDeviceAuthorization, supportedClient } from "../../../src/device.js"
import { json, methodNotAllowed, readObject, run } from "../../../src/response.js"

const handler = (request: Request) =>
  run(request, async () => {
    if (request.method !== "POST") return methodNotAllowed(request)
    const body = await readObject(request)
    if (!supportedClient(body?.client_id)) return json(request, { error: "invalid_client" }, 400)
    const clientType = body?.client_type === "desktop" ? "desktop" : "cli"
    return json(
      request,
      await createDeviceAuthorization({
        clientID: body.client_id as string,
        clientType,
        deviceName: typeof body.device_name === "string" ? body.device_name.slice(0, 120) : undefined,
        platform: typeof body.platform === "string" ? body.platform.slice(0, 40) : undefined,
        strictLogin: body.strict_login === true,
      }),
      201,
    )
  })

export const POST = handler
export const OPTIONS = handler
