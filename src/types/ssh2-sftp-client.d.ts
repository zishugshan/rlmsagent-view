// src/types/ssh2-sftp-client.d.ts
declare module 'ssh2-sftp-client' {
  export interface SftpConnectOptions {
    host: string;
    port?: number;
    username?: string;
    password?: string;
    privateKey?: string | Buffer;
    passphrase?: string;
    readyTimeout?: number;
    hostVerifier?: (hash: string) => boolean;
  }

  export default class SftpClient {
    connect(options: SftpConnectOptions): Promise<void>;
    get(remotePath: string): Promise<Buffer | NodeJS.ReadableStream>;
    end(): Promise<void>;
  }
}



