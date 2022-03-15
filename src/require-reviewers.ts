import * as core from "@actions/core";
import * as github from "@actions/github";
import * as yaml from "js-yaml";
import { Minimatch } from "minimatch";
import { ClientType, Config } from "./models";

export class RequireReviewers {
  public async run() {
    try {
      const token = core.getInput("repo-token", { required: true });
      const configPath = core.getInput("configuration-path", { required: true });

      const prNumber = this.getPrNumber();
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

      const config = await this.getConfig(client, configPath);
      if (!config) {
        console.log("Could not get configuration, exiting");
        return;
      }

      const labels = pullRequest.labels;
      const labelNames: string[] = labels.map((l: any) => l.name);
      let numOfChangedFiles = pullRequest.changed_files;

      const [changedFiles, currentReviewCount] = await Promise.all([
        this.getChangedFiles(client, prNumber),
        this.getCurrentReviewCount(client, prNumber),
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

      const maxReviewsNeeded = this.getMaxReviewsNeeded(
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

  public getMaxReviewsNeeded(
    config: Config,
    labels: string[],
    numOfChangedFiles: number
  ): number {
    let maxReviewsNeeded = 0;

    if (config.require_reviews_for_labels) {
      for (const label of labels) {
        const labelConfig = config.require_reviews_for_labels.find(
          (c) => c.label === label
        );

        if (labelConfig) {
          maxReviewsNeeded = Math.max(maxReviewsNeeded, labelConfig.reviews);
        }
      }
    }

    if (config.require_reviews_for_num_of_files_changed) {
      const sortedConfig = config.require_reviews_for_num_of_files_changed.sort(
        (a, b) => b.num - a.num
      );
      const numConfig = sortedConfig.find(
        (c) => c.num <= numOfChangedFiles
      );

      if (numConfig) {
        maxReviewsNeeded = Math.max(maxReviewsNeeded, numConfig.reviews);
      }
    }

    return maxReviewsNeeded;
  }

  public async getCurrentReviewCount(
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

  public async getChangedFiles(
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

  private getPrNumber(): number | undefined {
    const pullRequest = github.context.payload.pull_request;
    if (!pullRequest) {
      return undefined;
    }

    return pullRequest.number;
  }

  private async getConfig(
    client: ClientType,
    configPath: string
  ): Promise<Config> {
    const content = await this.fetchContent(client, configPath);
    return yaml.load(content);
  }

  private async fetchContent(
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
}

export const requireReviewers = new RequireReviewers();
