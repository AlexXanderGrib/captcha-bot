export interface CaptchaStorage {
  add(id: string, code: string, cb: () => void, delay: number): void;
  decrementMessages(id: string): number;
  solve(id: string, code: string): boolean;
  clear(id: string): void;
  has(is: string): boolean;
}

class Storage implements CaptchaStorage {
  private timeouts = new Map<string, NodeJS.Timeout>();

  private codes = new Map<string, string>();

  private messagesLeft = new Map<string, number>();

  public add(id: string, code: string, cb: () => void, delay = 2000): void {
    this.messagesLeft.set(id, 10);
    this.timeouts.set(
      id,
      setTimeout(() => {
        cb();
        const t = this.timeouts.get(id);

        if (t) clearTimeout(t);

        this.clear(id);
      }, delay)
    );
    this.codes.set(id, code);
  }

  public decrementMessages(id: string): number {
    const base = this.messagesLeft.get(id) || 0;
    const nextValue = base - 1;

    this.messagesLeft.set(id, nextValue);
    return nextValue;
  }

  public solve(id: string, code: string): boolean {
    if (
      this.codes.has(id) &&
      this.timeouts.has(id) &&
      code === this.codes.get(id)
    ) {
      clearTimeout(this.timeouts.get(id) as NodeJS.Timeout); // because of line #30
      this.clear(id);
      return true;
    }
    return false;
  }

  public clear(id: string): void {
    this.timeouts.delete(id);
    this.codes.delete(id);
    this.messagesLeft.delete(id);
  }

  public has(id: string): boolean {
    return (
      this.codes.has(id) || this.timeouts.has(id) || this.messagesLeft.has(id)
    );
  }
}

export default new Storage();
