"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkGlobs = exports.run = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const yaml = __importStar(require("js-yaml"));
const minimatch_1 = require("minimatch");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const token = core.getInput("repo-token", { required: true });
            const configPath = core.getInput("configuration-path", { required: true });
            const syncLabels = !!core.getInput("sync-labels", { required: false });
            const prNumber = getPrNumber();
            if (!prNumber) {
                console.log("Could not get pull request number from context, exiting");
                return;
            }
            const client = github.getOctokit(token);
            const { data: pullRequest } = yield client.rest.pulls.get({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                pull_number: prNumber,
            });
            core.debug(`fetching changed files for pr #${prNumber}`);
            const changedFiles = yield getChangedFiles(client, prNumber);
            const labelGlobs = yield getLabelGlobs(client, configPath);
            const labels = [];
            const labelsToRemove = [];
            for (const [label, globs] of labelGlobs.entries()) {
                core.debug(`processing ${label}`);
                if (checkGlobs(changedFiles, globs)) {
                    labels.push(label);
                }
                else if (pullRequest.labels.find((l) => l.name === label)) {
                    labelsToRemove.push(label);
                }
            }
            if (labels.length > 0) {
                yield addLabels(client, prNumber, labels);
            }
            if (syncLabels && labelsToRemove.length) {
                yield removeLabels(client, prNumber, labelsToRemove);
            }
        }
        catch (error) {
            core.error(error);
            core.setFailed(error.message);
        }
    });
}
exports.run = run;
function getPrNumber() {
    const pullRequest = github.context.payload.pull_request;
    if (!pullRequest) {
        return undefined;
    }
    return pullRequest.number;
}
function getChangedFiles(client, prNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        const listFilesOptions = client.rest.pulls.listFiles.endpoint.merge({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            pull_number: prNumber,
        });
        const listFilesResponse = yield client.paginate(listFilesOptions);
        const changedFiles = listFilesResponse.map((f) => f.filename);
        core.debug("found changed files:");
        for (const file of changedFiles) {
            core.debug("  " + file);
        }
        return changedFiles;
    });
}
function getLabelGlobs(client, configurationPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const configurationContent = yield fetchContent(client, configurationPath);
        // loads (hopefully) a `{[label:string]: string | StringOrMatchConfig[]}`, but is `any`:
        const configObject = yaml.load(configurationContent);
        // transform `any` => `Map<string,StringOrMatchConfig[]>` or throw if yaml is malformed:
        return getLabelGlobMapFromObject(configObject);
    });
}
function fetchContent(client, repoPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield client.rest.repos.getContent({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            path: repoPath,
            ref: github.context.sha,
        });
        return Buffer.from(response.data.content, response.data.encoding).toString();
    });
}
function getLabelGlobMapFromObject(configObject) {
    const labelGlobs = new Map();
    for (const label in configObject) {
        if (typeof configObject[label] === "string") {
            labelGlobs.set(label, [configObject[label]]);
        }
        else if (configObject[label] instanceof Array) {
            labelGlobs.set(label, configObject[label]);
        }
        else {
            throw Error(`found unexpected type for label ${label} (should be string or array of globs)`);
        }
    }
    return labelGlobs;
}
function toMatchConfig(config) {
    if (typeof config === "string") {
        return {
            any: [config],
        };
    }
    return config;
}
function printPattern(matcher) {
    return (matcher.negate ? "!" : "") + matcher.pattern;
}
function checkGlobs(changedFiles, globs) {
    for (const glob of globs) {
        core.debug(` checking pattern ${JSON.stringify(glob)}`);
        const matchConfig = toMatchConfig(glob);
        if (checkMatch(changedFiles, matchConfig)) {
            return true;
        }
    }
    return false;
}
exports.checkGlobs = checkGlobs;
function isMatch(changedFile, matchers) {
    core.debug(`    matching patterns against file ${changedFile}`);
    for (const matcher of matchers) {
        core.debug(`   - ${printPattern(matcher)}`);
        if (!matcher.match(changedFile)) {
            core.debug(`   ${printPattern(matcher)} did not match`);
            return false;
        }
    }
    core.debug(`   all patterns matched`);
    return true;
}
// equivalent to "Array.some()" but expanded for debugging and clarity
function checkAny(changedFiles, globs) {
    const matchers = globs.map((g) => new minimatch_1.Minimatch(g));
    core.debug(`  checking "any" patterns`);
    for (const changedFile of changedFiles) {
        if (isMatch(changedFile, matchers)) {
            core.debug(`  "any" patterns matched against ${changedFile}`);
            return true;
        }
    }
    core.debug(`  "any" patterns did not match any files`);
    return false;
}
// equivalent to "Array.every()" but expanded for debugging and clarity
function checkAll(changedFiles, globs) {
    const matchers = globs.map((g) => new minimatch_1.Minimatch(g));
    core.debug(` checking "all" patterns`);
    for (const changedFile of changedFiles) {
        if (!isMatch(changedFile, matchers)) {
            core.debug(`  "all" patterns did not match against ${changedFile}`);
            return false;
        }
    }
    core.debug(`  "all" patterns matched all files`);
    return true;
}
function checkMatch(changedFiles, matchConfig) {
    if (matchConfig.all !== undefined) {
        if (!checkAll(changedFiles, matchConfig.all)) {
            return false;
        }
    }
    if (matchConfig.any !== undefined) {
        if (!checkAny(changedFiles, matchConfig.any)) {
            return false;
        }
    }
    return true;
}
function addLabels(client, prNumber, labels) {
    return __awaiter(this, void 0, void 0, function* () {
        yield client.rest.issues.addLabels({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: prNumber,
            labels: labels,
        });
    });
}
function removeLabels(client, prNumber, labels) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all(labels.map((label) => client.rest.issues.removeLabel({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: prNumber,
            name: label,
        })));
    });
}
