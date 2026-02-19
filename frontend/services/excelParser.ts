
import * as XLSX from 'xlsx';
import { Category, Product, ProductAttrs, ProductPrice } from '../types';

export const parseExcelToProducts = (file: File): Promise<Category[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const categories: Category[] = [];

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (rawData.length === 0) return;

        const categoryId = sheetName.toLowerCase().replace(/\s+/g, '_');
        const categoryTitle = sheetName;
        const items: Product[] = [];
        let currentBrandOrGroup = sheetName;

        // Extracting headers logic (Assume headers are in the first 2-3 rows)
        const headerRowIndex = 0; // Simplified for demo
        const headers = rawData[headerRowIndex] || [];
        
        // Dynamic Fields identification
        const fields: string[] = headers.map(h => String(h).toLowerCase().replace(/\s+/g, '_')).filter(h => h && h !== 'наименование' && h !== 'цена');

        rawData.slice(1).forEach((row, idx) => {
          if (!row[0]) return; // Skip empty rows

          // Logic for brandOrGroup: if row has only 1st cell filled
          const nonNullableCells = row.filter(cell => cell !== null && cell !== undefined && cell !== '');
          if (nonNullableCells.length === 1) {
            currentBrandOrGroup = String(row[0]);
            return;
          }

          const name = String(row[0]);
          const prices: ProductPrice = {};
          const attrs: ProductAttrs = {};

          // Specific Sheet Mapping Logic
          if (sheetName.includes('Утеплитель')) {
            attrs.thickness_mm = row[1];
            attrs.roll_size_mm = row[2];
            attrs.pack_area_m2 = row[3];
            attrs.pack_volume_m3 = row[4];
            prices.retail = parseFloat(String(row[5])) || 0;
          } else if (sheetName.includes('Пеноплэкс')) {
            attrs.thickness_mm = String(row[1]).replace(/[^0-9]/g, '');
            attrs.pack_area_m2 = row[2];
            attrs.pack_volume_m3 = row[3];
            if (String(row[4]).toLowerCase().includes('запросу')) {
              prices.note = 'по запросу';
            } else {
              prices.purchase = parseFloat(String(row[4])) || 0;
            }
          } else {
            // General fallback mapping
            headers.forEach((header, colIdx) => {
              const val = row[colIdx];
              const h = String(header).toLowerCase();
              if (h.includes('наименование')) return;
              if (h.includes('цена') || h.includes('retail')) prices.retail = parseFloat(String(val));
              else attrs[h.replace(/\s+/g, '_')] = val;
            });
          }

          items.push({
            id: `${categoryId}-${idx}`,
            name,
            brandOrGroup: currentBrandOrGroup,
            unit: 'упаковка',
            prices,
            attrs,
            category_id: categoryId,
            inStock: true
          });
        });

        categories.push({
          id: categoryId,
          title: categoryTitle,
          fields,
          items
        });
      });

      resolve(categories);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};
