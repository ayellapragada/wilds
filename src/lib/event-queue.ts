import type { GameEvent } from "../../engine/types";

const GLOBAL_KEY = "__global__";

/** Events that have a trainerId field */
function getTrainerId(event: GameEvent): string | null {
  if ("trainerId" in event && typeof event.trainerId === "string") {
    return event.trainerId;
  }
  return null;
}

export class EventQueueManager {
  private queues = new Map<string, GameEvent[]>();
  private currentEvents = new Map<string, GameEvent | null>();
  private processing = new Set<string>();
  private delayMs: number;
  private lastTrainerId: string | null = null;

  /** Called whenever a current event changes — for reactive UI updates */
  onChange: (() => void) | null = null;

  constructor(delayMs = 500) {
    this.delayMs = delayMs;
  }

  /** Route a batch of events into per-trainer queues */
  queueEvents(events: GameEvent[]) {
    for (const event of events) {
      let key = getTrainerId(event);

      if (key) {
        this.lastTrainerId = key;
      } else if (event.type === "ability_triggered" && this.lastTrainerId) {
        // ability_triggered follows the trainer who drew the pokemon
        key = this.lastTrainerId;
      } else {
        key = GLOBAL_KEY;
      }

      if (!this.queues.has(key)) {
        this.queues.set(key, []);
      }
      this.queues.get(key)!.push(event);

      if (!this.processing.has(key)) {
        this.processQueue(key);
      }
    }
  }

  /** Get the event currently "playing" for a trainer */
  getCurrentEvent(trainerId: string): GameEvent | null {
    return this.currentEvents.get(trainerId) ?? null;
  }

  /** Get the current global event */
  getGlobalEvent(): GameEvent | null {
    return this.currentEvents.get(GLOBAL_KEY) ?? null;
  }

  /** Check if any queue is still processing */
  get isProcessing(): boolean {
    return this.processing.size > 0;
  }

  private async processQueue(key: string) {
    this.processing.add(key);
    const queue = this.queues.get(key)!;

    while (queue.length > 0) {
      const event = queue.shift()!;
      this.currentEvents.set(key, event);
      this.onChange?.();
      await this.delay();
    }

    this.currentEvents.set(key, null);
    this.processing.delete(key);
    this.onChange?.();
  }

  private delay(): Promise<void> {
    if (this.delayMs === 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, this.delayMs));
  }

  /** Clear all queues and current events */
  clear() {
    this.queues.clear();
    this.currentEvents.clear();
    this.processing.clear();
    this.lastTrainerId = null;
    this.onChange?.();
  }
}
