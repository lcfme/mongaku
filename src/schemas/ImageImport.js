const os = require("os");
const fs = require("fs");
const path = require("path");

const glob = require("glob");
const async = require("async");
const unzip = require("unzip-stream");

const models = require("../lib/models");
const db = require("../lib/db");
const options = require("../lib/options");
const urls = require("../lib/urls")(options);
const config = require("../lib/config");

const Import = require("./Import");

const SAVE_RATE = 30 * 1000;

const states = [
    {
        id: "started",
        name: i18n => i18n.gettext("Awaiting processing..."),
        advance(batch, callback) {
            if (batch.zipFile) {
                batch.processZipFile(callback);
            } else if (batch.directory) {
                batch.processDirectory(callback);
            } else {
                process.nextTick(callback);
            }
        },
    },
    {
        id: "process.started",
        name: i18n => i18n.gettext("Processing..."),
    },
    {
        id: "process.completed",
        name: i18n => i18n.gettext("Completed."),
        advance(batch, callback) {
            // NOTE(jeresig): Currently nothing needs to be done to finish
            // up the import, other than moving it to the "completed" state.
            process.nextTick(callback);
        },
    },
    {
        id: "completed",
        name: i18n => i18n.gettext("Completed."),
    },
];

const errors = {
    ERROR_READING_ZIP: i18n => i18n.gettext("Error opening zip file."),
    ZIP_FILE_EMPTY: i18n => i18n.gettext("Zip file has no images in it."),
    MALFORMED_IMAGE: i18n =>
        i18n.gettext(
            "There was an error processing " +
                "the image. Perhaps it is malformed in some way.",
        ),
    EMPTY_IMAGE: i18n => i18n.gettext("The image is empty."),
    NEW_VERSION: i18n =>
        i18n.gettext(
            "A new version of the image was " +
                "uploaded, replacing the old one.",
        ),
    TOO_SMALL: i18n =>
        i18n.gettext(
            "The image is too small to work with " +
                "the image similarity algorithm. It must be at " +
                "least 150px on each side.",
        ),
    ERROR_SAVING: i18n => i18n.gettext("Error saving image."),
};

const ImageImport = new db.schema(
    Object.assign({}, Import.schema, {
        // The location of the uploaded zip file
        // (temporary, deleted after processing)
        zipFile: {
            type: String,
        },

        // The directory location of the source images to import
        directory: {
            type: String,
        },

        // The name of the original file (e.g. `foo.zip`)
        fileName: {
            type: String,
            required: true,
        },
    }),
);

