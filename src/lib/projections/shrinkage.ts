// Empirical-Bayes-style shrinkage: blends a small-sample average toward a prior (league/position baseline)
// as sample size shrinks, so "3 career games at this stadium" can't produce a wildly overconfident adjustment.
// `k` is the "pseudo-sample-size" of the prior — larger k means more skepticism of small samples.
export function shrink(sampleMean: number, sampleSize: number, prior: number, k: number): number {
  if (sampleSize <= 0) return prior;
  return (sampleMean * sampleSize + prior * k) / (sampleSize + k);
}
