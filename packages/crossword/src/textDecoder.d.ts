/**
 * The standard TextDecoder, which every runtime we target has (browsers,
 * Workers, Node). Declared here because this package compiles without the
 * DOM or Node type libraries; apps that import it bring their own.
 */
declare class TextDecoder {
  constructor(label?: string);
  decode(input?: Uint8Array): string;
}
