const ASSET_BASE_URL = import.meta.env.VITE_ASSET_BASE_URL ?? "";

export function assetUrl(path: string): string {
  return `${ASSET_BASE_URL}/${path}`;
}

export function preloadImages(paths: string[]): void {
  for (const path of paths) {
    const img = new Image();
    img.src = assetUrl(path);
  }
}

const POKESPRITE_BASE =
  "https://raw.githubusercontent.com/msikma/pokesprite/master/pokemon-gen8/regular";

export function spriteUrl(templateId: string): string {
  return `${POKESPRITE_BASE}/${templateId}.png`;
}


const TYPE_COLORS: Record<string, string> = {
  normal: '#bfbf8f',  fire: '#f5ac78',    water: '#9db7f5',   grass: '#a7db8d',
  electric: '#fae078', ice: '#bce6e6',    fighting: '#d67873', poison: '#c183c1',
  ground: '#ebd69d',  flying: '#c6b7f5',  psychic: '#fa92b2', bug: '#c6d16e',
  rock: '#d1c17d',    ghost: '#a292bc',   dragon: '#a27dfa',  dark: '#a29288',
  steel: '#d1d1e0',   fairy: '#f4bdc9',
};

export function typeColor(types: readonly string[]): string {
  const c1 = TYPE_COLORS[types[0]] ?? '#a8a878';
  if (types.length < 2) return c1;
  const c2 = TYPE_COLORS[types[1]] ?? c1;
  return `linear-gradient(to right, ${c1} 30%, ${c2} 70%)`;
}
