declare class HyperswarmRPC {
  constructor(options?: HyperswarmRPC.RPCOptions);

  readonly dht: any;
  readonly defaultKeyPair: HyperswarmRPC.KeyPair;

  createServer(options?: HyperswarmRPC.ServerOptions): HyperswarmRPC.RPCServer;
  connect(
    publicKey: HyperswarmRPC.BinaryLike,
    options?: HyperswarmRPC.ConnectOptions
  ): HyperswarmRPC.RPCClient;

  request(
    publicKey: HyperswarmRPC.BinaryLike,
    method: string,
    value: any,
    options?: HyperswarmRPC.RequestOptions
  ): Promise<any>;

  event(
    publicKey: HyperswarmRPC.BinaryLike,
    method: string,
    value: any,
    options?: HyperswarmRPC.RequestOptions
  ): void;

  destroy(options?: HyperswarmRPC.DestroyOptions): Promise<void>;
}

declare namespace HyperswarmRPC {
  export type BinaryLike = Uint8Array;

  export class EventEmitter {
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export interface KeyPair {
    publicKey: BinaryLike;
    secretKey: BinaryLike;
  }

  export interface ValueEncoding<T = any> {
    preencode?: (state: any, value: T) => void;
    encode?: (state: any, value: T) => void;
    decode?: (state: any) => T;
  }

  export interface RequestOptions {
    valueEncoding?: ValueEncoding<any>;
    requestEncoding?: ValueEncoding<any>;
    responseEncoding?: ValueEncoding<any>;
    [key: string]: any;
  }

  export interface ConnectOptions {
    capability?: BinaryLike | null;
    keyPair?: KeyPair;
    [key: string]: any;
  }

  export interface ServerOptions {
    capability?: BinaryLike | null;
    [key: string]: any;
  }

  export interface RPCOptions {
    valueEncoding?: ValueEncoding<any>;
    seed?: BinaryLike;
    keyPair?: KeyPair;
    bootstrap?: string[];
    debug?: any;
    dht?: any;
    namespace?: any;
    capability?: any;
    poolLinger?: number;
  }

  export interface DestroyOptions {
    force?: boolean;
  }

  export interface ServerAddress {
    host: string;
    port: number;
    publicKey: BinaryLike;
  }

  export class RPCClient extends EventEmitter {
    readonly dht: any;
    readonly rpc: any;
    readonly closed: boolean;
    readonly mux: any;
    readonly stream: any;

    request(method: string, value: any, options?: RequestOptions): Promise<any>;
    event(method: string, value: any, options?: RequestOptions): void;
    end(): Promise<void>;
    destroy(err?: Error): void;

    on(event: "open", listener: (...args: any[]) => void): this;
    on(event: "close", listener: () => void): this;
    on(event: "destroy", listener: () => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export type Responder = (request: any, rpc: any) => any | Promise<any>;

  export class RPCServer extends EventEmitter {
    readonly dht: any;
    readonly closed: boolean;
    readonly publicKey: BinaryLike;
    readonly connections: Set<any>;

    address(): ServerAddress;
    listen(keyPair?: KeyPair): Promise<void>;
    close(): Promise<void>;

    respond(method: string, handler: Responder): this;
    respond(method: string, options: RequestOptions, handler: Responder): this;
    unrespond(method: string): this;

    on(event: "listening", listener: () => void): this;
    on(event: "connection", listener: (rpc: any) => void): this;
    on(event: "close", listener: () => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }
}

export = HyperswarmRPC;

