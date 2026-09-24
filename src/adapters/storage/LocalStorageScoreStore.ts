import type { ScoreStore } from '../../ports/driven';

export class LocalStorageScoreStore implements ScoreStore {
  constructor(private readonly key = 'falling2fluffy.best') {}

  loadBest(): number {
    try {
      return Number(localStorage.getItem(this.key)) || 0;
    } catch (err) {
      console.warn('Best score unavailable', err);
      return 0;
    }
  }

  saveBest(score: number): void {
    try {
      localStorage.setItem(this.key, String(score));
    } catch (err) {
      console.warn('Could not save best score', err);
    }
  }
}
