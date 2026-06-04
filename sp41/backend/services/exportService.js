const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const dataService = require('./dataService');

const FONTS_DIR = path.join(__dirname, '..', 'fonts');

const getFontPath = (fontName) => {
  const fontPath = path.join(FONTS_DIR, fontName);
  if (fs.existsSync(fontPath)) {
    return fontPath;
  }
  return null;
};

const getAvailableFonts = () => {
  const fonts = {};
  
  const regularFont = getFontPath('NotoSansSC-Regular.ttf');
  const boldFont = getFontPath('NotoSansSC-Bold.ttf');
  
  if (regularFont) {
    fonts.regular = regularFont;
  }
  if (boldFont) {
    fonts.bold = boldFont;
  }
  
  return fonts;
};

const STAGE_LABELS_CN = {
  awake: '清醒',
  light: '浅睡',
  deep: '深睡',
  rem: 'REM睡眠'
};

const exportToCSV = async (deviceId, start, stop) => {
  const stepsData = await dataService.queryStepsByRange(deviceId, start, stop);
  const heartRateData = await dataService.queryHeartRateByRange(deviceId, start, stop);
  const sleepData = await dataService.querySleepByRange(deviceId, start, stop);

  const combinedData = [];
  
  stepsData.forEach(item => {
    combinedData.push({
      type: '步数',
      date: item.date,
      value: item.steps,
      detail: ''
    });
  });

  heartRateData.forEach(item => {
    combinedData.push({
      type: '心率',
      date: new Date(item.timestamp).toISOString(),
      value: item.heartRate,
      detail: ''
    });
  });

  sleepData.forEach(item => {
    combinedData.push({
      type: '睡眠',
      date: new Date(item.timestamp).toISOString(),
      value: item.duration,
      detail: STAGE_LABELS_CN[item.stage] || item.stage
    });
  });

  const fields = ['type', 'date', 'value', 'detail'];
  const json2csvParser = new Parser({ fields });
  return json2csvParser.parse(combinedData);
};

