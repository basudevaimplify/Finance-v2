import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Search, 
  Download, 
  RefreshCw, 
  Calculator, 
  Calendar, 
  User, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";

interface JournalEntry {
  id: string;
  journalId: string;
  date: string;
  accountCode: string;
  accountName: string;
  debitAmount: string;
  creditAmount: string;
  narration: string;
  entity: string;
  documentId: string;
  tenantId: string;
  createdBy: string;
  createdAt: string;
}

type SortDirection = 'asc' | 'desc' | null;

export default function JournalEntriesTable() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const itemsPerPage = 15;

  // Fetch data using React Query
  const { 
    data: journalEntries, 
    isLoading, 
    error, 
    refetch,
    isRefetching 
  } = useQuery<JournalEntry[]>({
    queryKey: ['/api/journal-entries'],
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : sortDirection === 'desc' ? null : 'asc');
      if (sortDirection === 'desc') {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    if (!journalEntries) return [];

    let filtered = journalEntries.filter(entry => {
      const matchesSearch = searchTerm === "" || 
        entry.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.accountCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.narration?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.entity?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesPeriod = periodFilter === "all" || 
        new Date(entry.date).getFullYear().toString() === periodFilter;
      
      return matchesSearch && matchesPeriod;
    });

    // Apply sorting
    if (sortField && sortDirection) {
      filtered.sort((a, b) => {
        let aValue = a[sortField as keyof JournalEntry];
        let bValue = b[sortField as keyof JournalEntry];

        // Handle different data types
        if (sortField === 'debitAmount' || sortField === 'creditAmount') {
          aValue = Number(aValue) || 0;
          bValue = Number(bValue) || 0;
        } else if (sortField === 'date' || sortField === 'createdAt') {
          aValue = new Date(aValue as string).getTime();
          bValue = new Date(bValue as string).getTime();
        } else {
          aValue = String(aValue).toLowerCase();
          bValue = String(bValue).toLowerCase();
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [journalEntries, searchTerm, periodFilter, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calculate totals
  const totals = useMemo(() => {
    const totalDebit = filteredAndSortedData.reduce((sum, entry) => 
      sum + (Number(entry.debitAmount) || 0), 0);
    const totalCredit = filteredAndSortedData.reduce((sum, entry) => 
      sum + (Number(entry.creditAmount) || 0), 0);
    return { totalDebit, totalCredit };
  }, [filteredAndSortedData]);

  // Format currency
  const formatCurrency = (amount: string | number) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(num);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Render sort icon
  const renderSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    if (sortDirection === 'asc') return <ArrowUp className="h-4 w-4" />;
    if (sortDirection === 'desc') return <ArrowDown className="h-4 w-4" />;
    return <ArrowUpDown className="h-4 w-4" />;
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load journal entries: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Journal Entries
            </CardTitle>
            <CardDescription>
              View and manage accounting journal entries from the database
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Total Entries</p>
                  <p className="text-2xl font-bold">{filteredAndSortedData.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <ArrowUp className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Total Debits</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.totalDebit)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <ArrowDown className="h-4 w-4 text-red-500" />
                <div>
                  <p className="text-sm font-medium">Total Credits</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.totalCredit)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="search"
                placeholder="Search accounts, narration..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="period">Period</Label>
            <Select value={periodFilter} onValueChange={(value) => {
              setPeriodFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="All periods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Periods</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2023">2023</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Results</Label>
            <div className="flex items-center gap-2 pt-2">
              <Badge variant="outline">
                {filteredAndSortedData.length} of {journalEntries?.length || 0}
              </Badge>
              <Badge variant={Math.abs(totals.totalDebit - totals.totalCredit) < 0.01 ? "default" : "destructive"}>
                {Math.abs(totals.totalDebit - totals.totalCredit) < 0.01 ? "Balanced" : "Unbalanced"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('date')}
                    >
                      <div className="flex items-center gap-2">
                        Date
                        {renderSortIcon('date')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('accountCode')}
                    >
                      <div className="flex items-center gap-2">
                        Account
                        {renderSortIcon('accountCode')}
                      </div>
                    </TableHead>
                    <TableHead>Narration</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-right"
                      onClick={() => handleSort('debitAmount')}
                    >
                      <div className="flex items-center justify-end gap-2">
                        Debit
                        {renderSortIcon('debitAmount')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-right"
                      onClick={() => handleSort('creditAmount')}
                    >
                      <div className="flex items-center justify-end gap-2">
                        Credit
                        {renderSortIcon('creditAmount')}
                      </div>
                    </TableHead>
                    <TableHead>Entity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <Calculator className="h-8 w-8 text-muted-foreground" />
                          <p className="text-muted-foreground">
                            {searchTerm || periodFilter !== "all"
                              ? "No journal entries match your filters"
                              : "No journal entries found"}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(entry.date)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{entry.accountCode}</div>
                            <div className="text-sm text-muted-foreground">{entry.accountName}</div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="truncate" title={entry.narration}>
                            {entry.narration || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(entry.debitAmount) > 0 ? (
                            <span className="text-green-600">
                              {formatCurrency(entry.debitAmount)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(entry.creditAmount) > 0 ? (
                            <span className="text-red-600">
                              {formatCurrency(entry.creditAmount)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.entity && (
                            <Badge variant="outline">{entry.entity}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                  {Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)} of{' '}
                  {filteredAndSortedData.length} results
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {[...Array(totalPages)].map((_, i) => {
                      const page = i + 1;
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-8 h-8 p-0"
                          >
                            {page}
                          </Button>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page} className="px-1">...</span>;
                      }
                      return null;
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
