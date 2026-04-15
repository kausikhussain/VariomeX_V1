"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, RefreshCw, Activity, Check, X, FileText, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/audit");
            const json = await res.json();
            if (json.auditLogs) {
                setLogs(json.auditLogs);
            }
        } catch (error) {
            console.error("Failed to fetch audit logs", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 4000);
        return () => clearInterval(interval);
    }, []);

    const getIcon = (action: string) => {
        if (action.includes("Upload")) return <Database className="h-4 w-4 text-blue-500" />;
        if (action.includes("Delete")) return <X className="h-4 w-4 text-red-500" />;
        if (action.includes("Request")) return <FileText className="h-4 w-4 text-emerald-500" />;
        if (action.includes("Granted")) return <Check className="h-4 w-4 text-green-500" />;
        if (action.includes("Denied")) return <X className="h-4 w-4 text-red-500" />;
        return <Activity className="h-4 w-4 text-primary" />;
    };

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <ShieldAlert className="h-6 w-6" /> System Audit Logs
                    </h2>
                    <p className="text-muted-foreground">Immutable track of all data access and modifications.</p>
                </div>
                <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle>Activity Timeline</CardTitle>
                    <CardDescription>Chronological sequence of platform activities</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading && logs.length === 0 ? (
                        <div className="flex justify-center p-12">
                            <Activity className="h-8 w-8 animate-spin text-primary opacity-50" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground italic border-2 border-dashed rounded-lg">
                            No logs recorded in the system yet.
                        </div>
                    ) : (
                        <div className="relative border-l border-muted ml-3 space-y-6 pb-4">
                            {logs.map((log, index) => (
                                <div key={log.id} className="relative pl-6 flex flex-col gap-1">
                                    <div className="absolute -left-2 bg-background border rounded-full p-1 shadow-sm">
                                        {getIcon(log.action)}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="font-mono text-xs">{new Date(log.timestamp).toLocaleTimeString()}</Badge>
                                        <span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="font-semibold text-sm">{log.action}</span>
                                        <span className="text-muted-foreground text-sm">by <span className="font-medium text-foreground">{log.user}</span></span>
                                    </div>
                                    <p className="text-sm font-mono text-muted-foreground bg-muted/30 p-2 rounded-md border mt-1 w-fit">
                                        {log.target}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
