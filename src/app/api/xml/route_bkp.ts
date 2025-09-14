import { NextResponse } from 'next/server';
import SftpClient from 'ssh2-sftp-client';
export const runtime = 'nodejs';

const HOST = process.env.SFTP_HOST!;
const PORT = Number(process.env.SFTP_PORT || '22');
const USER = process.env.SFTP_USER!;
const PASSWORD = process.env.SFTP_PASSWORD;      // or use KEY
const PRIVATE_KEY = process.env.SFTP_PRIVATE_KEY; // raw PEM (optional)
const REMOTE = process.env.SFTP_REMOTE_PATH || '/home/cdotims/rlmsagent_log/user-data.xml';

// simple in-memory cache (optional)
let cached = { at: 0, data: '' };
const TTL_MS = Number(process.env.XML_TTL_MS || '10000'); // 10s

export async function GET() {
  try {
    if (Date.now() - cached.at < TTL_MS && cached.data) {
      return new Response(cached.data, { headers: { 'Content-Type': 'application/xml' } });
    }

    const sftp = new SftpClient();
    await sftp.connect({
      host: HOST, port: PORT, username: USER,
      password: PASSWORD,
      privateKey: PRIVATE_KEY,    // if you use key auth
      // hostVerifier: (hash) => hash === 'expected-fingerprint', // optional pin
    });

    const buf = (await sftp.get(REMOTE)) as Buffer;
    await sftp.end();

    const xml = buf.toString('utf8');
    cached = { at: Date.now(), data: xml };
    return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `sftp fail: ${msg}` }, { status: 502 });
  }
}

