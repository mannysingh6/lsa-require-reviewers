import { run } from "../src/require-reviewers";
import * as github from "@actions/github";
import * as core from "@actions/core";

const fs = jest.requireActual("fs");

jest.mock("@actions/core");
jest.mock("@actions/github");

const gh = github.getOctokit("_");
const addLabelsMock = jest.spyOn(gh.rest.issues, "addLabels");
const removeLabelMock = jest.spyOn(gh.rest.issues, "removeLabel");
const reposMock = jest.spyOn(gh.rest.repos, "getContent");
const paginateMock = jest.spyOn(gh, "paginate");
const getPullMock = jest.spyOn(gh.rest.pulls, "get");

const yamlFixtures = {
  "label-requires-reviews.yml": fs.readFileSync("__tests__/fixtures/label-requires-reviews.yml"),
};

afterAll(() => jest.restoreAllMocks());

describe("run", () => {

  it("get configurations", async () => {
    usingTestConfigYaml("label-requires-reviews.yml");
    mockGitHubResponseChangedFiles("foo.txt");
    getPullMock.mockResolvedValue(<any>{
      data: {
        labels: [{ name: "sensitive" }],
        changed_files: 1,
      },
    });

    await run();
  });

})

function usingTestConfigYaml(fixtureName: keyof typeof yamlFixtures): void {
  reposMock.mockResolvedValue(<any>{
    data: { content: yamlFixtures[fixtureName], encoding: "utf8" },
  });
}

function mockGitHubResponseChangedFiles(...files: string[]): void {
  const returnValue = files.map((f) => ({ filename: f }));
  paginateMock.mockReturnValue(<any>returnValue);
}