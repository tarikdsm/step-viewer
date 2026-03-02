declare module 'occt-import-js' {
  export interface OCCTInstance {
    ReadStepFile: (data: Uint8Array, params: unknown) => unknown;
  }
  export default function init(options?: { locateFile?: (path: string) => string }): Promise<OCCTInstance>;
}
