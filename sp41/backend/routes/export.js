const express = require('express');
const router = express.Router();
const exportService = require('../services/exportService');

router.get('/csv', async (req, res) => {
  try {
    const { deviceId, start, stop } = req.query;
    const csv = await exportService.exportToCSV(deviceId, start || '-7d', stop || 'now()');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="smartband-data-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/pdf', async (req, res) => {
  try {
    const { deviceId, start, stop, userProfile } = req.body;
    const pdfBuffer = await exportService.exportToPDF(
      deviceId,
      start || '-7d',
      stop || 'now()',
      userProfile || {}
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="smartband-report-${Date.now()}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
