import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

/**
 * GET METHOD:
 * Retrieves the raw binary blob of a specifically queried STEP file.
 * Returns standard application/octet-stream headers prompting the browser to download the file 
 * rather than attempting to natively interpret it.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const filename = searchParams.get('name');

        if (!filename) {
            return new NextResponse("Filename is required", { status: 400 });
        }

        // Critical Security: `path.basename` validates the query acts purely as a filename
        // preventing malicious Directory Traversal exploits (ex: ?name=../../secret.js)
        const safeFilename = path.basename(filename);
        const filePath = path.join(UPLOADS_DIR, safeFilename);

        try {
            // Check if file exists and get its size for the Content-Length header
            const stats = await fs.stat(filePath);

            // Stream the file instead of loading it entirely into memory.
            // This is critical for large STEP files (up to 100MB) to avoid server memory spikes.
            const nodeStream = createReadStream(filePath);
            const webStream = new ReadableStream({
                start(controller) {
                    nodeStream.on('data', (chunk: string | Buffer) => controller.enqueue(new Uint8Array(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))));
                    nodeStream.on('end', () => controller.close());
                    nodeStream.on('error', (err: Error) => controller.error(err));
                },
                cancel() {
                    nodeStream.destroy();
                }
            });

            return new NextResponse(webStream, {
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Content-Disposition': `attachment; filename="${safeFilename}"`,
                    'Content-Length': stats.size.toString()
                }
            });
        } catch (e: unknown) {
            if (e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
                return new NextResponse("File not found", { status: 404 });
            }
            throw e;
        }

    } catch (error) {
        console.error("GET /api/files/download error:", error);
        return new NextResponse("Failed to download file", { status: 500 });
    }
}
