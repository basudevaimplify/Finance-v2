import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import PageLayout from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { FileText, Download, Calculator, RefreshCw, CheckCircle, BookOpen, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface JournalEntry {
  id: string;
  entryDate: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  reference: string;
  documentType: string;
  sourceDocument: string;
  createdAt: string;
  createdBy: string;
}

export default function JournalEntries() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch journal entries
  const { data: journalEntries = [], isLoading, refetch } = useQuery<JournalEntry[]>({
    queryKey: ['/api/journal'],
    enabled: isAuthenticated,
  });

  // Generate journal entries mutation
  const generateJournalEntriesMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/journal/generate', {
        method: 'POST',
        body: JSON.stringify({ period: 'Q3_2025' }),
      }),
    onMutate: () => {
      setIsGenerating(true);
      toast({
        title: "Generating Journal Entries",
        description: "Processing uploaded documents to create journal entries...",
      });
    },
    onSuccess: (data) => {
      setIsGenerating(false);
      queryClient.invalidateQueries({ queryKey: ['/api/journal'] });
      
      if (data.success) {
        toast({
          title: "Journal Entries Generated",
          description: data.message,
        });
      } else {
        toast({
          title: "Generation Failed",
          description: data.message || "Failed to generate journal entries",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      setIsGenerating(false);
      toast({
        title: "Generation Failed",
        description: "Failed to generate journal entries. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Download CSV function (using same working implementation from Document Management)
  const handleDownloadCSV = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch('/api/journal/download-csv');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `journal_entries_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Successful",
        description: "Journal entries CSV downloaded successfully",
      });
    } catch (error) {
      console.error("CSV download error:", error);
      toast({
        title: "Download Failed",
        description: `Failed to download CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Calculate summary statistics
  const totalEntries = journalEntries.length;
  const totalDebitAmount = journalEntries
    .filter(entry => entry.debitAccount)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const totalCreditAmount = journalEntries
    .filter(entry => entry.creditAccount)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const isBalanced = Math.abs(totalDebitAmount - totalCreditAmount) < 0.01;

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!isAuthenticated) {
    return (
      <PageLayout title="Journal Entries">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Please log in to access journal entries.</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Journal Entries">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Journal Entries</h1>
            <p className="text-muted-foreground">
              Double-entry journal entries generated from uploaded financial documents
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={() => generateJournalEntriesMutation.mutate()}
              disabled={isGenerating}
              variant="default"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              {isGenerating ? 'Generating...' : 'Generate Entries'}
            </Button>
            <Button
              onClick={handleDownloadCSV}
              disabled={isDownloading || totalEntries === 0}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? 'Downloading...' : 'Download CSV'}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEntries}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Debits</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatAmount(totalDebitAmount)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatAmount(totalCreditAmount)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Balance Status</CardTitle>
              <CheckCircle className={`h-4 w-4 ${isBalanced ? 'text-green-500' : 'text-red-500'}`} />
            </CardHeader>
            <CardContent>
              <Badge variant={isBalanced ? "success" : "destructive"}>
                {isBalanced ? 'Balanced' : 'Unbalanced'}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Journal Entries Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Journal Entries Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                <span>Loading journal entries...</span>
              </div>
            ) : totalEntries === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Journal Entries Found</h3>
                <p className="text-muted-foreground mb-4">
                  Upload and process financial documents to generate journal entries.
                </p>
                <Button
                  onClick={() => generateJournalEntriesMutation.mutate()}
                  disabled={isGenerating}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Entries
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Debit Account</TableHead>
                      <TableHead>Credit Account</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journalEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {formatDate(entry.entryDate)}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate" title={entry.description}>
                            {entry.description || 'No description'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.debitAccount && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              {entry.debitAccount}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.creditAccount && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              {entry.creditAccount}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatAmount(entry.amount)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {entry.reference}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {entry.sourceDocument}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions Card */}
        <Card>
          <CardHeader>
            <CardTitle>How Journal Entry Generation Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-semibold text-blue-600">1. Document Processing</h4>
                <p className="text-muted-foreground">
                  System analyzes uploaded Bank Statements, Sales Registers, and Purchase Registers to extract transaction data.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-green-600">2. Journal Entry Creation</h4>
                <p className="text-muted-foreground">
                  AI applies accounting principles to generate double-entry journal entries following Companies Act 2013 and IndAS standards.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-purple-600">3. Audit-Grade Output</h4>
                <p className="text-muted-foreground">
                  Each entry includes Date, Description, Debit/Credit accounts, Amount, and Document Source for complete audit trail.
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-100 border border-red-200 rounded mr-2"></div>
                Debit Accounts
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-100 border border-green-200 rounded mr-2"></div>
                Credit Accounts
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                Balanced entries ensure accounting accuracy
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}