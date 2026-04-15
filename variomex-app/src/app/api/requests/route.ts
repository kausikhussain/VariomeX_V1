import { NextResponse } from "next/server";
import { getDb, saveDb, AccessRequest, logAudit } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const db = await getDb();
        // Return latest requests
        return NextResponse.json({ requests: db.requests.reverse() });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { datasetId, datasetName, researcher, reason, type } = body;

        const db = await getDb();
        
        // Check if active request already exists to prevent duplicate requests
        const existing = db.requests.find(r => r.datasetId === datasetId && r.researcher === researcher && r.status === 'pending');
        if (existing) {
            return NextResponse.json({ error: "Request already pending" }, { status: 400 });
        }

        const newReq: AccessRequest = {
            id: `req-${Date.now()}`,
            datasetId,
            datasetName,
            researcher,
            reason: reason || "Data exploration",
            type: type || "VCF Analysis",
            status: "pending",
            requestedAt: new Date().toISOString()
        };

        db.requests.push(newReq);
        await saveDb(db);
        await logAudit("Access Requested", researcher, `Dataset ID: ${datasetId}`);

        return NextResponse.json({ success: true, request: newReq });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { requestId, status } = body;

        if (!['approved', 'rejected'].includes(status)) {
            return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }

        const db = await getDb();
        const reqIndex = db.requests.findIndex(r => r.id === requestId);
        
        if (reqIndex === -1) {
            return NextResponse.json({ error: "Request not found" }, { status: 404 });
        }

        db.requests[reqIndex].status = status;
        await saveDb(db);
        await logAudit(`Access Call: ${status === "approved" ? "Granted" : "Denied"}`, "User Admin", `Request ID: ${requestId}`);

        return NextResponse.json({ success: true, request: db.requests[reqIndex] });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
