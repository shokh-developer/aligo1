import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { convert, Direction } from './uzbek-converter';

export type DownloadFormat = 'txt' | 'docx' | 'xlsx';

export interface FileResult {
  text: string;
  fileName: string;
  fileType: string;
  originalFile?: File;
}

export async function readFile(file: File): Promise<FileResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (ext === 'txt') {
    const text = await file.text();
    return { text, fileName: file.name, fileType: 'txt' };
  }

  if (ext === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return { text: result.value, fileName: file.name, fileType: 'docx', originalFile: file };
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const allText: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      allText.push(`--- ${sheetName} ---\n${csv}`);
    }
    return { text: allText.join('\n\n'), fileName: file.name, fileType: ext };
  }

  throw new Error(`Qo'llab-quvvatlanmaydigan format: .${ext}`);
}

/**
 * Convert text inside a .docx file by directly modifying the XML,
 * preserving ALL formatting, tables, styles, images, etc.
 */
async function convertDocxPreservingFormat(
  file: File,
  direction: Direction
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Process all XML files in the word/ directory that may contain text
  const xmlFiles = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/header3.xml',
    'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml'];

  for (const xmlPath of xmlFiles) {
    const xmlFile = zip.file(xmlPath);
    if (!xmlFile) continue;

    let xmlContent = await xmlFile.async('string');
    // Replace text content inside <w:t> tags (Word text runs) while preserving XML structure
    xmlContent = xmlContent.replace(
      /(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/g,
      (_match, openTag, textContent, closeTag) => {
        const converted = convert(textContent, direction);
        return openTag + converted + closeTag;
      }
    );
    zip.file(xmlPath, xmlContent);
  }

  return await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export async function downloadAsFormat(
  convertedText: string,
  originalFileName: string,
  format: DownloadFormat,
  direction: Direction,
  originalFile?: File
): Promise<void> {
  const baseName = originalFileName.replace(/\.[^.]+$/, '');
  const suffix = direction === 'cyr2lat' ? '_latin' : '_cyrillic';

  if (format === 'txt') {
    const blob = new Blob([convertedText], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${baseName}${suffix}.txt`);
    return;
  }

  if (format === 'docx') {
    // If we have the original docx file, preserve its formatting
    if (originalFile && originalFile.name.toLowerCase().endsWith('.docx')) {
      const blob = await convertDocxPreservingFormat(originalFile, direction);
      downloadBlob(blob, `${baseName}${suffix}.docx`);
      return;
    }
    // Fallback: create a simple docx from text
    const paragraphs = convertedText.split('\n').map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line, size: 24 })],
        })
    );
    const doc = new Document({
      sections: [{ children: paragraphs }],
    });
    const buffer = await Packer.toBlob(doc);
    downloadBlob(buffer, `${baseName}${suffix}.docx`);
    return;
  }

  if (format === 'xlsx') {
    const lines = convertedText.split('\n');
    const data = lines.map((line) => line.split(','));
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    downloadBlob(blob, `${baseName}${suffix}.xlsx`);
    return;
  }
}

export async function convertXlsxFile(
  file: File,
  direction: Direction
): Promise<void> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer);

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        if (cell && cell.t === 's' && typeof cell.v === 'string') {
          cell.v = convert(cell.v, direction);
          if (cell.w) cell.w = convert(cell.w, direction);
        }
      }
    }
  }

  const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const suffix = direction === 'cyr2lat' ? '_latin' : '_cyrillic';
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `${baseName}${suffix}.xlsx`);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
