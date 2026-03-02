declare module 'occt-import-js' {
  export default function init(options?: { locateFile?: (path: string) => string }): Promise<any>;
}
