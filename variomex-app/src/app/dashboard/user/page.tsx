"use client";

import { useAuth } from "@/context/auth-context";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dna, Activity, FileCheck, Clock, Upload, ArrowRight, X } from "lucide-react";
import api, { CheckDiseaseResult, MutationResult } from "@/lib/api";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

export default function UserDashboard() {
    const { user } = useAuth();

    // Genome disease check
    const [genomeId, setGenomeId] = useState<string>("");
    const [diseaseInput, setDiseaseInput] = useState<string>("");
    const [checking, setChecking] = useState(false);
    const [checkResult, setCheckResult] = useState<CheckDiseaseResult | null>(null);
    const [checkError, setCheckError] = useState<string | null>(null);

    // Upload functionality
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Dynamic stats
    const [datasetsCount, setDatasetsCount] = useState(0);
    const [requests, setRequests] = useState<any[]>([]);

    const fetchData = async () => {
        try {
            const [dsRes, reqRes] = await Promise.all([
                fetch("/api/data"),
                fetch("/api/requests")
            ]);
            
            if (dsRes.ok) {
                const dsJson = await dsRes.json();
                if (dsJson.datasets) setDatasetsCount(dsJson.datasets.length);
            }
            if (reqRes.ok) {
                const reqJson = await reqRes.json();
                if (reqJson.requests) setRequests(reqJson.requests);
            }
        } catch(e) {
            console.error("Dashboard fetch err:", e);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error("Upload failed");
            toast.success("Genome file uploaded successfully! View securely in 'My Data'.");
            fetchData();
        } catch (error) {
            console.error("Upload error:", error);
            toast.error("An error occurred during upload.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleRequestAction = async (id: string, status: string) => {
        try {
            const res = await fetch("/api/requests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId: id, status })
            });
            if (res.ok) {
                toast.success(`Request ${status} successfully!`);
                fetchData();
            } else {
                toast.error(`Failed to update request.`);
            }
        } catch (error) {
            toast.error(`Error updating request.`);
        }
    };

    const handleCheckDisease = async () => {
        if (!genomeId || !diseaseInput) {
            setCheckError("Please provide both genome ID and disease name.");
            return;
        }
        console.log("[User] Checking genome", genomeId, "for disease", diseaseInput);
        setChecking(true);
        setCheckError(null);
        setCheckResult(null); // clear previous result immediately
        try {
            const res = await api.checkGenomeDisease(genomeId, diseaseInput);
            console.log("[User] Raw response:", res);

            // Defensive validation
            if (!res || typeof res !== "object" || !("has_mutations" in res)) {
                const msg = "Unexpected response shape from /query/genome/{id}/check-disease";
                console.error("[User]", msg, res);
                setCheckError(msg);
                toast.error(msg);
                return;
            }

            setCheckResult(res as CheckDiseaseResult);

            if (res.matched_diseases && res.matched_diseases.length > 0) {
                toast.success(`Found ${res.matched_diseases.length} matched disease(s)`);
            } else if (res.has_mutations) {
                toast.info("Mutations found but no named matched diseases returned.");
            } else {
                toast.success("No matching mutations found for this disease in the genome.");
            }
        } catch (err: unknown) {
            console.error("[User] Check failed:", err);
            const msg = err instanceof Error ? err.message : String(err);
            setCheckError(msg ?? "Unknown error");
            toast.error(`Check failed: ${msg}`);
        } finally {
            setChecking(false);
            console.log("[User] Genome check finished");
        }
    };

    const pendingRequests = requests.filter(r => r.status === "pending");
    const activePermissions = requests.filter(r => r.status === "approved").length;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-primary">Welcome back, {user?.name}</h2>
                    <p className="text-muted-foreground">Manage your genomic data and access requests.</p>
                </div>
                <div className="flex items-center gap-4">
                    <input type="file" ref={fileInputRef} className="hidden" accept=".vcf,.vcf.gz" onChange={handleFileUpload} />
                    <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
                        {isUploading ? <Activity className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        {isUploading ? "Uploading..." : "Upload Genome"}
                    </Button>
                </div>
            </div>

            {/* Genome disease check card */}
            <Card className="shadow-md border-primary/10">
                <CardHeader>
                    <CardTitle>Check Genome for Disease</CardTitle>
                    <CardDescription>Check whether your genome contains mutations associated with a disease.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex gap-2">
                        <Input placeholder="Genome ID (e.g. G-1234)" value={genomeId} onChange={(e) => setGenomeId((e.target as HTMLInputElement).value)} />
                        <Input placeholder="Disease name (e.g. cystic fibrosis)" value={diseaseInput} onChange={(e) => setDiseaseInput((e.target as HTMLInputElement).value)} />
                        <Button onClick={handleCheckDisease} disabled={checking}>{checking ? "Checking..." : "Check"}</Button>
                    </div>

                    {checkError && <p className="text-destructive text-sm">{checkError}</p>}

                    {checking ? (
                        <p className="text-sm text-muted-foreground">Checking...</p>
                    ) : checkResult ? (
                        <div className="space-y-2">
                            <p className="text-sm">Has mutations: <strong>{checkResult.has_mutations ? "Yes" : "No"}</strong></p>
                            <p className="text-sm">Matched diseases: <strong>{checkResult.matched_diseases?.length ?? 0}</strong></p>

                            {checkResult.matched_diseases && checkResult.matched_diseases.length > 0 ? (
                                <p className="text-sm text-muted-foreground">{checkResult.matched_diseases.join(", ")}</p>
                            ) : (
                                <p className="text-sm text-muted-foreground">No matched diseases returned.</p>
                            )}

                            {checkResult.mutations && checkResult.mutations.length > 0 ? (
                                <div className="rounded-md border p-2 bg-muted/30">
                                    <p className="text-xs font-medium">Matched Mutations ({checkResult.mutations.length})</p>
                                    <ul className="text-sm list-disc list-inside">
                                        {checkResult.mutations.map((m: MutationResult, i: number) => (
                                            <li key={`${m.disease ?? 'mutation'}-${i}`}>{m.disease} {m.significance ? `— ${m.significance}` : ""}</li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="shadow-sm border-primary/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Genomes Uploaded</CardTitle>
                        <Dna className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{datasetsCount}</div>
                        <p className="text-xs text-muted-foreground">Active datasets securely stored</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-primary/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{pendingRequests.length}</div>
                        <p className="text-xs text-muted-foreground">Need your review</p>
                    </CardContent>
                </Card>
                
                <Card className="shadow-sm border-primary/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Access Granted</CardTitle>
                        <FileCheck className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activePermissions}</div>
                        <p className="text-xs text-muted-foreground">Active permissions</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 shadow-md bg-card/60 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                        <CardDescription>
                            Latest actions on your account
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Event</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Time</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requests.slice(0, 4).map((item, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="font-medium">
                                            Request for {item.datasetName.slice(0, 15)}...
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={item.status === "approved" ? "default" : item.status === "pending" ? "secondary" : "destructive"}>
                                                {item.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {new Date(item.requestedAt).toLocaleTimeString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {requests.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                                            No recent activity directly recorded. Upload data to begin.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card className="col-span-3 shadow-md bg-card/60 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Pending Access Requests</CardTitle>
                        <CardDescription>
                            Researchers requesting access to your data
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {pendingRequests.map((req, i) => (
                                <div key={i} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium leading-none">{req.researcher}</p>
                                        <p className="text-xs text-muted-foreground border border-muted p-1 px-2 rounded-md bg-muted/20">
                                            Dataset: {req.datasetName}
                                        </p>
                                        <Badge variant="outline" className="text-[10px] mt-1">{req.reason}</Badge>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => handleRequestAction(req.id, "approved")} className="h-8 w-8 p-0 text-green-600 border-green-200 bg-green-50 hover:bg-green-100">
                                            <FileCheck className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => handleRequestAction(req.id, "rejected")} className="h-8 w-8 p-0 text-red-600 border-red-200 bg-red-50 hover:bg-red-100">
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {pendingRequests.length === 0 && (
                                <div className="text-sm text-center text-muted-foreground italic h-20 flex items-center justify-center border-dashed border-2 rounded-md border-muted">
                                    You have no pending requests.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}