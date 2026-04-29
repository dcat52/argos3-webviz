/**
 * Grid-based spatial hash for O(N) neighbor queries.
 * Replaces O(N²) brute-force in computed fields like _distance_to_nearest.
 */
export class SpatialHash {
  private cells = new Map<string, string[]>()

  constructor(private cellSize: number = 1.0) {}

  private key(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`
  }

  rebuild(positions: Map<string, { x: number; y: number }>): void {
    this.cells.clear()
    for (const [id, pos] of positions) {
      const k = this.key(pos.x, pos.y)
      let cell = this.cells.get(k)
      if (!cell) { cell = []; this.cells.set(k, cell) }
      cell.push(id)
    }
  }

  queryRadius(x: number, y: number, radius: number): string[] {
    const results: string[] = []
    const minCX = Math.floor((x - radius) / this.cellSize)
    const maxCX = Math.floor((x + radius) / this.cellSize)
    const minCY = Math.floor((y - radius) / this.cellSize)
    const maxCY = Math.floor((y + radius) / this.cellSize)
    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(`${cx},${cy}`)
        if (cell) results.push(...cell)
      }
    }
    return results
  }
}
