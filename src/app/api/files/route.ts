import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Define the absolute path to the local generic 'uploads' directory relative to the Next.js project root
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

/**
 * Utility function to verify if the configured uploads directory exists.
 * If the folder has not been created yet (e.g., first run on a fresh clone), it automatically creates it 
 * to prevent ENOENT crashes during file saves.
 */
async function ensureUploadsDir() {
    try {
        await fs.access(UPLOADS_DIR);
    } catch {
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
    }
}

/**
 * GET METHOD:
 * Retrieves a list of all locally saved files.
 * Provides metadata (file size, creation/modification dates) formatted cleanly for the Sidebar to render.
 */
export async function GET() {
    try {
        await ensureUploadsDir();
        const files = await fs.readdir(UPLOADS_DIR);

        // Secure filter: Ensure that random noise files (like .gitkeep or macOS .DS_Store) 
        // are excluded. The route only serves valid STEP geometries to the React client.
        const validFiles = files.filter(f => f.toLowerCase().endsWith('.step') || f.toLowerCase().endsWith('.stp'));

        // Get file stats (size, modified date). We handle ENOENT individually so one deleted file doesn't crash the whole list.
        const fileDetailsResults = await Promise.all(
            validFiles.map(async (filename) => {
                const filePath = path.join(UPLOADS_DIR, filename);
                try {
                    const stats = await fs.stat(filePath);
                    return {
                        name: filename,
                        size: stats.size,
                        createdAt: stats.birthtime,
                        modifiedAt: stats.mtime
                    };
                } catch (err: unknown) {
                    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
                        return null; // Ignore missing files (race condition edge case)
                    }
                    throw err; // Re-throw other unexpected errors
                }
            })
        );

        // Filter out nulls from missing files
        const fileDetails = fileDetailsResults.filter(Boolean) as Array<{ name: string, size: number, createdAt: Date, modifiedAt: Date }>;

        // Sort by the newest modifications descending so the most recently uploaded files appear at the top of the Sidebar list
        fileDetails.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

        return NextResponse.json({ files: fileDetails });
    } catch (error) {
        console.error("GET /api/files error:", error);
        return NextResponse.json({ error: "Failed to read files directory" }, { status: 500 });
    }
}

/**
 * POST METHOD:
 * Accepts a standard multi-part form data upload from the client.
 * Normalizes the filename and saves it persistently to the server's disk, ensuring uniqueness through a timestamp tag.
 */
export async function POST(request: Request) {
    try {
        await ensureUploadsDir();
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const MAX_SIZE_MB = 100;
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            return NextResponse.json({ error: `File size exceeds ${MAX_SIZE_MB}MB limit` }, { status: 400 });
        }

        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const lastDotIndex = safeName.lastIndexOf('.');
        let extension = '';
        let baseName = safeName;

        if (lastDotIndex !== -1) {
            extension = safeName.substring(lastDotIndex).toLowerCase();
            baseName = safeName.substring(0, lastDotIndex);
        }

        // Validate extension strictly FIRST, rather than just trusting MIME type which can be spoofed.
        if (extension !== '.step' && extension !== '.stp') {
            return NextResponse.json({ error: "Invalid file type. Only .step or .stp are allowed." }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Anti-collision logic: Modify filename to embed a discrete timestamp value so 
        // two users uploading "test_part.step" won't overwrite each other's native geometries
        const timestamp = Date.now();
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

/**
 * DELETE METHOD:
 * Securely deletes a specific file physically matching a string parameter from the filesystem.
 */
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const filename = searchParams.get('name');

        if (!filename) {
            return NextResponse.json({ error: "Filename is required parameter" }, { status: 400 });
        }

        // Critical Security: Parse `path.basename` exclusively.
        // This stops malicious users from executing Directory Traversal attacks (ex: "../../etc/passwd") 
        // through corrupted API payloads ensuring it only ever reads filenames strictly within /uploads
        const safeFilename = path.basename(filename);
        const filePath = path.join(UPLOADS_DIR, safeFilename);

        await fs.unlink(filePath);
        return NextResponse.json({ success: true, message: "File deleted successfully" });
    } catch (error: unknown) {
        if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }
        console.error("DELETE /api/files error:", error);
        return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
    }
}
