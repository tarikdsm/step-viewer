import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const filename = searchParams.get('name');

        if (!filename) {
            return new NextResponse("Filename is required", { status: 400 });
        }

        // Prevent directory traversal attacks
        const safeFilename = path.basename(filename);
        const filePath = path.join(UPLOADS_DIR, safeFilename);

        try {
            // Check if file exists and get stats
            const stats = await fs.stat(filePath);

            // Read the file as binary buffer
            const fileBuffer = await fs.readFile(filePath);

            // Return the file response directly for downloading
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