const exportToPDF = async (deviceId, start, stop, userProfile = {}) => {
  return new Promise((resolve, reject) => {
    const fonts = getAvailableFonts();
    const hasChineseFonts = fonts.regular && fonts.bold;
    
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4'
    });

    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const setChineseFont = (weight = 'regular') => {
      if (hasChineseFonts) {
        doc.font(weight === 'bold' && fonts.bold ? fonts.bold : fonts.regular);
      } else {
        doc.font('Helvetica');
      }
    };

    const addText = (text, options = {}) => {
      const { fontSize = 12, bold = false, align = 'left', moveDown = 0 } = options;
      setChineseFont(bold ? 'bold' : 'regular');
      doc.fontSize(fontSize);
      doc.text(text, { align });
      if (moveDown > 0) {
        doc.moveDown(moveDown);
      }
    };

    if (hasChineseFonts) {
      addText('智能手环健康报告', { fontSize: 20, bold: true, align: 'center', moveDown: 1 });
    } else {
      doc.fontSize(20).text('Smart Band Health Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).fillColor('#999').text('Note: Install Noto Sans SC fonts for Chinese support', { align: 'center' });
      doc.fillColor('#000').moveDown();
    }
    
    addText(hasChineseFonts ? `设备 ID: ${deviceId}` : `Device ID: ${deviceId}`, { fontSize: 14, moveDown: 0.5 });
    addText(hasChineseFonts ? `报告周期: ${start} 至 ${stop}` : `Report Period: ${start} to ${stop}`, { fontSize: 12, moveDown: 0.5 });
    addText(hasChineseFonts ? `生成时间: ${new Date().toLocaleString('zh-CN')}` : `Generated: ${new Date().toLocaleString()}`, { fontSize: 12, moveDown: 1.5 });

    if (userProfile.age || userProfile.weight) {
      addText(hasChineseFonts ? '个人资料' : 'User Profile', { fontSize: 16, bold: true, moveDown: 0.5 });
      doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
      doc.moveDown(0.5);
      
      if (userProfile.age) addText(hasChineseFonts ? `年龄: ${userProfile.age} 岁` : `Age: ${userProfile.age} years`);
      if (userProfile.weight) addText(hasChineseFonts ? `体重: ${userProfile.weight} 公斤` : `Weight: ${userProfile.weight} kg`);
      if (userProfile.height) addText(hasChineseFonts ? `身高: ${userProfile.height} 厘米` : `Height: ${userProfile.height} cm`);
      doc.moveDown(1);
    }

    addText(hasChineseFonts ? '数据摘要' : 'Summary', { fontSize: 16, bold: true, moveDown: 0.5 });
    doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);

    dataService.queryStepsByRange(deviceId, start, stop).then(stepsData => {
      const totalSteps = stepsData.reduce((sum, d) => sum + d.steps, 0);
      const avgSteps = stepsData.length ? Math.round(totalSteps / stepsData.length) : 0;
      
      addText(hasChineseFonts ? `总步数: ${totalSteps.toLocaleString()}` : `Total Steps: ${totalSteps.toLocaleString()}`, { fontSize: 12 });
      addText(hasChineseFonts ? `日均步数: ${avgSteps.toLocaleString()}` : `Average Daily Steps: ${avgSteps.toLocaleString()}`, { fontSize: 12 });
      
      if (userProfile.weight && userProfile.age) {
        const calories = calculateCalories(totalSteps, userProfile.weight, userProfile.age);
        addText(hasChineseFonts ? `估算卡路里消耗: ${calories.toFixed(0)} 千卡` : `Estimated Calories Burned: ${calories.toFixed(0)} kcal`, { fontSize: 12 });
      }
      doc.moveDown(1);

      return dataService.queryHeartRateByRange(deviceId, start, stop);
    }).then(heartRateData => {
      if (heartRateData.length) {
        const avgHR = Math.round(heartRateData.reduce((sum, d) => sum + d.heartRate, 0) / heartRateData.length);
        const maxHR = Math.max(...heartRateData.map(d => d.heartRate));
        const minHR = Math.min(...heartRateData.map(d => d.heartRate));
        
        addText(hasChineseFonts ? '心率统计' : 'Heart Rate Statistics', { fontSize: 16, bold: true, moveDown: 0.5 });
        doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
        doc.moveDown(0.5);
        
        addText(hasChineseFonts ? `平均值: ${avgHR} 次/分` : `Average: ${avgHR} bpm`, { fontSize: 12 });
        addText(hasChineseFonts ? `最大值: ${maxHR} 次/分` : `Maximum: ${maxHR} bpm`, { fontSize: 12 });
        addText(hasChineseFonts ? `最小值: ${minHR} 次/分` : `Minimum: ${minHR} bpm`, { fontSize: 12 });
        doc.moveDown(1);
      }

      return dataService.querySleepByRange(deviceId, start, stop);
    }).then(sleepData => {
      if (sleepData.length) {
        const sleepByStage = {};
        sleepData.forEach(d => {
          sleepByStage[d.stage] = (sleepByStage[d.stage] || 0) + d.duration;
        });

        addText(hasChineseFonts ? '睡眠分析' : 'Sleep Analysis', { fontSize: 16, bold: true, moveDown: 0.5 });
        doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
        doc.moveDown(0.5);
        
        setChineseFont('regular');
        doc.fontSize(12);
        Object.entries(sleepByStage).forEach(([stage, duration]) => {
          const stageLabel = hasChineseFonts ? (STAGE_LABELS_CN[stage] || stage) : stage;
          doc.text(`${stageLabel}: ${duration.toFixed(1)} 小时`);
        });
      }

      doc.addPage();
      addText(hasChineseFonts ? '每日详情' : 'Daily Details', { fontSize: 16, bold: true, moveDown: 0.5 });
      doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
      doc.moveDown(0.5);

      return dataService.queryStepsByRange(deviceId, start, stop);
    }).then(stepsData => {
      doc.fontSize(10);
      stepsData.forEach(day => {
        const calories = userProfile.weight && userProfile.age 
          ? calculateCalories(day.steps, userProfile.weight, userProfile.age).toFixed(0)
          : '-';
        doc.text(`${day.date}: ${day.steps.toLocaleString()} 步, ${calories} 千卡`);
      });

      doc.end();
    }).catch(reject);
  });
};

const calculateCalories = (steps, weight, age) => {
  const stepsPerKm = 1300;
  const distanceKm = steps / stepsPerKm;
  const met = 5;
  const hoursWalking = distanceKm / 5;
  return met * weight * hoursWalking;
};

module.exports = {
  exportToCSV,
  exportToPDF,
  calculateCalories,
  getAvailableFonts
};
