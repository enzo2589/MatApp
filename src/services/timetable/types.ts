export interface ParsedCourseEvent {
  id: string;
  title: string;
  subject: string;
  professor?: string;
  room?: string;
  startTime: string; // ISO 8601 string: YYYY-MM-DDTHH:mm:ss
  endTime: string;   // ISO 8601 string: YYYY-MM-DDTHH:mm:ss
  color: string;
  category: string;
}

export interface GridItem {
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface DayColumn {
  dayName: string;
  dayNum: number;
  monthIdx: number;
  year: number;
  xCenter: number;
  xMin: number;
  xMax: number;
  isoDate: string; // YYYY-MM-DD
}

export interface TimeSlot {
  yCenter: number;
  yMin: number;
  yMax: number;
  startH: number;
  startM: number;
  endH: number;
  endM: number;
}
