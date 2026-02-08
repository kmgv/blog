/**
 * Shiki transformer that reads code fence meta strings and applies
 * them as CSS classes on the rendered <pre> element.
 *
 * Usage in MDX:
 *   ```python compact
 *   code here
 *   ```
 *
 * Produces: <pre class="astro-code ... compact">
 */
export function metaClassTransformer() {
  return {
    name: "meta-class",
    pre(node) {
      const meta = this.options.meta?.__raw;
      if (!meta) return;

      const classes = meta.split(/\s+/).filter(Boolean);
      if (classes.length === 0) return;

      node.properties.class =
        [node.properties.class, ...classes].filter(Boolean).join(" ");
    },
  };
}
