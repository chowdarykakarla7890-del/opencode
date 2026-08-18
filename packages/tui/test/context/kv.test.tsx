/** @jsxImportSource @opentui/solid */
import { expect, spyOn, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { onMount } from "solid-js"
import path from "node:path"
import { KVProvider } from "../../src/context/kv"
import { TestTuiContexts } from "../fixture/tui-environment"
import { tmpdir } from "../fixture/fixture"

test("a missing first-run KV file is expected but malformed state is reported", async () => {
  await using tmp = await tmpdir()
  const error = spyOn(console, "error").mockImplementation(() => {})

  try {
    await mount(tmp.path)
    expect(error).not.toHaveBeenCalled()

    await Bun.write(path.join(tmp.path, "kv.json"), "not-json")
    await mount(tmp.path)
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]?.[0]).toBe("Failed to read KV state")
  } finally {
    error.mockRestore()
  }
})

async function mount(state: string) {
  let ready!: () => void
  const mounted = new Promise<void>((resolve) => {
    ready = resolve
  })

  function Probe() {
    onMount(ready)
    return <box />
  }

  const app = await testRender(() => (
    <TestTuiContexts paths={{ state }}>
      <KVProvider>
        <Probe />
      </KVProvider>
    </TestTuiContexts>
  ))
  await mounted
  app.renderer.destroy()
}
