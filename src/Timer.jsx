import { useState, useEffect, useRef, useCallback } from "react";

const pad = (n) => String(n).padStart(2, "0");

function useBeep() {
  const ctxRef = useRef(null);

  const beep = useCallback(() => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new (
          window.AudioContext || window.webkitAudioContext
        )();
      }
      const ctx = ctxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {}
  }, []);

  return beep;
}

export default function Timer() {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(10);
  const [remaining, setRemaining] = useState(0);
  const [totalSecs, setTotalSecs] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | running | paused | alarm
  const intervalRef = useRef(null);
  const alertIntervalRef = useRef(null);
  // ✅ Ref so the tick closure can check synchronously whether we're still active
  const activeRef = useRef(false);
  const beep = useBeep();

  const hoursRef = useRef(hours);
  const minutesRef = useRef(minutes);
  const secondsRef = useRef(seconds);
  hoursRef.current = hours;
  minutesRef.current = minutes;
  secondsRef.current = seconds;

  const isDanger = status === "alarm";
  const isRunning = status === "running";

  const dispH = Math.floor(remaining / 3600);
  const dispM = Math.floor((remaining % 3600) / 60);
  const dispS = remaining % 60;
  const progressPct = totalSecs > 0 ? (remaining / totalSecs) * 100 : 100;

  // ✅ stopAlarm flips activeRef first so any in-flight tick won't re-trigger the alarm
  const stopAlarm = useCallback(() => {
    activeRef.current = false;
    clearInterval(alertIntervalRef.current);
    alertIntervalRef.current = null;
  }, []);

  const triggerAlarm = useCallback(() => {
    setStatus("alarm");
    beep();
    alertIntervalRef.current = setInterval(beep, 1200);
  }, [beep]);

  const handleStart = useCallback(() => {
    stopAlarm();
    const inputSecs =
      hoursRef.current * 3600 + minutesRef.current * 60 + secondsRef.current;
    setRemaining((prev) => {
      const secs = prev === 0 ? inputSecs : prev;
      if (secs === 0) return prev;
      if (prev === 0) setTotalSecs(secs);
      return secs;
    });
    const willHaveTime =
      remaining > 0 ||
      hoursRef.current * 3600 + minutesRef.current * 60 + secondsRef.current >
        0;
    if (!willHaveTime) return;
    activeRef.current = true;
    setStatus("running");
  }, [stopAlarm, remaining]);

  const handlePause = useCallback(() => {
    // ✅ Flip activeRef first so the tick won't call triggerAlarm after this
    activeRef.current = false;
    clearInterval(intervalRef.current);
    stopAlarm();
    setStatus((prev) => (prev === "running" ? "paused" : prev));
  }, [stopAlarm]);

  const handleReset = useCallback(() => {
    // ✅ Flip activeRef first
    activeRef.current = false;
    clearInterval(intervalRef.current);
    stopAlarm();
    setStatus("idle");
    setRemaining(0);
    setTotalSecs(0);
  }, [stopAlarm]);

  const inputChanged = useCallback(() => {
    setStatus((prev) => (prev !== "running" ? "idle" : prev));
    setRemaining((prev) => (prev !== 0 ? 0 : prev));
    setTotalSecs((prev) => (prev !== 0 ? 0 : prev));
  }, []);

  // Tick effect
  useEffect(() => {
    if (status !== "running") {
      clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          // ✅ Only fire alarm if activeRef is still true (not reset/paused mid-tick)
          if (activeRef.current) {
            activeRef.current = false;
            triggerAlarm();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [status, triggerAlarm]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      clearInterval(intervalRef.current);
      stopAlarm();
    };
  }, [stopAlarm]);

  const startLabel =
    status === "running" ? "Running" : status === "paused" ? "Resume" : "Start";

  return (
    <div
      style={{
        minHeight: 520,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        background: isDanger
          ? undefined
          : "var(--color-background-tertiary, #f5f5f0)",
        backgroundColor: isDanger ? "#A32D2D" : undefined,
        animation: isDanger ? "pulseRed 1s ease-in-out infinite" : undefined,
        borderRadius: 12,
        fontFamily: "'Syne', 'Segoe UI', sans-serif",
        transition: "background 0.6s ease",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap');
        @keyframes pulseRed {
          0%, 100% { background-color: #A32D2D; }
          50%       { background-color: #E24B4A; }
        }
        @keyframes shake {
          0%   { transform: translateX(-2px); }
          100% { transform: translateX(2px); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .digit-block input[type=number]::-webkit-outer-spin-button,
        .digit-block input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        .digit-block input[type=number] { -moz-appearance: textfield; }
      `}</style>

      {/* Title */}
      <div
        style={{
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: isDanger ? "#F7C1C1" : "var(--color-text-secondary, #888)",
          marginBottom: "2rem",
          transition: "color 0.4s",
        }}
      >
        GLORIOUS MEDIA
      </div>

      {/* Big display */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginBottom: "2.5rem",
        }}
      >
        {[
          { val: dispH, label: "hrs" },
          null,
          { val: dispM, label: "min" },
          null,
          { val: dispS, label: "sec" },
        ].map((item, i) =>
          item === null ? (
            <span
              key={i}
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 72,
                fontWeight: 900,
                color: isDanger
                  ? "rgba(255,255,255,0.4)"
                  : "var(--color-text-tertiary, #aaa)",
                marginBottom: 20,
                animation: "blink 1s step-end infinite",
                transition: "color 0.4s",
              }}
            >
              :
            </span>
          ) : (
            <div
              key={i}
              className='digit-block'
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <div
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 72,
                  fontWeight: 700,
                  color: isDanger ? "#fff" : "var(--color-text-primary, #111)",
                  lineHeight: 1,
                  minWidth: 120,
                  textAlign: "center",
                  background: isDanger
                    ? "rgba(255,255,255,0.08)"
                    : "var(--color-background-primary, #fff)",
                  border: isDanger
                    ? "0.5px solid rgba(255,255,255,0.2)"
                    : "0.5px solid var(--color-border-tertiary, #ddd)",
                  borderRadius: 8,
                  padding: "12px 8px",
                  transition: "all 0.4s ease",
                  animation: isDanger
                    ? "shake 0.4s ease-in-out infinite alternate"
                    : undefined,
                }}
              >
                {pad(item.val)}
              </div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: isDanger
                    ? "rgba(255,255,255,0.5)"
                    : "var(--color-text-tertiary, #aaa)",
                  fontWeight: 700,
                  transition: "color 0.4s",
                }}
              >
                {item.label}
              </div>
            </div>
          ),
        )}
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          height: 3,
          background: "var(--color-border-tertiary, #ddd)",
          borderRadius: 99,
          overflow: "hidden",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            height: "100%",
            background: isDanger ? "#fff" : "var(--color-text-primary, #111)",
            borderRadius: 99,
            width: `${progressPct}%`,
            transition: "width 1s linear, background 0.5s",
          }}
        />
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
          width: "100%",
          maxWidth: 380,
        }}
      >
        {/* Time inputs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: isDanger
              ? "rgba(255,255,255,0.1)"
              : "var(--color-background-primary, #fff)",
            border: isDanger
              ? "0.5px solid rgba(255,255,255,0.2)"
              : "0.5px solid var(--color-border-tertiary, #ddd)",
            borderRadius: 8,
            padding: "10px 16px",
            width: "100%",
            justifyContent: "center",
            transition: "all 0.4s",
          }}
        >
          {[
            { label: "Hours", value: hours, setter: setHours, max: 99 },
            null,
            { label: "Minutes", value: minutes, setter: setMinutes, max: 59 },
            null,
            { label: "Seconds", value: seconds, setter: setSeconds, max: 59 },
          ].map((item, i) =>
            item === null ? (
              <span
                key={i}
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 22,
                  color: isDanger
                    ? "rgba(255,255,255,0.4)"
                    : "var(--color-text-tertiary, #aaa)",
                  marginBottom: 16,
                  transition: "color 0.4s",
                }}
              >
                :
              </span>
            ) : (
              <div
                key={i}
                className='digit-block'
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <label
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: isDanger
                      ? "rgba(255,255,255,0.5)"
                      : "var(--color-text-tertiary, #aaa)",
                    fontWeight: 700,
                    transition: "color 0.4s",
                  }}
                >
                  {item.label}
                </label>
                <input
                  type='number'
                  min={0}
                  max={item.max}
                  value={item.value}
                  onChange={(e) => {
                    item.setter(
                      Math.min(
                        item.max,
                        Math.max(0, parseInt(e.target.value) || 0),
                      ),
                    );
                    inputChanged();
                  }}
                  style={{
                    width: 56,
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 22,
                    fontWeight: 700,
                    textAlign: "center",
                    border: "none",
                    background: "transparent",
                    color: isDanger
                      ? "#fff"
                      : "var(--color-text-primary, #111)",
                    outline: "none",
                    padding: "2px 0",
                    transition: "color 0.4s",
                  }}
                />
              </div>
            ),
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8, width: "100%" }}>
          {[
            { label: startLabel, onClick: handleStart, primary: true },
            { label: "Pause", onClick: handlePause },
            { label: "Reset", onClick: handleReset },
          ].map(({ label, onClick, primary }) => (
            <button
              key={label}
              onClick={onClick}
              style={{
                flex: 1,
                padding: 12,
                fontFamily: "'Syne', sans-serif",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.05em",
                borderRadius: 8,
                border: primary
                  ? "none"
                  : isDanger
                    ? "0.5px solid rgba(255,255,255,0.25)"
                    : "0.5px solid var(--color-border-secondary, #ccc)",
                cursor: "pointer",
                background: primary
                  ? isDanger
                    ? "#fff"
                    : "var(--color-text-primary, #111)"
                  : isDanger
                    ? "rgba(255,255,255,0.1)"
                    : "var(--color-background-primary, #fff)",
                color: primary
                  ? isDanger
                    ? "#A32D2D"
                    : "var(--color-background-primary, #fff)"
                  : isDanger
                    ? "#fff"
                    : "var(--color-text-primary, #111)",
                transition: "all 0.2s ease",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Alarm message */}
      {isDanger && (
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.05em",
            color: "#fff",
            marginTop: "1rem",
            animation: "fadeIn 0.5s ease",
          }}
        >
          ⏰ Time is up!
        </div>
      )}
    </div>
  );
}
