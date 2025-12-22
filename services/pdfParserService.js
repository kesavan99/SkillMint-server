const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const { pdf } = require('pdf-to-img');

/**
 * Extract text from image-based PDF using Tesseract OCR
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextWithOCR(pdfBuffer) {
  try {
    // Convert PDF to images
    const document = await pdf(pdfBuffer, { scale: 2.0 });
    
    let allText = '';
    let pageNum = 1;
    
    for await (const image of document) {
      // Perform OCR on the image
      const { data: { text } } = await Tesseract.recognize(
        image,
        'eng'
      );
      
      allText += text + '\n\n';
      pageNum++;
    }
    
    return allText.trim();
    
  } catch (error) {
    throw new Error(`OCR failed: ${error.message}`);
  }
}

/**
 * Extract text from a PDF file (supports both text-based and image-based PDFs)
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromPDF(pdfBuffer) {
  try {
    // First try standard text extraction
    const data = await pdfParse(pdfBuffer);
    const extractedText = data.text.trim();
    
    // If text extraction yields very little content (likely image-based PDF), use OCR
    if (!extractedText || extractedText.length < 50) {
      return await extractTextWithOCR(pdfBuffer);
    }
    
    return extractedText;
  } catch (error) {
    // If standard extraction failed, try OCR as fallback
    if (error.message.includes('OCR failed')) {
      throw error;
    }
    
    try {
      return await extractTextWithOCR(pdfBuffer);
    } catch (ocrError) {
      throw new Error(`Failed to extract text from PDF: ${ocrError.message}`);
    }
  }
}

module.exports = {
  extractTextFromPDF
};
