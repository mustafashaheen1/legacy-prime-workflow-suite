import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
  useWindowDimensions,
  Modal,
  Linking,
} from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import {
  Calendar,
  FileSpreadsheet,
  ChevronDown,
  ChevronLeft,
  MapPin,
  StickyNote,
  Clock,
  History,
  Download,
  Eye,
  FileText,
  Briefcase,
  X,
  Navigation,
} from "lucide-react-native";
import NativeMapView from "@/components/NativeMapView";
import WebMapFallback from "@/components/WebMapFallback";
import { useApp } from "@/contexts/AppContext";
import type { ClockEntry, GeoPoint } from "@/types";
import { supabase } from "@/lib/supabase";
import XLSXJsStyle from "xlsx-js-style";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const ANCHOR = new Date("2025-01-06T00:00:00").getTime();
const DAY_MS = 86_400_000;

type PeriodMode = "Weekly" | "Biweekly" | "Monthly";

// ─── Types ────────────────────────────────────────────────────────────────────
type TaskTag =
  | "Painting" | "Drywall" | "Framing" | "Flooring" | "Cleaning"
  | "General Labor" | "Electrical" | "Plumbing" | "Roofing" | "Concrete"
  | "Landscaping" | "HVAC" | "Insulation" | "Demolition" | "Other";

interface LocationPoint {
  label: string;
  time: string;
  address: string;
  lat: number;
  lng: number;
  color: string;
}

interface LunchSlot {
  out: string;
  in: string;
  outMs: number;
  inMs: number;
  minutes: number;
  inProgress: boolean;
}

interface Session {
  jobName: string;
  task: TaskTag;
  clockIn: string;
  clockOut: string;
  note: string;
  locations: LocationPoint[];
  lunchBreaks: LunchSlot[];
  lunchMinutes: number;
  grossH: number;
  grossM: number;
  netH: number;
  netM: number;
  pay: number;
  clockInMs: number;
  clockOutMs: number;
}

interface DayEntry {
  label: string;
  date: string;
  dateShort: string;
  sessions: Session[];
  lunchMinutes: number;
  grossH: number;
  grossM: number;
  netH: number;
  netM: number;
  pay: number;
}

interface WeekSection {
  label: string;
  range: string;
  days: DayEntry[];
  netHours: number;
  pay: number;
}

const TASK_COLORS: Record<TaskTag, { bg: string; fg: string }> = {
  Painting:      { bg: "#DBEAFE", fg: "#1D4ED8" },
  Drywall:       { bg: "#E0E7FF", fg: "#4338CA" },
  Framing:       { bg: "#F3E8FF", fg: "#7C3AED" },
  Flooring:      { bg: "#FFEDD5", fg: "#C2410C" },
  Cleaning:      { bg: "#DCFCE7", fg: "#15803D" },
  "General Labor": { bg: "#F3F4F6", fg: "#374151" },
  Electrical:    { bg: "#FEF9C3", fg: "#A16207" },
  Plumbing:      { bg: "#CFFAFE", fg: "#0E7490" },
  Roofing:       { bg: "#FEE2E2", fg: "#B91C1C" },
  Concrete:      { bg: "#F3F4F6", fg: "#4B5563" },
  Landscaping:   { bg: "#DCFCE7", fg: "#166534" },
  HVAC:          { bg: "#E0F2FE", fg: "#0369A1" },
  Insulation:    { bg: "#FFF7ED", fg: "#9A3412" },
  Demolition:    { bg: "#FEE2E2", fg: "#991B1B" },
  Other:         { bg: "#F3F4F6", fg: "#374151" },
};

const VALID_TASKS: TaskTag[] = [
  "Painting", "Drywall", "Framing", "Flooring", "Cleaning",
  "General Labor", "Electrical", "Plumbing", "Roofing", "Concrete",
  "Landscaping", "HVAC", "Insulation", "Demolition", "Other",
];

// ─── Geocoding (Nominatim / OpenStreetMap) ────────────────────────────────────
const geoCache = new Map<string, string>();
const geoQueue: Array<() => void> = [];
let geoRunning = false;

async function drainGeo() {
  if (geoRunning) return;
  geoRunning = true;
  while (geoQueue.length > 0) {
    geoQueue.shift()!();
    await new Promise<void>((r) => setTimeout(r, 1_100));
  }
  geoRunning = false;
}

function reverseGeocode(lat: number, lon: number): Promise<string> {
  if (lat === 0 && lon === 0) return Promise.resolve("");
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (geoCache.has(key)) return Promise.resolve(geoCache.get(key)!);
  return new Promise<string>((resolve) => {
    geoQueue.push(() => {
      if (geoCache.has(key)) {
        resolve(geoCache.get(key)!);
        return;
      }
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
        { headers: { "User-Agent": "LegacyPrimeWorkflowSuite/1.0" } },
      )
        .then((r) => r.json())
        .then((j) => {
          const a = j?.display_name ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
          geoCache.set(key, a);
          resolve(a);
        })
        .catch(() => resolve(`${lat.toFixed(5)}, ${lon.toFixed(5)}`));
    });
    drainGeo();
  });
}

