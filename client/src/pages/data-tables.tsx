import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search, Filter, FileText, Calendar, DollarSign, Building, Users, Database, Calculator } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import DatabaseTableViewer from "@/components/data-tables/DatabaseTableViewer";
import JournalEntriesTable from "@/components/data-tables/JournalEntriesTable";
import UsersTable from "@/components/data-tables/UsersTable";

interface ExtractedData {
  id: string;
  documentId: string;
  documentType: string;
  fileName: string;
  data: any;
  extractedAt: string;
  confidence: number;
}

interface BankStatementRecord {
  id: number;
  transactionDate: string;
  description: string;
  reference?: string;
  debitAmount?: string;
  creditAmount?: string;
  balance?: string;
  confidence: number;
  source: string;
  rowIndex?: number;
  createdAt: string;
  documentId: string;
  fileName: string;
  originalName: string;
}

export default function DataTables() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState("Q1_2025");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDocType, setSelectedDocType] = useState("all");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: extractedData, isLoading: dataLoading, error } = useQuery<ExtractedData[]>({
    queryKey: [`/api/extracted-data?period=${selectedPeriod}&docType=${selectedDocType}`],
  });

  // Query for bank statement data from the new dedicated table
  const { data: bankStatementData, isLoading: bankDataLoading, error: bankError } = useQuery<{
    success: boolean;
    data: BankStatementRecord[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ['/api/data-tables/bank-statement?page=1&limit=100'],
    retry: 1,
    refetchOnWindowFocus: false,
  });

  console.log('Data Tables Query:', { extractedData, isLoading, error });
  console.log('Bank Statement Query:', { bankStatementData, bankDataLoading, bankError });
  console.log('Extracted data length:', extractedData?.length || 0);
  console.log('Bank statement records:', bankStatementData?.data?.length || 0);
  console.log('Selected period:', selectedPeriod, 'Selected doc type:', selectedDocType);

  const filteredData = extractedData?.filter(item => {
    const matchesSearch = searchTerm === "" || 
      item.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(item.data).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = selectedDocType === "all" || item.documentType === selectedDocType;
    
    return matchesSearch && matchesType;
  }) || [];

  const documentTypes = [
    { value: "vendor_invoice", label: "Vendor Invoices", icon: FileText, color: "bg-blue-500" },
    { value: "sales_register", label: "Sales Register", icon: DollarSign, color: "bg-green-500" },
    { value: "salary_register", label: "Salary Register", icon: Users, color: "bg-purple-500" },
    { value: "bank_statement", label: "Bank Statement", icon: Building, color: "bg-orange-500" },
    { value: "purchase_register", label: "Purchase Register", icon: Calendar, color: "bg-red-500" },
  ];

  const getDocumentTypeData = (docType: string) => {
    return filteredData.filter(item => item.documentType === docType);
  };

  const renderVendorInvoiceData = (data: any[]) => (
    <div className="space-y-4">
      {data.map((item) => (
        <Card key={item.id} className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{item.fileName}</CardTitle>
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                {(item.confidence * 100).toFixed(1)}% confidence
              </Badge>
            </div>
            <CardDescription>
              Extracted on {new Date(item.extractedAt).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Vendor Name</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.data.invoices?.map((invoice: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{invoice.invoiceNumber || "N/A"}</TableCell>
                    <TableCell>{invoice.vendorName || "N/A"}</TableCell>
                    <TableCell>{invoice.invoiceDate || "N/A"}</TableCell>
                    <TableCell className="font-mono">₹{invoice.amount?.toLocaleString() || "0"}</TableCell>
                    <TableCell className="font-mono text-sm">{invoice.gstin || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                        {invoice.status || "pending"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderSalesRegisterData = (data: any[]) => (
    <div className="space-y-4">
      {data.map((item) => (
        <Card key={item.id} className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{item.fileName}</CardTitle>
              <Badge variant="outline" className="bg-green-50 text-green-700">
                {(item.confidence * 100).toFixed(1)}% confidence
              </Badge>
            </div>
            <CardDescription>
              Extracted on {new Date(item.extractedAt).toLocaleDateString()} • {item.totalRecords} records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Taxable Value</TableHead>
                  <TableHead>GST Amount</TableHead>
                  <TableHead>Invoice Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.data?.slice(0, 10).map((sale: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{sale["Invoice No"] || "N/A"}</TableCell>
                    <TableCell>{sale["Customer Name"] || "N/A"}</TableCell>
                    <TableCell>{sale["Date"] || "N/A"}</TableCell>
                    <TableCell className="font-mono text-sm">{sale["GSTIN"] || "N/A"}</TableCell>
                    <TableCell className="font-mono">₹{sale["Taxable Value"]?.toLocaleString() || "0"}</TableCell>
                    <TableCell className="font-mono">₹{sale["GST Amount"]?.toLocaleString() || "0"}</TableCell>
                    <TableCell className="font-mono font-semibold">₹{sale["Invoice Total"]?.toLocaleString() || "0"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {item.totalRecords > 10 && (
              <div className="mt-4 text-sm text-muted-foreground text-center">
                Showing 10 of {item.totalRecords} records
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderSalaryRegisterData = (data: any[]) => (
    <div className="space-y-4">
      {data.map((item) => (
        <Card key={item.id} className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{item.fileName}</CardTitle>
              <Badge variant="outline" className="bg-purple-50 text-purple-700">
                {(item.confidence * 100).toFixed(1)}% confidence
              </Badge>
            </div>
            <CardDescription>
              Extracted on {new Date(item.extractedAt).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Basic Salary</TableHead>
                  <TableHead>TDS Deducted</TableHead>
                  <TableHead>Net Salary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.data.employees?.map((employee: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{employee.employeeId || "N/A"}</TableCell>
                    <TableCell>{employee.employeeName || "N/A"}</TableCell>
                    <TableCell>{employee.department || "N/A"}</TableCell>
                    <TableCell className="font-mono">₹{employee.basicSalary?.toLocaleString() || "0"}</TableCell>
                    <TableCell className="font-mono">₹{employee.tdsDeducted?.toLocaleString() || "0"}</TableCell>
                    <TableCell className="font-mono font-semibold">₹{employee.netSalary?.toLocaleString() || "0"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderBankStatementData = () => {
    if (bankDataLoading) {
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="border-l-4 border-l-orange-500">
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...Array(5)].map((_, j) => (
                    <Skeleton key={j} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (bankError) {
      return (
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <p>Failed to load bank statement data</p>
              <p className="text-sm text-muted-foreground mt-2">
                {bankError instanceof Error ? bankError.message : 'Unknown error'}
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    const records = bankStatementData?.data || [];

    if (records.length === 0) {
      return (
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4" />
              <p>No bank statement data found</p>
              <p className="text-sm mt-2">
                Upload and process bank statement documents to see transaction data here.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Group records by document
    const groupedRecords = records.reduce((acc, record) => {
      const key = record.documentId;
      if (!acc[key]) {
        acc[key] = {
          documentId: record.documentId,
          fileName: record.fileName,
          originalName: record.originalName,
          records: []
        };
      }
      acc[key].records.push(record);
      return acc;
    }, {} as Record<string, { documentId: string; fileName: string; originalName: string; records: BankStatementRecord[] }>);

    return (
      <div className="space-y-4">
        {Object.values(groupedRecords).map((group) => (
          <Card key={group.documentId} className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{group.originalName}</CardTitle>
                <Badge variant="outline" className="bg-orange-50 text-orange-700">
                  {group.records.length} transactions
                </Badge>
              </div>
              <CardDescription>
                Source Document: {group.fileName} • {group.records.length} records stored in database
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Debit</TableHead>
                    <TableHead>Credit</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {new Date(record.transactionDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{record.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.reference || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-red-600">
                        {record.debitAmount ? `₹${parseFloat(record.debitAmount).toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell className="font-mono text-green-600">
                        {record.creditAmount ? `₹${parseFloat(record.creditAmount).toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell className="font-mono font-semibold">
                        {record.balance ? `₹${parseFloat(record.balance).toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {(record.confidence * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderPurchaseRegisterData = (data: any[]) => (
    <div className="space-y-4">
      {data.map((item) => (
        <Card key={item.id} className="border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{item.fileName}</CardTitle>
              <Badge variant="outline" className="bg-red-50 text-red-700">
                {(item.confidence * 100).toFixed(1)}% confidence
              </Badge>
            </div>
            <CardDescription>
              Extracted on {new Date(item.extractedAt).toLocaleDateString()} • {item.totalRecords} records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Vendor Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Item Description</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Taxable Value</TableHead>
                  <TableHead>GST Amount</TableHead>
                  <TableHead>Invoice Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.data?.slice(0, 10).map((purchase: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{purchase["Invoice No"] || "N/A"}</TableCell>
                    <TableCell>{purchase["Vendor Name"] || "N/A"}</TableCell>
                    <TableCell>{purchase["Date"] || "N/A"}</TableCell>
                    <TableCell className="font-mono text-sm">{purchase["GSTIN"] || "N/A"}</TableCell>
                    <TableCell>{purchase["Item Description"] || "N/A"}</TableCell>
                    <TableCell className="font-mono">{purchase["Quantity"] || "0"}</TableCell>
                    <TableCell className="font-mono">₹{purchase["Taxable Value"]?.toLocaleString() || "0"}</TableCell>
                    <TableCell className="font-mono">₹{purchase["GST Amount"]?.toLocaleString() || "0"}</TableCell>
                    <TableCell className="font-mono font-semibold">₹{purchase["Invoice Total"]?.toLocaleString() || "0"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {item.totalRecords > 10 && (
              <div className="mt-4 text-sm text-muted-foreground text-center">
                Showing 10 of {item.totalRecords} records
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="ml-64">
          <TopBar />
          <main className="p-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Data Tables</h1>
                <p className="text-muted-foreground">View extracted data from financial documents</p>
              </div>
            </div>
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-64">
        <TopBar />
        <main className="p-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Data Tables</h1>
              <p className="text-muted-foreground">View extracted data from financial documents</p>
            </div>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export Data
            </Button>
          </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period">Period</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Q1_2025">Q1 2025</SelectItem>
                  <SelectItem value="Q2_2025">Q2 2025</SelectItem>
                  <SelectItem value="Q3_2025">Q3 2025</SelectItem>
                  <SelectItem value="Q4_2025">Q4 2025</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="doctype">Document Type</Label>
              <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {documentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="search"
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Tables */}
      <Tabs defaultValue="database_tables" className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="database_tables" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Database Tables
          </TabsTrigger>
          {documentTypes.map((type) => {
            const Icon = type.icon;
            const count = getDocumentTypeData(type.value).length;
            return (
              <TabsTrigger key={type.value} value={type.value} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {type.label}
                <Badge variant="secondary" className="ml-1">
                  {count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="database_tables" className="space-y-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Tables
                </CardTitle>
                <CardDescription>
                  Direct access to database tables with real-time data from PostgreSQL
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="documents" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="documents" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Documents
                    </TabsTrigger>
                    <TabsTrigger value="journal_entries" className="flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Journal Entries
                    </TabsTrigger>
                    <TabsTrigger value="users" className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Users
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="documents" className="mt-6">
                    <DatabaseTableViewer
                      tableName="documents"
                      title="Documents Table"
                      description="All uploaded documents with metadata and processing status"
                      apiEndpoint="/api/documents"
                    />
                  </TabsContent>

                  <TabsContent value="journal_entries" className="mt-6">
                    <JournalEntriesTable />
                  </TabsContent>

                  <TabsContent value="users" className="mt-6">
                    <UsersTable />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vendor_invoice" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Vendor Invoices Data</h2>
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              {getDocumentTypeData("vendor_invoice").length} documents
            </Badge>
          </div>
          {renderVendorInvoiceData(getDocumentTypeData("vendor_invoice"))}
        </TabsContent>

        <TabsContent value="sales_register" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Sales Register Data</h2>
            <Badge variant="outline" className="bg-green-50 text-green-700">
              {getDocumentTypeData("sales_register").length} documents
            </Badge>
          </div>
          {renderSalesRegisterData(getDocumentTypeData("sales_register"))}
        </TabsContent>

        <TabsContent value="salary_register" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Salary Register Data</h2>
            <Badge variant="outline" className="bg-purple-50 text-purple-700">
              {getDocumentTypeData("salary_register").length} documents
            </Badge>
          </div>
          {renderSalaryRegisterData(getDocumentTypeData("salary_register"))}
        </TabsContent>

        <TabsContent value="bank_statement" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Bank Statement Data</h2>
            <Badge variant="outline" className="bg-orange-50 text-orange-700">
              {bankStatementData?.data?.length || 0} transactions
            </Badge>
          </div>
          {renderBankStatementData()}
        </TabsContent>

        <TabsContent value="purchase_register" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Purchase Register Data</h2>
            <Badge variant="outline" className="bg-red-50 text-red-700">
              {getDocumentTypeData("purchase_register").length} documents
            </Badge>
          </div>
          {renderPurchaseRegisterData(getDocumentTypeData("purchase_register"))}
        </TabsContent>
      </Tabs>

      {filteredData.length === 0 && (
        <Card className="p-8 text-center">
          <div className="space-y-4">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">No data found</h3>
              <p className="text-muted-foreground">
                {searchTerm || selectedDocType !== "all" 
                  ? "No documents match your current filters. Try adjusting your search or filters."
                  : "No extracted data available for the selected period. Upload and process documents to see data here."
                }
              </p>
            </div>
          </div>
        </Card>
      )}
        </main>
      </div>
    </div>
  );
}