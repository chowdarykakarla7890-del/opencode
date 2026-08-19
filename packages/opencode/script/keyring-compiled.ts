export const keyringCompiledPlugin = {
  name: "keyring-compiled-require",
  setup(build: Bun.PluginBuilder) {
    build.onLoad(
      { filter: /@napi-rs[\\/+]+keyring@[^/\\]+[\\/]node_modules[\\/]@napi-rs[\\/]keyring[\\/]index\.js$/ },
      async (args) => ({
        contents: (await Bun.file(args.path).text())
          .replace("const { createRequire } = require('node:module')\n", "")
          .replace("require = createRequire(__filename)\n", ""),
        loader: "js",
      }),
    )
  },
}
