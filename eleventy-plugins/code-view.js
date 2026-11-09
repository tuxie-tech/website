// Lets a page offer the same example in several forms (MakeCode blocks or TypeScript) and
// show only the one the reader picked. The choice is remembered across pages.
//
// Block form (images, code fences, any markdown):
//
//     ::: blocks
//     ![A block](render.png)
//     :::
//
//     ::: typescript
//     ```ts
//     haptibit.stop()
//     ```
//     :::
//
// Inline form (handy in table cells):
//
//     | :blocks[![play](play.png)] :typescript[`haptibit.stop()`] |
//
// `ts` is accepted as a short name for `typescript`. Adjacent containers form a group whose
// views share one space, so the page does not move when the reader switches language.
//
// Pages using at least one view get a "Show examples as" toggle button group. It goes where a
// `::: view-switch` line is written, or at the top of the page if there isn't one. Pages that
// don't use views are left untouched.

export const VIEWS = { blocks: "Blocks", typescript: "TypeScript" };
const ALIASES = { ts: "typescript" };
export const STORAGE_KEY = "tuxietech-code-view";

const resolveView = (name) => {
    const view = ALIASES[name] ?? name;
    return Object.hasOwn(VIEWS, view) ? view : null;
};

const NAME_PATTERN = [...Object.keys(VIEWS), ...Object.keys(ALIASES)].join("|");
const BLOCK_OPEN = new RegExp(`^:::\\s*(${NAME_PATTERN})\\s*$`);
const BLOCK_CLOSE = /^:::\s*$/;
const INLINE_OPEN = new RegExp(`^:(${NAME_PATTERN})\\[`);

const SWITCH_MARKER = /^:::\s*view-switch\s*$/;

const switcherHtml = () => `<div class="view-switch">
<span id="view-switch-label">Show examples as</span>
<div class="segmented" role="group" aria-labelledby="view-switch-label">
${Object.entries(VIEWS).map(([view, label]) => `<button type="button" data-view-choice="${view}" aria-pressed="false">${label}</button>`).join("\n")}
</div>
</div>
<script>
(function () {
    var key = ${JSON.stringify(STORAGE_KEY)}, root = document.documentElement, view;
    try { view = localStorage.getItem(key); } catch (e) {}
    root.dataset.view = ${JSON.stringify(Object.keys(VIEWS))}.indexOf(view) < 0 ? ${JSON.stringify(Object.keys(VIEWS)[0])} : view;
    function sync() {
        document.querySelectorAll("[data-view-choice]").forEach(function (b) {
            b.setAttribute("aria-pressed", String(b.dataset.viewChoice === root.dataset.view));
        });
    }
    document.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("[data-view-choice]");
        if (!b) return;
        root.dataset.view = b.dataset.viewChoice;
        try { localStorage.setItem(key, root.dataset.view); } catch (e) {}
        sync();
    });
    document.addEventListener("DOMContentLoaded", sync);
})();
</script>
`;

// Reuses the markdown-it `highlight` option (set by the syntax highlighter plugin, if any)
// and keeps just the highlighted code, without the surrounding <pre>.
const highlightInline = (md, code) => {
    const html = md.options.highlight?.(code, "typescript", "");
    const inner = html && /<code[^>]*>([\s\S]*)<\/code>/.exec(html);
    return inner ? `<code class="shiki-inline">${inner[1].replace(/\n$/, "")}</code>` : null;
};

