import fs from "node:fs";
import path from "node:path";
import { parse as yamlParse } from "yaml";

const toPosixPath = (value) => value.replaceAll(path.sep, "/");

const getGitSubmodulePaths = () => {
    const gitmodulesPath = path.join(process.cwd(), ".gitmodules");
    if( !fs.existsSync(gitmodulesPath) )
        return [];
    return fs.readFileSync(gitmodulesPath, "utf8")
        .split("\n")
        .filter( line => line.trim().startsWith("path = ") )
        .map( line => line.split(" = ")[1].trim() );
};

// Builds the `contents` global data tree (page metadata) and registers passthrough
// copies for media files, in a single walk of src/_pages.
export default function pagesPlugin(eleventyConfig, { templateExtensions, mediaExtensions }) {
    const pagesRoot = "src/_pages/";
    const submodulePaths = getGitSubmodulePaths();
    const templateExtensionPattern = new RegExp(`\\.(${templateExtensions.map((ext) => ext.slice(1)).join("|")})$`);

    const getOutputPath = (inputPath) => {
        // This is _probably_ ok, but feels quite janky to have a special 'slugify' here for just this.
        // We should really use the core function for 11ty...
        let url = path.relative(pagesRoot, inputPath).replace(/\\/g, "/").replace(templateExtensionPattern, "");
        url = url === "index" ? "/" : `/${url}`;
        url = url.replace(/\/index$/, "");
        return url;
    };

    const getPageMetadata = (pagePath) => {
        const meta = {};
        if( !fs.existsSync(pagePath) ) {
            console.log( `[book] Was asked to generate metadata for non-existent page '${pagePath}'.` );
            return meta;
        }

        try {
            const content = fs.readFileSync(pagePath, "utf8");
            if( content.length < 3 || !content.startsWith("---") ) {
                console.log( `[book] No front matter found in '${pagePath}'.` );
                return {};
            }

            const endOfFrontMatter = content.indexOf("---", 3);
            if( endOfFrontMatter === -1 ) {
                console.log( `[book] No closing front matter delimiter found in '${pagePath}'.` );
                return {};
            }

            const frontMatterContent = content.slice(3, endOfFrontMatter).trim();
            Object.assign(meta, yamlParse(frontMatterContent, { prettyErrors: true, strict: true }));
        }
        catch (error) {
            console.error(`[book] Error while reading metadata for page '${pagePath}':`, error);
        }

        return meta;
    };

    // Merges a parent's tags with a page's own, de-duplicated.
    const mergeTags = (parentTags, ownTags) => [...new Set([...(parentTags || []), ...(ownTags || [])])];

    const copyMediaFile = (filePath, virtualFilePath) => {
        const relativePath = toPosixPath(path.relative(process.cwd(), filePath));
        const targetPath = `/${toPosixPath(path.relative(pagesRoot, virtualFilePath))}`;

        console.log( `[book] Copying '${relativePath}' to '${targetPath}'` );
        eleventyConfig.addPassthroughCopy({
            [relativePath]: targetPath
        });
    };

    const walkPagesTree = (dir, virtualDir = dir, parentTags = []) => {
        const context = {
            input: dir,
            output: getOutputPath(virtualDir),
        };
        const files = fs.readdirSync(dir, { withFileTypes: true });

        // Read the directory's own index page first, so its tags can flow down to its children.
        const indexFile = files.find( file =>
            file.isFile() &&
            templateExtensions.includes( path.extname(file.name) ) &&
            getOutputPath(path.join(virtualDir, file.name)) === context.output
        );
        const dirTags = mergeTags( parentTags, indexFile ? getPageMetadata(path.join(dir, indexFile.name)).tags : undefined );

        for( const file of files ) {
            if( file.name.startsWith(".") )
                continue;

            const filePath = path.join(dir, file.name);
            const virtualFilePath = path.join(virtualDir, file.name);

            if( file.isDirectory() ) {
                if( submodulePaths.includes(toPosixPath(path.relative(process.cwd(), filePath))) ) {
                    console.log( `[book] Parsing submodule directory: ${filePath}` );
                    const innerDocPath = path.join(filePath, "doc");
                    if( !fs.existsSync(innerDocPath) ) {
                        console.log( `[book] Submodule detected, but had no doc subpath, so skipped: ${filePath}` );
                        continue;
                    }
                    // The submodule's doc/ folder becomes the module's own output root.
                    context.sections = context.sections || [];
                    context.sections.push( walkPagesTree( innerDocPath, virtualFilePath, dirTags ) );
                    continue;
                }

                context.sections = context.sections || [];
                context.sections.push( walkPagesTree( filePath, virtualFilePath, dirTags ) );
                continue;
            }

            const extension = path.extname(file.name).toLowerCase();

            if( templateExtensions.includes( extension ) ) {
                const meta = getPageMetadata( filePath );
                meta.tags = mergeTags( dirTags, meta.tags );

                context.sections = context.sections || [];
                context.sections.push( {
                    'input': filePath,
                    'output': getOutputPath(virtualFilePath),
                    'meta': meta
                } );
                continue;
            }

            if( mediaExtensions.includes( extension ) ) {
                copyMediaFile(filePath, virtualFilePath);
            }
        }

        // Determine if we have a direct child with the same output path as the directory itself, and if so, merge its metadata into the directory context.
        const indexPage = context.sections?.find( section => section.output === context.output );
        if( indexPage ) {
            context.meta = getPageMetadata( indexPage.input );
            context.meta.tags = dirTags;
            // Remove the index page from the sections, since its metadata is now part of the directory context.
            context.sections = context.sections.filter( section => section !== indexPage );
        }
        context.sections = context.sections || [];

        return context;
    };

    // Walk eagerly, since addPassthroughCopy must be registered during config setup,
    // not lazily when 11ty later resolves the "contents" global data.
    eleventyConfig.addGlobalData("contents", walkPagesTree(pagesRoot));
}
