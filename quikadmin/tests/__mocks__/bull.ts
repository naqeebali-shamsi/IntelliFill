/**
 * Bull Queue Mock for Jest Tests
 *
 * This mock provides a complete in-memory implementation of Bull queue
 * functionality to enable tests to run without Redis connection.
 */

import { EventEmitter } from 'events';

// In-memory job storage
const jobStorage = new Map<string, MockJob>();
let jobIdCounter = 1;

class MockJob extends EventEmitter {
  id: string | number;
  data: any;
  opts: any;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  returnvalue?: any;
  failedReason?: string;
  attemptsMade: number = 0;
  private _state: string = 'waiting';
  private _progress: number = 0;

  constructor(data: any, opts: any = {}, id?: string | number) {
    super();
    this.id = id || jobIdCounter++;
    this.data = data;
    this.opts = {
      attempts: 3,
      ...opts
    };
    this.timestamp = Date.now();
    jobStorage.set(String(this.id), this);
  }

  async progress(value?: number): Promise<number> {
    if (value !== undefined) {
      this._progress = value;
    }
    return this._progress;
  }

  async getState(): Promise<string> {
    return this._state;
  }

  async remove(): Promise<void> {
    jobStorage.delete(String(this.id));
  }

  async retry(): Promise<void> {
    this._state = 'waiting';
    this.attemptsMade++;
  }

  async promote(): Promise<void> {
    this._state = 'waiting';
  }

  async finished(): Promise<any> {
    return this.returnvalue;
  }

  async waitUntilFinished(opts?: { ttl?: number }): Promise<any> {
    // Simulate immediate completion for tests
    this._state = 'completed';
    this.finishedOn = Date.now();
    return this.returnvalue;
  }

  // Internal methods for testing
  _setState(state: string) {
    this._state = state;
  }

  _complete(result?: any) {
    this._state = 'completed';
    this.returnvalue = result;
    this.finishedOn = Date.now();
  }

  _fail(reason: string) {
    this._state = 'failed';
    this.failedReason = reason;
    this.finishedOn = Date.now();
    this.attemptsMade++;
  }
}

class MockQueue extends EventEmitter {
  name: string;
  private jobs: Map<string, MockJob> = new Map();
  private _isPaused: boolean = false;
  private _isClosed: boolean = false;
  private processor?: Function;

  constructor(name: string, redisConfig?: any, opts?: any) {
    super();
    this.name = name;
    // Emit ready event asynchronously
    setImmediate(() => this.emit('ready'));
  }

  // Core queue methods
  async add(data: any, opts?: any): Promise<MockJob>;
  async add(name: string, data: any, opts?: any): Promise<MockJob>;
  async add(nameOrData: any, dataOrOpts?: any, opts?: any): Promise<MockJob> {
    let jobData: any;
    let jobOpts: any;

    if (typeof nameOrData === 'string') {
      jobData = dataOrOpts;
      jobOpts = opts;
    } else {
      jobData = nameOrData;
      jobOpts = dataOrOpts;
    }

    const job = new MockJob(jobData, jobOpts);
    this.jobs.set(String(job.id), job);

    // Emit events
    this.emit('waiting', job);

    // If there's a processor, simulate processing
    if (this.processor) {
      setImmediate(async () => {
        try {
          job._setState('active');
          job.processedOn = Date.now();
          this.emit('active', job);

          const result = await (this.processor as Function)(job);
          job._complete(result);
          this.emit('completed', job, result);
        } catch (error) {
          job._fail(error instanceof Error ? error.message : 'Unknown error');
          this.emit('failed', job, error);
        }
      });
    }

    return job;
  }

  async addBulk(jobs: Array<{ data: any; opts?: any }>): Promise<MockJob[]> {
    return Promise.all(jobs.map(j => this.add(j.data, j.opts)));
  }

  process(concurrency: number | Function, processor?: Function): void {
    if (typeof concurrency === 'function') {
      this.processor = concurrency;
    } else {
      this.processor = processor;
    }
  }

  async getJob(jobId: string | number): Promise<MockJob | null> {
    return this.jobs.get(String(jobId)) || jobStorage.get(String(jobId)) || null;
  }

  async getJobs(
    types: string | string[],
    start?: number,
    end?: number,
    asc?: boolean
  ): Promise<MockJob[]> {
    return Array.from(this.jobs.values());
  }

  // Queue state methods
  async empty(): Promise<void> {
    this.jobs.clear();
  }

  async clean(grace: number, type?: string): Promise<string[]> {
    const cleaned: string[] = [];
    this.jobs.forEach((job, id) => {
      if (job.finishedOn && Date.now() - job.finishedOn > grace) {
        this.jobs.delete(id);
        cleaned.push(id);
      }
    });
    return cleaned;
  }

  async pause(isLocal?: boolean, doNotWaitActive?: boolean): Promise<void> {
    this._isPaused = true;
    this.emit('paused');
  }

  async resume(isLocal?: boolean): Promise<void> {
    this._isPaused = false;
    this.emit('resumed');
  }

  async close(): Promise<void> {
    this._isClosed = true;
    this.jobs.clear();
    this.emit('closed');
  }

  async obliterate(opts?: { force?: boolean }): Promise<void> {
    this.jobs.clear();
  }

  // Count methods
  async getWaitingCount(): Promise<number> {
    return this._countByState('waiting');
  }

  async getActiveCount(): Promise<number> {
    return this._countByState('active');
  }

  async getCompletedCount(): Promise<number> {
    return this._countByState('completed');
  }

  async getFailedCount(): Promise<number> {
    return this._countByState('failed');
  }

  async getDelayedCount(): Promise<number> {
    return this._countByState('delayed');
  }

  async getPausedCount(): Promise<number> {
    return this._isPaused ? this.jobs.size : 0;
  }

  async count(): Promise<number> {
    return this.jobs.size;
  }

  private _countByState(state: string): number {
    let count = 0;
    this.jobs.forEach(job => {
      if ((job as any)._state === state) count++;
    });
    return count;
  }

  // Status checks
  isPaused(): boolean {
    return this._isPaused;
  }

  isReady(): Promise<this> {
    return Promise.resolve(this);
  }

  // Clients (mock for compatibility)
  get clients() {
    return [];
  }

  get client() {
    return {
      status: 'ready',
      duplicate: () => ({})
    };
  }
}

// Export as both default and named export to match Bull's export pattern
const BullMock = MockQueue as any;
BullMock.Job = MockJob;
BullMock.Queue = MockQueue;

export default BullMock;
export { MockQueue as Queue, MockJob as Job };
