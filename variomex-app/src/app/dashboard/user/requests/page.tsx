"use client";

import { useAuth } from "@/context/auth-context";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, RefreshCw, Activity, FileCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function MyRequestsPage() {
    const { user, role } = useAuth();
    const [requests, setRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/requests");
            const json = await res.json();
            if (json.requests) {
                setRequests(json.requests);
            }
        } catch (error) {
            console.error("Failed to fetch requests", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 4000);
        return () => clearInterval(interval);
    }, []);

    const handleAction = async (id: string, status: string) => {
        try {
            const res = await fetch("/api/requests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId: id, status })
            });
            if (res.ok) {
                toast.success(`Request ${status} successfully.`);
                fetchData();
            } else {
                toast.error("Failed to update status.");
            }
        } catch(e) {
            toast.error("Error confirming action.");
        }
    }

    // Filter requests based on role
    const displayedRequests = role === "researcher" 
        ? requests.filter(r => r.researcher === (user?.name || "Dr. Guest Researcher"))
        : requests;

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <FileText className="h-6 w-6" /> 
                        {role === "researcher" ? "My Access Requests" : "Pending Approvals & Access Configurations"}
                    </h2>
                    <p className="text-muted-foreground">Detailed log of data access intents.</p>
                </div>
                <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle>Directory</CardTitle>
                    <CardDescription>Track the lifecycle of data queries between Users and Researchers</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                {role === "user" && <TableHead>Researcher</TableHead>}
                                <TableHead>Dataset</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead>Timestamp</TableHead>
                                <TableHead>Status</TableHead>
                                {role === "user" && <TableHead className="text-right">Actions</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayedRequests.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={role === "user" ? 7 : 5} className="text-center h-24 italic text-muted-foreground">
                                        No request history recorded yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                displayedRequests.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell className="font-mono text-xs">{req.id}</TableCell>
                                        {role === "user" && <TableCell className="font-medium">{req.researcher}</TableCell>}
                                        <TableCell className="font-semibold">{req.datasetName}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{req.reason}</TableCell>
                                        <TableCell className="text-xs">{new Date(req.requestedAt).toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Badge variant={req.status === "approved" ? "default" : req.status === "rejected" ? "destructive" : "secondary"}>
                                                {req.status}
                                            </Badge>
                                        </TableCell>
                                        {role === "user" && (
                                            <TableCell className="text-right flex items-center justify-end gap-2">
                                                {req.status === "pending" && (
                                                    <>
                                                        <Button size="sm" variant="outline" onClick={() => handleAction(req.id, "approved")} className="h-8 w-8 p-0 text-green-600 border-green-200 bg-green-50 hover:bg-green-100">
                                                            <FileCheck className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="sm" variant="outline" onClick={() => handleAction(req.id, "rejected")} className="h-8 w-8 p-0 text-red-600 border-red-200 bg-red-50 hover:bg-red-100">
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                )}
                                                {req.status !== "pending" && (
                                                    <span className="text-xs italic text-muted-foreground">Resolved</span>
                                                )}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
