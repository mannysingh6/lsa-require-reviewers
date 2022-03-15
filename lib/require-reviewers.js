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
exports.run = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const yaml = __importStar(require("js-yaml"));
const minimatch_1 = require("minimatch");
const max_reviews_needed_1 = require("./max-reviews-needed");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const token = core.getInput("repo-token", { required: true });
            const configPath = core.getInput("configuration-path", { required: true });
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
            const config = yield getConfig(client, configPath);
            if (!config) {
                console.log("Could not get configuration, exiting");
                return;
            }
            const labels = pullRequest.labels;
            const labelNames = labels.map((l) => l.name);
            let numOfChangedFiles = pullRequest.changed_files;
            const [changedFiles, currentReviewCount] = yield Promise.all([
                getChangedFiles(client, prNumber),
                getCurrentReviewCount(client, prNumber),
            ]);
            if (config === null || config === void 0 ? void 0 : config.ignore_paths) {
                changedFiles.forEach((file) => {
                    const ignorePaths = config.ignore_paths;
                    const ignore = ignorePaths.some((ignorePath) => {
                        const minimatch = new minimatch_1.Minimatch(ignorePath);
                        return minimatch.match(file);
                    });
                    if (ignore) {
                        numOfChangedFiles = Math.max(0, numOfChangedFiles - 1);
                    }
                });
            }
            console.log('config: ', config);
            console.log('labels: ', labelNames);
            console.log('numOfChangedFiles: ', numOfChangedFiles);
            console.log('changedFiles: ', changedFiles);
            console.log('currentReviewCount: ', currentReviewCount);
            const maxReviewsNeeded = (0, max_reviews_needed_1.getMaxReviewsNeeded)(config, labelNames, numOfChangedFiles);
            console.log('maxReviewsNeeded:', maxReviewsNeeded);
            if (maxReviewsNeeded > currentReviewCount) {
                const reviewsNeeded = maxReviewsNeeded - currentReviewCount;
                console.log('reviewsNeeded:', reviewsNeeded);
                core.setFailed(`Need to add ${reviewsNeeded} more reviews`);
            }
        }
        catch (error) {
            console.error(error);
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
        return changedFiles;
    });
}
function getCurrentReviewCount(client, prNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        const listReviewsOptions = client.rest.pulls.listReviews.endpoint.merge({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            pull_number: prNumber,
        });
        const listReviewsResponse = yield client.paginate(listReviewsOptions);
        return listReviewsResponse.length;
    });
}
;
function getConfig(client, configPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const content = yield fetchContent(client, configPath);
        return yaml.load(content);
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
