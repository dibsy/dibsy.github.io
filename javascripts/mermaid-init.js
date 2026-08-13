// Diagrams are emitted as `<pre class="mermaid-diagram"><code>…</code></pre>` (a class Material's
// own mermaid handler deliberately ignores, so the two renderers don't fight). We render them
// ourselves: unwrap the `<code>`, then run Mermaid — and re-run on Material's instant-navigation
// events so diagrams survive client-side page swaps.
function renderDiagrams() {
  if (!window.mermaid) return;
  var blocks = document.querySelectorAll("pre.mermaid-diagram");
  if (!blocks.length) return;
  blocks.forEach(function (el) {
    if (el.dataset.rendered === "true") return;
    el.textContent = el.textContent; // flatten the inner <code> down to raw diagram source
    el.dataset.rendered = "true";
  });
  try {
    window.mermaid.run({ querySelector: "pre.mermaid-diagram" });
  } catch (e) {
    /* one malformed diagram shouldn't take the page down */
  }
}

if (window.mermaid) {
  var dark = document.body.getAttribute("data-md-color-scheme") === "slate";
  window.mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "default" });
}

// Material exposes a `document$` observable that fires on first load and every instant-nav.
if (typeof window.document$ !== "undefined" && window.document$.subscribe) {
  window.document$.subscribe(renderDiagrams);
} else if (document.readyState !== "loading") {
  renderDiagrams();
} else {
  document.addEventListener("DOMContentLoaded", renderDiagrams);
}
