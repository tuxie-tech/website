import path from "node:path";
import { readdir } from "node:fs/promises";
import { inspect } from 'util'
import fs from "node:fs"
import pagesPlugin from "./eleventy-plugins/pages.js";

const templateExtensions = [".html", ".xml", ".njk", ".md"];
const mediaExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif", ".ico", ".pdf", ".mp3", ".mp4", ".webm", ".ogg"];

export default async function(eleventyConfig) {
    eleventyConfig.addPlugin(pagesPlugin, { templateExtensions, mediaExtensions });

    // Add a filter to handle URL prefixes correctly
    eleventyConfig.addFilter("url", (path) => {
        const pathPrefix = process.env.PATH_PREFIX || "/";
        // Ensure pathPrefix doesn't have trailing slash for consistency
        const prefix = pathPrefix.endsWith("/") ? pathPrefix.slice(0, -1) : pathPrefix;
        // Ensure path starts with /
        const normalizedPath = path.startsWith("/") ? path : "/" + path;
        return prefix + normalizedPath;
    });

    eleventyConfig.addFilter("safedump", (obj) => {
        return inspect(obj, { depth: null, colors: false });
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

    eleventyConfig.addPassthroughCopy("src/assets/img");


    const pagesRoot = path.join(process.cwd(), "src/_pages");
    const catalogRoot = path.join(pagesRoot, "catalog");
    const catalogSubmodules = new Set();
    const catalogSubmoduleUrls = new Map();

    const toPosixPath = (value) => value.replaceAll(path.sep, "/");
    const hasCatalogModuleFile = (moduleName, fileName) => {
        return fs.existsSync(path.join(catalogRoot, moduleName, fileName));
    };

    try {
        const catalogEntries = await readdir(catalogRoot, { withFileTypes: true });
        for (const entry of catalogEntries) {
            if (!entry.isDirectory()) {
                continue;
            }

            const modulePath = path.join(catalogRoot, entry.name);
            if (fs.existsSync(path.join(modulePath, ".git"))) {
                catalogSubmodules.add(entry.name);
            }
        }
    } catch {
        // Catalog directory is optional in some environments.
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
                const url = urlMatch[1].trim();
                const catalogPathMatch = modulePath.match(/^src\/_pages\/catalog\/([^/]+)$/);

                if (!catalogPathMatch) {
                    continue;
                }

                const moduleName = catalogPathMatch[1];
                if (catalogSubmodules.has(moduleName)) {
                    catalogSubmoduleUrls.set(moduleName, url);
                }
            }
        }
    } catch {
        // Missing or malformed .gitmodules should not break builds.
    }

    eleventyConfig.addGlobalData("eleventyComputed", {
        isMakecode: (data) => {
            const filePathStem = (data.page?.filePathStem || "").replaceAll("\\", "/");
            const docMatch = filePathStem.match(/^\/_pages\/catalog\/([^/]+)\/doc(?:\/(.*))?$/);
            if (docMatch && hasCatalogModuleFile(docMatch[1], "pxt.json")) {
                return true;
            }
        },
        gitUrl: (data) => {
            const filePathStem = (data.page?.filePathStem || "").replaceAll("\\", "/");
            const docMatch = filePathStem.match(/^\/_pages\/catalog\/([^/]+)\/doc(?:\/(.*))?$/);
            if (docMatch && catalogSubmoduleUrls.has(docMatch[1])) {
                return catalogSubmoduleUrls.get(docMatch[1]);
            }
        },
        permalink: (data) => {
            const inputPath = data.page?.inputPath || "";
            if (!inputPath.endsWith(".md") || !inputPath.includes("/_pages/")) {
                return;
            }

            const filePathStem = (data.page?.filePathStem || "").replaceAll("\\", "/");
            const docMatch = filePathStem.match(/^\/_pages\/catalog\/([^/]+)\/doc(?:\/(.*))?$/);
            if (docMatch && catalogSubmodules.has(docMatch[1])) {
                const moduleName = docMatch[1];
                const stemWithinDoc = docMatch[2] || "index";

                if (stemWithinDoc === "index") {
                    return `/catalog/${moduleName}/`;
                }

                if (stemWithinDoc.endsWith("/index")) {
                    const folderStem = stemWithinDoc.slice(0, -"/index".length);
                    return `/catalog/${moduleName}/${folderStem}/`;
                }

                return `/catalog/${moduleName}/${stemWithinDoc}/`;
            }

            const submoduleMatch = filePathStem.match(/^\/_pages\/catalog\/([^/]+)\/(.*)$/);
            if (
                submoduleMatch
                && catalogSubmodules.has(submoduleMatch[1])
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