"use client";

import { useAuth } from "@/context/auth-context";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, History, Database, ArrowUpRight, FlaskConical, Download } from "lucide-react";
import { useState, useEffect } from "react";
import api, { DiseaseVariant } from "@/lib/api";
import { toast } from "sonner";

export default function ResearcherDashboard() {
    const { user } = useAuth();
    
    const [mutChr, setMutChr] = useState<string>("");
    const [mutPos, setMutPos] = useState<string>("");
    const [mutRef, setMutRef] = useState<string>("");
    const [mutAlt, setMutAlt] = useState<string>("");
    const [zkpLoading, setZkpLoading] = useState(false);
    const [zkpResult, setZkpResult] = useState<{ exists: boolean; proof: string | null } | null>(null);
    const [zkpError, setZkpError] = useState<string | null>(null);

    const [diseaseQuery, setDiseaseQuery] = useState("");
    const [diseaseResults, setDiseaseResults] = useState<DiseaseVariant[] | null>(null);
    const [diseaseLoading, setDiseaseLoading] = useState(false);
    const [diseaseError, setDiseaseError] = useState<string | null>(null);

    // Dynamic Data Management
    const [datasets, setDatasets] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);

    const fetchData = async () => {
        try {
            const [ds, req] = await Promise.all([
                fetch("/api/data").then(r => r.json()),
                fetch("/api/requests").then(r => r.json())
            ]);
            if (ds.datasets) setDatasets(ds.datasets);
            if (req.requests) setRequests(req.requests);
        } catch (e) {
            console.error("fetch err", e);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 3000);
        return () => clearInterval(interval);
    }, []);

    const getDatasetAccess = (dsId: string) => {
        const req = requests.find(r => r.datasetId === dsId && r.researcher === (user?.name || "Dr. Guest Researcher"));
        if (!req) return { status: "Request Access", variant: "outline" };
        if (req.status === "approved") return { status: "Granted", variant: "default" };
        if (req.status === "rejected") return { status: "Rejected", variant: "destructive" };
        return { status: "Pending", variant: "secondary" };
    };

    const handleRequestAccess = async (dataset: any) => {
        try {
            const res = await fetch("/api/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    datasetId: dataset.id,
                    datasetName: dataset.originalName,
                    researcher: user?.name || "Dr. Guest Researcher",
                    reason: "Clinical Trial Analysis - ZKP Protocol"
                })
            });

            if (res.ok) {
                toast.success("Request sent successfully!");
                fetchData();
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to request access.");
            }
        } catch (e) {
            toast.error("Error requesting access.");
        }
    };

    const handleDiseaseSearch = async () => {
        if (!diseaseQuery) {
            setDiseaseError("Please enter a disease name to search.");
            return;
        }

        console.log("[Researcher] Starting disease search for:", diseaseQuery);
        setDiseaseLoading(true);
        setDiseaseError(null);
        setDiseaseResults(null); 

        try {
            const res = await api.queryDisease(diseaseQuery);
            if (!Array.isArray(res)) {
                const msg = "Unexpected response shape from /query/disease: expected array";
                setDiseaseError(msg);
                toast.error(msg);
                return;
            }
            setDiseaseResults(res);

            if (!res || res.length === 0) {
                toast.info("No variants found for that disease.");
            } else {
                toast.success(`Found ${res.length} variant(s)`);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setDiseaseError(msg ?? "Unknown error");
            toast.error(`Search failed: ${msg}`);
        } finally {
            setDiseaseLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-primary">Research Portal</h2>
                    <p className="text-muted-foreground">Query variant databases and manage datasets.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-emerald-500/10 shadow-md col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FlaskConical className="h-5 w-5 text-emerald-600" />
                            Disease → Variant Search
                        </CardTitle>
                        <CardDescription>
                            Enter a disease name to find matching variants across datasets.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2 items-center">
                            <Input
                                placeholder="e.g. cystic fibrosis, breast cancer"
                                value={diseaseQuery}
                                onChange={(e) => setDiseaseQuery(e.target.value)}
                                className="flex-1 bg-background/80"
                            />
                            <Button onClick={handleDiseaseSearch} disabled={diseaseLoading}>
                                {diseaseLoading ? "Searching..." : "Search Disease"}
                            </Button>
                        </div>

                        {diseaseError && <p className="text-destructive text-sm">{diseaseError}</p>}

                        {diseaseLoading ? (
                            <p className="text-sm text-muted-foreground">Searching...</p>
                        ) : diseaseResults !== null ? (
                            diseaseResults.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <p className="text-sm text-muted-foreground mb-2">{diseaseResults.length} result(s)</p>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Chr</TableHead>
                                                <TableHead>Pos</TableHead>
                                                <TableHead>Ref</TableHead>
                                                <TableHead>Alt</TableHead>
                                                <TableHead>Disease</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {diseaseResults.map((d, i) => (
                                                <TableRow key={`${d.chr}-${d.pos}-${d.ref ?? "n"}-${d.alt ?? "n"}-${i}`}>
                                                    <TableCell className="font-mono text-sm">{d.chr}</TableCell>
                                                    <TableCell>{d.pos}</TableCell>
                                                    <TableCell>{d.ref ?? "-"}</TableCell>
                                                    <TableCell>{d.alt ?? "-"}</TableCell>
                                                    <TableCell className="font-medium">{d.disease}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No results found.</p>
                            )
                        ) : null}
                    </CardContent>
                </Card>
                <Card className="border-primary/20 shadow-lg bg-gradient-to-br from-card to-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Search className="h-5 w-5 text-primary" />
                            Submit Mutation Query
                        </CardTitle>
                        <CardDescription>
                            Search for specific variants across the VariomeX network
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Mutation (chr, pos, ref, alt)</Label>
                            <div className="flex gap-2">
                                <Input placeholder="chr (e.g. 1)" value={mutChr} onChange={(e) => setMutChr(e.target.value)} className="w-1/4 bg-background/80" />
                                <Input placeholder="pos" value={mutPos} onChange={(e) => setMutPos(e.target.value)} className="w-1/6 bg-background/80" />
                                <Input placeholder="ref" value={mutRef} onChange={(e) => setMutRef(e.target.value)} className="w-1/6 bg-background/80" />
                                <Input placeholder="alt" value={mutAlt} onChange={(e) => setMutAlt(e.target.value)} className="w-1/6 bg-background/80" />
                                <Button onClick={async () => {
                                    if (!mutChr || !mutPos || !mutRef || !mutAlt) {
                                        setZkpError("Please fill all mutation fields.");
                                        return;
                                    }
                                    setZkpError(null);
                                    setZkpResult(null);
                                    setZkpLoading(true);
                                    try {
                                        const res = await api.zkpMutation(mutChr, Number(mutPos), mutRef, mutAlt);
                                        if (typeof res !== 'object' || !('exists' in res)) throw new Error('Unexpected response');
                                        setZkpResult({ exists: !!res.exists, proof: res.proof ?? null });
                                        if (res.exists) toast.success('Mutation exists (proof returned?)');
                                        else toast.info('Mutation does not exist');
                                    } catch (err: unknown) {
                                        const msg = err instanceof Error ? err.message : String(err);
                                        setZkpError(msg ?? 'Unknown error');
                                        toast.error(`ZKP check failed: ${msg}`);
                                    } finally {
                                        setZkpLoading(false);
                                    }
                                }} disabled={zkpLoading}>
                                    {zkpLoading ? 'Verifying...' : '🔐 Verify Mutation (Private)'}
                                </Button>
                            </div>
                        </div>

                        {zkpError && <p className="text-destructive text-sm">{zkpError}</p>}

                        {zkpLoading ? (
                            <p className="text-sm text-muted-foreground">Verifying mutation privately...</p>
                        ) : zkpResult ? (
                            <div className="p-2 rounded-md border bg-muted/20">
                                <p className="text-sm">Exists: <strong>{zkpResult.exists ? 'YES' : 'NO'}</strong></p>
                                {zkpResult.proof ? (
                                    <p className="text-sm text-emerald-600">🔐 ZKP Verified — proof available</p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No proof returned</p>
                                )}
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                <Card className="border-primary/10 shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="h-5 w-5 text-blue-500" />
                            Available Datasets
                        </CardTitle>
                        <CardDescription>
                            Cohorts available for analysis
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {datasets.map((set) => {
                                const acc = getDatasetAccess(set.id);
                                return (
                                    <div key={set.id} className="flex items-center justify-between p-3 rounded-md bg-muted/20 hover:bg-muted/40 transition-colors">
                                        <div>
                                            <p className="font-medium text-sm">{set.originalName}</p>
                                            <p className="text-xs text-muted-foreground">{(set.size / 1024).toFixed(2)} KB • Uploaded User Data</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {acc.status === "Request Access" ? (
                                                <Button size="sm" variant="outline" onClick={() => handleRequestAccess(set)}>
                                                    Request Access
                                                </Button>
                                            ) : acc.status === "Granted" ? (
                                                <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20 px-3 py-1.5 shadow-none">
                                                    <Database className="h-3 w-3 mr-2 inline" /> Query Ready
                                                </Badge>
                                            ) : (
                                                <Badge variant={acc.variant as any}>
                                                    {acc.status}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {datasets.length === 0 && (
                                <div className="text-sm text-muted-foreground italic h-24 flex items-center justify-center border-dashed border-2 rounded-md">
                                    No cohorts available currently.
                                </div>
                            )}

                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5 text-muted-foreground" />
                        My Access Requests Log
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Request ID</TableHead>
                                <TableHead>Dataset</TableHead>
                                <TableHead>Target Use Case</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Requested At</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {requests.filter(r => r.researcher === (user?.name || "Dr. Guest Researcher")).map((q, i) => (
                                <TableRow key={i}>
                                    <TableCell className="font-medium font-mono text-xs text-muted-foreground">{q.id}</TableCell>
                                    <TableCell className="font-medium">{q.datasetName}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{q.reason}</TableCell>
                                    <TableCell>
                                        <Badge variant={q.status === "approved" ? "default" : q.status === "pending" ? "secondary" : "destructive"}>
                                            {q.status === "approved" ? "Query Access Granted" : q.status === "rejected" ? "Access Denied" : "Pending"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground text-xs">
                                        {new Date(q.requestedAt).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {requests.filter(r => r.researcher === (user?.name || "Dr. Guest Researcher")).length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground h-24 italic">
                                        You have not made any access requests yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}