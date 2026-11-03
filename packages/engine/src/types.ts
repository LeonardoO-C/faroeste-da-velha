export type Player = 'X' | 'O';
export type Outcome = Player | 'draw' | null;

export function other(p: Player): Player {
  return p === 'X' ? 'O' : 'X';
}
