import express from 'express';
import { journalGenerationService } from '../services/journalGenerationService';
import { storage } from '../storage';

const router = express.Router();

// No authentication middleware - allow all requests through
const noAuth = (req: any, res: any, next: any) => {
  // Set a default user context for compatibility with existing code
  req.user = {
    claims: {
      sub: 'demo-user'
    },
    userId: 'demo-user',
    email: 'demo@example.com',
    tenantId: '66a2a729-dfeb-4a96-b0bb-d65b91aeabb8',
    role: 'admin'
  };
  next();
};

// Generate journal entries from uploaded documents
router.post('/generate', noAuth, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    
    // Use default tenant ID for demo purposes
    const tenantId = req.user.tenantId;
    
    console.log(`🔄 Starting journal generation for user ${userId}, tenant ${tenantId}`);
    
    const result = await journalGenerationService.generateJournalEntries(userId, tenantId);
    
    if (result.success) {
      console.log(`✅ Journal generation completed: ${result.totalEntries} entries from ${result.documentsProcessed} documents`);
      
      res.json({
        success: true,
        message: result.totalEntries > 0 
          ? `Generated ${result.totalEntries} journal entries from ${result.documentsProcessed} documents`
          : 'No new journal entries generated - documents may already have entries',
        totalEntries: result.totalEntries,
        documentsProcessed: result.documentsProcessed,
        entries: result.entries.slice(0, 5), // Return first 5 entries for preview
        errors: result.errors
      });
    } else {
      console.log(`❌ Journal generation failed: ${result.errors.join(', ')}`);
      
      res.status(400).json({
        success: false,
        message: 'Journal generation failed',
        errors: result.errors
      });
    }
    
  } catch (error) {
    console.error('❌ Error in journal generation endpoint:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate journal entries',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Download journal entries as CSV
router.get('/download-csv', noAuth, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    
    // Use default tenant ID for demo purposes
    const tenantId = req.user.tenantId;

    console.log(`📊 Generating CSV report for user ${userId}`);
    
    const csvContent = await journalGenerationService.generateCSVReport(userId, tenantId);
    
    // Set headers for CSV download
    const filename = `journal_entries_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    console.log(`✅ CSV report generated successfully: ${filename}`);
    
    res.send(csvContent);
    
  } catch (error) {
    console.error('❌ Error generating CSV report:', error);
    res.status(500).json({ 
      message: 'Failed to generate CSV report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all journal entries for display
router.get('/', noAuth, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    
    // Use default tenant ID for demo purposes
    const tenantId = req.user.tenantId;

    const journalEntries = await storage.getJournalEntries(userId);
    
    // Transform entries to match expected format
    const formattedEntries = journalEntries.map(entry => ({
      id: entry.id,
      entryDate: entry.entryDate || entry.createdAt,
      description: entry.description,
      debitAccount: entry.debitAccount,
      creditAccount: entry.creditAccount,
      amount: entry.amount,
      reference: entry.reference || '',
      documentType: entry.documentType || 'system_generated',
      sourceDocument: entry.sourceDocument || 'System Generated',
      createdAt: entry.createdAt,
      createdBy: entry.createdBy
    }));
    
    res.json(formattedEntries);
    
  } catch (error) {
    console.error('❌ Error fetching journal entries:', error);
    res.status(500).json({ 
      message: 'Failed to fetch journal entries',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export { router as journalRoutes };