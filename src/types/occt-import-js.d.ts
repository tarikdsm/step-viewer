declare module 'occt-import-js' {
  export interface OCCTMesh {
    name?: string;
    attributes: {
      position?: { array: Float32Array };
      normal?: { array: Float32Array };
    };
    index?: { array: Uint32Array };
    color?: [number, number, number];
  }

  export interface OCCTResult {
    meshes?: OCCTMesh[];
  }

  export interface OCCTInstance {
    ReadStepFile: (data: Uint8Array, params: null | Record<string, unknown>) => OCCTResult;
  }

  export default function init(options?: { locateFile?: (path: string) => string }): Promise<OCCTInstance>;
}
