/**
 * Independent Job Execution Engine
 *
 * Dynamically resolves prerequisites from the active workflow DAG,
 * calculates topological execution waves (supporting branching & parallelism),
 * skips already-satisfied dependencies, and executes jobs in dependency order.
 */

/**
 * Automatically determine all prerequisite jobs required to execute the target job,
 * including direct and indirect dependencies. Cycle-safe.
 */
export function resolvePrerequisites(targetJobId, predsMap) {
  const prerequisites = new Set();
  const queue = [targetJobId];
  const visited = new Set([targetJobId]);

  while (queue.length > 0) {
    const current = queue.shift();
    const directPrereqs = predsMap.get(current) || [];
    for (const p of directPrereqs) {
      if (!visited.has(p)) {
        visited.add(p);
        prerequisites.add(p);
        queue.push(p);
      }
    }
  }

  return prerequisites;
}

/**
 * Determine if a job is already successfully completed.
 */
export function isJobSuccess(jobId, states) {
  const state = states?.[jobId];
  if (!state) return false;
  const tone = String(state.tone || '').toLowerCase();
  const label = String(state.label || '').toLowerCase();
  return tone === 'good' || label === 'success' || label === 'done';
}

/**
 * Build the execution plan for a target job:
 * 1. Resolves all direct and indirect dependencies.
 * 2. Skips already-successful prerequisite jobs.
 * 3. Partitions the required jobs into sequential execution waves (supporting parallel branches).
 */
export function buildExecutionPlan(targetJobId, predsMap, currentStates = {}) {
  const allPrereqs = resolvePrerequisites(targetJobId, predsMap);
  const allCandidates = new Set([targetJobId, ...allPrereqs]);

  // Determine which jobs actually need execution.
  // The target job always runs; prerequisites run only if not already successful.
  const toRun = new Set();
  const alreadySatisfied = [];

  for (const jobId of allCandidates) {
    if (jobId === targetJobId || !isJobSuccess(jobId, currentStates)) {
      toRun.add(jobId);
    } else {
      alreadySatisfied.push(jobId);
    }
  }

  // Construct topological waves from toRun
  // A job can run when all its prerequisites in allCandidates are satisfied
  // (either already satisfied or finished in previous waves).
  const satisfiedInPlan = new Set(alreadySatisfied);
  const remaining = new Set(toRun);
  const waves = [];

  let safetyCounter = 0;
  const maxIterations = remaining.size + 2;

  while (remaining.size > 0 && safetyCounter < maxIterations) {
    safetyCounter += 1;
    const currentWave = [];

    for (const jobId of remaining) {
      const directPrereqs = predsMap.get(jobId) || [];
      // Only care about prerequisites that belong to this workflow / execution chain
      const relevantPrereqs = directPrereqs.filter((p) => allCandidates.has(p));
      const allSatisfied = relevantPrereqs.every((p) => satisfiedInPlan.has(p));

      if (allSatisfied) {
        currentWave.push(jobId);
      }
    }

    if (currentWave.length === 0) {
      // Cycle or unresolvable prerequisite: push all remaining to avoid infinite loop
      waves.push(Array.from(remaining));
      break;
    }

    waves.push(currentWave);
    for (const j of currentWave) {
      remaining.delete(j);
      satisfiedInPlan.add(j);
    }
  }

  return {
    targetJobId,
    allPrerequisites: Array.from(allPrereqs),
    alreadySatisfied,
    toRun: Array.from(toRun),
    waves,
  };
}

