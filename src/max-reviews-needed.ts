import { Config } from "./models";

export function getMaxReviewsNeeded(
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