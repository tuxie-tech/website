import path from "node:path";
import { readdir } from "node:fs/promises";

export default async function(eleventyConfig) {
    // Add a filter to handle URL prefixes correctly
    eleventyConfig.addFilter("url", (path) => {
        const pathPrefix = process.env.PATH_PREFIX || "/";
        // Ensure pathPrefix doesn't have trailing slash for consistency
        const prefix = pathPrefix.endsWith("/") ? pathPrefix.slice(0, -1) : pathPrefix;
        // Ensure path starts with /
        const normalizedPath = path.startsWith("/") ? path : "/" + path;
        return prefix + normalizedPath;
    });

    eleventyConfig.addGlobalData("eleventyComputed", {
        permalink: (data) => {
            const inputPath = data.page?.inputPath || "";
            if (!inputPath.endsWith(".md") || !inputPath.includes("/_pages/")) {
                return;
            }

            const filePathStem = data.page?.filePathStem || "";
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

    eleventyConfig.addPassthroughCopy("src/assets/img");


    const mediaExtensions = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif", ".ico", ".pdf", ".mp3", ".mp4", ".webm", ".ogg"]);
    const pagesRoot = path.join(process.cwd(), "src/_pages");

    const walkPagesTree = async (directoryPath) => {
        const entries = await readdir(directoryPath, { withFileTypes: true });

        for (const entry of entries) {
            const entryPath = path.join(directoryPath, entry.name);

            if (entry.isDirectory()) {
                await walkPagesTree(entryPath);
                continue;
            }

            const extension = path.extname(entry.name).toLowerCase();
            if (!mediaExtensions.has(extension)) {
                continue;
            }

            const relativePath = path.relative(process.cwd(), entryPath).replaceAll(path.sep, "/");
            const relativeToPages = path.relative(pagesRoot, entryPath).replaceAll(path.sep, "/");
            const targetPath = `/${relativeToPages}`;

            eleventyConfig.addPassthroughCopy({
                [relativePath]: targetPath
            });
        }
    };
    await walkPagesTree(pagesRoot);

    //eleventyConfig.addCollection("pages", async (collectionsApi) => collectionsApi.getAllSorted() );
	
    return {
        pathPrefix: process.env.PATH_PREFIX || "/",
        dir: {
            input: "src",
            output: "dist",
            includes: "_includes"
        },
        templateFormats: ["html", "njk", "md"],
        htmlTemplateEngine: "njk",
        markdownTemplateEngine: "njk"
    }

};