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
