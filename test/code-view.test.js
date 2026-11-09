import assert from "node:assert/strict";
import test from "node:test";
import MarkdownIt from "markdown-it";
import { markdownItCodeView } from "../eleventy-plugins/code-view.js";

const render = (src) => new MarkdownIt({ html: true }).use(markdownItCodeView).render(src);

test("block containers wrap their markdown in a view marker", () => {
    const html = render("::: blocks\n![alt](a.png)\n:::\n\n::: ts\n```ts\nstop()\n```\n:::\n");
    assert.match(html, /<div data-view-only="blocks">\s*<p><img src="a.png" alt="alt"><\/p>\s*<\/div>/);
    assert.match(html, /<div data-view-only="typescript">\s*<pre><code class="language-ts">stop\(\)\n<\/code><\/pre>\s*<\/div>/);
});

test("inline views survive nested brackets and work inside table cells", () => {
    const html = render("| A |\n| --- |\n| :blocks[![x](a.png)] :ts[`f(a[0])`] |\n");
    assert.match(html, /<span data-view-only="blocks"><img src="a.png" alt="x"><\/span>/);
    assert.match(html, /<span data-view-only="typescript"><code>f\(a\[0\]\)<\/code><\/span>/);
});

test("the switcher appears only on pages that use views", () => {
    assert.match(render("::: blocks\nhi\n:::\n"), /^<div class="view-switch"/);
    assert.match(render(":ts[x]\n"), /^<div class="view-switch"/);
    assert.doesNotMatch(render("plain text and :unknown[x]\n"), /view-switch|data-view-only/);
});

test("unknown names and unclosed containers are handled", () => {
    assert.doesNotMatch(render("::: other\nhi\n:::\n"), /data-view-only/);
    assert.match(render("::: blocks\nhi\n"), /data-view-only="blocks">\s*<p>hi<\/p>/);
});

test("adjacent views are grouped and the switcher can be placed by a marker", () => {
    const html = render("# Title\n\n::: view-switch\n\n::: blocks\na\n:::\n\n::: ts\nb\n:::\n\n::: blocks\nc\n:::\n\ntext\n");
    assert.equal((html.match(/class="view-group"/g) ?? []).length, 1);
    assert.equal((html.match(/data-view-only/g) ?? []).length, 3);
    assert.ok(html.indexOf("view-switch") > html.indexOf("<h1>"), "switcher follows the marker, not the page top");
    assert.equal((html.match(/class="view-switch"/g) ?? []).length, 1);
});

test("lone code spans in a typescript view use the configured highlighter", () => {
    const md = new MarkdownIt({ html: true, highlight: (code) => `<pre><code><span class="tok">${code}</span>\n</code></pre>` }).use(markdownItCodeView);
    const html = md.render(":ts[`stop()`] :blocks[`stop()`]\n");
    assert.match(html, /<code class="shiki-inline"><span class="tok">stop\(\)<\/span><\/code>/);
    assert.match(html, /<span data-view-only="blocks"><code>stop\(\)<\/code><\/span>/);
});
