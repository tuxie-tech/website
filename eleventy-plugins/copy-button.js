// Adds a copy-to-clipboard button to every fenced and indented code block rendered from markdown.
//
// The markup is produced at build time:
//
//     <div class="copy-block"><pre>…</pre><button class="copy-button" …></button></div>
//
// The button has no icon of its own (the CSS draws it), carries a tooltip, and does nothing until
// src/assets/js/copy-code.js loads, which also reveals the buttons; without JavaScript the
// page is simply the code block, as before.

export const BUTTON_HTML = '<button type="button" class="copy-button" title="Copy to clipboard" aria-label="Copy code to clipboard"></button>';

export function markdownItCopyButton(md) {
    for (const rule of ["fence", "code_block"]) {
        const original = md.renderer.rules[rule];
        if (!original) continue;

        md.renderer.rules[rule] = (...args) => `<div class="copy-block">${original(...args)}${BUTTON_HTML}</div>\n`;
    }
}

export default function copyButtonPlugin(eleventyConfig) {
    eleventyConfig.amendLibrary("md", (md) => md.use(markdownItCopyButton));
}
