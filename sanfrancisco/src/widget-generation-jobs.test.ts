import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWidgetGenerationJobs,
  normalizeWidgetGenerationJob,
} from './widget-generation-jobs.ts';

test('widget generation job envelope accepts translation and embed jobs', () => {
  const jobs = buildWidgetGenerationJobs({
    accountPublicId: 'A1B2C3D4',
    instanceId: 'Z9Y8X7W6V5',
    sourceVersion: 7,
    traceId: 'trace-1',
    now: '2026-05-16T12:00:00.000Z',
  });

  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs.map((job) => job.jobType), ['widget.translation', 'widget.embed']);
  for (const job of jobs) {
    assert.equal(normalizeWidgetGenerationJob(job)?.sourceVersion, 7);
    assert.equal(normalizeWidgetGenerationJob(job)?.attempt, 0);
  }
});

test('widget generation job envelope rejects ambiguous or unscoped jobs', () => {
  assert.equal(normalizeWidgetGenerationJob({
    v: 1,
    jobId: 'job-1',
    jobType: 'widget.translation',
    accountPublicId: 'not-an-account',
    instanceId: 'Z9Y8X7W6V5',
    sourceVersion: 1,
    attempt: 0,
    queuedAt: '2026-05-16T12:00:00.000Z',
    traceId: 'trace-1',
    agentId: 'widget.instance.translator',
  }), null);

  assert.equal(normalizeWidgetGenerationJob({
    v: 1,
    jobId: 'job-1',
    jobType: 'widget.embed',
    accountPublicId: 'A1B2C3D4',
    instanceId: 'Z9Y8X7W6V5',
    sourceVersion: 0,
    attempt: 0,
    queuedAt: '2026-05-16T12:00:00.000Z',
    traceId: 'trace-1',
    agentId: 'widget.instance.embed',
  }), null);
});
