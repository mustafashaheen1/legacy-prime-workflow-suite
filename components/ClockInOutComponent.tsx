import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  Platform,
  Linking,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useApp } from "@/contexts/AppContext";
import type { GeoPoint } from "@/types";

// Always renders as "9:05 AM" / "1:30 PM" — no seconds, no locale variance
function formatTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Renders a millisecond duration. Seconds are shown only for sub-hour values,
// so "7h 30m" stays clean for real shifts but "2m 10s" reads correctly during
// short-duration testing (otherwise truncating to minutes makes the subtraction
// visual "Work − Lunch = Paid" look broken at second-scale values).
// 0 or negative → "—".
function formatDurationCompact(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

function fmtSec(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0m";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}
import {
  Clock,
  CheckCircle,
  Coffee,
  FileText,
  Calendar,
  MapPin,
  Hourglass,
  LogOut,
} from "lucide-react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";

/** Fetches the user's current GPS position at the moment it is called.
 *  Tries up to two attempts before giving up so transient failures don't
 *  silently drop the location (especially during clock-out on web). */
async function getCurrentLocation(highAccuracy = false): Promise<GeoPoint> {
  if (Platform.OS === "web") {
    const tryGeo = (opts: PositionOptions): Promise<GeoPoint> =>
      new Promise((resolve) => {
        if (!("geolocation" in navigator))
          return resolve({ latitude: 0, longitude: 0 });
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          () => resolve({ latitude: 0, longitude: 0 }),
          opts,
        );
      });

    // First attempt: accept a cached position up to 2 minutes old (covers the gap
    // between lunch-in and clock-out without forcing a new satellite fix).
    const first = await tryGeo({
      timeout: 10_000,
      maximumAge: 120_000,
      enableHighAccuracy: highAccuracy,
    });
    if (first.latitude !== 0 || first.longitude !== 0) return first;

    // Second attempt: force a fresh position with a longer timeout.
    return tryGeo({
      timeout: 20_000,
      maximumAge: 0,
      enableHighAccuracy: false,
    });
  }

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return { latitude: 0, longitude: 0 };

    const accuracy = highAccuracy
      ? Location.Accuracy.High
      : Location.Accuracy.Balanced;
    const timeout = highAccuracy ? 15_000 : 10_000;

    const locOrNull = await Promise.race<Location.LocationObject | null>([
      Location.getCurrentPositionAsync({ accuracy }),
      new Promise<null>((r) => setTimeout(() => r(null), timeout)),
    ]);
    if (locOrNull)
      return {
        latitude: locOrNull.coords.latitude,
        longitude: locOrNull.coords.longitude,
      };

    // Retry once with relaxed accuracy if the high-accuracy attempt timed out.
    if (highAccuracy) {
      const fallback = await Promise.race<Location.LocationObject | null>([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Lowest,
        }),
        new Promise<null>((r) => setTimeout(() => r(null), 8_000)),
      ]);
      if (fallback)
        return {
          latitude: fallback.coords.latitude,
          longitude: fallback.coords.longitude,
        };
    }

    return { latitude: 0, longitude: 0 };
  } catch {
    return { latitude: 0, longitude: 0 };
  }
}

import { ClockEntry, Report, EmployeeTimeData } from "@/types";

const WORK_CATEGORIES = [
  "Framing",
  "Drywall",
  "Electrical",
  "Plumbing",
  "Painting",
  "Flooring",
  "Roofing",
  "HVAC",
  "Carpentry",
  "Concrete",
  "Demolition",
  "Site Work",
  "General Labor",
  "Other",
];

const OFFICE_CATEGORIES = [
  "Admin Work",
  "Client Meeting",
  "Bookkeeping",
  "Sales Call",
  "Planning",
  "Correspondence",
  "HR / Payroll",
  "Other",
];

interface ClockInOutComponentProps {
  projectId?: string;
  projectName?: string;
  officeRole?: string;
  compact?: boolean;
}

