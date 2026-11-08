import { ParsedCourseEvent } from './types';
import { mergeConsecutiveCourses } from './gridParser';

/**
 * Parseur de fichiers iCalendar (.ics / ADE Campus / ENT)
 */
export function parseIcsContent(icsContent: string): ParsedCourseEvent[] {
  const events: ParsedCourseEvent[] = [];
  const veventBlocks = icsContent.split('BEGIN:VEVENT');

  for (let i = 1; i < veventBlocks.length; i++) {
    const block = veventBlocks[i].split('END:VEVENT')[0];

    const summaryMatch = block.match(/SUMMARY:(.*?)(\r?\n[A-Z]|$)/s);
    const dtStartMatch = block.match(/DTSTART(?:;.*?)?:(\d{8}T\d{6}Z?)/);
    const dtEndMatch = block.match(/DTEND(?:;.*?)?:(\d{8}T\d{6}Z?)/);
    const locationMatch = block.match(/LOCATION:(.*?)(\r?\n[A-Z]|$)/s);
    const descMatch = block.match(/DESCRIPTION:(.*?)(\r?\n[A-Z]|$)/s);

    if (dtStartMatch && dtEndMatch) {
      const summary = summaryMatch ? summaryMatch[1].replace(/\\,/g, ',').trim() : 'Cours';
      const location = locationMatch ? locationMatch[1].replace(/\\,/g, ',').trim() : '';
      const description = descMatch ? descMatch[1].replace(/\\n/g, ' ').trim() : '';

      const parseIcsDate = (str: string) => {
        const year = parseInt(str.substring(0, 4), 10);
        const month = parseInt(str.substring(4, 6), 10) - 1;
        const day = parseInt(str.substring(6, 8), 10);
        const hour = parseInt(str.substring(9, 11), 10);
        const min = parseInt(str.substring(11, 13), 10);
        return new Date(Date.UTC(year, month, day, hour, min)).toISOString();
      };

      events.push({
        id: `ics-${Date.now()}-${i}`,
        title: summary,
        subject: location || 'Cours Faculté',
        room: location,
        professor: description,
        startTime: parseIcsDate(dtStartMatch[1]),
        endTime: parseIcsDate(dtEndMatch[1]),
        color: 'cours',
        category: 'Faculté',
      });
    }
  }

  return mergeConsecutiveCourses(events);
}
