import * as core from "@actions/core";
import * as github from "@actions/github";
import * as yaml from "js-yaml";

export async function run() {
  try {
    const token = core.getInput("repo-token", { required: true });
    const configPath = core.getInput("configuration-path", { required: true });

    const myInput = core.getInput('myInput');
    core.debug(`Hello ${myInput} from inside a container`);

    // Get github context data
    const context = github.context;
    console.log(`We can even get context data, like the repo: ${context.repo.repo}`)

  } catch (error: any) {
    core.error(error);
    core.setFailed(error.message);
  }
}