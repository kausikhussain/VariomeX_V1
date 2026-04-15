import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { getDb, saveDb, logAudit } from "@/lib/db";

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const datasetId = `ds-${Date.now()}`;
        const fileName = `mutate_${datasetId}.vcf`;
        
        const uploadsDir = path.join(process.cwd(), "uploads");
        if (!existsSync(uploadsDir)) {
            await mkdir(uploadsDir);
        }

        const filePath = path.join(uploadsDir, fileName);
        await writeFile(filePath, buffer);

        // Save metadata
        const db = await getDb();
        const metadata = {
            id: datasetId,
            originalName: file.name,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            status: "Completed",
            statusDetails: "File securely indexed & isolated.",
            filePath: filePath,
        };

        db.datasets.push(metadata);
        await saveDb(db);
        
        await logAudit("Dataset Uploaded", "User", `Dataset ID: ${datasetId} (${file.name})`);

        return NextResponse.json({ success: true, metadata });
    } catch (error) {
        console.error("Upload Route Error:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
