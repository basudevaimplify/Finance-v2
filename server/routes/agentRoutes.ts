import { Router } from 'express';
import { AgentOrchestrator } from '../agents/AgentOrchestrator';
import { storage } from '../storage';

const router = Router();
const agentOrchestrator = new AgentOrchestrator();

// Simple auth middleware for demo
const noAuth = (req: any, res: any, next: any) => {
  req.user = {
    userId: 'demo-user',
    email: 'demo@example.com',
    tenantId: '550e8400-e29b-41d4-a716-446655440000'
  };
  next();
};

// Process single document with agent pipeline
router.post('/process/:documentId', noAuth, async (req: any, res) => {
  try {
    const { documentId } = req.params;
    const { userId, tenantId } = req.user;
    
    const document = await storage.getDocument(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const result = await agentOrchestrator.processDocument(
      documentId,
      document.filePath,
      document.originalName,
      document.mimeType,
      userId,
      tenantId
    );
    
    res.json({
      success: true,
      result,
      message: 'Document processed successfully by agent pipeline'
    });
    
  } catch (error) {
    console.error('Agent processing error:', error);
    res.status(500).json({
      error: 'Agent processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Reprocess document
router.post('/reprocess/:documentId', noAuth, async (req: any, res) => {
  try {
    const { documentId } = req.params;
    
    const result = await agentOrchestrator.reprocessDocument(documentId);
    
    res.json({
      success: true,
      result,
      message: 'Document reprocessed successfully'
    });
    
  } catch (error) {
    console.error('Agent reprocessing error:', error);
    res.status(500).json({
      error: 'Agent reprocessing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get processing status
router.get('/status/:documentId', noAuth, async (req: any, res) => {
  try {
    const { documentId } = req.params;
    
    const status = await agentOrchestrator.getProcessingStatus(documentId);
    
    res.json({
      success: true,
      status,
      message: 'Processing status retrieved successfully'
    });
    
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      error: 'Failed to get processing status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Bulk process multiple documents
router.post('/bulk-process', noAuth, async (req: any, res) => {
  try {
    const { documentIds, maxConcurrency = 3 } = req.body;
    
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: 'Invalid document IDs array' });
    }
    
    const results = await agentOrchestrator.bulkProcessDocuments(documentIds, {
      maxConcurrency,
      onProgress: (completed, total) => {
        console.log(`Bulk processing progress: ${completed}/${total}`);
      }
    });
    
    res.json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.processingStatus === 'success').length,
        failed: results.filter(r => r.processingStatus === 'failed').length
      },
      message: 'Bulk processing completed'
    });
    
  } catch (error) {
    console.error('Bulk processing error:', error);
    res.status(500).json({
      error: 'Bulk processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get agent statistics
router.get('/statistics', noAuth, async (req: any, res) => {
  try {
    const stats = await agentOrchestrator.getAgentStatistics();
    
    res.json({
      success: true,
      statistics: stats,
      message: 'Agent statistics retrieved successfully'
    });
    
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      error: 'Failed to get agent statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as agentRoutes };