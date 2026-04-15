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
import { Search, History, Database, ArrowUpRight, FlaskConical } from "lucide-react";
import { useState } from "react";
import api, { DiseaseVariant } from "@/lib/api";
import { toast } from "sonner";

export default function ResearcherDashboard() {
    const { user } = useAuth();
    // unused legacy search state removed

    // ZKP mutation verification state
    const [mutChr, setMutChr] = useState<string>("");
    const [mutPos, setMutPos] = useState<string>("");
    const [mutRef, setMutRef] = useState<string>("");
    const [mutAlt, setMutAlt] = useState<string>("");
    const [zkpLoading, setZkpLoading] = useState(false);
    const [zkpResult, setZkpResult] = useState<{ exists: boolean; proof: string | null } | null>(null);
    const [zkpError, setZkpError] = useState<string | null>(null);

    // Disease search state
    const [diseaseQuery, setDiseaseQuery] = useState("");
    const [diseaseResults, setDiseaseResults] = useState<DiseaseVariant[] | null>(null);
    const [diseaseLoading, setDiseaseLoading] = useState(false);
    const [diseaseError, setDiseaseError] = useState<string | null>(null);

    // ...existing code...

    const handleDiseaseSearch = async () => {
        if (!diseaseQuery) {
            setDiseaseError("Please enter a disease name to search.");
            return;
        }

        console.log("[Researcher] Starting disease search for:", diseaseQuery);
        setDiseaseLoading(true);
        setDiseaseError(null);
        setDiseaseResults(null); // clear previous results immediately

        try {
            const res = await api.queryDisease(diseaseQuery);
            console.log("[Researcher] Raw response:", res);

            // Defensive validation: expect an array
            if (!Array.isArray(res)) {
                const msg = "Unexpected response shape from /query/disease: expected array";
                console.error("[Researcher]", msg, res);
                setDiseaseError(msg);
                toast.error(msg);
                return;
            }

            setDiseaseResults(res);

            if (!res || res.length === 0) {
                console.info("[Researcher] No variants found for disease:", diseaseQuery);
                toast.info("No variants found for that disease.");
            } else {
                toast.success(`Found ${res.length} variant(s)`);
            }
        } catch (err: unknown) {
            console.error("[Researcher] Search failed:", err);
            const msg = err instanceof Error ? err.message : String(err);
            setDiseaseError(msg ?? "Unknown error");
            toast.error(`Search failed: ${msg}`);
        } finally {
            setDiseaseLoading(false);
            console.log("[Researcher] Disease search finished");
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
                                <Input placeholder="chr (e.g. 1 or chr1)" value={mutChr} onChange={(e) => setMutChr(e.target.value)} className="w-1/4 bg-background/80" />
                                <Input placeholder="pos" value={mutPos} onChange={(e) => setMutPos(e.target.value)} className="w-1/6 bg-background/80" />
                                <Input placeholder="ref" value={mutRef} onChange={(e) => setMutRef(e.target.value)} className="w-1/6 bg-background/80" />
                                <Input placeholder="alt" value={mutAlt} onChange={(e) => setMutAlt(e.target.value)} className="w-1/6 bg-background/80" />
                                <Button onClick={async () => {
                                    // handler inline to keep related logic nearby
                                    if (!mutChr || !mutPos || !mutRef || !mutAlt) {
                                        setZkpError("Please fill all mutation fields.");
                                        return;
                                    }

                                    setZkpError(null);
                                    setZkpResult(null);
                                    setZkpLoading(true);
                                    console.log("[Researcher] ZKP verify start", { mutChr, mutPos, mutRef, mutAlt });
                                    try {
                                        const posNum = Number(mutPos);
                                        const res = await api.zkpMutation(mutChr, posNum, mutRef, mutAlt);
                                        console.log("[Researcher] ZKP response:", res);
                                        if (typeof res !== 'object' || !('exists' in res)) {
                                            throw new Error('Unexpected response from zkp-mutation');
                                        }
                                        setZkpResult({ exists: !!res.exists, proof: res.proof ?? null });
                                        if (res.exists) {
                                            toast.success('Mutation exists (proof returned?)');
                                        } else {
                                            toast.info('Mutation does not exist');
                                        }
                                    } catch (err: unknown) {
                                        console.error('[Researcher] ZKP failed:', err);
                                        const msg = err instanceof Error ? err.message : String(err);
                                        setZkpError(msg ?? 'Unknown error');
                                        toast.error(`ZKP check failed: ${msg}`);
                                    } finally {
                                        setZkpLoading(false);
                                        console.log('[Researcher] ZKP verify finished');
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
                            {[
                                { name: "Rare Disease Cohort A", samples: 1240, access: "Granted" },
                                { name: "Oncology Dataset B", samples: 850, access: "Request Needed" },
                                { name: "Population Control Group", samples: 5000, access: "Public" },
                            ].map((set, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-md bg-muted/20 hover:bg-muted/40 transition-colors">
                                    <div>
                                        <p className="font-medium text-sm">{set.name}</p>
                                        <p className="text-xs text-muted-foreground">{set.samples} samples</p>
                                    </div>
                                    <Badge variant={set.access === "Granted" ? "default" : set.access === "Public" ? "secondary" : "outline"}>
                                        {set.access}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button variant="ghost" size="sm" className="w-full text-xs">
                            Browse All Datasets <ArrowUpRight className="ml-2 h-3 w-3" />
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5 text-muted-foreground" />
                        Query History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Query ID</TableHead>
                                <TableHead>Target</TableHead>
                                <TableHead>Parameters</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Result</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[
                                { id: "Q-9982", target: "TP53", params: "Exon 5-8", status: "Completed", result: "12 Matches" },
                                { id: "Q-9981", target: "BRCA2", params: "Pathogenic only", status: "Processing", result: "-" },
                                { id: "Q-9975", target: "CFTR", params: "F508del", status: "Completed", result: "0 Matches" },
                            ].map((q, i) => (
                                <TableRow key={i}>
                                    <TableCell className="font-medium font-mono text-xs">{q.id}</TableCell>
                                    <TableCell>{q.target}</TableCell>
                                    <TableCell className="text-muted-foreground text-xs">{q.params}</TableCell>
                                    <TableCell>
                                        <Badge variant={q.status === "Completed" ? "outline" : "secondary"} className={q.status === "Processing" ? "animate-pulse" : ""}>
                                            {q.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">{q.result}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}