import { Effect } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

// effect-smol's HttpMiddleware.cors builds OPTIONS preflight responses by
// spreading allowOrigin() and allowHeaders() into the same record. Both set
// the `vary` key, so allowHeaders' `Vary: Access-Control-Request-Headers`
// overwrites allowOrigin's `Vary: Origin`. With dynamic origin echoing, the
// missing `Vary: Origin` lets shared caches reuse a preflight cached for one
// origin against a different origin.
//
// TODO: upstream a fix that merges Vary values in headersFromRequestOptions
// (packages/effect/src/unstable/http/HttpMiddleware.ts ~line 332).
export const corsVaryFix = HttpRouter.middleware(
  (effect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      const response = yield* effect
      const allowOrigin = response.headers["access-control-allow-origin"]
      const result =
        allowOrigin && request.headers["access-control-request-private-network"] === "true"
          ? HttpServerResponse.setHeader(response, "access-control-allow-private-network", "true")
          : response
      if (!allowOrigin || allowOrigin === "*") return result

      const vary = result.headers["vary"]
      if (!vary) return HttpServerResponse.setHeader(result, "vary", "Origin")

      const tokens = vary.split(",").map((s) => s.trim().toLowerCase())
      if (tokens.includes("origin") || tokens.includes("*")) return result

      return HttpServerResponse.setHeader(result, "vary", `${vary}, Origin`)
    }),
  { global: true },
)
