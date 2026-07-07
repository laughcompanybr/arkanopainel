// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

/**
 * The `@tanstack/devtools:inject-source` plugin injects a `data-tsd-source`
 * attribute on every JSX element in `development` mode. In Lovable preview
 * builds (which run with mode=development but ALSO perform a real SSR build),
 * the injected file:line:col string can end up different between the server
 * and client bundles — causing a React hydration warning
 * ("attributes of the server rendered HTML didn't match the client").
 *
 * This attribute is purely for devtools "open in editor" and has no effect
 * on the running app. We strip it after the JSX transform so SSR and client
 * bundles agree on the DOM output, eliminating the warning at its source
 * without needing `suppressHydrationWarning` band-aids.
 */
function stripTsdSourcePlugin(): Plugin {
  const RE_WITH_LEADING = /,\s*"data-tsd-source"\s*:\s*"[^"\\]*"/g;
  const RE_WITH_TRAILING = /"data-tsd-source"\s*:\s*"[^"\\]*"\s*,?/g;
  return {
    name: "lovable:strip-tsd-source",
    enforce: "post",
    apply: () => true,
    transform: {
      filter: {
        id: { exclude: [/node_modules/, /\?raw/] },
      },
      handler(code) {
        if (!code.includes('"data-tsd-source"')) return null;
        let out = code.replace(RE_WITH_LEADING, "").replace(RE_WITH_TRAILING, "");
        // Cleanup any stray commas removal may have left behind.
        out = out
          .replace(/\{\s*,/g, "{")
          .replace(/,(\s*,)+/g, ",")
          .replace(/,(\s*\})/g, "$1");
        return { code: out, map: null };
      },
    },
  };
}


export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  plugins: [stripTsdSourcePlugin()],
});
