import { NextResponse } from 'next/server';
import SftpClient from 'ssh2-sftp-client';
import fs from 'node:fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- ENV
const HOST = process.env.SFTP_HOST!;
const PORT = Number(process.env.SFTP_PORT || '22');
const USER = process.env.SFTP_USER!;
const PASSWORD = process.env.SFTP_PASSWORD; // fallback if no key
const REMOTE = process.env.SFTP_REMOTE_PATH || '/home/cdotims/rlmsagent_log/user-data.xml';
const KEY_PATH = process.env.SFTP_PRIVATE_KEY_PATH;
const KEY_B64  = process.env.SFTP_PRIVATE_KEY_B64;
const KEY_RAW  = process.env.SFTP_PRIVATE_KEY;
const PASSPHRASE = process.env.SFTP_PASSPHRASE;

let cached = { at: 0, data: '' };
const TTL_MS = Number(process.env.XML_TTL_MS || '10000');

// ---- Types (minimal)
type SftpConnectOptions = {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string | Buffer;
  passphrase?: string;
  readyTimeout?: number;
  hostVerifier?: (hash: string) => boolean;
};

// ---- Helpers
function resolvePrivateKey(): Buffer | string | undefined {
  if (KEY_PATH && fs.existsSync(KEY_PATH)) return fs.readFileSync(KEY_PATH);
  if (KEY_B64) return Buffer.from(KEY_B64, 'base64');
  if (KEY_RAW) return KEY_RAW;
  return undefined;
}
async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  return await new Promise((resolve, reject) => {
    stream.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

// ---- Route
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const wantCount = url.searchParams.get('count') === '1';

    // serve cached
    if (Date.now() - cached.at < TTL_MS && cached.data) {
      if (wantCount) {
        const m = cached.data.match(/<\s*(?:[\w.-]+:)?rlmsreginfo\b/gi);
        return NextResponse.json({ count: m ? m.length : 0 });
      }
      return new Response(cached.data, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    // fetch via SFTP
    const sftp = new SftpClient();
    const connectOpts: SftpConnectOptions = {
      host: HOST,
      port: PORT,
      username: USER,
      readyTimeout: 20_000,
    };

    const pk = resolvePrivateKey();
    if (pk) {
      connectOpts.privateKey = pk;
      if (PASSPHRASE) connectOpts.passphrase = PASSPHRASE;
    } else if (PASSWORD) {
      connectOpts.password = PASSWORD; // <-- uses PASSWORD, so no unused-var
    }

    await sftp.connect(connectOpts);
    try {
      const got = (await sftp.get(REMOTE)) as Buffer | NodeJS.ReadableStream;
      const xml = Buffer.isBuffer(got) ? got.toString('utf8') : await streamToString(got);
      cached = { at: Date.now(), data: xml };

      if (wantCount) {
        const m = xml.match(/<\s*(?:[\w.-]+:)?rlmsreginfo\b/gi);
        return NextResponse.json({ count: m ? m.length : 0 });
      }
      return new Response(xml, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    } finally {
      await sftp.end().catch(() => {});
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `sftp fail: ${msg}` }, { status: 502 });
  }
}
