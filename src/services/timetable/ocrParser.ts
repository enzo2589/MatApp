import { ParsedCourseEvent, GridItem } from './types';
import { parseGrid } from './gridParser';

/**
 * Analyse et extraction optique (OCR) d'une photo ou capture d'écran d'emploi du temps
 */
export async function parseImageFile(
  file: File,
  onProgress?: (pct: number, status: string) => void
): Promise<ParsedCourseEvent[]> {
  onProgress?.(10, 'Initialisation du lecteur optique...');
  const { createWorker } = await import('tesseract.js');

  const worker = await createWorker('fra', 1, {
    logger: (m: any) => {
      if (m.status === 'recognizing text') {
        const pct = Math.min(99, Math.round((m.progress || 0) * 100));
        onProgress?.(pct, `Lecture de la photo... ${pct}%`);
      } else if (m.status && m.status.includes('loading')) {
        onProgress?.(25, 'Chargement de la reconnaissance...');
      }
    },
  });

  try {
    onProgress?.(45, 'Détection optique des colonnes et des cours...');
    const result = await worker.recognize(file, {}, { blocks: true });

    const items: GridItem[] = [];
    if (result.data?.blocks) {
      for (const block of result.data.blocks) {
        for (const para of block.paragraphs || []) {
          for (const line of para.lines || []) {
            if (line.text && line.text.trim()) {
              items.push({
                text: line.text.trim(),
                x: line.bbox.x0,
                y: line.bbox.y0,
                width: line.bbox.x1 - line.bbox.x0,
                height: line.bbox.y1 - line.bbox.y0,
              });
            }
          }
        }
      }
    }

    onProgress?.(85, 'Analyse spatiale de la grille...');
    if (items.length >= 5) {
      const gridCourses = parseGrid(items);
      if (gridCourses.length > 0) {
        onProgress?.(100, `${gridCourses.length} cours détectés avec succès !`);
        return gridCourses;
      }
    }

    throw new Error(
      'Aucun cours n’a pu être identifié sur cette photo. Assurez-vous que les horaires et les jours sont bien cadrés et lisibles.'
    );
  } finally {
    await worker.terminate();
  }
}
