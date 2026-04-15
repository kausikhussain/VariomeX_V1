import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { getDb, saveDb, logAudit } from "@/lib/db";
import { existsSync } from "fs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const db = await getDb();
        const { id } = await params;
        
        const index = db.datasets.findIndex(ds => ds.id === id);
        if (index === -1) {
            return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
        }

        const dataset = db.datasets[index];
        
        // Remove from db
        db.datasets.splice(index, 1);
        
        // Cascading delete for requests
        db.requests = db.requests.filter(req => req.datasetId !== id);

        await saveDb(db);
        await logAudit("Dataset Deleted", "User", `Dataset ID: ${id}`);

        // Delete underlying file
        try {
            if (existsSync(dataset.filePath)) {
                await unlink(dataset.filePath);
            }
        } catch (e) {
            console.error("Could not delete file:", e);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Data Delete API Route Error:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
