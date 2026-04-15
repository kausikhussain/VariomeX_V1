import { readFile, writeFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

const DB_FILE = path.join(process.cwd(), "db.json");

export type Dataset = {
    id: string;
    originalName: string;
    size: number;
    uploadedAt: string;
    status: string;
    statusDetails: string;
    filePath: string;
};

export type AccessRequest = {
    id: string;
    datasetId: string;
    datasetName: string;
    researcher: string;
    reason: string;
    type: string;
    status: "pending" | "approved" | "rejected" | "deleted";
    requestedAt: string;
};

export type AuditLog = {
    id: string;
    action: string;
    user: string;
    target: string;
    timestamp: string;
};

export type DatabaseSchema = {
    datasets: Dataset[];
    requests: AccessRequest[];
    auditLogs: AuditLog[];
};

const defaultSchema: DatabaseSchema = {
    datasets: [],
    requests: [],
    auditLogs: []
};

export async function getDb(): Promise<DatabaseSchema> {
    try {
        if (!existsSync(DB_FILE)) return defaultSchema;
        const data = await readFile(DB_FILE, "utf-8");
        const parsed = JSON.parse(data) as DatabaseSchema;
        if (!parsed.auditLogs) parsed.auditLogs = [];
        return parsed;
    } catch {
        return defaultSchema;
    }
}

export async function saveDb(data: DatabaseSchema): Promise<void> {
    await writeFile(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function logAudit(action: string, user: string, target: string): Promise<void> {
    try {
        const db = await getDb();
        db.auditLogs.unshift({
            id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            action,
            user,
            target,
            timestamp: new Date().toISOString()
        });
        // Keep logs slightly bounded to prevent bloat
        if (db.auditLogs.length > 500) {
            db.auditLogs = db.auditLogs.slice(0, 500);
        }
        await saveDb(db);
    } catch (e) {
        console.error("Failed to write audit log:", e);
    }
}