Object.assign(ImageImport.methods, Import.methods, {
    getURL(lang) {
        return urls.gen(
            lang,
            `/${this.getSource().type}/source` +
                `/${this.source}/admin?images=${this._id}`,
        );
    },

    getError(i18n) {
        return models("ImageImport").getError(i18n, this.error);
    },

    getStates() {
        return states;
    },

    processZipFile(callback) {
        const zipFile = fs.createReadStream(this.zipFile);
        let zipError;
        const files = [];
        const extractDir = path.join(
            os.tmpdir(),
            new Date().getTime().toString(),
        );

        fs.mkdir(extractDir, () => {
            zipFile
                .pipe(unzip.Parse())
                .on("entry", entry => {
                    const fileName = path.basename(entry.path);
                    const outFileName = path.join(extractDir, fileName);

                    // Ignore things that aren't files (e.g. directories)
                    // Ignore files that don't end with .jpe?g
                    // Ignore files that start with '.'
                    if (
                        entry.type !== "File" ||
                        !/.+\.jpe?g$/i.test(fileName) ||
                        fileName.indexOf(".") === 0
                    ) {
                        return entry.autodrain();
                    }

                    // Don't attempt to add files that already exist
                    if (files.indexOf(outFileName) >= 0) {
                        return entry.autodrain();
                    }

                    /* istanbul ignore if */
                    if (config.NODE_ENV !== "test") {
                        console.log("Extracting:", path.basename(outFileName));
                    }

                    files.push(outFileName);
                    entry.pipe(fs.createWriteStream(outFileName));
                })
                .on("error", function() {
                    // Hack from this ticket to force the stream to close:
                    // https://github.com/glebdmitriew/node-unzip-2/issues/8
                    this._streamEnd = true;
                    this._streamFinish = true;
                    zipError = true;
                })
                .on("close", () => {
                    if (zipError) {
                        return callback(new Error("ERROR_READING_ZIP"));
                    }

                    if (files.length === 0) {
                        return callback(new Error("ZIP_FILE_EMPTY"));
                    }

                    this.importImages(files, callback);
                });
        });
    },

    processDirectory(callback) {
        const fileGlob = path.join(
            path.resolve(this.directory),
            "**",
            "*.@(jpg|jpeg)",
        );

        glob(fileGlob, (err, files) => {
            /* istanbul ignore if */
            if (err) {
                return callback(err);
            }

            // Filter out any directories, we only want files
            const onlyFiles = files.filter(file => fs.statSync(file).isFile());

            this.importImages(onlyFiles, callback);
        });
    },

    importImages(files, callback) {
        // Import all of the files as images
        async.eachLimit(
            files,
            1,
            (file, callback) => {
                this.addResult(file, callback);
            },
            err => {
                /* istanbul ignore if */
                if (err) {
                    return callback(err);
                }

                this.setSimilarityState(callback);
            },
        );
    },

    setSimilarityState(callback) {
        const {type} = this.getSource();
        const hasImageSearch = options.types[type].hasImageSearch();

        if (hasImageSearch) {
            const Image = models("Image");
            Image.queueBatchSimilarityIndex(this._id, callback);
        } else {
            process.nextTick(callback);
        }
    },

    addResult(file, callback) {
        /* istanbul ignore if */
        if (config.NODE_ENV !== "test") {
            console.log("Adding Image:", path.basename(file));
        }

        models("Image").fromFile(this, file, (err, image, warnings) => {
            const fileName = path.basename(file);

            const result = {
                _id: fileName,
                fileName,
            };

            if (err) {
                result.error = err.message;
            } else {
                result.warnings = warnings;
                result.model = image._id;
            }

            if (image) {
                image.save(err => {
                    /* istanbul ignore if */
                    if (err) {
                        result.error = err.message;
                        result.model = undefined;
                    } else {
                        image.linkToRecords(callback);
                    }

                    // Add the result
                    this.results.push(result);
                    this.delayedSave();
                });
            } else {
                // Add the result
                this.results.push(result);
                this.delayedSave();
            }
        });
    },

    getFilteredResults() {
        return {
            models: this.results.filter(result => result.model),
            errors: this.results.filter(result => result.error),
            warnings: this.results.filter(
                result => (result.warnings || []).length !== 0,
            ),
        };
    },

    getFilteredResultsSummary() {
        const filtered = this.getFilteredResults();
        return {
            models: filtered.models.length,
            errors: filtered.errors.length,
            warnings: filtered.warnings.length,
        };
    },

    delayedSave() {
        if (this.saveDelay) {
            return;
        }

        this.saveDelay = setTimeout(() => {
            this.saveDelay = null;
            this.save(() => {
                // Ignore the result
            });
        }, SAVE_RATE);
    },
});

Object.assign(ImageImport.statics, Import.statics, {
    fromFile(fileName, source) {
        const ImageImport = models("ImageImport");
        return new ImageImport({source, fileName});
    },

    getError(i18n, error) {
        const msg = errors[error];
        return msg ? msg(i18n) : error;
    },
});

ImageImport.pre("validate", function(next) {
    // Create the ID if one hasn't been set before
    if (!this._id) {
        this._id = `${this.source}/${Date.now()}`;
    }

    next();
});

/* istanbul ignore next */
ImageImport.pre("save", function(next) {
    // Always updated the modified time on every save
    this.modified = new Date();

    next();
});

module.exports = ImageImport;
