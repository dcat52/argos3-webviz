/**
 * Fixed-capacity ring buffer with O(1) push and O(N) ordered iteration.
 * Used for trail history and other bounded-memory sequences.
 */
export class RingBuffer<T> {
  private buf: (T | undefined)[]
  private head = 0
  private count = 0

  constructor(private capacity: number) {
    this.buf = new Array(capacity)
  }

  push(item: T): void {
    this.buf[this.head % this.capacity] = item
    this.head++
    if (this.count < this.capacity) this.count++
  }

  get length(): number { return this.count }

  /** Get item by logical index (0 = oldest) */
  get(index: number): T | undefined {
    if (index < 0 || index >= this.count) return undefined
    const start = this.count < this.capacity ? 0 : this.head
    return this.buf[(start + index) % this.capacity] as T
  }

  /** Last pushed item */
  last(): T | undefined {
    if (this.count === 0) return undefined
    return this.buf[(this.head - 1 + this.capacity) % this.capacity] as T
  }

  /** Iterate oldest → newest */
  *[Symbol.iterator](): Iterator<T> {
    const start = this.count < this.capacity ? 0 : this.head
    for (let i = 0; i < this.count; i++) {
      yield this.buf[(start + i) % this.capacity] as T
    }
  }

  clear(): void {
    this.head = 0
    this.count = 0
  }
}
