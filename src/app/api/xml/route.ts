import { NextResponse } from 'next/server';
import SftpClient from 'ssh2-sftp-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // avoid edge/static caching

const HOST = process.env.SFTP_HOST!;
const PORT = Number(process.env.SFTP_PORT || '22');
const USER = process.env.SFTP_USER!;
const PASSWORD = process.env.SFTP_PASSWORD;           // optional if using key
const PRIVATE_KEY = process.env.SFTP_PRIVATE_KEY;     // raw PEM OR use *_PATH / *_B64 pattern
const REMOTE = process.env.SFTP_REMOTE_PATH || '/home/cdotims/rlmsagent_log/user-data.xml';

let cached = { at: 0, data: '' };
const TTL_MS = Number(process.env.XML_TTL_MS || '10000'); // 10s

// helper: if ssh2-sftp-client returns a stream on some servers
async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  return await new Promise((resolve, reject) => {
    stream.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

export async function GET(req: Request) {
  try {
    // serve from cache if fresh
    if (Date.now() - cached.at < TTL_MS && cached.data) {
      const { searchParams } = new URL(req.url);
      if (searchParams.get('count') === '1') {
        const m = cached.data.match(/<\s*rlmsreginfo\b/gi);
        return NextResponse.json({ count: m ? m.length : 0 });
      }
      return new Response(cached.data, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
    }

    // fetch via SFTP
    const sftp = new SftpClient();
    await sftp.connect({
      host: HOST,
      port: PORT,
      username: USER,
      password: PASSWORD,
      privateKey: PRIVATE_KEY, // if you pass PEM via env; for a file, read and set here instead
      readyTimeout: 20_000,
      // hostVerifier: (hash) => hash === 'your-fingerprint', // recommended if you can pin it
    });

    const got = (await sftp.get(REMOTE)) as Buffer | NodeJS.ReadableStream;
    await sftp.end();

    const xml = Buffer.isBuffer(got) ? got.toString('utf8') : await streamToString(got);
    cached = { at: Date.now(), data: xml };

    const { searchParams } = new URL(req.url);
    if (searchParams.get('count') === '1') {
      const m = xml.match(/<\s*rlmsreginfo\b/gi);
      return NextResponse.json({ count: m ? m.length : 0 });
    }

    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `sftp fail: ${msg}` }, { status: 502 });
  }
}

