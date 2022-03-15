import * as github from "@actions/github";

export type ClientType = ReturnType<typeof github.getOctokit>;

export type Config = {
  require_reviews_for_labels: {
    label: string;
    reviews: number;
  }[];
  require_reviews_for_num_of_files_changed: {
    num: number;
    reviews: number;
  }[];
  ignore_paths: string[];
}