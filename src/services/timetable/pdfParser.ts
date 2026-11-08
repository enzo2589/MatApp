import { ParsedCourseEvent, GridItem } from './types';
import { parseGrid, mergeConsecutiveCourses } from './gridParser';

/**
 * Charge et analyse un fichier PDF d'emploi du temps page par page
 */
export async function parsePdfFile(file: File): Promise<ParsedCourseEvent[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await import('pdfjs-dist');
    const pdfWorker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;

    if (!pdfjsLib.GlobalWorkerOptions.workerSrc && !pdfjsLib.GlobalWorkerOptions.workerPort) {
      try {
        pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(
          new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
          { type: 'module' }
        );
      } catch {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          pdfWorker ||
          `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/build/pdf.worker.min.mjs`;
      }
    }

    let pdfDoc;
    try {
      pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    } catch {
      delete (pdfjsLib.GlobalWorkerOptions as any).workerPort;
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      pdfDoc = await pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        useWorkerFetch: false,
        useSystemFonts: true,
      } as any).promise;
    }

    let allCourses: ParsedCourseEvent[] = [];

    // Analyse chaque page individuellement pour garantir l'absence totale de collision
    // de coordonnées entre le bloc du matin (Page 1) et celui de l'après-midi (Page 2)
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageItems: GridItem[] = textContent.items
        .filter((item: any) => item.str && item.str.trim())
        .map((item: any) => ({
          text: item.str.trim(),
          x: Math.round(item.transform[4]),
          y: Math.round(item.transform[5]),
          width: Math.round(item.width || 0),
          height: Math.round(item.height || 0),
        }));

      const pageCourses = parseGrid(pageItems);
      allCourses = allCourses.concat(pageCourses);
    }

    return mergeConsecutiveCourses(allCourses);
  } catch (err) {
    console.error('Erreur lors de l’analyse du PDF:', err);
    return [];
  }
}
