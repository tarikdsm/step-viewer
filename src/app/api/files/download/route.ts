import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
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
            // Check if file exists and get stats
            const stats = await fs.stat(filePath);

            // Read the file off the disk fully into an isolated binary buffer mapping
            const fileBuffer = await fs.readFile(filePath);

            // Respond directly using raw blob bytes alongside strict HTTP headers identifying correct lengths and the file attachment behavior
            return new NextResponse(fileBuffer, {
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Content-Disposition': `attachment; filename="${safeFilename}"`,
                    'Content-Length': stats.size.toString()
                }
            });
        } catch (e: any) {
            if (e.code === 'ENOENT') {
                return new NextResponse("File not found", { status: 404 });
            }
            throw e;
        }

    } catch (error) {
        console.error("GET /api/files/download error:", error);
        return new NextResponse("Failed to download file", { status: 500 });
    }
}
