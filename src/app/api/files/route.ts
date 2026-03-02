import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Define the absolute path to the uploads directory relative to project root
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Helper to ensure the directory exists
async function ensureUploadsDir() {
    try {
        await fs.access(UPLOADS_DIR);
    } catch {
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
    }
}

// GET: List all saved files
export async function GET() {
    try {
        await ensureUploadsDir();
        const files = await fs.readdir(UPLOADS_DIR);

        // Filter out .gitkeep and other non-step files if needed
        const validFiles = files.filter(f => f.toLowerCase().endsWith('.step') || f.toLowerCase().endsWith('.stp'));

        // Get file stats (size, modified date)
        const fileDetails = await Promise.all(
            validFiles.map(async (filename) => {
                const filePath = path.join(UPLOADS_DIR, filename);
                const stats = await fs.stat(filePath);
                return {
                    name: filename,
                    size: stats.size,
                    createdAt: stats.birthtime,
                    modifiedAt: stats.mtime
                };
            })
        );

        // Sort by newest first
        fileDetails.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

        return NextResponse.json({ files: fileDetails });
    } catch (error) {
        console.error("GET /api/files error:", error);
        return NextResponse.json({ error: "Failed to read files directory" }, { status: 500 });
    }
}

// POST: Upload a new file
export async function POST(request: Request) {
    try {
        await ensureUploadsDir();
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Add timestamp to filename to prevent overwriting
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const timestamp = Date.now();
        const baseName = safeName.substring(0, safeName.lastIndexOf('.'));
        const extension = safeName.substring(safeName.lastIndexOf('.'));
        const finalName = `${baseName}_${timestamp}${extension}`;

        const filePath = path.join(UPLOADS_DIR, finalName);
        await fs.writeFile(filePath, buffer);

        return NextResponse.json({
            success: true,
            message: "File saved successfully",
            file: { name: finalName, size: file.size }
        });
    } catch (error) {
        console.error("POST /api/files error:", error);
        return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
    }
}

// DELETE: Remove a saved file
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const filename = searchParams.get('name');

        if (!filename) {
            return NextResponse.json({ error: "Filename is required parameter" }, { status: 400 });
        }

        // Prevent directory traversal
        const safeFilename = path.basename(filename);
        const filePath = path.join(UPLOADS_DIR, safeFilename);

        await fs.unlink(filePath);
        return NextResponse.json({ success: true, message: "File deleted successfully" });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }
        console.error("DELETE /api/files error:", error);
        return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
    }
}