export function markdownItCodeView(md) {
    md.block.ruler.before("fence", "code_view", (state, startLine, endLine, silent) => {
        if (state.sCount[startLine] - state.blkIndent >= 4) return false;

        const start = state.bMarks[startLine] + state.tShift[startLine];
        const opener = BLOCK_OPEN.exec(state.src.slice(start, state.eMarks[startLine]));
        if (!opener) return false;
        if (silent) return true;

        let next = startLine + 1;
        let closed = false;
        for (; next < endLine; next++) {
            const from = state.bMarks[next] + state.tShift[next];
            if (BLOCK_CLOSE.test(state.src.slice(from, state.eMarks[next]))) {
                closed = true;
                break;
            }
        }

        const open = state.push("code_view_open", "div", 1);
        open.block = true;
        open.attrSet("data-view-only", resolveView(opener[1]));
        open.map = [startLine, next];

        const parentType = state.parentType;
        const lineMax = state.lineMax;
        state.parentType = "container";
        state.lineMax = next;
        state.md.block.tokenize(state, startLine + 1, next);
        state.parentType = parentType;
        state.lineMax = lineMax;

        state.push("code_view_close", "div", -1).block = true;
        state.line = next + (closed ? 1 : 0);
        return true;
    }, { alt: ["paragraph", "reference", "blockquote", "list"] });

    md.block.ruler.before("fence", "code_view_switch", (state, startLine, endLine, silent) => {
        if (state.sCount[startLine] - state.blkIndent >= 4) return false;

        const start = state.bMarks[startLine] + state.tShift[startLine];
        if (!SWITCH_MARKER.test(state.src.slice(start, state.eMarks[startLine]))) return false;
        if (silent) return true;

        const token = state.push("code_view_switch", "", 0);
        token.block = true;
        token.map = [startLine, startLine + 1];
        state.line = startLine + 1;
        return true;
    });

    md.inline.ruler.before("link", "code_view_inline", (state, silent) => {
        const { src, pos } = state;
        if (src.charCodeAt(pos) !== 0x3a) return false;

        const opener = INLINE_OPEN.exec(src.slice(pos, pos + 16));
        if (!opener) return false;

        // Find the matching close bracket, allowing nested brackets (images, links).
        const contentStart = pos + opener[0].length;
        let depth = 1;
        let end = contentStart;
        for (; end < state.posMax; end++) {
            const char = src[end];
            if (char === "\\") {
                end++;
            } else if (char === "[") {
                depth++;
            } else if (char === "]" && --depth === 0) {
                break;
            }
        }
        if (depth !== 0) return false;

        if (!silent) {
            const open = state.push("code_view_inline_open", "span", 1);
            open.attrSet("data-view-only", resolveView(opener[1]));

            const posMax = state.posMax;
            state.pos = contentStart;
            state.posMax = end;
            state.md.inline.tokenize(state);
            state.posMax = posMax;

            // A lone code span in a TypeScript view gets the same highlighting as a code fence.
            const only = state.tokens.length === state.tokens.indexOf(open) + 2 ? state.tokens.at(-1) : null;
            if (only?.type === "code_inline" && resolveView(opener[1]) === "typescript") {
                const html = highlightInline(state.md, only.content);
                if (html) {
                    only.type = "html_inline";
                    only.content = html;
                }
            }

            state.push("code_view_inline_close", "span", -1);
        }

        state.pos = end + 1;
        return true;
    });

    md.core.ruler.push("code_view_switcher", (state) => {
        const { tokens } = state;

        // Group runs of adjacent block views so their views can share one space.
        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i].type !== "code_view_open") continue;

            let end = i;
            for (;;) {
                let depth = 0;
                let close = end;
                do {
                    if (tokens[close].nesting === 1) depth++;
                    else if (tokens[close].nesting === -1) depth--;
                    close++;
                } while (depth > 0 && close < tokens.length);
                end = close - 1;

                if (tokens[end + 1]?.type === "code_view_open") {
                    end++;
                } else {
                    break;
                }
            }

            const groupOpen = new state.Token("code_view_group_open", "div", 1);
            groupOpen.block = true;
            groupOpen.attrSet("class", "view-group");
            const groupClose = new state.Token("code_view_group_close", "div", -1);
            groupClose.block = true;
            tokens.splice(end + 1, 0, groupClose);
            tokens.splice(i, 0, groupOpen);
            i = end + 2;
        }

        // Offer the switcher only on pages that actually have something to switch.
        const used = tokens.some((token) => token.type === "code_view_open")
            || tokens.some((token) => token.type === "inline"
                && token.children?.some((child) => child.type === "code_view_inline_open"));
        if (!used) return;

        const switcher = new state.Token("html_block", "", 0);
        switcher.content = switcherHtml();
        switcher.block = true;

        const marker = tokens.findIndex((token) => token.type === "code_view_switch");
        if (marker >= 0) {
            tokens.splice(marker, 1, switcher);
        } else {
            tokens.unshift(switcher);
        }
    });
}

export default function codeViewPlugin(eleventyConfig) {
    eleventyConfig.amendLibrary("md", (md) => md.use(markdownItCodeView));
}
