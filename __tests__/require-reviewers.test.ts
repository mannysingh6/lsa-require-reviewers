import { RequireReviewers } from "../src/require-reviewers";
import * as github from "@actions/github";
import * as core from "@actions/core";

const main = new RequireReviewers();

const fs = jest.requireActual("fs");

jest.mock("@actions/core");
jest.mock("@actions/github");

const gh = github.getOctokit("_");

const reposMock = jest.spyOn(gh.rest.repos, "getContent");
const getPullMock = jest.spyOn(gh.rest.pulls, "get");

const getMaxReviewsNeededSpy = jest.spyOn(main, "getMaxReviewsNeeded");
const getCurrentReviewCountSpy = jest.spyOn(main, "getCurrentReviewCount");
const getChangedFilesSpy = jest.spyOn(main, "getChangedFiles");

const yamlFixtures = {
  "label-requires-reviews.1.yml": fs.readFileSync("__tests__/fixtures/label-requires-reviews.1.yml"),
  "label-requires-reviews.2.yml": fs.readFileSync("__tests__/fixtures/label-requires-reviews.2.yml"),
  "label-requires-reviews.3.yml": fs.readFileSync("__tests__/fixtures/label-requires-reviews.3.yml"),
  "label-requires-reviews.4.yml": fs.readFileSync("__tests__/fixtures/label-requires-reviews.4.yml"),
  "label-requires-reviews.5.yml": fs.readFileSync("__tests__/fixtures/label-requires-reviews.5.yml"),
};

afterAll(() => jest.restoreAllMocks());

