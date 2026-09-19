/** The face's ink colours; every feature is procedural geometry with a flat material. */
export type FacePalette={
  readonly eye:string;
  /** Mouth and brows share one material. */
  readonly mouth:string;
  readonly tongue:string;
  readonly blush:string;
};

export type JellyFlavor = {
  readonly surface:string;
  readonly absorption:readonly [number,number,number];
  /** Absent means the original palette, drawn for lime and worn by every flavor since. */
  readonly face?:FacePalette;
};

export const DEFAULT_FACE:FacePalette={eye:'#142905',mouth:'#254508',tongue:'#b5d641',blush:'#edab4f'};

export const JELLY_FLAVORS={
  lime:{surface:'#eaffd4',absorption:[48,3.2,85]},
  strawberry:{surface:'#ffc2ce',absorption:[10,44,56]},
  blueberry:{surface:'#a9d9ff',absorption:[14,8,3]},
  lemon:{surface:'#fff06a',absorption:[8,8,112]},
  // Smashbar grape — brand purple. Absorbs green hardest so the body reads violet
  // in transmission, with a pale lavender surface so highlights stay soft.
  grape:{
    surface:'#e9d5ff',absorption:[22,62,6],
    // Plum ink instead of the lime face's greens: dark plum eyes and mouth, an orchid tongue, pink blush.
    face:{eye:'#1b0d33',mouth:'#33175a',tongue:'#e0aaff',blush:'#f28cb0'},
  },
} as const satisfies Record<string,JellyFlavor>;

export type JellyFlavorName=keyof typeof JELLY_FLAVORS;
export const DEFAULT_JELLY_FLAVOR:JellyFlavorName='lime';
