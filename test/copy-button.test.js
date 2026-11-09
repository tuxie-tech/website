import assert from "node:assert/strict";
import test from "node:test";
import MarkdownIt from "markdown-it";
import { markdownItCopyButton } from "../eleventy-plugins/copy-button.js";

const render = (src, options = {}) => new MarkdownIt(options).use(markdownItCopyButton).render(src);

test("fenced and indented code blocks get a copy button after the pre", () => {
    for (const src of ["```ts\nstop()\n```\n", "    stop()\n"]) {
        const html = render(src);
        assert.match(html, /^<div class="copy-block"><pre>[\s\S]*<\/pre>\s*<button type="button" class="copy-button" title="Copy to clipboard" aria-label="Copy code to clipboard"><\/button><\/div>/);
    }
});

test("the button wraps the highlighter's output, not just the default", () => {
    const html = render("```ts\nx\n```\n", { highlight: () => '<pre class="shiki"><code>HIGHLIGHTED</code></pre>' });
    assert.match(html, /<div class="copy-block"><pre class="shiki"><code>HIGHLIGHTED<\/code><\/pre>\s*<button/);
});

test("inline code is left alone", () => {
    assert.doesNotMatch(render("some `code` here"), /copy-button/);
});
