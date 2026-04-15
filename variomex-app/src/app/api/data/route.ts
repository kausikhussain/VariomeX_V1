import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const db = await getDb();
        
        // Let's resolve the previews for each dataset
        const datasetsWithPreview = await Promise.all(db.datasets.map(async (ds) => {
            let preview = "";
            try {
                if (existsSync(ds.filePath)) {
                    const vcfData = await readFile(ds.filePath, "utf8");
                    const lines = vcfData.split("\n");
                    const previewLines = lines.filter(l => l.trim().length > 0 && (!l.startsWith("##") || l.startsWith("#CHROM"))).slice(0, 10);
                    preview = previewLines.join("\n");
                }
            } catch {
                // Ignore missing files or parsing issues
            }
            return {
                ...ds,
                preview
            };
        }));

        // Reverse to show newest first
        return NextResponse.json({ datasets: datasetsWithPreview.reverse() });
    } catch (error) {
        console.error("Data API Route Error:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