export default function ClockInOutComponent({
  projectId,
  projectName,
  officeRole,
  compact = false,
}: ClockInOutComponentProps) {
  const isOfficeMode = !!officeRole;
  const {
    clockEntries,
    addClockEntry,
    updateClockEntry,
    user,
    updateProject,
    addExpense,
    expenses,
  } = useApp();
  const router = useRouter();
  const [currentEntry, setCurrentEntry] = useState<ClockEntry | null>(null);
  const [showClockOutModal, setShowClockOutModal] = useState<boolean>(false);
  const [isClockingOut, setIsClockingOut] = useState(false);
  const [workPerformed, setWorkPerformed] = useState<string>("");
  const [showClockInModal, setShowClockInModal] = useState<boolean>(false);
  const [clockInCategory, setClockInCategory] = useState<string>("");
  const [clockInDescription, setClockInDescription] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  // Ticker to keep elapsed hours / earnings live-updating every 30 s
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live GPS tracking — push employee location every 60 s while clocked in
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const currentEntryRef = useRef<ClockEntry | null>(null);
  // Cache of the most recent valid GPS fix — used as fallback when high-accuracy
  // clock-out GPS times out (common indoors or with a cold GPS chip).
  const lastKnownLocationRef = useRef<GeoPoint | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  // Keep ref in sync so the 60 s interval callback always sees the latest entry
  useEffect(() => {
    currentEntryRef.current = currentEntry;
  }, [currentEntry]);

  // Restore the GPS cache from AsyncStorage when the component remounts mid-shift.
  // Without this, navigating away and back resets lastKnownLocationRef to null and
  // the clock-out falls through to (0,0) when GPS can't get a fresh fix indoors.
  useEffect(() => {
    if (!currentEntry?.id || currentEntry.clockOut) return;
    AsyncStorage.getItem(`@clockloc_${currentEntry.id}`)
      .then((val) => {
        if (!val) return;
        try {
          const loc: GeoPoint = JSON.parse(val);
          if (loc.latitude !== 0 || loc.longitude !== 0) {
            lastKnownLocationRef.current = loc;
            console.log(
              "[GPS] lastKnownLocation restored from storage for entry:",
              currentEntry.id.slice(0, 8),
            );
          }
        } catch {}
      })
      .catch(() => {});
  }, [currentEntry?.id]);

  // Resume tracking after re-mount (e.g. background→foreground) if already clocked in
  useEffect(() => {
    if (currentEntry?.id && !currentEntry.clockOut && !isOfficeMode) {
      if (!locationIntervalRef.current) {
        startLocationTracking(currentEntry.id, currentEntry.projectId);
      }
    }
    return () => stopLocationTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEntry?.id]);

  // Check for active entry whenever clockEntries changes or component mounts
  useEffect(() => {
    const activeEntry = clockEntries.find((entry) => {
      if (entry.employeeId !== user?.id || entry.clockOut) return false;
      if (isOfficeMode) return entry.officeRole === officeRole;
      return entry.projectId === projectId;
    });
    if (activeEntry) {
      console.log("[Clock] Found active entry:", activeEntry.id);
      setCurrentEntry(activeEntry);
    } else if (currentEntry && !activeEntry) {
      // Only clear if we had a currentEntry but it's no longer in the list
      // This happens when clock out completes
      const stillExists = clockEntries.some((e) => e.id === currentEntry.id);
      if (stillExists) {
        // Entry exists but has been clocked out, clear current entry
        const updatedEntry = clockEntries.find((e) => e.id === currentEntry.id);
        if (updatedEntry?.clockOut) {
          console.log("[Clock] Entry was clocked out, clearing current entry");
          setCurrentEntry(null);
        }
      }
    }
  }, [projectId, clockEntries, user?.id]);

  const API_BASE =
    process.env.EXPO_PUBLIC_API_URL ||
    "https://legacy-prime-workflow-suite.vercel.app";

  async function pushLiveLocation(
    entryId: string,
    projId: string | undefined,
    locStatus: "working" | "on_break",
  ) {
    if (!user?.id || !user?.companyId || isOfficeMode) return;
    const loc = await getCurrentLocation();
    if (loc.latitude === 0 && loc.longitude === 0) {
      console.warn(
        "[GPS] pushLiveLocation GPS returned (0,0) — skipping push, lastKnownLocation unchanged",
      );
      return;
    }
    lastKnownLocationRef.current = loc;
    AsyncStorage.setItem(`@clockloc_${entryId}`, JSON.stringify(loc)).catch(
      () => {},
    );
    console.log(
      "[GPS] lastKnownLocation updated via tracking push:",
      loc.latitude.toFixed(5),
      loc.longitude.toFixed(5),
    );
    try {
      await fetch(`${API_BASE}/api/update-worker-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: user.id,
          companyId: user.companyId,
          projectId: projId || null,
          clockEntryId: entryId,
          latitude: loc.latitude,
          longitude: loc.longitude,
          status: locStatus,
          employeeName: user.name,
        }),
      });
    } catch (e) {
      console.warn("[Location] Push failed (non-fatal):", e);
    }
  }

  function stopLocationTracking() {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  }

  function startLocationTracking(entryId: string, projId: string | undefined) {
    stopLocationTracking();
    pushLiveLocation(entryId, projId, "working");
    locationIntervalRef.current = setInterval(() => {
      const entry = currentEntryRef.current;
      if (!entry || entry.clockOut) {
        stopLocationTracking();
        return;
      }
      const locStatus = entry.lunchBreaks?.some((lb) => !lb.endTime)
        ? "on_break"
        : "working";
      pushLiveLocation(entry.id, entry.projectId, locStatus);
    }, 60_000);
  }

  const handleClockIn = () => {
    if (!user) {
      Alert.alert("Error", "Please log in to clock in");
      return;
    }
    setShowClockInModal(true);
  };

  const completeClockIn = async () => {
    if (!user || !clockInCategory) return;

    const clockInLocation = await getCurrentLocation();
    if (clockInLocation.latitude !== 0 || clockInLocation.longitude !== 0) {
      lastKnownLocationRef.current = clockInLocation;
      console.log(
        "[GPS] lastKnownLocation updated at clock-in:",
        clockInLocation.latitude.toFixed(5),
        clockInLocation.longitude.toFixed(5),
      );
    } else {
      console.warn(
        "[GPS] clock-in GPS returned (0,0) — lastKnownLocation NOT updated",
      );
    }

    const entry: ClockEntry = {
      id: Date.now().toString(),
      employeeId: user.id,
      projectId: isOfficeMode ? undefined : projectId,
      officeRole: isOfficeMode ? officeRole : undefined,
      clockIn: new Date().toISOString(),
      location: clockInLocation,
      category: clockInCategory,
      workPerformed: clockInDescription,
    };

    // Close modal and reset form immediately for responsive UI
    setShowClockInModal(false);
    const categoryForLog = clockInCategory;
    const descriptionForLog = clockInDescription;
    setClockInCategory("");
    setClockInDescription("");

    // Set the entry optimistically
    setCurrentEntry(entry);

    try {
      // addClockEntry returns the entry with the database ID
      const savedEntry = await addClockEntry(entry);
      // Update currentEntry with the database ID
      setCurrentEntry(savedEntry);
      startLocationTracking(savedEntry.id, savedEntry.projectId);
      // Persist clock-in GPS under the real DB entry ID so it survives remounts
      if (clockInLocation.latitude !== 0 || clockInLocation.longitude !== 0) {
        AsyncStorage.setItem(
          `@clockloc_${savedEntry.id}`,
          JSON.stringify(clockInLocation),
        ).catch(() => {});
      }
      console.log(
        `[Clock In] ${user.name} clocked in to ${projectName} at ${formatTime(new Date())}`,
      );
      console.log(`[Clock In] Category: ${categoryForLog}`);
      console.log(`[Clock In] Description: ${descriptionForLog || "N/A"}`);
      console.log(`[Clock In] Entry ID: ${savedEntry.id}`);
    } catch (error) {
      console.error("[Clock In] Error:", error);
      // Entry is already set locally, just log the error
    }
  };

  const handleClockOut = () => {
    if (!currentEntry) return;
    setShowClockOutModal(true);
  };

  const completeClockOut = async () => {
    if (!currentEntry || isClockingOut) return;
    setIsClockingOut(true);
    try {
      // Use high-accuracy mode for clock-out — this is the location that appears
      // on time cards and payroll reports, so precision matters more than speed.
      // Fall back to the most recently cached GPS fix (from the 60 s tracking loop
      // or clock-in) if the device can't obtain a fresh fix in time (e.g., indoors).
      const [clockOutTime, freshLocation] = await Promise.all([
        Promise.resolve(new Date().toISOString()),
        getCurrentLocation(true),
      ]);

      console.log(
        "[GPS] clock-out freshLocation:",
        freshLocation.latitude,
        freshLocation.longitude,
      );
      console.log(
        "[GPS] lastKnownLocationRef at clock-out:",
        lastKnownLocationRef.current,
      );

      const freshIsValid =
        freshLocation.latitude !== 0 || freshLocation.longitude !== 0;
      let clockOutLocation: GeoPoint;
      if (freshIsValid) {
        clockOutLocation = freshLocation;
        console.log(
          "[GPS] clock-out using fresh GPS:",
          clockOutLocation.latitude.toFixed(5),
          clockOutLocation.longitude.toFixed(5),
        );
      } else if (lastKnownLocationRef.current) {
        clockOutLocation = lastKnownLocationRef.current;
        console.log(
          "[GPS] clock-out using FALLBACK lastKnownLocation:",
          clockOutLocation.latitude,
          clockOutLocation.longitude,
        );
      } else {
        // Last resort: read the persisted GPS cache from AsyncStorage in case the
        // component remounted (navigation away + back) and reset the in-memory ref.
        try {
          const stored = await AsyncStorage.getItem(
            `@clockloc_${currentEntry.id}`,
          );
          if (stored) {
            const loc: GeoPoint = JSON.parse(stored);
            if (loc.latitude !== 0 || loc.longitude !== 0) {
              clockOutLocation = loc;
              console.log(
                "[GPS] clock-out using STORED fallback location:",
                loc.latitude,
                loc.longitude,
              );
            } else {
              clockOutLocation = freshLocation;
            }
          } else {
            clockOutLocation = freshLocation;
          }
        } catch {
          clockOutLocation = freshLocation;
        }
        if (
          clockOutLocation.latitude === 0 &&
          clockOutLocation.longitude === 0
        ) {
          console.warn(
            "[GPS] clock-out GPS (0,0) AND no cached location — clock-out will save WITHOUT location",
          );
        }
      }

      const clockInDate = new Date(currentEntry.clockIn);
      const clockOutDate = new Date(clockOutTime);
      let totalMs = clockOutDate.getTime() - clockInDate.getTime();

      if (currentEntry.lunchBreaks) {
        currentEntry.lunchBreaks.forEach((lunch) => {
          const lunchStart = new Date(lunch.startTime).getTime();
          const lunchEnd = lunch.endTime
            ? new Date(lunch.endTime).getTime()
            : clockOutDate.getTime();
          totalMs -= lunchEnd - lunchStart;
        });
      }

      const hoursWorked = totalMs / (1000 * 60 * 60);

      updateClockEntry(currentEntry.id, {
        clockOut: clockOutTime,
        clockOutLocation,
        workPerformed,
        category: currentEntry.category || "General Labor",
        lunchBreaks: currentEntry.lunchBreaks,
      });

      if (!isOfficeMode && projectId) {
        updateProject(projectId, { hoursWorked: hoursWorked });
      }

      console.log(`[Clock Out] ${user?.name} clocked out from ${projectName}`);
      console.log(
        `[Clock Out] Hours worked (excluding lunch): ${hoursWorked.toFixed(2)}h`,
      );
      console.log(
        `[Clock Out] Category: ${currentEntry.category || "General Labor"}`,
      );
      console.log(`[Clock Out] Work performed: ${workPerformed || "N/A"}`);

      // Auto-create labor expense if hourly rate is set.
      // Use the rate snapshotted at clock-in time (currentEntry.hourlyRate) so the
      // expense reflects the correct wage even if the rate changed since then.
      const effectiveRate = currentEntry.hourlyRate ?? user?.hourlyRate ?? 0;
      let laborCostMessage = "";
      if (effectiveRate > 0 && hoursWorked > 0 && projectId && !isOfficeMode) {
        // Check if labor expense already exists for this clock entry
        const existingExpense = expenses.find(
          (exp) => exp.clockEntryId === currentEntry.id && exp.type === "Labor",
        );

        if (existingExpense) {
          console.log(
            "[Clock Out] Labor expense already exists for this clock entry",
          );
        } else {
          const laborCost = Math.round(hoursWorked * effectiveRate * 100) / 100;

          const laborExpense = {
            id: `labor-${currentEntry.id}-${Date.now()}`,
            projectId: projectId,
            companyId: user?.companyId,
            type: "Labor",
            subcategory: "Employee Labor",
            amount: laborCost,
            store: user?.name || "Unknown Employee",
            date: clockOutTime,
            notes: `${hoursWorked.toFixed(2)} hrs @ $${effectiveRate}/hr`,
            createdAt: new Date().toISOString(),
            clockEntryId: currentEntry.id,
          };

          try {
            await addExpense(laborExpense);
            laborCostMessage = `\nLabor cost: $${laborCost.toFixed(2)} (${hoursWorked.toFixed(2)} hrs @ $${effectiveRate}/hr)`;
            console.log(
              "[Clock Out] Created labor expense:",
              laborExpense.id,
              `$${laborCost.toFixed(2)}`,
            );
          } catch (expenseErr) {
            console.warn(
              "[Clock Out] Labor expense save failed (non-fatal):",
              expenseErr,
            );
          }
        }
      } else {
        if (!effectiveRate) {
          console.log(
            "[Clock Out] No hourly rate set for employee, skipping labor expense",
          );
        } else if (hoursWorked <= 0) {
          console.log(
            "[Clock Out] Hours worked is 0 or negative, skipping labor expense",
          );
        } else if (!projectId) {
          console.log(
            "[Clock Out] No project assigned, skipping labor expense",
          );
        }
      }

      stopLocationTracking();
      AsyncStorage.removeItem(`@clockloc_${currentEntry.id}`).catch(() => {});
      setCurrentEntry(null);
      setWorkPerformed("");
      setSelectedCategory("");
      setShowClockOutModal(false);
      Alert.alert(
        "Clocked Out",
        `Total hours: ${hoursWorked.toFixed(2)}h${laborCostMessage}`,
      );
    } catch (err) {
      console.error("[Clock Out] Unexpected error:", err);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsClockingOut(false);
    }
  };

  const isOnLunch = () => {
    if (!currentEntry?.lunchBreaks) return false;
    return currentEntry.lunchBreaks.some((lunch) => !lunch.endTime);
  };

  const handleLunchStart = async () => {
    if (!currentEntry) return;

    const startLocation = await getCurrentLocation();
    if (startLocation.latitude !== 0 || startLocation.longitude !== 0) {
      lastKnownLocationRef.current = startLocation;
      AsyncStorage.setItem(
        `@clockloc_${currentEntry.id}`,
        JSON.stringify(startLocation),
      ).catch(() => {});
      console.log(
        "[GPS] lastKnownLocation updated at lunch-out:",
        startLocation.latitude.toFixed(5),
        startLocation.longitude.toFixed(5),
      );
    } else {
      console.warn(
        "[GPS] lunch-out GPS returned (0,0) — lastKnownLocation unchanged, current ref:",
        lastKnownLocationRef.current,
      );
    }

    const lunchBreak = {
      startTime: new Date().toISOString(),
      startLocation,
    };

    const updatedLunchBreaks = [
      ...(currentEntry.lunchBreaks || []),
      lunchBreak,
    ];

    updateClockEntry(currentEntry.id, {
      lunchBreaks: updatedLunchBreaks,
    });

    setCurrentEntry({
      ...currentEntry,
      lunchBreaks: updatedLunchBreaks,
    });

    pushLiveLocation(currentEntry.id, currentEntry.projectId, "on_break");

    console.log(
      `[Lunch] ${user?.name} started lunch break at ${formatTime(new Date())} @ ${startLocation.latitude.toFixed(5)},${startLocation.longitude.toFixed(5)}`,
    );
    Alert.alert(
      "Lunch Break",
      "Lunch break started. Time won't count towards payroll.",
    );
  };

  const handleLunchEnd = async () => {
    if (!currentEntry?.lunchBreaks) return;

    const activeLunchIndex = currentEntry.lunchBreaks.findIndex(
      (lunch) => !lunch.endTime,
    );
    if (activeLunchIndex === -1) return;

    const endLocation = await getCurrentLocation();
    if (endLocation.latitude !== 0 || endLocation.longitude !== 0) {
      lastKnownLocationRef.current = endLocation;
      AsyncStorage.setItem(
        `@clockloc_${currentEntry.id}`,
        JSON.stringify(endLocation),
      ).catch(() => {});
      console.log(
        "[GPS] lastKnownLocation updated at lunch-in:",
        endLocation.latitude.toFixed(5),
        endLocation.longitude.toFixed(5),
      );
    } else {
      console.warn(
        "[GPS] lunch-in GPS returned (0,0) — lastKnownLocation unchanged, current ref:",
        lastKnownLocationRef.current,
      );
    }

    const updatedLunchBreaks = [...currentEntry.lunchBreaks];
    updatedLunchBreaks[activeLunchIndex] = {
      ...updatedLunchBreaks[activeLunchIndex],
      endTime: new Date().toISOString(),
      endLocation,
    };

    updateClockEntry(currentEntry.id, {
      lunchBreaks: updatedLunchBreaks,
    });

    setCurrentEntry({
      ...currentEntry,
      lunchBreaks: updatedLunchBreaks,
    });

    pushLiveLocation(currentEntry.id, currentEntry.projectId, "working");

    const lunchStart = new Date(updatedLunchBreaks[activeLunchIndex].startTime);
    const lunchEnd = new Date(updatedLunchBreaks[activeLunchIndex].endTime!);
    const lunchDuration = (
      (lunchEnd.getTime() - lunchStart.getTime()) /
      (1000 * 60)
    ).toFixed(0);

    console.log(
      `[Lunch] ${user?.name} ended lunch break at ${formatTime(new Date())} @ ${endLocation.latitude.toFixed(5)},${endLocation.longitude.toFixed(5)}`,
    );
    console.log(`[Lunch] Duration: ${lunchDuration} minutes`);
    Alert.alert(
      "Back to Work",
      `Lunch break ended. Duration: ${lunchDuration} minutes`,
    );
  };

  const calculateCurrentHours = () => {
    if (!currentEntry) return 0;
    const start = new Date(currentEntry.clockIn);
    const now = new Date();
    let totalMs = now.getTime() - start.getTime();

    if (currentEntry.lunchBreaks) {
      currentEntry.lunchBreaks.forEach((lunch) => {
        const lunchStart = new Date(lunch.startTime).getTime();
        const lunchEnd = lunch.endTime
          ? new Date(lunch.endTime).getTime()
          : now.getTime();
        totalMs -= lunchEnd - lunchStart;
      });
    }

    return totalMs / (1000 * 60 * 60);
  };

  // Current-session earnings: use the rate snapshotted at clock-in (entry.hourlyRate),
  // falling back to the user's current rate only if the snapshot is missing (legacy entries).
  const calculateCurrentSessionEarnings = () => {
    const hours = calculateCurrentHours();
    const rate = currentEntry?.hourlyRate ?? user?.hourlyRate ?? 0;
    return hours * rate;
  };

  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportStartDate, setReportStartDate] = useState<string>("");
  const [reportEndDate, setReportEndDate] = useState<string>("");

  const getWeekDates = (weeksAgo: number = 0) => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff - weeksAgo * 7);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { start: monday.toISOString(), end: sunday.toISOString() };
  };

  const setDateRange = (type: "current" | "last" | "custom") => {
    if (type === "current") {
      const { start, end } = getWeekDates(0);
      setReportStartDate(start);
      setReportEndDate(end);
    } else if (type === "last") {
      const { start, end } = getWeekDates(1);
      setReportStartDate(start);
      setReportEndDate(end);
    }
  };

  const generateWeeklyReport = () => {
    if (!reportStartDate || !reportEndDate) {
      Alert.alert("Error", "Please select a date range");
      return;
    }

    if (!user) return;

    const startDate = new Date(reportStartDate);
    const endDate = new Date(reportEndDate);

    const employeeEntries = clockEntries.filter((entry) => {
      const entryDate = new Date(entry.clockIn);
      return (
        entry.employeeId === user.id &&
        entry.projectId === projectId &&
        entryDate >= startDate &&
        entryDate <= endDate
      );
    });

    const calculateHours = (entry: ClockEntry) => {
      if (!entry.clockOut) return 0;
      const start = new Date(entry.clockIn).getTime();
      const end = new Date(entry.clockOut).getTime();
      let totalMs = end - start;

      if (entry.lunchBreaks) {
        entry.lunchBreaks.forEach((lunch) => {
          if (lunch.endTime) {
            const lunchStart = new Date(lunch.startTime).getTime();
            const lunchEnd = new Date(lunch.endTime).getTime();
            totalMs -= lunchEnd - lunchStart;
          }
        });
      }

      return totalMs / (1000 * 60 * 60);
    };

    const totalHours = employeeEntries.reduce(
      (sum, entry) => sum + calculateHours(entry),
      0,
    );
    const regularHours = Math.min(totalHours, 40);
    const overtimeHours = Math.max(0, totalHours - 40);

    const uniqueDays = new Set(
      employeeEntries.map((entry) => new Date(entry.clockIn).toDateString()),
    ).size;

    const employeeData: EmployeeTimeData = {
      employeeId: user.id,
      employeeName: user.name,
      totalHours: totalHours,
      regularHours: regularHours,
      overtimeHours: overtimeHours,
      totalDays: uniqueDays,
      averageHoursPerDay: uniqueDays > 0 ? totalHours / uniqueDays : 0,
      clockEntries: employeeEntries,
    };

    const report: Report = {
      id: `report-${Date.now()}`,
      name: `Weekly Hours Report - ${user.name} - ${projectName}`,
      type: "time-tracking",
      generatedDate: new Date().toISOString(),
      projectIds: [projectId],
      dateRange: {
        startDate: reportStartDate,
        endDate: reportEndDate,
      },
      employeeData: [employeeData],
      employeeIds: [user.id],
      totalHours: totalHours,
    };

    addReport(report);

    console.log("[Report] Weekly hours report generated");
    console.log(`  Employee: ${user.name}`);
    console.log(`  Project: ${projectName}`);
    console.log(
      `  Date Range: ${new Date(reportStartDate).toLocaleDateString()} - ${new Date(reportEndDate).toLocaleDateString()}`,
    );
    console.log(`  Total Hours: ${totalHours.toFixed(2)}h`);
    console.log(`  Regular Hours: ${regularHours.toFixed(2)}h`);
    console.log(`  Overtime Hours: ${overtimeHours.toFixed(2)}h`);
    console.log(`  Days Worked: ${uniqueDays}`);

    // Close modal immediately
    setShowReportModal(false);

    // Show success message
    if (Platform.OS === "web") {
      window.alert(
        `Report Generated Successfully!\n\nTotal Hours: ${totalHours.toFixed(2)}h\nRegular: ${regularHours.toFixed(2)}h\nOvertime: ${overtimeHours.toFixed(2)}h\n\nNavigating to Reports page...`,
      );
      // Navigate to reports page
      router.push("/reports");
    } else {
      Alert.alert(
        "Report Generated",
        `Weekly hours report saved successfully.\n\nTotal Hours: ${totalHours.toFixed(2)}h\nRegular: ${regularHours.toFixed(2)}h\nOvertime: ${overtimeHours.toFixed(2)}h`,
        [
          {
            text: "View Reports",
            onPress: () => router.push("/reports"),
          },
        ],
      );
    }
  };

  const todayEntries = clockEntries.filter((entry) => {
    const entryDate = new Date(entry.clockIn).toDateString();
    const today = new Date().toDateString();
    if (entryDate !== today || entry.employeeId !== user?.id) return false;
    if (isOfficeMode) return entry.officeRole === officeRole;
    return entry.projectId === projectId;
  });

  // Today's total earnings: sum per-entry so mixed rates (rate change mid-day) are correct.
  const todayEarnings = todayEntries.reduce((sum, entry) => {
    const start = new Date(entry.clockIn);
    const end = entry.clockOut ? new Date(entry.clockOut) : new Date();
    let totalMs = end.getTime() - start.getTime();
    if (entry.lunchBreaks) {
      entry.lunchBreaks.forEach((lunch) => {
        const lunchStart = new Date(lunch.startTime).getTime();
        const lunchEnd = lunch.endTime
          ? new Date(lunch.endTime).getTime()
          : new Date().getTime();
        totalMs -= lunchEnd - lunchStart;
      });
    }
    const netMs = isNaN(totalMs) ? 0 : Math.max(0, totalMs);
    const hours = netMs / 3_600_000;
    const rate = entry.hourlyRate ?? user?.hourlyRate ?? 0;
    return sum + parseFloat((rate * hours).toFixed(2));
  }, 0);

  // Use the same floor-to-seconds math as the Shift Breakdown card so
  // Today's Summary "Paid Hours" always equals the sum of each shift's breakdown value.
  const { totalPaidSecToday, totalBreakSecToday } = (() => {
    let totalPaidSec = 0;
    let totalBreakSec = 0;

    const calcEntry = (entry: ClockEntry, endMs: number) => {
      const startMs = new Date(entry.clockIn).getTime();
      const workSec = Math.floor(Math.max(0, endMs - startMs) / 1000);
      let lunchSec = 0;
      (entry.lunchBreaks ?? []).forEach((lunch) => {
        const ls = new Date(lunch.startTime).getTime();
        const le = lunch.endTime ? new Date(lunch.endTime).getTime() : endMs;
        lunchSec += Math.floor(Math.max(0, le - ls) / 1000);
      });
      return { paidSec: Math.max(0, workSec - lunchSec), lunchSec };
    };

    // Completed sessions — use clockEntries (stable, DB-backed)
    todayEntries
      .filter((e) => !!e.clockOut)
      .forEach((e) => {
        const { paidSec, lunchSec } = calcEntry(e, new Date(e.clockOut!).getTime());
        totalPaidSec += paidSec;
        totalBreakSec += lunchSec;
      });

    // Active session — use currentEntry directly so lunch breaks are always fresh
    if (currentEntry) {
      const now = Date.now();
      const { paidSec, lunchSec } = calcEntry(currentEntry, now);
      totalPaidSec += paidSec;
      totalBreakSec += lunchSec;
    }

    return { totalPaidSecToday: totalPaidSec, totalBreakSecToday: totalBreakSec };
  })();

  // Shift to display in the Top Summary Card + Time Log section.
  // Active entry takes precedence; otherwise pick today's latest entry
  // for this project/role (sorted by clockIn desc).
  const shiftEntry: ClockEntry | null =
    currentEntry ??
    (todayEntries.length > 0
      ? [...todayEntries].sort(
          (a, b) =>
            new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime(),
        )[0]
      : null);

  const { addReport } = useApp();

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <Clock size={24} color="#2563EB" />
          <Text style={styles.compactTitle}>Quick Clock</Text>
        </View>

        {currentEntry ? (
          <View style={styles.activeSession}>
            <View style={styles.activeIndicator}>
              <View style={styles.pulseDot} />
              <Text style={styles.activeText}>Active Session</Text>
            </View>
            <Text style={styles.clockedInTime}>
              Clocked in: {formatTime(currentEntry.clockIn)}
            </Text>
            {currentEntry.category && (
              <Text style={styles.categoryBadge}>{currentEntry.category}</Text>
            )}
            {currentEntry.workPerformed && (
              <Text style={styles.workDescription}>
                {currentEntry.workPerformed}
              </Text>
            )}
            <Text style={styles.currentHours}>
              {calculateCurrentHours().toFixed(2)}h elapsed
            </Text>
            {(currentEntry?.hourlyRate ?? user?.hourlyRate) ? (
              <Text style={styles.earningsText}>
                Earnings: ${calculateCurrentSessionEarnings().toFixed(2)}
              </Text>
            ) : null}

            <View style={styles.lunchButtonsRow}>
              {isOnLunch() ? (
                <TouchableOpacity
                  style={styles.lunchEndButton}
                  onPress={handleLunchEnd}
                >
                  <Coffee size={16} color="#FFFFFF" />
                  <Text style={styles.lunchButtonText}>End Lunch</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.lunchStartButton}
                  onPress={handleLunchStart}
                >
                  <Coffee size={16} color="#FFFFFF" />
                  <Text style={styles.lunchButtonText}>Start Lunch</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.clockOutButtonCompact}
                onPress={handleClockOut}
              >
                <Text style={styles.clockOutButtonText}>Clock Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.clockInButtonCompact}
            onPress={handleClockIn}
          >
            <Text style={styles.clockInButtonText}>Clock In</Text>
          </TouchableOpacity>
        )}

        <Modal
          visible={showClockOutModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowClockOutModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Clock Out Summary</Text>

                {currentEntry?.category && (
                  <View style={styles.categoryDisplayBox}>
                    <Text style={styles.categoryDisplayLabel}>
                      Work Category
                    </Text>
                    <Text style={styles.categoryDisplayValue}>
                      {currentEntry.category}
                    </Text>
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    What work was performed? (Optional)
                  </Text>
                  <TextInput
                    style={styles.textArea}
                    value={workPerformed}
                    onChangeText={setWorkPerformed}
                    placeholder="Describe the work completed..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={4}
                  />
                </View>

                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>Hours Worked</Text>
                  <Text style={styles.summaryValue}>
                    {calculateCurrentHours().toFixed(2)}h
                  </Text>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowClockOutModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.confirmButton,
                      isClockingOut && { opacity: 0.7 },
                    ]}
                    onPress={completeClockOut}
                    disabled={isClockingOut}
                  >
                    {isClockingOut ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.confirmButtonText}>
                        Complete Clock Out
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Clock size={28} color="#2563EB" />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Time Tracking</Text>
            <Text style={styles.headerSubtitle}>{projectName}</Text>
          </View>
        </View>
      </View>

      <View style={styles.employeeCard}>
        <Text style={styles.cardLabel}>Employee</Text>
        <Text style={styles.cardValue}>{user?.name || "Unknown Employee"}</Text>
      </View>

      {shiftEntry &&
        (() => {
          const inProgress = !shiftEntry.clockOut;
          const startMs = new Date(shiftEntry.clockIn).getTime();
          const endMs = shiftEntry.clockOut
            ? new Date(shiftEntry.clockOut).getTime()
            : Date.now();
          const totalMs = Math.max(0, endMs - startMs);

          let lunchMs = 0;
          if (shiftEntry.lunchBreaks) {
            shiftEntry.lunchBreaks.forEach((lunch) => {
              const ls = new Date(lunch.startTime).getTime();
              const le = lunch.endTime
                ? new Date(lunch.endTime).getTime()
                : Date.now();
              lunchMs += Math.max(0, le - ls);
            });
          }

          const clockInLabel = formatTime(shiftEntry.clockIn);
          const clockOutLabel = shiftEntry.clockOut
            ? formatTime(shiftEntry.clockOut)
            : "In Progress";
          const lunchLabel = lunchMs > 0 ? formatDurationCompact(lunchMs) : "—";
          const totalLabel = formatDurationCompact(totalMs);

          return (
            <View style={styles.shiftSummaryCard}>
              <View style={styles.shiftSummaryHeader}>
                <Text style={styles.shiftSummaryTitle}>Current Shift</Text>
                {inProgress && (
                  <View style={styles.shiftSummaryBadge}>
                    <View style={styles.shiftSummaryBadgeDot} />
                    <Text style={styles.shiftSummaryBadgeText}>
                      In Progress
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.shiftSummaryGrid}>
                <View style={styles.shiftSummaryItem}>
                  <View
                    style={[
                      styles.shiftSummaryIconWrap,
                      { backgroundColor: "#EFF6FF" },
                    ]}
                  >
                    <Clock size={16} color="#2563EB" />
                  </View>
                  <Text style={styles.shiftSummaryLabel}>Clocked In</Text>
                  <Text style={styles.shiftSummaryValue}>{clockInLabel}</Text>
                </View>
                <View style={styles.shiftSummaryItem}>
                  <View
                    style={[
                      styles.shiftSummaryIconWrap,
                      { backgroundColor: "#ECFDF5" },
                    ]}
                  >
                    <LogOut size={16} color="#16A34A" />
                  </View>
                  <Text style={styles.shiftSummaryLabel}>Clocked Out</Text>
                  <Text
                    style={[
                      styles.shiftSummaryValue,
                      inProgress && styles.shiftSummaryValueMuted,
                    ]}
                  >
                    {clockOutLabel}
                  </Text>
                </View>
                <View style={styles.shiftSummaryItem}>
                  <View
                    style={[
                      styles.shiftSummaryIconWrap,
                      { backgroundColor: "#FEF3C7" },
                    ]}
                  >
                    <Coffee size={16} color="#D97706" />
                  </View>
                  <Text style={styles.shiftSummaryLabel}>Lunch Break</Text>
                  <Text
                    style={[
                      styles.shiftSummaryValue,
                      lunchMs === 0 && styles.shiftSummaryValueMuted,
                    ]}
                  >
                    {lunchLabel}
                  </Text>
                </View>
                <View style={styles.shiftSummaryItem}>
                  <View
                    style={[
                      styles.shiftSummaryIconWrap,
                      { backgroundColor: "#EDE9FE" },
                    ]}
                  >
                    <Hourglass size={16} color="#6D28D9" />
                  </View>
                  <Text style={styles.shiftSummaryLabel}>Total Hours</Text>
                  <Text style={styles.shiftSummaryValue}>{totalLabel}</Text>
                </View>
              </View>
            </View>
          );
        })()}

      {shiftEntry &&
        (() => {
          // Build a flat, chronologically-sorted list of clock events for the shift.
          const events: {
            type: "clock-in" | "lunch-out" | "lunch-in" | "clock-out";
            label: string;
            time: string | null;
            inProgress?: boolean;
          }[] = [
            { type: "clock-in", label: "Clock In", time: shiftEntry.clockIn },
          ];

          const normalizedBreaks = (shiftEntry.lunchBreaks ?? [])
            .filter((lb) => !!lb.startTime)
            .map((lb) => ({
              startTime: lb.startTime,
              endTime: lb.endTime || null,
            }))
            .sort(
              (a, b) =>
                new Date(a.startTime).getTime() -
                new Date(b.startTime).getTime(),
            );

          for (const b of normalizedBreaks) {
            events.push({
              type: "lunch-out",
              label: "Lunch Out",
              time: b.startTime,
            });
            if (b.endTime) {
              events.push({
                type: "lunch-in",
                label: "Lunch In",
                time: b.endTime,
              });
            } else {
              // Edge case: break in progress — Lunch Out without a matching Lunch In.
              events.push({
                type: "lunch-in",
                label: "Lunch In",
                time: null,
                inProgress: true,
              });
            }
          }

          if (shiftEntry.clockOut) {
            events.push({
              type: "clock-out",
              label: "Clock Out",
              time: shiftEntry.clockOut,
            });
          }

          // Defensive re-sort by actual timestamp (nulls stay in place).
          events.sort((a, b) => {
            if (!a.time) return 1;
            if (!b.time) return -1;
            return new Date(a.time).getTime() - new Date(b.time).getTime();
          });

          const dotColor = (type: (typeof events)[number]["type"]) => {
            switch (type) {
              case "clock-in":
                return "#2563EB";
              case "lunch-out":
                return "#D97706";
              case "lunch-in":
                return "#F59E0B";
              case "clock-out":
                return "#16A34A";
            }
          };

          return (
            <View style={styles.timeLogCard}>
              <Text style={styles.timeLogCardTitle}>Time Log</Text>
              {events.map((ev, i) => (
                <View
                  key={`${shiftEntry.id}-ev-${i}`}
                  style={styles.timeLogRow}
                >
                  <View
                    style={[
                      styles.timeLogDot,
                      { backgroundColor: dotColor(ev.type) },
                    ]}
                  />
                  <Text style={styles.timeLogLabel}>{ev.label}</Text>
                  {ev.inProgress || !ev.time ? (
                    <Text style={[styles.timeLogTime, styles.timeLogTimeMuted]}>
                      In Progress
                    </Text>
                  ) : (
                    <Text style={styles.timeLogTime}>
                      {formatTime(ev.time)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          );
        })()}

      {shiftEntry &&
        (() => {
          // Shift Breakdown card: Work Hours − Lunch Break = Paid Hours.
          // For in-progress shifts, endMs is "now" (live-ticked by the 30s interval).
          const startMs = new Date(shiftEntry.clockIn).getTime();
          const endMs = shiftEntry.clockOut
            ? new Date(shiftEntry.clockOut).getTime()
            : Date.now();
          const workMs = Math.max(0, endMs - startMs);

          let lunchMs = 0;
          if (shiftEntry.lunchBreaks) {
            shiftEntry.lunchBreaks.forEach((lunch) => {
              const ls = new Date(lunch.startTime).getTime();
              const le = lunch.endTime
                ? new Date(lunch.endTime).getTime()
                : Date.now();
              lunchMs += Math.max(0, le - ls);
            });
          }
          // Floor each value to whole seconds, then derive Paid FROM the rounded
          // work and lunch seconds (not from the raw ms difference). Guarantees
          // the displayed subtraction always adds up — otherwise sub-second
          // remainders in the raw ms can push Paid off by 1s from what the user
          // visually computes from Work − Lunch.
          const workSec = Math.floor(workMs / 1000);
          const lunchSec = Math.floor(lunchMs / 1000);
          const paidSec = Math.max(0, workSec - lunchSec);

          // Formatter for whole seconds: same output shape as formatDurationCompact
          // but returns "0s" for zero (subtraction visual) instead of "—".
          const fmtSec = (sec: number): string => {
            if (!Number.isFinite(sec) || sec <= 0) return "0s";
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            const s = sec % 60;
            if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
            if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
            return `${s}s`;
          };

          return (
            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Shift Breakdown</Text>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Work Hours</Text>
                <Text style={styles.breakdownValue}>{fmtSec(workSec)}</Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Lunch Break</Text>
                <Text style={[styles.breakdownValue, styles.breakdownSubtract]}>
                  −{fmtSec(lunchSec)}
                </Text>
              </View>

              <View style={styles.breakdownDivider} />

              <View style={styles.breakdownRow}>
                <Text
                  style={[styles.breakdownLabel, styles.breakdownLabelPaid]}
                >
                  Paid Hours
                </Text>
                <Text style={styles.breakdownValuePaid}>{fmtSec(paidSec)}</Text>
              </View>
            </View>
          );
        })()}

      {currentEntry ? (
        <View style={styles.activeCard}>
          <View style={styles.activeHeader}>
            <View style={styles.activeIndicator}>
              <View style={styles.pulseDot} />
              <Text style={styles.activeText}>Currently Clocked In</Text>
            </View>
            <Text style={styles.activeTime}>
              {calculateCurrentHours().toFixed(2)}h
            </Text>
          </View>
          <Text style={styles.clockedInTime}>
            Started: {formatTime(currentEntry.clockIn)}
          </Text>
          {currentEntry.category && (
            <View style={styles.activeInfoRow}>
              <Text style={styles.activeInfoLabel}>Category:</Text>
              <Text style={styles.activeInfoValue}>
                {currentEntry.category}
              </Text>
            </View>
          )}
          {currentEntry.workPerformed && (
            <View style={styles.activeInfoRow}>
              <Text style={styles.activeInfoLabel}>Working on:</Text>
              <Text style={styles.activeInfoValue}>
                {currentEntry.workPerformed}
              </Text>
            </View>
          )}
          {user?.hourlyRate && (
            <View style={styles.rateInfoCard}>
              <Text style={styles.rateInfoLabel}>Hourly Rate:</Text>
              <Text style={styles.rateInfoValue}>
                ${user.hourlyRate.toFixed(2)}/hr
              </Text>
            </View>
          )}

          {isOnLunch() && (
            <View style={styles.lunchIndicator}>
              <Coffee size={16} color="#F59E0B" />
              <Text style={styles.lunchIndicatorText}>On Lunch Break</Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            {isOnLunch() ? (
              <TouchableOpacity
                style={styles.lunchEndButtonLarge}
                onPress={handleLunchEnd}
              >
                <Coffee size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>End Lunch</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.lunchStartButtonLarge}
                onPress={handleLunchStart}
              >
                <Coffee size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>Start Lunch</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.clockOutButton}
              onPress={handleClockOut}
            >
              <CheckCircle size={20} color="#FFFFFF" />
              <Text style={styles.clockOutButtonText}>Clock Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.clockInButton} onPress={handleClockIn}>
          <Clock size={24} color="#FFFFFF" />
          <Text style={styles.clockInButtonText}>Clock In</Text>
        </TouchableOpacity>
      )}

      <View style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>Today&apos;s Summary</Text>
          <TouchableOpacity
            style={styles.reportButton}
            onPress={() => setShowReportModal(true)}
          >
            <FileText size={18} color="#2563EB" />
            <Text style={styles.reportButtonText}>Weekly Report</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Paid Hours</Text>
            <Text style={styles.statValue}>{fmtSec(totalPaidSecToday)}</Text>
            {/* {totalBreakSecToday > 0 && (
              <Text style={styles.statBreakNote}>
                −{fmtSec(totalBreakSecToday)} break
              </Text>
            )} */}
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Sessions</Text>
            <Text style={styles.statValue}>{todayEntries.length}</Text>
          </View>
          {user?.hourlyRate && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Earnings Today</Text>
              <Text style={styles.statValue}>${todayEarnings.toFixed(2)}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.historyCard}>
        <Text style={styles.historyTitle}>Today&apos;s Clock History</Text>
        {todayEntries.length > 0 ? (
          todayEntries.map((entry) => {
            const start = new Date(entry.clockIn);
            const end = entry.clockOut ? new Date(entry.clockOut) : null;

            // Normalize breaks: filter out any with missing start, sort chronologically.
            const breaks = (entry.lunchBreaks ?? [])
              .filter((lb) => !!lb.startTime)
              .map((lb) => {
                const s = new Date(lb.startTime).getTime();
                const e = lb.endTime ? new Date(lb.endTime).getTime() : null;
                return {
                  startTime: lb.startTime,
                  endTime: lb.endTime,
                  startMs: s,
                  endMs: e,
                  inProgress: e === null,
                };
              })
              .sort((a, b) => a.startMs - b.startMs);

            const lunchMs = breaks.reduce((sum, b) => {
              const bEnd = b.endMs ?? Date.now();
              return sum + Math.max(0, bEnd - b.startMs);
            }, 0);
            const lunchMinutes = lunchMs / (1000 * 60);

            const netHours = end
              ? Math.round(
                  (end.getTime() - start.getTime() - lunchMs) / 60_000,
                ) / 60
              : 0;

            const breakCountLabel =
              breaks.length === 0
                ? ""
                : ` (${breaks.length} break${breaks.length === 1 ? "" : "s"})`;

            return (
              <View key={entry.id} style={styles.historyEntry}>
                <View style={styles.historyTime}>
                  <Text style={styles.historyTimeText}>
                    {formatTime(start)} - {end ? formatTime(end) : "Active"}
                  </Text>
                  {entry.clockOut && (
                    <Text style={styles.historyHours}>
                      {netHours.toFixed(2)}h
                    </Text>
                  )}
                </View>
                {entry.category && (
                  <Text style={styles.historyCategory}>{entry.category}</Text>
                )}
                {lunchMinutes > 0 && (
                  <Text style={styles.historyLunch}>
                    Lunch: {lunchMinutes.toFixed(0)} min total{breakCountLabel}
                  </Text>
                )}
                {entry.workPerformed && (
                  <Text style={styles.historyWork}>{entry.workPerformed}</Text>
                )}
                {entry.location &&
                  entry.location.latitude !== 0 &&
                  entry.location.longitude !== 0 && (
                    <View style={styles.locationContainer}>
                      <View style={styles.locationHeader}>
                        <MapPin size={14} color="#6B7280" />
                        <Text style={styles.locationText}>
                          {entry.location.latitude.toFixed(6)}
                          {", "}
                          {entry.location.longitude.toFixed(6)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.mapContainer}
                        onPress={() => {
                          const mapsUrl = Platform.select({
                            ios: `maps:0,0?q=${entry.location.latitude},${entry.location.longitude}`,
                            android: `geo:0,0?q=${entry.location.latitude},${entry.location.longitude}`,
                            web: `https://www.google.com/maps/search/?api=1&query=${entry.location.latitude},${entry.location.longitude}`,
                          });
                          if (Platform.OS === "web") {
                            window.open(mapsUrl, "_blank");
                          } else {
                            Linking.openURL(mapsUrl!);
                          }
                        }}
                      >
                        <View style={styles.mapPlaceholder}>
                          <MapPin size={32} color="#2563EB" />
                          <Text style={styles.mapPlaceholderText}>
                            Tap to view on map
                          </Text>
                          <Text style={styles.mapPlaceholderCoords}>
                            {entry.location.latitude.toFixed(4)},{" "}
                            {entry.location.longitude.toFixed(4)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
              </View>
            );
          })
        ) : (
          <Text style={styles.noDataText}>No clock entries today</Text>
        )}
      </View>

      <Modal
        visible={showClockInModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowClockInModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Clock In</Text>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  {isOfficeMode ? "Task Category *" : "Work Category *"}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryScroll}
                >
                  {(isOfficeMode ? OFFICE_CATEGORIES : WORK_CATEGORIES).map(
                    (category) => (
                      <TouchableOpacity
                        key={category}
                        style={[
                          styles.categoryChip,
                          clockInCategory === category &&
                            styles.categoryChipActive,
                        ]}
                        onPress={() => setClockInCategory(category)}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            clockInCategory === category &&
                              styles.categoryChipTextActive,
                          ]}
                        >
                          {category}
                        </Text>
                      </TouchableOpacity>
                    ),
                  )}
                </ScrollView>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  What will you be working on?
                </Text>
                <TextInput
                  style={styles.textArea}
                  value={clockInDescription}
                  onChangeText={setClockInDescription}
                  placeholder="Brief description of the work..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowClockInModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    !clockInCategory && styles.confirmButtonDisabled,
                  ]}
                  onPress={completeClockIn}
                  disabled={!clockInCategory}
                >
                  <Text style={styles.confirmButtonText}>Start Clock</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showClockOutModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowClockOutModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Clock Out Summary</Text>

              {currentEntry?.category && (
                <View style={styles.categoryDisplayBox}>
                  <Text style={styles.categoryDisplayLabel}>Work Category</Text>
                  <Text style={styles.categoryDisplayValue}>
                    {currentEntry.category}
                  </Text>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  What work was performed? (Optional)
                </Text>
                <TextInput
                  style={styles.textArea}
                  value={workPerformed}
                  onChangeText={setWorkPerformed}
                  placeholder="Describe the work completed..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.summaryBox}>
                <View>
                  <Text style={styles.summaryLabel}>Hours Worked</Text>
                  <Text style={styles.summaryValue}>
                    {calculateCurrentHours().toFixed(2)}h
                  </Text>
                </View>
                {user?.hourlyRate && (
                  <View>
                    <Text style={styles.summaryLabel}>Estimated Earnings</Text>
                    <Text style={styles.summaryValue}>
                      ${calculateCurrentSessionEarnings().toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowClockOutModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    isClockingOut && { opacity: 0.7 },
                  ]}
                  onPress={completeClockOut}
                  disabled={isClockingOut}
                >
                  {isClockingOut ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmButtonText}>
                      Complete Clock Out
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showReportModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Generate Weekly Hours Report</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Select Time Period</Text>
              <View style={styles.dateRangeButtons}>
                <TouchableOpacity
                  style={styles.dateRangeButton}
                  onPress={() => setDateRange("current")}
                >
                  <Calendar size={18} color="#2563EB" />
                  <Text style={styles.dateRangeButtonText}>Current Week</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateRangeButton}
                  onPress={() => setDateRange("last")}
                >
                  <Calendar size={18} color="#2563EB" />
                  <Text style={styles.dateRangeButtonText}>Last Week</Text>
                </TouchableOpacity>
              </View>
            </View>

            {reportStartDate && reportEndDate && (
              <View style={styles.selectedDateRange}>
                <Text style={styles.selectedDateLabel}>Selected Range:</Text>
                <Text style={styles.selectedDateText}>
                  {new Date(reportStartDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {" - "}
                  {new Date(reportEndDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowReportModal(false);
                  setReportStartDate("");
                  setReportEndDate("");
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  (!reportStartDate || !reportEndDate) &&
                    styles.confirmButtonDisabled,
                ]}
                onPress={generateWeeklyReport}
                disabled={!reportStartDate || !reportEndDate}
              >
                <Text style={styles.confirmButtonText}>Generate Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  compactContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  compactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  compactTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: "#1F2937",
  },
  header: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: "#1F2937",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
  employeeCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#6B7280",
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: "#1F2937",
  },
  activeCard: {
    backgroundColor: "#DCFCE7",
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#10B981",
  },
  activeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  activeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
  },
  activeText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#10B981",
  },
  activeTime: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: "#10B981",
  },
  clockedInTime: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
  },
  clockInButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#10B981",
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  clockInButtonCompact: {
    backgroundColor: "#10B981",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  clockInButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700" as const,
  },
  clockOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#EF4444",
    padding: 16,
    borderRadius: 8,
  },
  clockOutButtonCompact: {
    backgroundColor: "#EF4444",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  clockOutButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  statsCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#1F2937",
  },
  reportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  reportButtonText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "#2563EB",
  },
  statsRow: {
    flexDirection: "row",
    gap: 20,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: "#2563EB",
  },
  statBreakNote: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  historyCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#1F2937",
    marginBottom: 16,
  },
  historyEntry: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  historyTime: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  historyTimeText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#1F2937",
  },
  historyHours: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#2563EB",
  },
  historyCategory: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  historyWork: {
    fontSize: 12,
    color: "#4B5563",
  },
  noDataText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic" as const,
    textAlign: "center",
    paddingVertical: 20,
  },
  activeSession: {
    backgroundColor: "#F3F4F6",
    padding: 16,
    borderRadius: 8,
  },
  currentHours: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: "#10B981",
    marginVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "85%",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: "#1F2937",
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#1F2937",
    marginBottom: 12,
  },
  categoryScroll: {
    flexDirection: "row",
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#6B7280",
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
  },
  textArea: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#1F2937",
    minHeight: 100,
    textAlignVertical: "top",
  },
  summaryBox: {
    backgroundColor: "#EFF6FF",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  categoryDisplayBox: {
    backgroundColor: "#F0FDF4",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#10B981",
  },
  categoryDisplayLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#6B7280",
    marginBottom: 4,
  },
  categoryDisplayValue: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#10B981",
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#1F2937",
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: "#2563EB",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#6B7280",
  },
  confirmButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#EF4444",
    alignItems: "center",
  },
  confirmButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
  categoryBadge: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#2563EB",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginVertical: 4,
    alignSelf: "flex-start",
  },
  workDescription: {
    fontSize: 12,
    color: "#4B5563",
    marginVertical: 4,
  },
  activeInfoRow: {
    flexDirection: "row",
    marginTop: 8,
    gap: 8,
  },
  activeInfoLabel: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "#059669",
  },
  activeInfoValue: {
    fontSize: 13,
    color: "#065F46",
    flex: 1,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  lunchButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  lunchStartButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F59E0B",
    padding: 12,
    borderRadius: 8,
  },
  lunchEndButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#10B981",
    padding: 12,
    borderRadius: 8,
  },
  lunchStartButtonLarge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F59E0B",
    padding: 16,
    borderRadius: 8,
  },
  lunchEndButtonLarge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10B981",
    padding: 16,
    borderRadius: 8,
  },
  lunchButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  lunchIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  lunchIndicatorText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "#D97706",
  },
  historyLunch: {
    fontSize: 12,
    color: "#F59E0B",
    marginBottom: 4,
    fontWeight: "600" as const,
  },
  dateRangeButtons: {
    flexDirection: "row",
    gap: 12,
  },
  dateRangeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#2563EB",
  },
  dateRangeButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#2563EB",
  },
  selectedDateRange: {
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  selectedDateLabel: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "#6B7280",
    marginBottom: 6,
  },
  selectedDateText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#1F2937",
  },
  locationContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500" as const,
  },
  mapContainer: {
    height: 120,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  mapPlaceholderText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "#2563EB",
    marginTop: 8,
  },
  mapPlaceholderCoords: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
  },
  earningsText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#059669",
    marginTop: 4,
  },
  rateInfoCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  rateInfoLabel: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "#1F2937",
  },
  rateInfoValue: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: "#2563EB",
  },
  shiftSummaryCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  shiftSummaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  shiftSummaryTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#111827",
  },
  shiftSummaryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  shiftSummaryBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16A34A",
  },
  shiftSummaryBadgeText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#047857",
  },
  shiftSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  shiftSummaryItem: {
    flex: 1,
    minWidth: 130,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  shiftSummaryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  shiftSummaryLabel: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: "#6B7280",
    marginBottom: 4,
  },
  shiftSummaryValue: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#111827",
  },
  shiftSummaryValueMuted: {
    color: "#9CA3AF",
    fontWeight: "500" as const,
  },
  timeLogCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  timeLogCardTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#111827",
    marginBottom: 12,
  },
  timeLogRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    gap: 10,
  },
  timeLogDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timeLogLabel: {
    flex: 1,
    fontSize: 13,
    color: "#374151",
  },
  timeLogTime: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "#111827",
  },
  timeLogTimeMuted: {
    color: "#D97706",
    fontStyle: "italic" as const,
  },
  breakdownCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#111827",
    marginBottom: 14,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  breakdownLabel: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500" as const,
  },
  breakdownValue: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#111827",
  },
  breakdownSubtract: {
    color: "#D97706",
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 10,
  },
  breakdownLabelPaid: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: "#111827",
  },
  breakdownValuePaid: {
    fontSize: 20,
    fontWeight: "800" as const,
    color: "#2563EB",
  },
});
