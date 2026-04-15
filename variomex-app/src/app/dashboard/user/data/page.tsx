"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, HardDrive, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function MyDataPage() {
    const [datasets, setDatasets] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        try {
            const res = await fetch("/api/data");
            const json = await res.json();
            if (json.datasets) {
                setDatasets(json.datasets);
            } else {
                setDatasets([]);
            }
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this genome dataset? This will also revoke any granted access.")) return;
        
        try {
            const res = await fetch(`/api/data/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success("Dataset deleted successfully.");
                setDatasets(datasets.filter(ds => ds.id !== id));
            } else {
                toast.error("Failed to delete dataset.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error deleting dataset.");
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-primary">My Data</h2>
                    <p className="text-muted-foreground">Manage and view your uploaded genomic datasets securely.</p>
                </div>
                <Button variant="outline" onClick={() => { setIsLoading(true); fetchData(); }} disabled={isLoading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {isLoading && datasets.length === 0 ? (
                <div className="flex justify-center p-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary opacity-50" />
                </div>
            ) : datasets.length === 0 ? (
                <Card className="border-dashed shadow-sm">
                    <CardHeader>
                        <CardTitle>No Data Uploaded</CardTitle>
                        <CardDescription>You have not uploaded any genome files yet.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Upload a VCF file from the dashboard to see it reflected here in real-time.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6">
                    {datasets.map((ds) => (
                        <Card key={ds.id} className="shadow-md">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <CardTitle className="text-xl flex items-center gap-2">
                                            <FileText className="h-5 w-5 text-primary" />
                                            {ds.originalName}
                                        </CardTitle>
                                        <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20 shadow-none">
                                            {ds.status}
                                        </Badge>
                                    </div>
                                    <CardDescription>ID: {ds.id}</CardDescription>
                                </div>
                                <Button variant="destructive" size="icon" onClick={() => handleDelete(ds.id)} className="shadow-lg shadow-red-500/20">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4 mt-4 mb-4">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <HardDrive className="h-4 w-4" />
                                        {(ds.size / 1024).toFixed(2)} KB
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Calendar className="h-4 w-4" />
                                        {new Date(ds.uploadedAt).toLocaleString()}
                                    </div>
                                </div>
                                <p className="text-sm italic opacity-70 border-l-2 border-primary/50 pl-3">
                                    {ds.statusDetails}
                                </p>
                                
                                {ds.preview && (
                                    <div className="mt-6">
                                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                            File Preview Snippet
                                        </h4>
                                        <pre className="bg-muted/50 p-4 rounded-xl overflow-x-auto text-[11px] font-mono border border-border/50 text-foreground/80 leading-relaxed">
                                            {ds.preview}
                                        </pre>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
