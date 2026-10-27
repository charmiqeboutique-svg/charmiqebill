import { BusinessSettings, Invoice } from '../types/pos.ts';

const pdfSafe = (value: unknown) => String(value ?? '')
  .replace(/₹/g, 'INR ')
  .replace(/[·•]/g, '-')
  .replace(/[–—]/g, '-')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\x20-\x7E]/g, '?');

const escapePdfText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

export function createInvoicePdf(invoice: Invoice, settings: BusinessSettings): Buffer {
  const lines = [
    settings.boutiqueName,
    settings.tagline,
    settings.address,
    `Phone: ${settings.phone} | Email: ${settings.email}`,
    `GSTIN: ${settings.gstin}`,
    '',
    `TAX INVOICE: ${invoice.invoiceNumber}`,
    `Date: ${invoice.date}    Due: ${invoice.dueDate}`,
    `Cashier: ${invoice.cashierName} (${invoice.cashierRole})`,
    '',
    `BILLED TO: ${invoice.customerName}`,
    `Phone: ${invoice.customerPhone || '-'}`,
    `Email: ${invoice.customerEmail || '-'}`,
    `City: ${invoice.customerCity || '-'}`,
    '',
    `Payment: ${invoice.paymentStatus} | Method: ${invoice.paymentMethod}`,
    `Amount received: INR ${invoice.amountReceived.toFixed(2)}    Change due: INR ${invoice.changeDue.toFixed(2)}`,
    '',
    'ITEMS',
    'Description | SKU | Qty | Rate | Disc | GST | Total',
    ...invoice.items.map((item) =>
      `${item.name}${item.size ? ` / ${item.size}` : ''}${item.color ? ` / ${item.color}` : ''} | ${item.sku} | ${item.quantity} | INR ${item.unitPrice.toFixed(2)} | ${item.discountPercent}% | ${item.gstRate}% | INR ${item.totalAmount.toFixed(2)}`
    ),
    '',
    `Subtotal: INR ${invoice.subtotal.toFixed(2)}`,
    `Discount: INR ${invoice.totalDiscount.toFixed(2)}`,
    `Taxable base: INR ${invoice.taxableBase.toFixed(2)}`,
    `CGST: INR ${invoice.cgstTotal.toFixed(2)}    SGST: INR ${invoice.sgstTotal.toFixed(2)}    IGST: INR ${invoice.igstTotal.toFixed(2)}`,
    `Total GST: INR ${invoice.totalGst.toFixed(2)}`,
    `GRAND TOTAL: INR ${invoice.grandTotal.toFixed(2)}`,
    ...(invoice.notes ? ['', `Notes: ${invoice.notes}`] : []),
    '',
    'TERMS & CONDITIONS',
    ...settings.termsAndConditions,
    '',
    'Computer generated invoice - No signature required',
  ].flatMap((line) => {
    const safeLine = pdfSafe(line);
    if (safeLine.length <= 105) return [safeLine];
    const chunks: string[] = [];
    for (let index = 0; index < safeLine.length; index += 105) chunks.push(safeLine.slice(index, index + 105));
    return chunks;
  });

  const pageLines: string[][] = [];
  for (let index = 0; index < lines.length; index += 44) pageLines.push(lines.slice(index, index + 44));
  if (pageLines.length === 0) pageLines.push([]);

  const objects: string[] = [];
  const pageObjectIds = pageLines.map((_, index) => 4 + index * 2);
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageLines.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  pageLines.forEach((page, index) => {
    const pageId = 4 + index * 2;
    const streamId = pageId + 1;
    const commands = ['BT', '/F1 9 Tf', '50 790 Td', '14 TL'];
    page.forEach((line, lineIndex) => {
      if (lineIndex > 0) commands.push('T*');
      commands.push(`(${escapePdfText(line)}) Tj`);
    });
    commands.push('ET');
    const stream = commands.join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`);
  });

  let document = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(document, 'ascii'));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(document, 'ascii');
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index++) {
    document += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document, 'ascii');
}