function openInMaps(lat: number, lon: number, label = "Location") {
  const enc = encodeURIComponent(label);
  const url = Platform.select({
    ios: `http://maps.apple.com/?q=${enc}&ll=${lat},${lon}`,
    android: `geo:${lat},${lon}?q=${lat},${lon}(${enc})`,
    default: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
  })!;
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps?q=${lat},${lon}`),
  );
}

// ─── Period helpers ───────────────────────────────────────────────────────────
interface Period {
  label: string;
  start: Date;
  end: Date;
}

function getPeriods(mode: PeriodMode): Period[] {
  const now = new Date();
  if (mode === "Weekly") {
    const dow = now.getDay();
    const daysToMon = dow === 0 ? 6 : dow - 1;
    const thisMonday = new Date(now);
    thisMonday.setHours(0, 0, 0, 0);
    thisMonday.setDate(thisMonday.getDate() - daysToMon);
    return Array.from({ length: 104 }, (_, k) => {
      const s = new Date(thisMonday.getTime() - k * 7 * DAY_MS);
      const e = new Date(s.getTime() + 6 * DAY_MS);
      e.setHours(23, 59, 59, 999);
      const f = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
      return {
        label: `${f(s)} – ${f(e)}, ${e.getFullYear()}`,
        start: s,
        end: e,
      };
    });
  }
  if (mode === "Biweekly") {
    const cur = Math.floor((now.getTime() - ANCHOR) / (14 * DAY_MS));
    return Array.from({ length: 52 }, (_, k) => {
      const i = cur - k;
      if (i < 0) return null!;
      const s = new Date(ANCHOR + i * 14 * DAY_MS);
      const e = new Date(s.getTime() + 13 * DAY_MS);
      e.setHours(23, 59, 59, 999);
      const f = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
      return {
        label: `${f(s)} – ${f(e)}, ${e.getFullYear()}`,
        start: s,
        end: e,
      };
    }).filter(Boolean);
  }
  // Monthly
  return Array.from({ length: 24 }, (_, k) => {
    const s = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const e = new Date(now.getFullYear(), now.getMonth() - k + 1, 0);
    e.setHours(23, 59, 59, 999);
    return {
      label: `${MONTHS[s.getMonth()]} ${s.getFullYear()}`,
      start: s,
      end: e,
    };
  });
}

// ─── Data helpers ─────────────────────────────────────────────────────────────
function normLoc(l: any): GeoPoint {
  if (!l || typeof l !== "object") return { latitude: 0, longitude: 0 };
  const lat = parseFloat(l.latitude ?? l.lat ?? 0);
  const lng = parseFloat(l.longitude ?? l.lng ?? l.lon ?? 0);
  return { latitude: isNaN(lat) ? 0 : lat, longitude: isNaN(lng) ? 0 : lng };
}
function validLocOrUndef(l: any): GeoPoint | undefined {
  if (!l) return undefined;
  const g = normLoc(l);
  return g.latitude !== 0 || g.longitude !== 0 ? g : undefined;
}
function isValidLoc(loc?: GeoPoint | null): loc is GeoPoint {
  return !!loc && loc.latitude !== 0 && !isNaN(loc.latitude);
}
function mapRow(r: any): ClockEntry {
  console.log('[TimeCards] DB row for entry', r.id?.slice(0,8),
    '| clock_out:', r.clock_out ? 'SET' : 'NULL',
    '| clock_out_location:', r.clock_out_location
      ? `lat=${r.clock_out_location?.latitude ?? r.clock_out_location?.lat} lng=${r.clock_out_location?.longitude ?? r.clock_out_location?.lng}`
      : 'NULL',
    '| location:', r.location ? `lat=${r.location?.latitude}` : 'NULL',
    '| lunch_breaks:', (r.lunch_breaks ?? []).length,
  );
  return {
    id: r.id,
    employeeId: r.employee_id,
    projectId: r.project_id,
    clockIn: r.clock_in,
    clockOut: r.clock_out ?? undefined,
    location: normLoc(r.location),
    clockOutLocation: validLocOrUndef(r.clock_out_location),
    workPerformed: r.work_performed ?? undefined,
    category: r.category ?? undefined,
    lunchBreaks: (r.lunch_breaks ?? []).map((lb: any) => ({
      startTime: lb.startTime ?? lb.start_time ?? lb.start ?? "",
      endTime: lb.endTime ?? lb.end_time ?? lb.end ?? "",
      startLocation: validLocOrUndef(lb.startLocation ?? lb.start_location),
      endLocation: validLocOrUndef(lb.endLocation ?? lb.end_location),
    })),
    hourlyRate: r.hourly_rate ?? undefined,
  };
}
function fmtTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  let h = d.getHours(),
    m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}
function fmtHM(h: number, m: number): string {
  return `${h}:${m.toString().padStart(2, "0")}h`;
}

// ─── ClockEntry → Session adapter ────────────────────────────────────────────
function entryToSession(e: ClockEntry, jobName: string, rate: number): Session {
  const out = e.clockOut;
  const clockInMs = new Date(e.clockIn).getTime();
  // Fix 1: active sessions use current time instead of 0 so they appear in totals
  const clockOutMs = out ? new Date(out).getTime() : Date.now();
  const gross = Math.max(0, (clockOutMs - clockInMs) / 3_600_000);

  // Build all lunch break slots — supports unlimited breaks
  let totalBreakMs = 0;
  const lunchBreaks: LunchSlot[] = (e.lunchBreaks ?? []).map(lb => {
    const outMs = new Date(lb.startTime).getTime();
    const inMs = lb.endTime ? new Date(lb.endTime).getTime() : Date.now();
    const inProgress = !lb.endTime;
    const durMs = Math.max(0, inMs - outMs);
    totalBreakMs += durMs;
    return {
      out: fmtTime(lb.startTime),
      in: inProgress ? "In progress" : fmtTime(lb.endTime!),
      outMs,
      inMs,
      minutes: Math.round(durMs / 60_000),
      inProgress,
    };
  });

  const grossMs = Math.max(0, clockOutMs - clockInMs);
  const netMs = Math.max(0, grossMs - totalBreakMs);
  // Round to nearest minute then divide — identical to clock screen todayEarnings
  const grossMin = Math.round(grossMs / 60_000);
  const netMin = Math.round(netMs / 60_000);
  const net = netMin / 60;

  // Use rate snapshotted at clock-in; fall back to current employee rate
  const effectiveRate = e.hourlyRate ?? rate;
  const pay = parseFloat((net * effectiveRate).toFixed(2));
  const lunchMinutes = Math.round(totalBreakMs / 60_000);

  const getAddr = (loc: GeoPoint): string => {
    const key = `${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}`;
    return geoCache.get(key) ?? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
  };

  const locations: LocationPoint[] = [];
  if (isValidLoc(e.location)) {
    locations.push({
      label: "Clock In", time: fmtTime(e.clockIn),
      address: getAddr(e.location),
      lat: e.location.latitude, lng: e.location.longitude, color: "#10B981",
    });
  }
  (e.lunchBreaks ?? []).forEach((lb) => {
    if (lb.startTime && isValidLoc(lb.startLocation)) {
      locations.push({
        label: "Lunch Out", time: fmtTime(lb.startTime),
        address: getAddr(lb.startLocation!),
        lat: lb.startLocation!.latitude, lng: lb.startLocation!.longitude, color: "#F59E0B",
      });
    }
    if (lb.endTime && isValidLoc(lb.endLocation)) {
      locations.push({
        label: "Lunch In", time: fmtTime(lb.endTime!),
        address: getAddr(lb.endLocation!),
        lat: lb.endLocation!.latitude, lng: lb.endLocation!.longitude, color: "#F59E0B",
      });
    }
  });
  if (out) {
    const hasClockOutLoc = isValidLoc(e.clockOutLocation);
    locations.push({
      label: "Clock Out", time: fmtTime(out),
      address: hasClockOutLoc ? getAddr(e.clockOutLocation!) : "Location not captured",
      lat: hasClockOutLoc ? e.clockOutLocation!.latitude : 0,
      lng: hasClockOutLoc ? e.clockOutLocation!.longitude : 0,
      color: "#EF4444",
    });
  }

  const task = VALID_TASKS.find(t => t.toLowerCase() === (e.category ?? "").toLowerCase()) ?? "General Labor";

  return {
    jobName: jobName || "General Work",
    task,
    clockIn: fmtTime(e.clockIn),
    clockOut: out ? fmtTime(out) : "—",
    note: e.workPerformed ?? "",
    locations,
    lunchBreaks,
    lunchMinutes,
    grossH: Math.floor(grossMin / 60),
    grossM: grossMin % 60,
    netH: Math.floor(netMin / 60),
    netM: netMin % 60,
    pay,
    clockInMs,
    clockOutMs,
  };
}

function buildDayEntry(
  date: Date,
  entries: ClockEntry[],
  projName: (id?: string) => string,
  rate: number,
): DayEntry {
  const sessions = entries.map((e) =>
    entryToSession(e, projName(e.projectId), rate),
  );
  const lunchMinutes = sessions.reduce((a, s) => a + s.lunchMinutes, 0);
  const grossMin = sessions.reduce((a, s) => a + s.grossH * 60 + s.grossM, 0);
  const netMin = sessions.reduce((a, s) => a + s.netH * 60 + s.netM, 0);
  const pay = sessions.reduce((a, s) => a + s.pay, 0);
  return {
    label: DAYS[date.getDay()],
    date: `${MONTHS[date.getMonth()]} ${date.getDate()}`,
    dateShort: `${MONTHS[date.getMonth()].toUpperCase()} ${date.getDate()}`,
    sessions,
    lunchMinutes,
    grossH: Math.floor(grossMin / 60),
    grossM: grossMin % 60,
    netH: Math.floor(netMin / 60),
    netM: netMin % 60,
    pay,
  };
}

// ─── MiniMap ──────────────────────────────────────────────────────────────────
// Decorative preview: shows up to 2 break pairs of amber pins proportionally.
function MiniMap({ lunchCount, onPress }: { lunchCount: number; onPress?: () => void }) {
  // Evenly space up to 4 amber pins (2 pairs) across the 12%–85% usable range
  const breakPins = useMemo(() => {
    if (lunchCount === 0) return [];
    const count = Math.min(lunchCount, 2); // cap at 2 pairs for visual
    const pins: string[] = [];
    for (let i = 0; i < count; i++) {
      const base = lunchCount === 1 ? 36 : 20 + i * 30;
      pins.push(`${base}%`);
      pins.push(`${base + 14}%`);
    }
    return pins;
  }, [lunchCount]);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.mapPreview}
      testID="mini-map"
    >
      <View style={[styles.mapBlock, { backgroundColor: "#E0F2FE", left: 0, width: "35%" }]} />
      <View style={[styles.mapBlock, { backgroundColor: "#ECFCCB", left: "35%", width: "30%" }]} />
      <View style={[styles.mapBlock, { backgroundColor: "#E0F2FE", left: "65%", width: "35%" }]} />
      <View style={styles.mapDashLine} />
      <View style={[styles.mapPin, { left: "6%", backgroundColor: "#10B981" }]} />
      {breakPins.map((left, i) => (
        <View key={i} style={[styles.mapPin, { left: left as any, backgroundColor: "#F59E0B" }]} />
      ))}
      <View style={[styles.mapPin, { left: "88%", backgroundColor: "#EF4444" }]} />
      <View style={styles.mapExpandHint}>
        <MapPin size={10} color="#2563EB" />
        <Text style={styles.mapExpandHintText}>Tap to open map</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── SessionBlock ─────────────────────────────────────────────────────────────
type TLEvent = {
  label: string;
  time: string;
  color: string;
  pct: number;       // 0–100 position along the bar
  isRight?: boolean; // true only for the last dot (Clock Out) to anchor right edge
  italic?: boolean;
};

function buildTimelineEvents(session: Session): TLEvent[] {
  const spanMs = (session.clockOutMs || Date.now()) - session.clockInMs;
  const pct = (ms: number) =>
    spanMs > 0 ? Math.min(95, Math.max(2, ((ms - session.clockInMs) / spanMs) * 100)) : 50;
  const events: TLEvent[] = [];
  events.push({ label: "Clock In", time: session.clockIn, color: "#10B981", pct: 0 });

  session.lunchBreaks.forEach((lb) => {
    events.push({ label: "Lunch Out", time: lb.out, color: "#F59E0B", pct: pct(lb.outMs) });
    events.push({ label: "Lunch In", time: lb.in, color: "#F59E0B", pct: pct(lb.inMs), italic: lb.inProgress });
  });

  events.push({ label: "Clock Out", time: session.clockOut, color: "#EF4444", pct: 100, isRight: true });
  return events;
}

// Maps a 0–100 pct to a pixel X on the bar line, inset by LINE_PAD on each side.
const LINE_PAD = 4;
const DOT_R = 5;
const LABEL_W = 60;   // fixed label box width — fits "Lunch Out" at fontSize 8
const LABEL_ROW_H = 14; // height of each label row

function evX(pct: number, bw: number): number {
  return LINE_PAD + (pct / 100) * (bw - 2 * LINE_PAD);
}

function SessionBlock({
  session,
  index,
  total,
  onOpenMap,
}: {
  session: Session;
  index: number;
  total: number;
  onOpenMap: (title: string, points: LocationPoint[], focus?: LocationPoint) => void;
}) {
  const taskStyle = TASK_COLORS[session.task] ?? { bg: "#F3F4F6", fg: "#374151" };
  const tlEvents = useMemo(() => buildTimelineEvents(session), [session]);

  // Pixel width of the bar — drives chip, shade, and dot positioning.
  const [barWidth, setBarWidth] = useState(0);

  // For each break: dot centers (px), chip left, shade span.
  const breakSegments = useMemo(() => {
    if (!barWidth || !session.lunchBreaks.length) return [];
    return session.lunchBreaks.map((lb, i) => {
      // Clock In is at index 0; each break pushes Lunch Out then Lunch In → break i at 1+i*2 and 2+i*2
      const outEv = tlEvents[1 + i * 2];
      const inEv  = tlEvents[2 + i * 2];
      if (!outEv || !inEv) return null;
      const loX = evX(outEv.pct, barWidth);
      const liX = evX(inEv.pct,  barWidth);
      const chipW = lb.minutes >= 100 ? 34 : lb.minutes >= 10 ? 28 : 22;
      const midX  = (loX + liX) / 2;
      const chipLeft = Math.max(LINE_PAD, Math.min(barWidth - chipW - LINE_PAD, midX - chipW / 2));
      const shadeLeft  = loX;
      const shadeWidth = Math.max(0, liX - loX);
      return { i, chipLeft, chipW, shadeLeft, shadeWidth, minutes: lb.minutes };
    }).filter(Boolean) as Array<{
      i: number; chipLeft: number; chipW: number;
      shadeLeft: number; shadeWidth: number; minutes: number;
    }>;
  }, [barWidth, tlEvents, session.lunchBreaks]);

  // Each label is centered exactly under its dot.
  // Adjacent events (consecutive indices) always alternate rows so they never
  // overlap even with 0-second breaks: even index → row 0, odd index → row 1.
  const labelLayout = useMemo(() =>
    tlEvents.map((ev, i) => {
      const cx = barWidth > 0
        ? (ev.isRight ? barWidth - DOT_R : evX(ev.pct, barWidth))
        : 0;
      const left = Math.max(0, Math.min(barWidth - LABEL_W, cx - LABEL_W / 2));
      return { left, row: i % 2 };
    }),
  [barWidth, tlEvents]);

  return (
    <View style={[styles.sessionBlock, total > 1 && styles.sessionBlockMulti]}>
      <View style={styles.jobRow}>
        <View style={styles.jobLeft}>
          <Briefcase size={11} color="#2563EB" />
          <Text style={styles.jobName} numberOfLines={1}>
            {session.jobName}
          </Text>
          {total > 1 && (
            <View style={styles.sessionBadge}>
              <Text style={styles.sessionBadgeText}>Session {index + 1}</Text>
            </View>
          )}
        </View>
        <View style={[styles.taskBadge, { backgroundColor: taskStyle.bg }]}>
          <Text style={[styles.taskBadgeText, { color: taskStyle.fg }]}>
            {session.task}
          </Text>
        </View>
      </View>

      <View style={styles.timelineTimes}>
        {tlEvents.map(ev => (
          <Text key={ev.label} style={styles.timelineTime}>{ev.time}</Text>
        ))}
      </View>

      {/* Timeline bar — line, amber shades, duration chips ON the line, and dots */}
      <View
        style={styles.timelineBar}
        onLayout={e => setBarWidth(e.nativeEvent.layout.width)}
      >
        <View style={styles.timelineLine} />
        {/* Amber highlight between each Lunch Out / Lunch In pair */}
        {breakSegments.map(seg => (
          <View
            key={`shade-${seg.i}`}
            style={[styles.lunchShade, { left: seg.shadeLeft, width: seg.shadeWidth }]}
          />
        ))}
        {/* Duration chips sit ON the line between their dot pair */}
        {breakSegments.map(seg => (
          <View
            key={`chip-${seg.i}`}
            style={[styles.lunchChip, { left: seg.chipLeft, width: seg.chipW }]}
          >
            <Text style={styles.lunchChipText} numberOfLines={1}>{seg.minutes}m</Text>
          </View>
        ))}
        {/* Dots — pixel-positioned so center aligns with proportional position */}
        {tlEvents.map(ev => (
          <View
            key={ev.label}
            style={[
              styles.timelineDot,
              ev.isRight
                ? { right: 0 }
                : { left: barWidth > 0 ? evX(ev.pct, barWidth) - DOT_R : `${ev.pct}%` as any },
              { backgroundColor: ev.color },
            ]}
          />
        ))}
      </View>

      <View style={styles.timelineLabels}>
        {barWidth > 0 && tlEvents.map((ev, idx) => {
          const { left, row } = labelLayout[idx];
          return (
            <Text
              key={ev.label}
              numberOfLines={1}
              style={[
                styles.timelineLabel,
                { position: "absolute", left, width: LABEL_W, top: row * LABEL_ROW_H },
                ev.italic ? { color: "#F59E0B", fontStyle: "italic" as const } : undefined,
              ]}
            >
              {ev.label}
            </Text>
          );
        })}
      </View>

      <MiniMap
        lunchCount={session.lunchBreaks.length}
        onPress={() =>
          onOpenMap(`${session.jobName} • ${session.task}`, session.locations)
        }
      />

      <View style={styles.locationsCol}>
        {session.locations.map((loc, i) => {
          const hasGps = loc.lat !== 0 || loc.lng !== 0;
          return (
            <TouchableOpacity
              key={`${loc.label}-${i}`}
              style={styles.locationRow}
              activeOpacity={hasGps ? 0.6 : 1}
              disabled={!hasGps}
              onPress={() =>
                onOpenMap(
                  `${loc.label} • ${session.jobName}`,
                  session.locations,
                  loc,
                )
              }
            >
              <MapPin size={12} color={loc.color} fill={hasGps ? loc.color : "none"} />
              <Text style={styles.locationTime}>{loc.time}</Text>
              <Text style={styles.locationLabel}>{loc.label}</Text>
              <Text
                style={[
                  styles.locationAddress,
                  !hasGps && { color: "#9CA3AF", fontStyle: "italic" as const },
                ]}
                numberOfLines={1}
              >
                {loc.address}
              </Text>
              {hasGps && <Navigation size={11} color="#2563EB" />}
            </TouchableOpacity>
          );
        })}
      </View>

      {!!session.note && (
        <View style={styles.noteRow}>
          <StickyNote size={12} color="#6B7280" />
          <Text style={styles.noteLabel}>Note:</Text>
          <Text style={styles.noteText} numberOfLines={2}>
            {session.note}
          </Text>
        </View>
      )}

      <View style={styles.sessionMiniFoot}>
        <Text style={styles.sessionMiniText}>
          <Text style={styles.footerLabel}>Net: </Text>
          <Text style={styles.footerValue}>
            {fmtHM(session.netH, session.netM)}
          </Text>
        </Text>
        <Text style={styles.sessionMiniText}>
          <Text style={styles.footerLabel}>Pay: </Text>
          <Text style={styles.footerPay}>${session.pay.toFixed(2)}</Text>
        </Text>
      </View>
    </View>
  );
}

// ─── DayCard ──────────────────────────────────────────────────────────────────
function DayCard({
  day,
  onOpenMap,
}: {
  day: DayEntry;
  onOpenMap: (
    title: string,
    points: LocationPoint[],
    focus?: LocationPoint,
  ) => void;
}) {
  return (
    <View style={styles.dayCard} testID={`day-card-${day.label}`}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayTitle}>
          {day.label}, {day.dateShort}
        </Text>
        {day.sessions.length > 1 && (
          <View style={styles.multiChip}>
            <Text style={styles.multiChipText}>{day.sessions.length} jobs</Text>
          </View>
        )}
      </View>

      {day.sessions.map((s, i) => (
        <SessionBlock
          key={`${s.jobName}-${i}`}
          session={s}
          index={i}
          total={day.sessions.length}
          onOpenMap={onOpenMap}
        />
      ))}

      <View style={styles.dayFooter}>
        <Text style={styles.footerItem}>
          <Text style={styles.footerLabel}>Gross: </Text>
          <Text style={styles.footerValue}>
            {fmtHM(day.grossH, day.grossM)}
          </Text>
        </Text>
        <Text style={styles.footerItem}>
          <Text style={styles.footerLabel}>Net: </Text>
          <Text style={styles.footerValue}>{fmtHM(day.netH, day.netM)}</Text>
        </Text>
        <Text style={styles.footerItem}>
          <Text style={styles.footerLabel}>Pay: </Text>
          <Text style={styles.footerPay}>${day.pay.toFixed(2)}</Text>
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function TimeCardsScreen() {
  const {
    employeeId,
    periodStart,
    periodMode: periodModeParam,
  } = useLocalSearchParams<{
    employeeId?: string;
    periodStart?: string;
    periodMode?: string;
  }>();
  const { companyUsers: users, projects } = useApp();
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;
  const isTablet = width >= 640;

  // Responsive layout values
  const hPad = isWide ? 40 : isTablet ? 24 : 16;
  const maxWidth = isWide ? 1480 : undefined;

  const employee = useMemo(
    () => users.find((u) => u.id === employeeId),
    [users, employeeId],
  );
  const displayName = employee?.name ?? "Employee";
  const rate = employee?.hourlyRate ?? 0;

  const scrollRef = React.useRef<any>(null);
  const [periodMode, setPeriodMode] = useState<PeriodMode>(
    (["Weekly", "Biweekly", "Monthly"].includes(periodModeParam ?? "")
      ? periodModeParam
      : "Biweekly") as PeriodMode,
  );
  const [selIdx, setSelIdx] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const [entries, setEntries] = useState<ClockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [addrTick, setAddrTick] = useState(0);

  const periods = useMemo(() => getPeriods(periodMode), [periodMode]);

  // If arriving from history screen with a periodStart param, find and select that period
  const didApplyParam = React.useRef(false);
  useEffect(() => {
    if (didApplyParam.current || !periodStart) return;
    const targetMs = new Date(periodStart).getTime();
    if (isNaN(targetMs)) return;
    const idx = periods.findIndex(
      (p) => Math.abs(p.start.getTime() - targetMs) < 60_000,
    );
    if (idx >= 0) {
      setSelIdx(idx);
      didApplyParam.current = true;
    }
  }, [periods, periodStart]);

  const period = periods[Math.min(selIdx, periods.length - 1)];

  const projName = useCallback(
    (id?: string) =>
      id ? (projects.find((p) => p.id === id)?.name ?? "") : "",
    [projects],
  );

  // Load entries from Supabase — called on mount, period change, and pull-to-refresh
  const loadEntries = useCallback(async (isRefresh = false) => {
    if (!employeeId || !period) return;
    isRefresh ? setRefreshing(true) : setLoading(true);
    const { data, error } = await supabase
      .from("clock_entries")
      .select("*")
      .eq("employee_id", employeeId)
      .gte("clock_in", period.start.toISOString())
      .lte("clock_in", period.end.toISOString())
      .order("clock_in", { ascending: true });
    setEntries(!error && data ? data.map(mapRow) : []);
    isRefresh ? setRefreshing(false) : setLoading(false);
  }, [employeeId, period]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const onRefresh = useCallback(() => loadEntries(true), [loadEntries]);

  // Start geocoding all locations; tick on batch completion to trigger re-render
  useEffect(() => {
    const locs: GeoPoint[] = [];
    entries.forEach((e) => {
      if (isValidLoc(e.location)) locs.push(e.location);
      if (isValidLoc(e.clockOutLocation)) locs.push(e.clockOutLocation!);
      e.lunchBreaks?.forEach((lb) => {
        if (isValidLoc(lb.startLocation)) locs.push(lb.startLocation!);
        if (isValidLoc(lb.endLocation)) locs.push(lb.endLocation!);
      });
    });
    if (!locs.length) return;
    let resolved = 0;
    locs.forEach((loc) => {
      reverseGeocode(loc.latitude, loc.longitude).then(() => {
        resolved++;
        if (resolved % 4 === 0 || resolved === locs.length) {
          setAddrTick((t) => t + 1);
        }
      });
    });
  }, [entries]);

  // Build days array for current period
  const days = useMemo(() => {
    if (!period) return [] as Date[];
    // end is always 23:59:59.999 so (end-start)/DAY_MS ≈ N-0.000001 — floor gives N-1, +1 = N
    const n =
      Math.floor((period.end.getTime() - period.start.getTime()) / DAY_MS) + 1;
    return Array.from(
      { length: n },
      (_, i) => new Date(period.start.getTime() + i * DAY_MS),
    );
  }, [period]);

  // Group entries by date key
  const byDay = useMemo(() => {
    const m = new Map<string, ClockEntry[]>();
    entries.forEach((e) => {
      const k = new Date(e.clockIn).toLocaleDateString("en-CA");
      m.set(k, [...(m.get(k) ?? []), e]);
    });
    return m;
  }, [entries]);

  // Build week sections (addrTick triggers re-build when geocoding resolves)
  const weekSections = useMemo((): WeekSection[] => {
    if (!days.length) return [];
    const f = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;

    const buildWeek = (
      wDays: Date[],
    ): { days: DayEntry[]; netHours: number; pay: number } => {
      const dayEntries: DayEntry[] = [];
      wDays.forEach((date) => {
        const k = date.toLocaleDateString("en-CA");
        const es = byDay.get(k) ?? [];
        if (es.length > 0)
          dayEntries.push(buildDayEntry(date, es, projName, rate));
      });
      const netMin = dayEntries.reduce((a, d) => a + d.netH * 60 + d.netM, 0);
      const pay = dayEntries.reduce((a, d) => a + d.pay, 0);
      return { days: dayEntries, netHours: netMin / 60, pay };
    };

    if (periodMode === "Weekly") {
      const range = `${f(days[0])} – ${f(days[days.length - 1])}, ${days[days.length - 1].getFullYear()}`;
      return [{ label: "WEEK 1", range, ...buildWeek(days) }];
    }

    if (periodMode === "Biweekly") {
      const w1 = days.slice(0, 7),
        w2 = days.slice(7);
      const r1 = `${f(w1[0])} – ${f(w1[w1.length - 1])}, ${w1[w1.length - 1].getFullYear()}`;
      const r2 = `${f(w2[0])} – ${f(w2[w2.length - 1])}, ${w2[w2.length - 1].getFullYear()}`;
      return [
        { label: "WEEK 1", range: r1, ...buildWeek(w1) },
        { label: "WEEK 2", range: r2, ...buildWeek(w2) },
      ];
    }

    // Monthly — split into Mon→Sun calendar weeks
    const sections: WeekSection[] = [];
    let week: Date[] = [];
    let weekNum = 1;
    days.forEach((d, i) => {
      week.push(d);
      if (d.getDay() === 0 || i === days.length - 1) {
        const range = `${f(week[0])} – ${f(week[week.length - 1])}`;
        sections.push({ label: `WEEK ${weekNum}`, range, ...buildWeek(week) });
        week = [];
        weekNum++;
      }
    });
    return sections;
  }, [days, byDay, projName, rate, addrTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => {
    const allDays = weekSections.flatMap((s) => s.days);
    const netMin = allDays.reduce((a, d) => a + d.netH * 60 + d.netM, 0);
    const grossMin = allDays.reduce((a, d) => a + d.grossH * 60 + d.grossM, 0);
    const lunchMin = allDays.reduce((a, d) => a + d.lunchMinutes, 0);
    const pay = allDays.reduce((a, d) => a + d.pay, 0);
    const sessions = allDays.reduce((a, d) => a + d.sessions.length, 0);
    return {
      netHours: netMin / 60,
      grossStr: `${Math.floor(grossMin / 60)}:${(grossMin % 60).toString().padStart(2, "0")}h`,
      lunchStr: `${Math.floor(lunchMin / 60)}:${(lunchMin % 60).toString().padStart(2, "0")}h`,
      totalPay: pay,
      sessions,
    };
  }, [weekSections]);

  // History (last 3 previous periods) — include the period index so View can load it
  const history = useMemo(() => {
    return periods.slice(1, 4).map((p, i) => ({
      label: p.label,
      hours: "—",
      pay: "—",
      periodIndex: i + 1,
    }));
  }, [periods]);

  // ── Map modal ───────────────────────────────────────────────────────────────
  const [mapModal, setMapModal] = useState<{
    title: string;
    points: LocationPoint[];
    focus?: LocationPoint;
  } | null>(null);
  const openMap = useCallback(
    (title: string, points: LocationPoint[], focus?: LocationPoint) =>
      setMapModal({ title, points, focus }),
    [],
  );
  const closeMap = useCallback(() => setMapModal(null), []);
  const openExternalMaps = useCallback((p: LocationPoint) => {
    const q = encodeURIComponent(p.address);
    const url = Platform.select({
      ios: `http://maps.apple.com/?q=${q}&ll=${p.lat},${p.lng}`,
      android: `geo:${p.lat},${p.lng}?q=${q}`,
      default: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`,
    }) as string;
    Linking.openURL(url).catch(console.error);
  }, []);

  // ── Excel export ────────────────────────────────────────────────────────────
  const exportToExcel = useCallback(async () => {
    setExporting(true);
    try {
      const XLSX: any = XLSXJsStyle;
      const wb = XLSX.utils.book_new();

      const NAVY = "1E3A8A";
      const NAVY_DARK = "0F1E4D";
      const LIGHT_BLUE = "EAF2FF";
      const ROW_ALT = "F8FAFC";
      const BORDER = "E5E7EB";
      const WHITE = "FFFFFF";
      const GREEN = "10B981";
      const ORANGE = "F59E0B";
      const PURPLE = "7C3AED";
      const TEXT = "0F172A";
      const MUTED = "6B7280";

      const thinBorder = {
        top: { style: "thin" as const, color: { rgb: BORDER } },
        bottom: { style: "thin" as const, color: { rgb: BORDER } },
        left: { style: "thin" as const, color: { rgb: BORDER } },
        right: { style: "thin" as const, color: { rgb: BORDER } },
      };

      const TASK_BG: Record<TaskTag, string> = {
        Painting: "DBEAFE",
        Drywall: "E0E7FF",
        Framing: "F3E8FF",
        Flooring: "FFEDD5",
        Cleaning: "DCFCE7",
      };
      const TASK_FG: Record<TaskTag, string> = {
        Painting: "1D4ED8",
        Drywall: "4338CA",
        Framing: "7C3AED",
        Flooring: "C2410C",
        Cleaning: "15803D",
      };

      const aoa: (string | number)[][] = [];
      const styleMap: Record<string, any> = {};
      const merges: {
        s: { r: number; c: number };
        e: { r: number; c: number };
      }[] = [];
      const TOTAL_COLS = 15;

      const setCell = (r: number, c: number, style: any) => {
        styleMap[XLSX.utils.encode_cell({ r, c })] = style;
      };
      const setRange = (r: number, c1: number, c2: number, style: any) => {
        for (let c = c1; c <= c2; c++) setCell(r, c, style);
      };

      // Row 0: Title
      aoa.push(["TIME CARDS REPORT", ...Array(14).fill("")]);
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } });
      setRange(0, 0, TOTAL_COLS - 1, { fill: { fgColor: { rgb: WHITE } } });
      setCell(0, 0, {
        font: { bold: true, sz: 18, color: { rgb: NAVY } },
        alignment: { horizontal: "left", vertical: "center" },
      });

      // Row 1: Summary KPIs
      aoa.push([
        periodMode,
        "EMPLOYEE",
        displayName,
        "PAY RATE",
        rate > 0 ? `${rate.toFixed(2)} / hr` : "N/A",
        "PAY PERIOD",
        period.label,
        "TOTAL NET HOURS",
        `${totals.netHours.toFixed(2)} hrs`,
        "TOTAL LUNCH",
        totals.lunchStr,
        "TOTAL GROSS",
        totals.grossStr,
        "TOTAL PAY",
        rate > 0 ? `$${totals.totalPay.toFixed(2)}` : "N/A",
      ]);
      setCell(1, 0, {
        font: { sz: 11, color: { rgb: MUTED } },
        alignment: { horizontal: "left" },
      });
      const kpiPairs = [
        { lc: 1, vc: 2, lc_rgb: MUTED },
        { lc: 3, vc: 4, lc_rgb: MUTED },
        { lc: 5, vc: 6, lc_rgb: MUTED },
        { lc: 7, vc: 8, lc_rgb: MUTED, vc_rgb: NAVY, bold: true },
        { lc: 9, vc: 10, lc_rgb: MUTED, vc_rgb: ORANGE, bold: true },
        { lc: 11, vc: 12, lc_rgb: MUTED, vc_rgb: PURPLE, bold: true },
        { lc: 13, vc: 14, lc_rgb: MUTED, vc_rgb: GREEN, bold: true },
      ];
      for (const k of kpiPairs) {
        setCell(1, k.lc, {
          font: { sz: 9, bold: true, color: { rgb: k.lc_rgb } },
          alignment: { horizontal: "left", vertical: "center" },
        });
        setCell(1, k.vc, {
          font: {
            sz: 11,
            bold: !!k.bold,
            color: { rgb: (k as any).vc_rgb ?? TEXT },
          },
          alignment: { horizontal: "left", vertical: "center" },
        });
      }

      aoa.push([]); // spacer

      const weekHeaderRow = (label: string, range: string) => {
        const r = aoa.length;
        const row = Array(TOTAL_COLS).fill("") as string[];
        row[0] = `${label}  •  ${range}`;
        aoa.push(row);
        merges.push({ s: { r, c: 0 }, e: { r, c: TOTAL_COLS - 1 } });
        setRange(r, 0, TOTAL_COLS - 1, {
          fill: { fgColor: { rgb: NAVY } },
          font: { bold: true, color: { rgb: WHITE }, sz: 12 },
          alignment: { horizontal: "left", vertical: "center" },
          border: thinBorder,
        });
      };

      const tableHeaderRow = () => {
        const r = aoa.length;
        aoa.push([
          "Day",
          "Date",
          "Job",
          "Task",
          "Clock In",
          "Lunch Out",
          "Lunch In",
          "Clock Out",
          "Lunch",
          "Gross",
          "",
          "Net",
          "",
          "Pay",
          "Notes",
        ]);
        merges.push({ s: { r, c: 9 }, e: { r, c: 10 } });
        merges.push({ s: { r, c: 11 }, e: { r, c: 12 } });
        setRange(r, 0, TOTAL_COLS - 1, {
          fill: { fgColor: { rgb: NAVY_DARK } },
          font: { bold: true, color: { rgb: WHITE }, sz: 10 },
          alignment: {
            horizontal: "center",
            vertical: "center",
            wrapText: true,
          },
          border: thinBorder,
        });
        const r2 = aoa.length;
        const sub = Array(TOTAL_COLS).fill("") as string[];
        sub[9] = "Hrs";
        sub[10] = "Min";
        sub[11] = "Hrs";
        sub[12] = "Min";
        aoa.push(sub);
        setRange(r2, 0, TOTAL_COLS - 1, {
          fill: { fgColor: { rgb: NAVY_DARK } },
          font: { bold: true, color: { rgb: WHITE }, sz: 9 },
          alignment: { horizontal: "center", vertical: "center" },
          border: thinBorder,
        });
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 13, 14].forEach((col) =>
          merges.push({ s: { r, c: col }, e: { r: r2, c: col } }),
        );
      };

      const sessionRow = (
        d: DayEntry,
        s: Session,
        si: number,
        total: number,
        alt: boolean,
      ) => {
        const r = aoa.length;
        const bg = alt ? ROW_ALT : WHITE;
        const tBg = (TASK_BG as any)[s.task] ?? "F3F4F6";
        const tFg = (TASK_FG as any)[s.task] ?? "374151";
        const lunchOutStr = s.lunchBreaks.length === 0 ? "—"
          : s.lunchBreaks.map(lb => lb.out).join("\n");
        const lunchInStr = s.lunchBreaks.length === 0 ? "—"
          : s.lunchBreaks.map(lb => lb.in).join("\n");
        aoa.push([
          si === 0 ? d.label.charAt(0) + d.label.slice(1).toLowerCase() : "",
          si === 0 ? d.date : "",
          s.jobName + (total > 1 ? ` (#${si + 1})` : ""),
          s.task,
          s.clockIn,
          lunchOutStr,
          lunchInStr,
          s.clockOut,
          `0:${s.lunchMinutes.toString().padStart(2, "0")}`,
          s.grossH,
          s.grossM.toString().padStart(2, "0"),
          s.netH,
          s.netM.toString().padStart(2, "0"),
          rate > 0 ? `$${s.pay.toFixed(2)}` : "—",
          s.note,
        ]);
        setRange(r, 0, TOTAL_COLS - 1, {
          fill: { fgColor: { rgb: bg } },
          font: { sz: 10, color: { rgb: TEXT } },
          alignment: { horizontal: "center", vertical: "center" },
          border: thinBorder,
        });
        setCell(r, 0, {
          fill: { fgColor: { rgb: bg } },
          font: { sz: 10, bold: true, color: { rgb: TEXT } },
          alignment: { horizontal: "center", vertical: "center" },
          border: thinBorder,
        });
        setCell(r, 2, {
          fill: { fgColor: { rgb: bg } },
          font: { sz: 10, bold: true, color: { rgb: NAVY } },
          alignment: { horizontal: "left", vertical: "center" },
          border: thinBorder,
        });
        setCell(r, 3, {
          fill: { fgColor: { rgb: tBg } },
          font: { sz: 10, bold: true, color: { rgb: tFg } },
          alignment: { horizontal: "center", vertical: "center" },
          border: thinBorder,
        });
        setCell(r, 13, {
          fill: { fgColor: { rgb: bg } },
          font: { sz: 10, bold: true, color: { rgb: GREEN } },
          alignment: { horizontal: "center", vertical: "center" },
          border: thinBorder,
        });
        setCell(r, 14, {
          fill: { fgColor: { rgb: bg } },
          font: { sz: 10, color: { rgb: TEXT } },
          alignment: { horizontal: "left", vertical: "center", wrapText: true },
          border: thinBorder,
        });
      };

      const weekTotalsRow = (label: string, wDays: DayEntry[]) => {
        const r = aoa.length;
        const lunchMin = wDays.reduce((a, d) => a + d.lunchMinutes, 0);
        const grossMin = wDays.reduce(
          (a, d) => a + d.grossH * 60 + d.grossM,
          0,
        );
        const netMin = wDays.reduce((a, d) => a + d.netH * 60 + d.netM, 0);
        const pay = wDays.reduce((a, d) => a + d.pay, 0);
        const row = Array(TOTAL_COLS).fill("") as (string | number)[];
        row[0] = label;
        row[8] = `${Math.floor(lunchMin / 60)}:${(lunchMin % 60).toString().padStart(2, "0")}`;
        row[9] = Math.floor(grossMin / 60);
        row[10] = (grossMin % 60).toString().padStart(2, "0");
        row[11] = Math.floor(netMin / 60);
        row[12] = (netMin % 60).toString().padStart(2, "0");
        row[13] = rate > 0 ? `$${pay.toFixed(2)}` : "—";
        aoa.push(row);
        setRange(r, 0, TOTAL_COLS - 1, {
          fill: { fgColor: { rgb: LIGHT_BLUE } },
          font: { bold: true, sz: 10, color: { rgb: NAVY } },
          alignment: { horizontal: "center", vertical: "center" },
          border: thinBorder,
        });
        setCell(r, 0, {
          fill: { fgColor: { rgb: LIGHT_BLUE } },
          font: { bold: true, sz: 10, color: { rgb: NAVY } },
          alignment: { horizontal: "left", vertical: "center" },
          border: thinBorder,
        });
        setCell(r, 13, {
          fill: { fgColor: { rgb: LIGHT_BLUE } },
          font: { bold: true, sz: 10, color: { rgb: GREEN } },
          alignment: { horizontal: "center", vertical: "center" },
          border: thinBorder,
        });
        merges.push({ s: { r, c: 0 }, e: { r, c: 7 } });
      };

      weekSections.forEach((sec, i) => {
        if (i > 0) aoa.push([]);
        weekHeaderRow(sec.label, sec.range);
        tableHeaderRow();
        let alt = false;
        sec.days.forEach((d) => {
          d.sessions.forEach((s, si) =>
            sessionRow(d, s, si, d.sessions.length, alt),
          );
          alt = !alt;
        });
        weekTotalsRow(`${sec.label} TOTALS`, sec.days);
      });

      aoa.push([]);

      // Period totals row
      const ptR = aoa.length;
      const ptRow = Array(TOTAL_COLS).fill("") as string[];
      ptRow[0] = `PAY PERIOD TOTALS   (${period.label})`;
      ptRow[5] = "Total Net";
      ptRow[6] = `${totals.netHours.toFixed(2)}h`;
      ptRow[7] = "Total Lunch";
      ptRow[8] = totals.lunchStr;
      ptRow[9] = "Total Gross";
      ptRow[10] = totals.grossStr;
      ptRow[11] = "Total Pay";
      ptRow[12] = rate > 0 ? `$${totals.totalPay.toFixed(2)}` : "N/A";
      aoa.push(ptRow);
      merges.push({ s: { r: ptR, c: 0 }, e: { r: ptR, c: 4 } });
      setRange(ptR, 0, TOTAL_COLS - 1, {
        fill: { fgColor: { rgb: "ECFDF5" } },
        font: { sz: 10, color: { rgb: TEXT } },
        alignment: { horizontal: "left", vertical: "center" },
        border: thinBorder,
      });
      setCell(ptR, 0, {
        fill: { fgColor: { rgb: "ECFDF5" } },
        font: { bold: true, sz: 13, color: { rgb: GREEN } },
        alignment: { horizontal: "left", vertical: "center" },
        border: thinBorder,
      });
      [5, 7, 9, 11].forEach((c) =>
        setCell(ptR, c, {
          fill: { fgColor: { rgb: "ECFDF5" } },
          font: { bold: true, sz: 9, color: { rgb: MUTED } },
          alignment: { horizontal: "right", vertical: "center" },
          border: thinBorder,
        }),
      );
      setCell(ptR, 6, {
        fill: { fgColor: { rgb: "ECFDF5" } },
        font: { bold: true, sz: 12, color: { rgb: NAVY } },
        alignment: { horizontal: "left", vertical: "center" },
        border: thinBorder,
      });
      setCell(ptR, 8, {
        fill: { fgColor: { rgb: "ECFDF5" } },
        font: { bold: true, sz: 12, color: { rgb: ORANGE } },
        alignment: { horizontal: "left", vertical: "center" },
        border: thinBorder,
      });
      setCell(ptR, 10, {
        fill: { fgColor: { rgb: "ECFDF5" } },
        font: { bold: true, sz: 12, color: { rgb: PURPLE } },
        alignment: { horizontal: "left", vertical: "center" },
        border: thinBorder,
      });
      setCell(ptR, 12, {
        fill: { fgColor: { rgb: "ECFDF5" } },
        font: { bold: true, sz: 13, color: { rgb: GREEN } },
        alignment: { horizontal: "left", vertical: "center" },
        border: thinBorder,
      });

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!merges"] = merges;
      ws["!cols"] = [
        { wch: 8 },
        { wch: 11 },
        { wch: 26 },
        { wch: 12 },
        { wch: 11 },
        { wch: 11 },
        { wch: 11 },
        { wch: 11 },
        { wch: 9 },
        { wch: 7 },
        { wch: 7 },
        { wch: 7 },
        { wch: 7 },
        { wch: 11 },
        { wch: 42 },
      ];
      ws["!rows"] = aoa.map((_, i) => ({
        hpt: i === 0 ? 28 : i === 1 ? 30 : 20,
      }));

      Object.keys(styleMap).forEach((ref) => {
        if (ws[ref]) (ws[ref] as any).s = styleMap[ref];
        else ws[ref] = { t: "s", v: "", s: styleMap[ref] } as any;
      });

      XLSX.utils.book_append_sheet(wb, ws, "Time Cards");

      // Locations sheet
      const locAoa: (string | number)[][] = [
        ["Date", "Job", "Event", "Time", "Address", "Latitude", "Longitude"],
      ];
      weekSections.forEach((sec) =>
        sec.days.forEach((d) =>
          d.sessions.forEach((s) =>
            s.locations.forEach((loc) =>
              locAoa.push([
                d.date,
                s.jobName,
                loc.label,
                loc.time,
                loc.address,
                loc.lat,
                loc.lng,
              ]),
            ),
          ),
        ),
      );
      const wsLoc = XLSX.utils.aoa_to_sheet(locAoa);
      wsLoc["!cols"] = [
        { wch: 12 },
        { wch: 26 },
        { wch: 12 },
        { wch: 11 },
        { wch: 42 },
        { wch: 12 },
        { wch: 12 },
      ];
      for (let c = 0; c < 7; c++) {
        const ref = XLSX.utils.encode_cell({ r: 0, c });
        if (wsLoc[ref])
          (wsLoc[ref] as any).s = {
            fill: { fgColor: { rgb: NAVY } },
            font: { bold: true, color: { rgb: WHITE }, sz: 11 },
            alignment: { horizontal: "center", vertical: "center" },
            border: thinBorder,
          };
      }
      for (let r = 1; r < locAoa.length; r++) {
        const bg = r % 2 === 0 ? ROW_ALT : WHITE;
        for (let c = 0; c < 7; c++) {
          const ref = XLSX.utils.encode_cell({ r, c });
          if (wsLoc[ref])
            (wsLoc[ref] as any).s = {
              fill: { fgColor: { rgb: bg } },
              font: { sz: 10, color: { rgb: TEXT } },
              alignment: { horizontal: "left", vertical: "center" },
              border: thinBorder,
            };
        }
      }
      XLSX.utils.book_append_sheet(wb, wsLoc, "Locations");

      const safeName = displayName.replace(/\s+/g, "");
      const pStart = `${MONTHS[period.start.getMonth()]}${period.start.getDate()}`;
      const pEnd = `${MONTHS[period.end.getMonth()]}${period.end.getDate()}`;
      const fileName = `TimeCards_${safeName}_${pStart}_${pEnd}_${period.end.getFullYear()}.xlsx`;
      const mime =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      if (Platform.OS === "web") {
        const buf = XLSX.write(wb, {
          bookType: "xlsx",
          type: "array",
        }) as ArrayBuffer;
        const url = URL.createObjectURL(new Blob([buf], { type: mime }));
        const a = document.createElement("a");
        a.style.cssText = "position:fixed;top:-9999px;left:-9999px";
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 2000);
      } else {
        const b64 = XLSX.write(wb, {
          bookType: "xlsx",
          type: "base64",
        }) as string;
        const uri = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(uri, b64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: mime,
            dialogTitle: "Export Time Cards",
            UTI: "com.microsoft.excel.xlsx",
          });
        } else {
          Alert.alert("Saved", fileName);
        }
      }
    } catch (e: any) {
      console.error("[TimeCards] Export failed", e);
      Alert.alert("Export failed", e?.message ?? "Unknown error");
    } finally {
      setExporting(false);
    }
  }, [displayName, rate, totals, period, periodMode, weekSections]);

  // ── PDF export ──────────────────────────────────────────────────────────────
  const buildPdfHtml = useCallback(() => {
    const renderSession = (s: Session, idx: number, total: number): string => {
      const taskBg = TASK_COLORS[s.task]?.bg ?? "#F3F4F6";
      const taskFg = TASK_COLORS[s.task]?.fg ?? "#374151";
      const spanMs = (s.clockOutMs || Date.now()) - s.clockInMs;
      const pctOf = (ms: number) =>
        spanMs > 0 ? Math.min(95, Math.max(2, ((ms - s.clockInMs) / spanMs) * 100)).toFixed(1) : "50";

      // Build dynamic timeline events
      const tlEvents: Array<{ label: string; time: string; color: string; pos: string }> = [];
      tlEvents.push({ label: "Clock In", time: s.clockIn, color: "#10B981", pos: "left:0%" });
      s.lunchBreaks.forEach((lb) => {
        tlEvents.push({ label: "Lunch Out", time: lb.out, color: "#F59E0B", pos: `left:${pctOf(lb.outMs)}%` });
        tlEvents.push({ label: "Lunch In", time: lb.in, color: "#F59E0B", pos: `left:${pctOf(lb.inMs)}%` });
      });
      tlEvents.push({ label: "Clock Out", time: s.clockOut, color: "#EF4444", pos: "right:0" });

      const times  = tlEvents.map(ev => `<span>${ev.time}</span>`).join("");
      const labels = tlEvents.map(ev => `<span>${ev.label}</span>`).join("");
      const dots   = tlEvents.map(ev =>
        `<div class="tl-dot" style="${ev.pos};background:${ev.color}"></div>`
      ).join("\n");

      // Chips row above the bar — centered at each break's midpoint, always visible.
      // Amber shade on the line segment between each LO/LI pair.
      const chipsRow = s.lunchBreaks.length > 0
        ? `<div class="tl-chips">${s.lunchBreaks.map(lb => {
            const outP = parseFloat(pctOf(lb.outMs));
            const inP  = parseFloat(pctOf(lb.inMs));
            const midP = (outP + inP) / 2;
            return `<div class="lunch-chip" style="left:${midP}%;transform:translateX(-50%)">${lb.minutes}m</div>`;
          }).join("")}</div>`
        : "";
      const shades = s.lunchBreaks.map(lb => {
        const outP = parseFloat(pctOf(lb.outMs));
        const inP  = parseFloat(pctOf(lb.inMs));
        return `<div class="tl-shade" style="left:${outP}%;right:${(100 - inP).toFixed(1)}%"></div>`;
      }).join("");

      // Mini-map amber pins — proportional, capped at 2 pairs for visual
      const breakPins = s.lunchBreaks.slice(0, 2).flatMap((lb, i) => {
        const base = s.lunchBreaks.length === 1 ? 36 : 20 + i * 30;
        return [
          `<div class="mp" style="left:${base}%;background:#F59E0B"></div>`,
          `<div class="mp" style="left:${base + 14}%;background:#F59E0B"></div>`,
        ];
      }).join("");

      const locs = s.locations.map(loc => `
        <div class="loc-row">
          <span class="loc-dot" style="background:${loc.color}"></span>
          <span class="loc-time">${loc.time}</span>
          <span class="loc-label">${loc.label}</span>
          <span class="loc-addr">${loc.address}</span>
        </div>`).join("");

      return `
      <div class="session ${total > 1 ? "session-multi" : ""}">
        <div class="job-row">
          <div class="job-left">
            <span class="job-name">${s.jobName}</span>
            ${total > 1 ? `<span class="session-badge">Session ${idx + 1}</span>` : ""}
          </div>
          <div class="task-badge" style="background:${taskBg};color:${taskFg}">${s.task}</div>
        </div>
        <div class="tl-times">${times}</div>
        ${chipsRow}
        <div class="tl-bar"><div class="tl-line"></div>${shades}${dots}</div>
        <div class="tl-labels">${labels}</div>
        <div class="mini-map">
          <div class="mb" style="background:#E0F2FE;left:0;width:35%"></div>
          <div class="mb" style="background:#ECFCCB;left:35%;width:30%"></div>
          <div class="mb" style="background:#E0F2FE;left:65%;width:35%"></div>
          <div class="mp" style="left:6%;background:#10B981"></div>
          ${breakPins}
          <div class="mp" style="left:88%;background:#EF4444"></div>
        </div>
        <div class="locs">${locs}</div>
        ${s.note ? `<div class="note"><b>Note:</b> ${s.note}</div>` : ""}
        <div class="session-foot">
          <span><span class="lbl">Net: </span><b>${fmtHM(s.netH, s.netM)}</b></span>
          <span><span class="lbl">Pay: </span><b class="pay">${rate > 0 ? `$${s.pay.toFixed(2)}` : "—"}</b></span>
        </div>
      </div>`;
    };

    const renderDay = (d: DayEntry): string => `
      <div class="day-card">
        <div class="day-head">
          <div class="day-title">${d.label}, ${d.dateShort}</div>
          ${d.sessions.length > 1 ? `<div class="multi-chip">${d.sessions.length} jobs</div>` : ""}
        </div>
        ${d.sessions.map((s, i) => renderSession(s, i, d.sessions.length)).join("")}
        <div class="day-foot">
          <span><span class="lbl">Gross: </span><b>${fmtHM(d.grossH, d.grossM)}</b></span>
          <span><span class="lbl">Net: </span><b>${fmtHM(d.netH, d.netM)}</b></span>
          <span><span class="lbl">Pay: </span><b class="pay">${rate > 0 ? `$${d.pay.toFixed(2)}` : "—"}</b></span>
        </div>
      </div>`;

    const renderWeek = (sec: WeekSection): string => `
      <div class="week-head">
        <div><span class="wk-label">${sec.label}</span> &nbsp;•&nbsp; ${sec.range}</div>
        <div class="wk-totals">
          <span class="muted">Net Hours:</span> <b>${sec.netHours.toFixed(2)}h</b>
          &nbsp;&nbsp;<span class="muted">Total Pay:</span> <b class="pay">${rate > 0 ? `$${sec.pay.toFixed(2)}` : "—"}</b>
        </div>
      </div>
      <div class="days-grid">${sec.days.map(renderDay).join("")}</div>`;

    return `<!doctype html><html><head><meta charset="utf-8"/>
    <style>
      @page { size: A4 landscape; margin: 14mm; }
      * { box-sizing: border-box; }
      body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0F172A; margin: 0; background: #fff; }
      .top { display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; }
      .title { font-size: 22px; font-weight: 800; }
      .period { font-size: 12px; color:#374151; border:1px solid #E5E7EB; padding:6px 10px; border-radius:8px; }
      .summary { display:flex; gap: 18px; align-items:center; padding:12px 14px; border:1px solid #E5E7EB; border-radius:12px; margin-bottom:14px; }
      .avatar { width:38px; height:38px; border-radius:50%; background:#DBEAFE; color:#2563EB; font-weight:800; font-size:16px; display:flex; align-items:center; justify-content:center; }
      .sname { font-size: 14px; font-weight:700; }
      .srate { font-size: 11px; color:#6B7280; }
      .stat { text-align:center; min-width: 90px; }
      .sv { font-size: 15px; font-weight:800; }
      .sl { font-size: 10px; color:#6B7280; }
      .green { color:#10B981; }
      .muted { color:#6B7280; }
      .week-head { display:flex; justify-content:space-between; align-items:center; margin: 10px 0 6px; font-size:12px; color:#374151; }
      .wk-label { font-weight:800; letter-spacing:.5px; color:#0F172A; }
      .wk-totals { font-size:12px; }
      .days-grid { display:grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
      .day-card { border:1px solid #E5E7EB; border-radius:10px; padding:8px; page-break-inside: avoid; }
      .day-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
      .day-title { font-size: 11px; font-weight:800; }
      .multi-chip { font-size:8px; font-weight:700; color:#2563EB; background:#DBEAFE; padding:2px 6px; border-radius:999px; }
      .session { padding: 4px 0; }
      .session-multi { border-top: 1px dashed #E5E7EB; padding-top: 6px; margin-top: 4px; }
      .session:first-of-type.session-multi { border-top:0; padding-top:0; margin-top:0; }
      .job-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:6px; }
      .job-left { display:flex; align-items:center; gap:4px; flex:1; min-width:0; }
      .job-name { font-size: 10px; font-weight:700; color:#1E3A8A; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .session-badge { font-size:8px; color:#6B7280; background:#F3F4F6; padding:1px 5px; border-radius:4px; font-weight:600; }
      .task-badge { font-size:9px; font-weight:700; padding:2px 6px; border-radius:999px; }
      .tl-times { display:flex; justify-content:space-between; font-size:8px; color:#374151; margin-bottom:2px; }
      .tl-times span { flex:1; text-align:center; }
      .tl-bar { position:relative; height:14px; margin: 2px 0; }
      .tl-line { position:absolute; left:4px; right:4px; top:50%; height:2px; background:#E5E7EB; }
      .tl-dot { position:absolute; width:8px; height:8px; border-radius:50%; top:50%; margin-top:-4px; }
      .tl-chips { position:relative; height:14px; margin-bottom:1px; }
      .lunch-chip { position:absolute; height:12px; top:1px; border-radius:4px; background:#FEF3C7; border:1px solid #FCD34D; color:#92400E; font-size:7px; font-weight:700; display:flex; align-items:center; justify-content:center; padding:0 4px; white-space:nowrap; min-width:20px; }
      .tl-shade { position:absolute; height:2px; top:50%; background:#FCD34D; }
      .tl-labels { display:flex; justify-content:space-between; font-size:8px; color:#9CA3AF; margin-bottom:6px; }
      .tl-labels span { flex:1; text-align:center; }
      .mini-map { position:relative; height:30px; border-radius:6px; overflow:hidden; margin-bottom:6px; background:#F3F4F6; }
      .mb { position:absolute; top:0; bottom:0; }
      .mp { position:absolute; top:45%; width:8px; height:8px; border-radius:50%; margin-top:-4px; border:2px solid #FFFFFF; }
      .locs { margin-bottom: 6px; }
      .loc-row { display:flex; gap:5px; align-items:center; font-size:8.5px; margin-bottom:1px; }
      .loc-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
      .loc-time { color:#6B7280; width:42px; }
      .loc-label { color:#0F172A; font-weight:600; width:52px; }
      .loc-addr { color:#6B7280; flex:1; overflow:hidden; }
      .note { background:#F9FAFB; border-radius:5px; padding:5px 6px; font-size:9px; color:#4B5563; margin-bottom:6px; }
      .note b { color:#374151; }
      .session-foot { display:flex; justify-content:space-between; font-size:9px; padding:2px 0; color:#374151; }
      .day-foot { display:flex; justify-content:space-between; font-size:10px; padding-top:5px; border-top:1px solid #E5E7EB; margin-top:4px; }
      .day-foot .lbl, .session-foot .lbl { color:#6B7280; }
      .day-foot b, .session-foot b { color:#0F172A; }
      .day-foot .pay, .session-foot .pay { color:#10B981; }
      .pay-totals { margin-top: 14px; padding:12px 14px; border:1px solid #E5E7EB; border-radius:12px; display:flex; gap:18px; align-items:center; justify-content:space-between; page-break-inside: avoid; }
      .pt-title { font-size: 12px; font-weight:800; letter-spacing:.5px; }
      .pt-sub { font-size: 11px; color:#6B7280; }
    </style></head><body>
      <div class="top">
        <div class="title">Time Cards</div>
        <div class="period">${period.label} (${periodMode})</div>
      </div>
      <div class="summary">
        <div class="avatar">${displayName.charAt(0)}</div>
        <div>
          <div class="sname">${displayName}</div>
          <div class="srate">${rate > 0 ? `$${rate.toFixed(2)}/hr` : "Rate N/A"}</div>
        </div>
        <div class="stat"><div class="sv">${totals.netHours.toFixed(2)}h</div><div class="sl">Total Net Hours</div></div>
        <div class="stat"><div class="sv green">${rate > 0 ? `$${totals.totalPay.toFixed(2)}` : "—"}</div><div class="sl">Total Pay</div></div>
        <div class="stat"><div class="sv">${totals.sessions}</div><div class="sl">Total Sessions</div></div>
      </div>
      ${weekSections.map(renderWeek).join("")}
      <div class="pay-totals">
        <div>
          <div class="pt-title">PAY PERIOD TOTALS</div>
          <div class="pt-sub">${period.label} (${periodMode})</div>
        </div>
        <div class="stat"><div class="sv">${totals.netHours.toFixed(2)}h</div><div class="sl">Total Net Hours</div></div>
        <div class="stat"><div class="sv">${totals.lunchStr}</div><div class="sl">Total Lunch Time</div></div>
        <div class="stat"><div class="sv">${totals.grossStr}</div><div class="sl">Total Gross Hours</div></div>
        <div class="stat"><div class="sv green">${rate > 0 ? `$${totals.totalPay.toFixed(2)}` : "—"}</div><div class="sl">Total Pay</div></div>
      </div>
    </body></html>`;
  }, [displayName, rate, totals, period, periodMode, weekSections]);

  const exportToPdf = useCallback(async () => {
    setExportingPdf(true);
    try {
      const html = buildPdfHtml();
      const safeName = displayName.replace(/\s+/g, "");
      const pStart = `${MONTHS[period.start.getMonth()]}${period.start.getDate()}`;
      const pEnd = `${MONTHS[period.end.getMonth()]}${period.end.getDate()}`;
      const fileName = `TimeCards_${safeName}_${pStart}_${pEnd}_${period.end.getFullYear()}.pdf`;

      if (Platform.OS === "web") {
        const w = window.open("", "_blank");
        if (!w) {
          Alert.alert("Popup blocked", "Please allow popups to export PDF.");
          return;
        }
        w.document.open();
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 400);
      } else {
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        const target = `${FileSystem.cacheDirectory}${fileName}`;
        try {
          await FileSystem.moveAsync({ from: uri, to: target });
        } catch {}
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(target, {
            mimeType: "application/pdf",
            dialogTitle: "Export PDF",
            UTI: "com.adobe.pdf",
          });
        } else {
          Alert.alert("Saved", fileName);
        }
      }
    } catch (e: any) {
      console.error("[TimeCards] PDF export failed", e);
      Alert.alert("PDF export failed", e?.message ?? "Unknown error");
    } finally {
      setExportingPdf(false);
    }
  }, [buildPdfHtml, displayName, period]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Time Cards",
          headerShown: true,
          headerBackTitle: "Back",
        }}
      />
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: hPad },
          maxWidth && { maxWidth, alignSelf: "center" as const, width: "100%" },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2563EB"
            colors={["#2563EB"]}
          />
        }
      >
        {/* Top row */}
        <View style={[styles.topRow, !isTablet && styles.topRowMobile]}>
          <View style={styles.topLeft}>
            <Text
              style={[styles.pageTitle, !isTablet && styles.pageTitleMobile]}
            >
              Time Cards
            </Text>
          </View>
          <View
            style={[styles.topControls, !isTablet && styles.topControlsMobile]}
          >
            <TouchableOpacity
              style={styles.periodPicker}
              onPress={() => setShowPicker((s) => !s)}
            >
              <Calendar size={14} color="#2563EB" />
              <Text style={styles.periodPickerDate} numberOfLines={1}>
                {period.label}
              </Text>
              <View style={styles.periodModeBadge}>
                <Text style={styles.periodModeBadgeText}>{periodMode}</Text>
              </View>
              <ChevronDown size={14} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportBtn, !isTablet && styles.exportBtnMobile]}
              onPress={exportToExcel}
              disabled={exporting}
              testID="export-excel"
            >
              <FileSpreadsheet size={16} color="#FFFFFF" />
              {isTablet && (
                <Text style={styles.exportBtnText}>
                  {exporting ? "Exporting…" : "Export to Excel"}
                </Text>
              )}
              {isTablet && <ChevronDown size={14} color="#FFFFFF" />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportPdfBtn, !isTablet && styles.exportBtnMobile]}
              onPress={exportToPdf}
              disabled={exportingPdf}
              testID="export-pdf"
            >
              <FileText size={16} color="#FFFFFF" />
              {isTablet && (
                <Text style={styles.exportBtnText}>
                  {exportingPdf ? "Exporting…" : "Export to PDF"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Period picker menu */}
        {showPicker && (
          <View style={styles.periodMenu}>
            {(["Weekly", "Biweekly", "Monthly"] as PeriodMode[]).map((mode) => {
              const isActive = periodMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.periodMenuItem, isActive && styles.periodMenuItemActive]}
                  onPress={() => {
                    setPeriodMode(mode);
                    setSelIdx(0);
                    setShowPicker(false);
                  }}
                >
                  <Text style={[styles.periodMenuText, isActive && styles.periodMenuTextActive]}>
                    {mode}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Past period banner */}
        {selIdx > 0 && (
          <View style={styles.pastBanner}>
            <History size={13} color="#92400E" />
            <Text style={styles.pastBannerText}>Viewing: {period.label}</Text>
            <TouchableOpacity
              onPress={() => {
                setSelIdx(0);
                scrollRef.current?.scrollTo({ y: 0, animated: true });
              }}
              style={styles.pastBannerBtn}
            >
              <Text style={styles.pastBannerBtnText}>Back to current</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Summary card */}
        <View
          style={[styles.summaryCard, !isTablet && styles.summaryCardMobile]}
        >
          {/* On mobile: avatar+name spans full row above stats */}
          <View
            style={[styles.summaryLeft, !isTablet && styles.summaryLeftMobile]}
          >
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{displayName.charAt(0)}</Text>
            </View>
            <View>
              <Text style={styles.summaryName}>{displayName}</Text>
              <Text style={styles.summaryRate}>
                {rate > 0 ? `$${rate.toFixed(2)}/hr` : "Rate N/A"}
              </Text>
            </View>
          </View>
          {/* Stats row - on mobile becomes a separate flex row that wraps */}
          <View
            style={[
              styles.summaryStatsRow,
              !isTablet && styles.summaryStatsRowMobile,
            ]}
          >
            <View
              style={[
                styles.summaryStat,
                !isTablet && styles.summaryStatMobile,
              ]}
            >
              <Text style={styles.summaryStatValue}>
                {totals.netHours.toFixed(2)}h
              </Text>
              <Text style={styles.summaryStatLabel}>Total Net Hours</Text>
            </View>
            <View
              style={[
                styles.summaryStat,
                !isTablet && styles.summaryStatMobile,
              ]}
            >
              <Text style={[styles.summaryStatValue, { color: "#10B981" }]}>
                {rate > 0 ? `$${totals.totalPay.toFixed(2)}` : "—"}
              </Text>
              <Text style={styles.summaryStatLabel}>Total Pay</Text>
            </View>
            <View
              style={[
                styles.summaryStat,
                !isTablet && styles.summaryStatMobile,
              ]}
            >
              <Text style={styles.summaryStatValue}>{totals.sessions}</Text>
              <Text style={styles.summaryStatLabel}>Total Sessions</Text>
            </View>
          </View>
          {isWide && (
            <>
              <View style={styles.rateBox}>
                <Text style={styles.rateBoxLabel}>Pay Rate</Text>
                <Text style={styles.rateBoxValue}>
                  {rate > 0 ? `$${rate.toFixed(2)}` : "N/A"}{" "}
                  <Text style={styles.rateBoxUnit}>/ hr</Text>
                </Text>
              </View>
              <View style={styles.historyBox}>
                <Text style={styles.historyBoxTitle}>
                  History ({periodMode})
                </Text>
                <TouchableOpacity
                  style={styles.viewAllBtn}
                  onPress={() =>
                    router.push(
                      `/admin/time-cards-history?employeeId=${employeeId}`,
                    )
                  }
                >
                  <History size={12} color="#6B7280" />
                  <Text style={styles.viewAllText}>View All History</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Loading state */}
        {loading && (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <Text style={{ color: "#6B7280", fontSize: 14 }}>
              Loading time cards…
            </Text>
          </View>
        )}

        {/* Week sections */}
        {!loading &&
          weekSections.map((sec, secIdx) => (
            <View key={sec.label}>
              <View style={styles.weekHeader}>
                <Text style={styles.weekTitle}>
                  <Text style={styles.weekLabel}>{sec.label}</Text>
                  {"  •  "}
                  {sec.range}
                </Text>
                <View style={styles.weekTotalsRow}>
                  <Text style={styles.weekTotalText}>
                    Net Hours:{" "}
                    <Text style={styles.weekTotalValue}>
                      {sec.netHours.toFixed(2)}h
                    </Text>
                  </Text>
                  <Text style={styles.weekTotalText}>
                    Total Pay:{" "}
                    <Text style={[styles.weekTotalValue, { color: "#10B981" }]}>
                      {rate > 0 ? `$${sec.pay.toFixed(2)}` : "—"}
                    </Text>
                  </Text>
                </View>
              </View>
              <View style={styles.daysRow}>
                {sec.days.length > 0 ? (
                  sec.days.map((d) => (
                    <DayCard
                      key={d.label + d.date}
                      day={d}
                      onOpenMap={openMap}
                    />
                  ))
                ) : (
                  <Text style={{ color: "#9CA3AF", fontSize: 13, padding: 12 }}>
                    No clock entries for this week.
                  </Text>
                )}
              </View>
            </View>
          ))}

        {/* No entries at all */}
        {!loading && weekSections.every((s) => s.days.length === 0) && (
          <View style={{ paddingVertical: 40, alignItems: "center", gap: 8 }}>
            <Clock size={32} color="#D1D5DB" />
            <Text style={{ color: "#9CA3AF", fontSize: 14 }}>
              No time entries for this period.
            </Text>
          </View>
        )}

        {/* Pay period totals */}
        {!loading && totals.sessions > 0 && (
          <View style={styles.payTotalsCard}>
            <View style={styles.payTotalsLeft}>
              <Text style={styles.payTotalsTitle}>PAY PERIOD TOTALS</Text>
              <Text style={styles.payTotalsSub}>
                {period.label} ({periodMode})
              </Text>
            </View>
            <View style={styles.payStat}>
              <Text style={styles.payStatValue}>
                {totals.netHours.toFixed(2)}h
              </Text>
              <Text style={styles.payStatLabel}>Total Net Hours</Text>
            </View>
            <View style={styles.payStat}>
              <Text style={styles.payStatValue}>{totals.lunchStr}</Text>
              <Text style={styles.payStatLabel}>Total Lunch Time</Text>
            </View>
            <View style={styles.payStat}>
              <Text style={styles.payStatValue}>{totals.grossStr}</Text>
              <Text style={styles.payStatLabel}>Total Gross Hours</Text>
            </View>
            <View style={styles.payStat}>
              <Text style={[styles.payStatValue, { color: "#10B981" }]}>
                {rate > 0 ? `$${totals.totalPay.toFixed(2)}` : "—"}
              </Text>
              <Text style={styles.payStatLabel}>Total Pay</Text>
            </View>
            <TouchableOpacity
              style={styles.downloadReportBtn}
              onPress={exportToExcel}
            >
              <Download size={14} color="#374151" />
              <Text style={styles.downloadReportText}>
                View / Download Report
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* History panel */}
        <View style={styles.historyPanel}>
          <View style={styles.historyHeader}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <History size={16} color="#2563EB" />
              <Text style={styles.historyTitle}>History ({periodMode})</Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                router.push(
                  `/admin/time-cards-history?employeeId=${employeeId}`,
                )
              }
            >
              <Text style={styles.historyViewAll}>View All History</Text>
            </TouchableOpacity>
          </View>
          {history.map((h) => (
            <View
              key={h.periodIndex}
              style={[
                styles.historyItem,
                !isTablet && styles.historyItemMobile,
              ]}
            >
              <View style={styles.historyItemLabel}>
                <Text style={styles.historyLabel} numberOfLines={2}>
                  {h.label}
                </Text>
                <View style={styles.historyMeta}>
                  <Text style={styles.historyHours}>{h.hours}</Text>
                  <Text style={styles.historyPay}>{h.pay}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.historyBtn,
                  selIdx === h.periodIndex && styles.historyBtnActive,
                ]}
                onPress={() => {
                  setSelIdx(h.periodIndex);
                  setShowPicker(false);
                  scrollRef.current?.scrollTo({ y: 0, animated: true });
                }}
              >
                <Eye
                  size={14}
                  color={selIdx === h.periodIndex ? "#FFFFFF" : "#2563EB"}
                />
                <Text
                  style={[
                    styles.historyBtnText,
                    selIdx === h.periodIndex && { color: "#FFFFFF" },
                  ]}
                >
                  {selIdx === h.periodIndex ? "Viewing" : "View"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.historyBtn, styles.historyBtnDl]}
                onPress={exportToExcel}
              >
                <Download size={14} color="#FFFFFF" />
                <Text style={[styles.historyBtnText, { color: "#FFFFFF" }]}>
                  Download
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={styles.infoNote}>
          <Clock size={12} color="#6B7280" />
          <Text style={styles.infoNoteText}>
            All times are calculated after deducting unpaid lunch time. Multiple
            jobs on the same day are shown as separate sessions.
          </Text>
        </View>

        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>← Back to Employees</Text>
        </TouchableOpacity>
      </ScrollView>

      <LocationMapModal
        data={mapModal}
        onClose={closeMap}
        onOpenExternal={openExternalMaps}
      />
    </View>
  );
}

// ─── LocationMapModal ─────────────────────────────────────────────────────────
function LocationMapModal({
  data,
  onClose,
  onOpenExternal,
}: {
  data: {
    title: string;
    points: LocationPoint[];
    focus?: LocationPoint;
  } | null;
  onClose: () => void;
  onOpenExternal: (p: LocationPoint) => void;
}) {
  const visible = !!data;
  // Filter out placeholder (0,0) entries that have no real GPS fix
  const points = (data?.points ?? []).filter(p => p.lat !== 0 || p.lng !== 0);
  const focus = (data?.focus && (data.focus.lat !== 0 || data.focus.lng !== 0))
    ? data.focus
    : points[0];

  const region = useMemo(() => {
    if (!points.length)
      return {
        latitude: 47.3073,
        longitude: -122.2285,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    const lats = points.map((p) => p.lat),
      lngs = points.map((p) => p.lng);
    const minLat = Math.min(...lats),
      maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs),
      maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.01, (maxLat - minLat) * 2.2),
      longitudeDelta: Math.max(0.01, (maxLng - minLng) * 2.2),
    };
  }, [points]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {data?.title ?? "Location"}
            </Text>
            <Text style={styles.modalSubtitle}>
              {points.length} clock event{points.length === 1 ? "" : "s"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={onClose}
            testID="close-map"
          >
            <X size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>

        <View style={styles.mapWrap}>
          {visible && Platform.OS === "web" && (
            <WebMapFallback points={points} focus={focus} region={region} />
          )}
          {visible && Platform.OS !== "web" && (
            <NativeMapView
              initialRegion={{
                latitude: focus?.lat ?? region.latitude,
                longitude: focus?.lng ?? region.longitude,
                latitudeDelta: region.latitudeDelta,
                longitudeDelta: region.longitudeDelta,
              }}
              points={points}
            />
          )}
        </View>

        <ScrollView
          style={styles.modalList}
          contentContainerStyle={{ padding: 12, gap: 8 }}
        >
          {points.map((p, i) => (
            <TouchableOpacity
              key={`row-${p.label}-${i}`}
              style={styles.modalRow}
              onPress={() => onOpenExternal(p)}
            >
              <View style={[styles.modalDot, { backgroundColor: p.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalRowTitle}>
                  {p.label} • {p.time}
                </Text>
                <Text style={styles.modalRowAddr} numberOfLines={2}>
                  {p.address}
                </Text>
              </View>
              <View style={styles.modalOpenBtn}>
                <Navigation size={12} color="#2563EB" />
                <Text style={styles.modalOpenText}>Open</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 16, paddingBottom: 48 },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  topRowMobile: { alignItems: "flex-start" },
  topLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pageTitle: { fontSize: 26, fontWeight: "800" as const, color: "#0F172A" },
  pageTitleMobile: { fontSize: 22 },
  topControls: { flexDirection: "row", gap: 10, alignItems: "center" },
  topControlsMobile: { gap: 8 },
  exportBtnMobile: { paddingHorizontal: 10, paddingVertical: 10 },

  periodPicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    flexShrink: 1,
    minWidth: 0,
  },
  periodPickerDate: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "600" as const,
    flexShrink: 1,
  },
  periodModeBadge: {
    backgroundColor: "#EFF6FF",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  periodModeBadgeText: {
    fontSize: 11,
    color: "#2563EB",
    fontWeight: "700" as const,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  exportPdfBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#DC2626",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  exportBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" as const },

  periodMenu: {
    alignSelf: "flex-end",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 4,
    marginBottom: 8,
    gap: 2,
  },
  periodMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  periodMenuItemActive: { backgroundColor: "#EFF6FF" },
  periodMenuText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600" as const,
  },
  periodMenuTextActive: { color: "#2563EB", fontWeight: "700" as const },
  periodMenuDesc: { fontSize: 11, color: "#9CA3AF", marginTop: 1 },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  summaryCardMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
    padding: 12,
  },
  summaryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 180,
  },
  summaryLeftMobile: { minWidth: 0 },
  summaryStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  summaryStatsRowMobile: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 12,
    justifyContent: "space-around",
    gap: 0,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: "#2563EB", fontWeight: "800" as const, fontSize: 18 },
  summaryName: { fontSize: 16, fontWeight: "700" as const, color: "#0F172A" },
  summaryRate: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  summaryStat: { alignItems: "center", minWidth: 100 },
  summaryStatMobile: { flex: 1, minWidth: 0, paddingVertical: 4 },
  summaryStatValue: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: "#0F172A",
  },
  summaryStatLabel: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  rateBox: {
    paddingHorizontal: 14,
    borderLeftWidth: 1,
    borderLeftColor: "#E5E7EB",
  },
  rateBoxLabel: { fontSize: 11, color: "#6B7280" },
  rateBoxValue: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: "#0F172A",
    marginTop: 2,
  },
  rateBoxUnit: { fontSize: 12, color: "#6B7280", fontWeight: "500" as const },
  historyBox: {
    paddingHorizontal: 14,
    borderLeftWidth: 1,
    borderLeftColor: "#E5E7EB",
  },
  historyBoxTitle: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "700" as const,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  viewAllText: { fontSize: 11, color: "#6B7280" },

  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
    marginBottom: 8,
  },
  weekTitle: { fontSize: 13, color: "#374151" },
  weekLabel: {
    fontWeight: "800" as const,
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  weekTotalsRow: { flexDirection: "row", gap: 16 },
  weekTotalText: { fontSize: 12, color: "#6B7280" },
  weekTotalValue: { color: "#0F172A", fontWeight: "700" as const },

  daysRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 4,
  },

  dayCard: {
    flexGrow: 1,
    flexBasis: 280,
    minWidth: 260,
    maxWidth: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  dayTitle: { fontSize: 13, fontWeight: "800" as const, color: "#0F172A" },
  multiChip: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  multiChipText: { fontSize: 10, color: "#1D4ED8", fontWeight: "700" as const },

  sessionBlock: { paddingVertical: 4 },
  sessionBlockMulti: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    borderStyle: "dashed" as const,
    paddingTop: 8,
    marginTop: 4,
  },
  jobRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 6,
  },
  jobLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
    minWidth: 0,
  },
  jobName: {
    fontSize: 11,
    color: "#1E3A8A",
    fontWeight: "700" as const,
    flexShrink: 1,
  },
  sessionBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  sessionBadgeText: {
    fontSize: 9,
    color: "#6B7280",
    fontWeight: "600" as const,
  },
  taskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  taskBadgeText: { fontSize: 10, fontWeight: "700" as const },

  timelineTimes: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 10,
    color: "#374151",
    flex: 1,
    textAlign: "center" as const,
  },
  timelineBar: {
    height: 24,
    justifyContent: "center",
    position: "relative",
    marginBottom: 2,
  },
  timelineLine: {
    position: "absolute",
    left: 4,
    right: 4,
    height: 2,
    backgroundColor: "#E5E7EB",
    top: "50%",
    marginTop: -1,
  },
  timelineDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    top: "50%",
    marginTop: -5,
  },
  lunchChip: {
    position: "absolute",
    height: 14,
    top: "50%",
    marginTop: -7,
    borderRadius: 5,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  lunchChipText: {
    fontSize: 8,
    color: "#92400E",
    fontWeight: "700" as const,
    paddingHorizontal: 3,
  },
  lunchShade: {
    position: "absolute",
    height: 2,
    top: "50%",
    marginTop: -1,
    backgroundColor: "#FCD34D",
  },
  timelineLabels: {
    height: LABEL_ROW_H * 2,
    position: "relative",
    marginBottom: 8,
  },
  timelineLabel: {
    fontSize: 8,
    color: "#9CA3AF",
    textAlign: "center" as const,
  },

  mapPreview: {
    height: 50,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 8,
    position: "relative",
    backgroundColor: "#F3F4F6",
  },
  mapBlock: { position: "absolute", top: 0, bottom: 0 },
  mapDashLine: {
    position: "absolute",
    left: 10,
    right: 10,
    top: "60%",
    height: 1,
    borderTopWidth: 1,
    borderStyle: "dashed" as const,
    borderColor: "#60A5FA",
  },
  mapPin: {
    position: "absolute",
    top: "40%",
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: -5,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  mapExpandHint: {
    position: "absolute",
    right: 6,
    top: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  mapExpandHintText: {
    fontSize: 9,
    color: "#2563EB",
    fontWeight: "700" as const,
  },

  locationsCol: { gap: 2, marginBottom: 8 },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  locationTime: { fontSize: 10, color: "#6B7280", width: 50 },
  locationLabel: {
    fontSize: 10,
    color: "#0F172A",
    fontWeight: "600" as const,
    width: 60,
  },
  locationAddress: { fontSize: 10, color: "#6B7280", flex: 1 },

  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F9FAFB",
    borderRadius: 6,
    padding: 6,
    marginBottom: 6,
  },
  noteLabel: { fontSize: 10, fontWeight: "700" as const, color: "#374151" },
  noteText: { fontSize: 10, color: "#4B5563", flex: 1 },

  sessionMiniFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    paddingBottom: 2,
  },
  sessionMiniText: { fontSize: 10 },

  dayFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  footerItem: { fontSize: 11 },
  footerLabel: { color: "#6B7280" },
  footerValue: { color: "#0F172A", fontWeight: "700" as const },
  footerPay: { color: "#10B981", fontWeight: "800" as const },

  payTotalsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 16,
    marginBottom: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    alignItems: "center",
  },
  payTotalsLeft: { flex: 1, minWidth: 200 },
  payTotalsTitle: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  payTotalsSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  payStat: { alignItems: "center", minWidth: 90 },
  payStatValue: { fontSize: 16, fontWeight: "800" as const, color: "#0F172A" },
  payStatLabel: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  downloadReportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  downloadReportText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "600" as const,
  },

  historyPanel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    gap: 8,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  historyTitle: { fontSize: 14, fontWeight: "700" as const, color: "#0F172A" },
  historyViewAll: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "600" as const,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    flexWrap: "wrap",
  },
  historyItemMobile: { gap: 8 },
  historyItemLabel: { flex: 1, minWidth: 120 },
  historyLabel: { fontSize: 13, fontWeight: "600" as const, color: "#0F172A" },
  historyMeta: { flexDirection: "row", gap: 10, marginTop: 2 },
  historyHours: { fontSize: 12, color: "#6B7280" },
  historyPay: { fontSize: 12, color: "#10B981", fontWeight: "700" as const },
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#EFF6FF",
  },
  historyBtnDl: { backgroundColor: "#2563EB" },
  historyBtnActive: { backgroundColor: "#2563EB" },
  historyBtnText: {
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "700" as const,
  },

  pastBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  pastBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    fontWeight: "600" as const,
  },
  pastBannerBtn: {
    backgroundColor: "#D97706",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  pastBannerBtnText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "700" as const,
  },

  infoNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  infoNoteText: { fontSize: 11, color: "#6B7280", flex: 1 },

  backLink: { marginTop: 16, alignItems: "center" },
  backLinkText: { fontSize: 13, color: "#2563EB", fontWeight: "600" as const },

  modalContainer: { flex: 1, backgroundColor: "#FFFFFF" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    paddingTop: Platform.OS === "ios" ? 54 : 14,
  },
  modalTitle: { fontSize: 16, fontWeight: "800" as const, color: "#0F172A" },
  modalSubtitle: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  mapWrap: {
    height: 320,
    backgroundColor: "#E5E7EB",
    position: "relative",
    overflow: "hidden",
  },
  modalList: { flex: 1, backgroundColor: "#F8FAFC" },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modalDot: { width: 12, height: 12, borderRadius: 6 },
  modalRowTitle: { fontSize: 13, fontWeight: "700" as const, color: "#0F172A" },
  modalRowAddr: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  modalOpenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  modalOpenText: { fontSize: 11, color: "#2563EB", fontWeight: "700" as const },
});
