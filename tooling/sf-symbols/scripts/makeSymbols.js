const fs = require("fs");
const path = require("path");
const opentype = require("opentype.js");
const {
    WEIGHTS,
    SF_SYMBOLS_VERSION,
    PATH_PRECISION,
    FONT_SIZE,
} = require("./constants");

// Not sure if this is right
function writeFile(_path, contents) {
    fs.mkdirSync(path.dirname(_path), { recursive: true });
    fs.writeFileSync(_path, contents);
}

// Paths
const REPO_ROOT = path.resolve(__dirname, "../..", "..");

const PATHS = {
    CHARS: path.resolve(__dirname, "..", "sources", SF_SYMBOLS_VERSION, "chars.txt"),
    NAMES: path.resolve(__dirname, "..", "sources", SF_SYMBOLS_VERSION, "names.txt"),
    OUT: path.resolve(REPO_ROOT, "dieter", "icons", "icons.json"),
};

async function make() {
    console.log("Loading Fonts...");

    const fonts = await Promise.all(
        WEIGHTS.map(async (weight) => {
            const font = await opentype.load(
                `${__dirname}/../sources/${SF_SYMBOLS_VERSION}/SF-Pro-Text-${weight}.otf`
            );
            return font;
        })
    );

    console.log("Capturing Paths... This takes a while");

    const chars = fs
        .readFileSync(PATHS.CHARS, { encoding: "utf-8" })
        .match(/.{1,2}/g);

    // Load name sequence from text file.
    const names = fs
        .readFileSync(PATHS.NAMES, { encoding: "utf8", flag: "r" })
        .split(/\r?\n/);

    const out = {
        version: SF_SYMBOLS_VERSION,
        precision: PATH_PRECISION,
        fontSize: FONT_SIZE,
        symbols: names.reduce((acc1, name, namesIndex) => {
            console.log(`${namesIndex + 1}/${names.length} - ${name}`);
            return {
                ...acc1,
                [name]: WEIGHTS.reduce((acc2, weight, index) => {
                    const font = fonts[index];
                    const glyph = font.charToGlyph(chars[namesIndex]);
                    const ascenderPx = (font.ascender / font.unitsPerEm) * FONT_SIZE;
                    const advanceWidthPx =
                        (glyph.advanceWidth / font.unitsPerEm) * FONT_SIZE;
                    const path = font.getPath(
                        chars[namesIndex],
                        0,
                        ascenderPx,
                        FONT_SIZE
                    );
                    const bb = path.getBoundingBox();
                    const pathData = path.toPathData(PATH_PRECISION);

                    return {
                        ...acc2,
                        [weight.toLowerCase()]: {
                            path: pathData,
                            geometry: {
                                width: FONT_SIZE,
                                height: FONT_SIZE,
                                advanceWidth: advanceWidthPx,
                                bounds: {
                                    x1: bb.x1,
                                    y1: bb.y1,
                                    x2: bb.x2,
                                    y2: bb.y2,
                                },
                            },
                        },
                    };
                }, {}),
            };
        }, {}),
    };

    console.log("Done!");
    writeFile(PATHS.OUT, JSON.stringify(out, null, 2));
}

make();
