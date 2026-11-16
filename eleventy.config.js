import path from "node:path";
import { readdir } from "node:fs/promises";
import { inspect } from 'util'
import fs from "node:fs"
import { parse as yamlParse } from "yaml";
import Shiki from "@shikijs/markdown-it";
import pagesPlugin from "./eleventy-plugins/pages.js";
import codeViewPlugin from "./eleventy-plugins/code-view.js";
import copyButtonPlugin from "./eleventy-plugins/copy-button.js";
import { isOptimizable, processQueuedImages, queueImage } from "./eleventy-plugins/images.js";

const templateExtensions = [".html", ".xml", ".njk", ".md"];
const mediaExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif", ".ico", ".pdf", ".mp3", ".mp4", ".webm", ".ogg"];

// FEATURE_* environment flags toggle site features. Each takes a boolean ("true"/"false", "1"/"0", "on"/"off")
// and falls back to the default given here when unset.
const featureFlag = (name, defaultValue) => {
    const value = process.env[name]?.trim().toLowerCase();
    if (!value) {
        return defaultValue;
    }
    return !["false", "0", "off", "no"].includes(value);
};

const features = {
    // Purchase sections on catalog pages, and the view cart page.
    squareSales: featureFlag("FEATURE_SQUARE_SALES", true),
    // Notice at the top of catalog pages linking to an availability and sales enquiry email.
    salesEmail: featureFlag("FEATURE_SALES_EMAIL", true),
};

