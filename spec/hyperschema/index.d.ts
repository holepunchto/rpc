export interface Encoding<T = any> {
  preencode(state: any, value: T): void;
  encode(state: any, value: T): void;
  decode(state: any): T;
}

export function setVersion(v: number): void;
export let version: number;

export function getEnum(name: string): unknown;
export function getEncoding(name: string): Encoding<any>;
export function getStruct(name: string, v?: number): Encoding<any>;
export function resolveStruct(name: string, v?: number): Encoding<any>;

export function encode(name: string, value: any, v?: number): Uint8Array;
export function decode(name: string, buffer: Uint8Array, v?: number): any;