describe("run", () => {

  it("test one", async () => {

    const filesChanged = [
      "apps/web/src/containers/class/class.ts",
      "apps/web-e2e-nightwatch/src/utils/apiUtils.ts"
    ];

    usingTestConfigYaml("label-requires-reviews.1.yml");
    getChangedFilesSpy.mockReturnValue(Promise.resolve(filesChanged));
    getCurrentReviewCountSpy.mockReturnValue(Promise.resolve(2));
    getPullMock.mockResolvedValue(<any>{
      data: {
        labels: [{ name: "sensitive" }],
        changed_files: filesChanged.length,
      },
    });

    await main.run();

    expect(getMaxReviewsNeededSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        require_reviews_for_labels: [
          {
            label: "sensitive",
            reviews: 2,
          },
          {
            label: "nightwatch",
            reviews: 1,
          }
        ],
      }),
      ["sensitive"],
      filesChanged.length,
    );
    expect(getMaxReviewsNeededSpy).toReturnWith(2);
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it("test two", async () => {

    const filesChanged = [
      "apps/web/src/containers/class/class.ts",
      "apps/web-e2e-nightwatch/src/utils/apiUtils.ts"
    ];

    usingTestConfigYaml("label-requires-reviews.2.yml");
    getChangedFilesSpy.mockReturnValue(Promise.resolve(filesChanged));
    getCurrentReviewCountSpy.mockReturnValue(Promise.resolve(20));
    getPullMock.mockResolvedValue(<any>{
      data: {
        labels: [{ name: "nightwatch" }],
        changed_files: filesChanged.length,
      },
    });

    await main.run();

    expect(getMaxReviewsNeededSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        require_reviews_for_num_of_files_changed: [
          { num: 3, reviews: 30 }, { num: 2, reviews: 20 }, { num: 1, reviews: 10 }
        ],
      }),
      ["nightwatch"],
      filesChanged.length,
    );
    expect(getMaxReviewsNeededSpy).toReturnWith(20);
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it("test three", async () => {

    const filesChanged = [
      "apps/web/src/containers/class/class.ts",
      "apps/web-e2e-nightwatch/src/utils/apiUtils.ts"
    ];

    usingTestConfigYaml("label-requires-reviews.3.yml");
    getChangedFilesSpy.mockReturnValue(Promise.resolve(filesChanged));
    getCurrentReviewCountSpy.mockReturnValue(Promise.resolve(10));
    getPullMock.mockResolvedValue(<any>{
      data: {
        labels: [{ name: "nightwatch" }],
        changed_files: filesChanged.length,
      },
    });

    await main.run();

    expect(getMaxReviewsNeededSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        require_reviews_for_num_of_files_changed: [
          { num: 3, reviews: 30 }, { num: 2, reviews: 20 }, { num: 1, reviews: 10 },
        ],
        ignore_paths: ["apps/web-e2e-nightwatch/**/*"]
      }),
      ["nightwatch"],
      filesChanged.length - 1,
    );
    expect(getMaxReviewsNeededSpy).toReturnWith(10);
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it("test four", async () => {

    const filesChanged = [
      "apps/web/src/containers/class/class.ts",
      "apps/web-e2e-nightwatch/src/utils/apiUtils.ts"
    ];

    usingTestConfigYaml("label-requires-reviews.4.yml");
    getChangedFilesSpy.mockReturnValue(Promise.resolve(filesChanged));
    getCurrentReviewCountSpy.mockReturnValue(Promise.resolve(2));
    getPullMock.mockResolvedValue(<any>{
      data: {
        labels: [{ name: "sensitive" }, { name: "nightwatch" }],
        changed_files: filesChanged.length,
      },
    });

    await main.run();

    expect(getMaxReviewsNeededSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        require_reviews_for_labels: [
          {
            label: "sensitive",
            reviews: 2,
          },
          {
            label: "nightwatch",
            reviews: 1,
          }
        ],
        require_reviews_for_num_of_files_changed: [
          { num: 3, reviews: 3 }, { num: 2, reviews: 2 }, { num: 1, reviews: 1 }
        ],
        ignore_paths: ["apps/web-e2e-nightwatch/**/*"]
      }),
      ["sensitive", "nightwatch"],
      filesChanged.length - 1,
    );
    expect(getMaxReviewsNeededSpy).toReturnWith(2);
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it("test five", async () => {

    const filesChanged = [
    ];

    usingTestConfigYaml("label-requires-reviews.5.yml");
    getChangedFilesSpy.mockReturnValue(Promise.resolve(filesChanged));
    getCurrentReviewCountSpy.mockReturnValue(Promise.resolve(0));
    getPullMock.mockResolvedValue(<any>{
      data: {
        labels: [],
        changed_files: filesChanged.length,
      },
    });

    await main.run();

    expect(getMaxReviewsNeededSpy).not.toHaveBeenCalled();
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it("Not enough reviews (label)", async () => {

    const filesChanged = [
      "apps/web/src/containers/class/class.ts",
      "apps/web-e2e-nightwatch/src/utils/apiUtils.ts"
    ];

    usingTestConfigYaml("label-requires-reviews.1.yml");
    getChangedFilesSpy.mockReturnValue(Promise.resolve(filesChanged));
    getCurrentReviewCountSpy.mockReturnValue(Promise.resolve(0));
    getPullMock.mockResolvedValue(<any>{
      data: {
        labels: [{ name: "sensitive" }],
        changed_files: filesChanged.length,
      },
    });

    await main.run();

    expect(getMaxReviewsNeededSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        require_reviews_for_labels: [
          {
            label: "sensitive",
            reviews: 2,
          },
          {
            label: "nightwatch",
            reviews: 1,
          }
        ],
      }),
      ["sensitive"],
      filesChanged.length,
    );
    expect(getMaxReviewsNeededSpy).toReturnWith(2);
    expect(core.setFailed).toHaveBeenCalled();

  });

  it("Not enough reviews (num of files changed)", async () => {

    const filesChanged = [
      "apps/web/src/containers/class/class.ts",
      "apps/web-e2e-nightwatch/src/utils/apiUtils.ts",
      "some/random/file.ts"
    ];

    usingTestConfigYaml("label-requires-reviews.3.yml");
    getChangedFilesSpy.mockReturnValue(Promise.resolve(filesChanged));
    getCurrentReviewCountSpy.mockReturnValue(Promise.resolve(5));
    getPullMock.mockResolvedValue(<any>{
      data: {
        labels: [{ name: "sensitive" }],
        changed_files: filesChanged.length,
      },
    });

    await main.run();

    expect(getMaxReviewsNeededSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        require_reviews_for_num_of_files_changed: [
          { num: 3, reviews: 30 }, { num: 2, reviews: 20 }, { num: 1, reviews: 10 },
        ],
        ignore_paths: ["apps/web-e2e-nightwatch/**/*"]
      }),
      ["sensitive"],
      filesChanged.length - 1,
    );
    expect(getMaxReviewsNeededSpy).toReturnWith(20);
    expect(core.setFailed).toHaveBeenCalled();

  });

})

function usingTestConfigYaml(fixtureName: keyof typeof yamlFixtures): void {
  reposMock.mockResolvedValue(<any>{
    data: { content: yamlFixtures[fixtureName], encoding: "utf8" },
  });
}
