import * as core from "@actions/core";
import * as github from "@actions/github";
import * as yaml from "js-yaml";
import { Minimatch } from "minimatch";
import { getMaxReviewsNeeded } from "./max-reviews-needed";
import { ClientType, Config } from "./models";

export async function run() {
  try {
    const token = core.getInput("repo-token", { required: true });
    const configPath = core.getInput("configuration-path", { required: true });

    const prNumber = getPrNumber();
    if (!prNumber) {
      console.log("Could not get pull request number from context, exiting");
      return;
    }

    const client: ClientType = github.getOctokit(token);

    const { data: pullRequest } = await client.rest.pulls.get({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: prNumber,
    });

    const config = await getConfig(client, configPath);
    if (!config) {
      console.log("Could not get configuration, exiting");
      return;
    }

    const labels = pullRequest.labels;
    const labelNames: string[] = labels.map((l: any) => l.name);
    let numOfChangedFiles = pullRequest.changed_files;

    const [changedFiles, currentReviewCount] = await Promise.all([
      getChangedFiles(client, prNumber),
      getCurrentReviewCount(client, prNumber),
    ]);

    if (config?.ignore_paths) {
      changedFiles.forEach((file) => {
        const ignorePaths = config.ignore_paths;
        const ignore = ignorePaths.some((ignorePath) => {
          const minimatch = new Minimatch(ignorePath);
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

    const maxReviewsNeeded = getMaxReviewsNeeded(
      config,
      labelNames,
      numOfChangedFiles
    );

    console.log('maxReviewsNeeded:', maxReviewsNeeded);

    if (maxReviewsNeeded > currentReviewCount) {
      const reviewsNeeded = maxReviewsNeeded - currentReviewCount;
      console.log('reviewsNeeded:', reviewsNeeded);
      core.setFailed(`Need to add ${reviewsNeeded} more reviews`);
    }

  } catch (error: any) {
    console.error(error);
    core.error(error);
    core.setFailed(error.message);
  }
}

function getPrNumber(): number | undefined {
  const pullRequest = github.context.payload.pull_request;
  if (!pullRequest) {
    return undefined;
  }

  return pullRequest.number;
}

async function getChangedFiles(
  client: ClientType,
  prNumber: number
): Promise<string[]> {
  const listFilesOptions = client.rest.pulls.listFiles.endpoint.merge({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    pull_number: prNumber,
  });

  const listFilesResponse = await client.paginate(listFilesOptions);
  const changedFiles = listFilesResponse.map((f: any) => f.filename);
  return changedFiles;
}

async function getCurrentReviewCount(
  client: ClientType,
  prNumber: number
): Promise<number> {
  const listReviewsOptions = client.rest.pulls.listReviews.endpoint.merge({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    pull_number: prNumber,
  });

  const listReviewsResponse = await client.paginate(listReviewsOptions);
  return listReviewsResponse.length;
};

async function getConfig(
  client: ClientType,
  configPath: string
): Promise<Config> {
  const content = await fetchContent(client, configPath);
  return yaml.load(content);
}

async function fetchContent(
  client: ClientType,
  repoPath: string
): Promise<string> {
  const response: any = await client.rest.repos.getContent({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    path: repoPath,
    ref: github.context.sha,
  });

  return Buffer.from(response.data.content, response.data.encoding).toString();
}