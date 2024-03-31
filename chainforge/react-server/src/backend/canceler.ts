/**
 * A CancelTracker allows ids to be added, to signal
 * any associated processes should be 'canceled'. The tracker
 * operates as a global. It does not cancel anything itself,
 * but rather can be used to send a message to cancel a process
 * associated with 'id' (through .add(id)), which the process itself
 * checks (through .has(id)) and then performs the cancellation.
 */
export default class CancelTracker {
  // eslint-disable-next-line no-use-before-define
  private static instance: CancelTracker;
  private data: Set<string | number>;

  private constructor() {
    this.data = new Set();
  }

  // Get the canceler
  public static getInstance(): CancelTracker {
    if (!CancelTracker.instance) CancelTracker.instance = new CancelTracker();
    return CancelTracker.instance;
  }

  // Add an id to trigger cancelation
  private addId(id: string | number): void {
    this.data.add(id);
  }

  public static add(id: string | number): void {
    CancelTracker.getInstance().addId(id);
  }

  // Canceler has the given id
  private hasId(id: string | number): boolean {
    return this.data.has(id);
  }

  public static has(id: string | number): boolean {
    return CancelTracker.getInstance().hasId(id);
  }

  // Clear id from the canceler
  private clearId(id: string | number): void {
    if (CancelTracker.has(id)) this.data.delete(id);
  }

  public static clear(id: string | number): void {
    CancelTracker.getInstance().clearId(id);
  }

  private clearTracker(): void {
    this.data.clear();
  }

  public static clearAll(): void {
    CancelTracker.getInstance().clearTracker();
  }
}