export default async function(eleventyConfig) {
    eleventyConfig.addGlobalData("features", features);
    console.log(`[book] Features: ${Object.entries(features).map(([key, on]) => `${key}=${on}`).join(", ")}`);

    eleventyConfig.addPlugin(pagesPlugin, { templateExtensions, mediaExtensions });

    // Code blocks are highlighted at build time, so no highlighter ships to the browser.
    const highlighter = await Shiki({
        theme: "github-light",
        langs: ["c", "cpp", "javascript", "typescript", "python"],
        fallbackLanguage: "text",
    });
    eleventyConfig.amendLibrary("md", (md) => md.use(highlighter));

    // `::: blocks` / `::: typescript` containers, with a reader-chosen language for the whole page.
    eleventyConfig.addPlugin(codeViewPlugin);

    // Copy-to-clipboard button on every code block (see src/assets/js/copy-code.js).
    eleventyConfig.addPlugin(copyButtonPlugin);

    // Add a filter to handle URL prefixes correctly
    eleventyConfig.addFilter("url", (path) => {
        const pathPrefix = process.env.PATH_PREFIX || "/";
        // Ensure pathPrefix doesn't have trailing slash for consistency
        const prefix = pathPrefix.endsWith("/") ? pathPrefix.slice(0, -1) : pathPrefix;
        // Ensure path starts with /
        const normalizedPath = path.startsWith("/") ? path : "/" + path;
        return prefix + normalizedPath;
    });

    eleventyConfig.addFilter("safedump", (obj, depth = null) => {
        return inspect(obj, { depth, colors: false });
    });

    eleventyConfig.addCollection("pages", (collectionsApi) => {
        return collectionsApi
            .getAllSorted()
            .filter((item) => item.inputPath.includes("/src/_pages/"));
    });

    eleventyConfig.addCollection("catalog", (collectionsApi) => {
        return collectionsApi
            .getAllSorted()
            .filter((item) => item.inputPath.includes("/src/_pages/catalog/"))
            .filter((item) => !item.inputPath.endsWith("/src/_pages/catalog/index.md"));
    });

    // One entry per guide: the landing page of each folder (or submodule doc/ folder) directly under guides/.
    eleventyConfig.addCollection("guides", (collectionsApi) => {
        return collectionsApi
            .getAll()
            .filter((item) => /^\/guides\/[^/]+\/$/.test(item.url || ""))
            .sort((a, b) => a.data.title.localeCompare(b.data.title));
    });

    eleventyConfig.addCollection("catalogIndex", (collectionsApi) => {
        const seen = new Set();
        const combined = [
            ...collectionsApi.getFilteredByTag("hardware"),
            ...collectionsApi.getFilteredByTag("software")
        ];

        return combined.filter((item) => {
            const key = item.inputPath.replaceAll("\\", "/");
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    });

    eleventyConfig.addCollection("hardwareIndex", (collectionsApi) => {
        const seen = new Set();
        const combined = [
            ...collectionsApi.getFilteredByTag("hardware")
        ];

        return combined.filter((item) => {
            const key = item.inputPath.replaceAll("\\", "/");
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    });

    eleventyConfig.addCollection("softwareIndex", (collectionsApi) => {
        const seen = new Set();
        const combined = [
            ...collectionsApi.getFilteredByTag("software")
        ];

        return combined.filter((item) => {
            const key = item.inputPath.replaceAll("\\", "/");
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    });

    eleventyConfig.addPassthroughCopy("src/assets/js");

    // Static images are optimised into the output once the build finishes.
    const queueImageDir = (dir, target, register) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const entryPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                queueImageDir(entryPath, `${target}/${entry.name}`, register);
            } else if (isOptimizable(entry.name)) {
                queueImage(entryPath, `${target}/${entry.name}`);
            } else if (register) {
                eleventyConfig.addPassthroughCopy({ [entryPath]: `${target}/${entry.name}` });
            }
        }
    };
    queueImageDir("src/assets/img", "assets/img", true);

    // Rescan on rebuilds so added images are picked up by the dev server.
    eleventyConfig.on("eleventy.before", () => queueImageDir("src/assets/img", "assets/img", false));
    eleventyConfig.addWatchTarget("src/assets/img/");
    eleventyConfig.on("eleventy.after", ({ directories, dir }) => processQueuedImages(directories?.output ?? dir.output));


    const pagesRoot = path.join(process.cwd(), "src/_pages");
    // Sections whose entries may be plain folders in this repo, or git submodules with a doc/ folder.
    // A submodule's doc/ folder becomes the entry's output root, e.g. src/_pages/guides/foo/doc/ -> /guides/foo/.
    const SUBMODULE_SECTIONS = ["catalog", "guides"];
    // Keyed by "<section>/<module>", e.g. "catalog/pxt-rib-bit".
    const sectionSubmodules = new Set();
    const sectionSubmoduleUrls = new Map();

    const toPosixPath = (value) => value.replaceAll(path.sep, "/");
    const hasModuleFile = (moduleKey, fileName) => {
        return fs.existsSync(path.join(pagesRoot, moduleKey, fileName));
    };

    for (const section of SUBMODULE_SECTIONS) {
        try {
            const entries = await readdir(path.join(pagesRoot, section), { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && fs.existsSync(path.join(pagesRoot, section, entry.name, ".git"))) {
                    sectionSubmodules.add(`${section}/${entry.name}`);
                }
            }
        } catch {
            // Section directories are optional in some environments.
        }
    }

    try {
        const gitmodulesPath = path.join(process.cwd(), ".gitmodules");
        if (fs.existsSync(gitmodulesPath)) {
            const gitmodules = fs.readFileSync(gitmodulesPath, "utf8");
            const sections = gitmodules.split(/\n(?=\[submodule\s+")/);

            for (const section of sections) {
                const pathMatch = section.match(/^\s*path\s*=\s*(.+)$/m);
                const urlMatch = section.match(/^\s*url\s*=\s*(.+)$/m);

                if (!pathMatch || !urlMatch) {
                    continue;
                }

                const modulePath = pathMatch[1].trim().replaceAll("\\", "/");
                const moduleKey = modulePath.match(/^src\/_pages\/([^/]+\/[^/]+)$/)?.[1];
                if (moduleKey && sectionSubmodules.has(moduleKey)) {
                    sectionSubmoduleUrls.set(moduleKey, urlMatch[1].trim());
                }
            }
        }
    } catch {
        // Missing or malformed .gitmodules should not break builds.
    }

    // Guides must each be a folder with an index page, so their relative links and images resolve inside it.
    try {
        for (const entry of fs.readdirSync(path.join(pagesRoot, "guides"), { withFileTypes: true })) {
            if (entry.isFile() && templateExtensions.includes(path.extname(entry.name)) && !entry.name.startsWith("index.")) {
                console.warn(`[book] Guide 'guides/${entry.name}' should be a folder: move it to 'guides/${path.parse(entry.name).name}/index${path.extname(entry.name)}'.`);
            }
        }
    } catch {
        // No guides directory.
    }

    // Matches a page inside a section submodule's doc/ folder: { moduleKey, sectionName, moduleName, stemWithinDoc }.
    const sectionDocPattern = new RegExp(`^/_pages/((${SUBMODULE_SECTIONS.join("|")})/([^/]+))/doc(?:/(.*))?$`);
    const matchSubmoduleDoc = (data) => {
        const filePathStem = (data.page?.filePathStem || "").replaceAll("\\", "/");
        const match = filePathStem.match(sectionDocPattern);
        if (!match || !sectionSubmodules.has(match[1])) {
            return null;
        }
        return { moduleKey: match[1], sectionName: match[2], moduleName: match[3], stemWithinDoc: match[4] || "index" };
    };

    // Pages inherit front matter from the index pages of their ancestor directories.
    const pagesDir = path.resolve("src/_pages");
    const NOT_INHERITED = new Set(["layout", "title", "permalink", "plugins", "eleventyComputed"]);
    const INDEX_FILES = ["index.md", "index.njk", "index.html"];
    const metaCache = new Map();

    const readFileMeta = (file) => {
        if (metaCache.has(file)) {
            return metaCache.get(file);
        }

        let meta = {};
        const frontMatter = fs.readFileSync(file, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (frontMatter) {
            meta = yamlParse(frontMatter[1]) || {};
        }

        metaCache.set(file, meta);
        return meta;
    };

    const readIndexMeta = (dir) => {
        const file = INDEX_FILES.map((name) => path.join(dir, name)).find((candidate) => fs.existsSync(candidate));
        return file ? readFileMeta(file) : {};
    };

    const collectIndexKeys = (dir, keys) => {
        for (const key of Object.keys(readIndexMeta(dir))) {
            if (!NOT_INHERITED.has(key)) {
                keys.add(key);
            }
        }

        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
                collectIndexKeys(path.join(dir, entry.name), keys);
            }
        }
    };

    // Ancestor index metadata, nearest first. A directory's own index starts at its parent.
    const getAncestorMeta = (data) => {
        const inputPath = path.resolve(data.page?.inputPath || "");
        let dir = path.dirname(inputPath);
        if (INDEX_FILES.includes(path.basename(inputPath))) {
            dir = path.dirname(dir);
        }

        const chain = [];
        while (dir.startsWith(pagesDir + path.sep)) {
            chain.push({ dir, meta: readIndexMeta(dir) });
            dir = path.dirname(dir);
        }
        return chain;
    };

    const inheritedKeys = new Set();
    if (fs.existsSync(pagesDir)) {
        collectIndexKeys(pagesDir, inheritedKeys);
    }

    const inheritedData = {};
    for (const key of inheritedKeys) {
        inheritedData[key] = (data) => {
            // A computed key can't read its own value, so use the page's front matter.
            const own = readFileMeta(path.resolve(data.page.inputPath))[key];
            const chain = getAncestorMeta(data).filter(({ meta }) => meta[key] !== undefined);

            if (key === "tags") {
                const all = [...chain.reverse().map(({ meta }) => meta.tags), own];
                return [...new Set(all.flat().filter(Boolean))];
            }

            if (own !== undefined || !chain.length) {
                return own;
            }

            const { dir, meta } = chain[0];
            if (key !== "hero") {
                return meta[key];
            }

            // Pages render as /name/, so relative image paths need one "../" per level below the owning index.
            const depth = path.relative(dir, path.resolve(data.page.inputPath)).split(path.sep).length;
            const prefix = "../".repeat(depth);
            const rebase = (src) => /^(\/|[a-z]+:)/i.test(src) ? src : prefix + src;
            return Array.isArray(meta.hero) ? meta.hero.map(rebase) : rebase(meta.hero);
        };
    }

    eleventyConfig.addGlobalData("eleventyComputed", {
        ...inheritedData,
        // "TuxieTech enquiry about <title> (<hwidx id>)", with the id taken from the first `mfn` entry if present.
        enquirySubject: (data) => {
            const mfn = [data.mfn].flat().find((value) => typeof value === "string" && value.trim());
            const id = mfn?.trim().replace(/\/+$/, "");
            return `TuxieTech enquiry about ${data.title}${id ? ` (${id})` : ""}`;
        },
        apiBaseUrl: () => process.env.API_BASE_URL || "https://api.tuxie.tech",
        isMakecode: (data) => {
            const doc = matchSubmoduleDoc(data);
            if (doc && hasModuleFile(doc.moduleKey, "pxt.json")) {
                return true;
            }
        },
        gitUrl: (data) => {
            const doc = matchSubmoduleDoc(data);
            if (doc && sectionSubmoduleUrls.has(doc.moduleKey)) {
                return sectionSubmoduleUrls.get(doc.moduleKey);
            }
        },
        permalink: (data) => {
            const inputPath = data.page?.inputPath || "";
            if (!features.squareSales && inputPath.endsWith("/src/_pages/cart.md")) {
                return false;
            }

            if (!inputPath.endsWith(".md") || !inputPath.includes("/_pages/")) {
                return;
            }

            const doc = matchSubmoduleDoc(data);
            if (doc) {
                const base = `/${doc.sectionName}/${doc.moduleName}/`;
                if (doc.stemWithinDoc === "index") {
                    return base;
                }

                if (doc.stemWithinDoc.endsWith("/index")) {
                    return `${base}${doc.stemWithinDoc.slice(0, -"/index".length)}/`;
                }

                return `${base}${doc.stemWithinDoc}/`;
            }

            // Anything in a section submodule outside its doc/ folder (README, sources...) is not published.
            const filePathStem = (data.page?.filePathStem || "").replaceAll("\\", "/");
            const submoduleMatch = filePathStem.match(/^\/_pages\/([^/]+\/[^/]+)\/(.*)$/);
            if (
                submoduleMatch
                && sectionSubmodules.has(submoduleMatch[1])
                && !submoduleMatch[2].startsWith("doc/")
            ) {
                return false;
            }

            const relativeStem = filePathStem.replace(/^\/_pages/, "");

            if (relativeStem === "/index" || relativeStem === "") {
                return "/";
            }

            if (relativeStem.endsWith("/index")) {
                return `${relativeStem.slice(0, -"/index".length)}/`;
            }

            return `${relativeStem}/`;
        }
    });

    console.log( `[book] Finished configuring '${pagesRoot}'` );
	
    return {
        pathPrefix: process.env.PATH_PREFIX || "/",
        dir: {
            input: "src",
            output: "dist",
            includes: "_includes"
        },
        templateFormats: templateExtensions.map((ext) => ext.slice(1)),
        htmlTemplateEngine: "njk",
        markdownTemplateEngine: "njk"
    }

};