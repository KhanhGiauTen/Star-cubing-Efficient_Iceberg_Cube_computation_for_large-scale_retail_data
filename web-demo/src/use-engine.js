import { useEffect, useRef, useState } from "react";
export function useEngine() {
  const worker = useRef(null);
  const timer = useRef(null);
  const [state, setState] = useState({
    result: null,
    busy: false,
    status: "Ready",
    error: "",
    milliseconds: 0,
  });
  const stop = () => {
    clearTimeout(timer.current);
    worker.current?.terminate();
    worker.current = null;
    setState((value) => ({
      ...value,
      busy: false,
      status: "Stopped",
      error: "",
    }));
  };
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      worker.current?.terminate();
    },
    [],
  );
  const run = (params, completedKey = "") => {
    if (worker.current && state.busy) return;
    clearTimeout(timer.current);
    setState((value) => ({
      ...value,
      busy: true,
      error: "",
      status: "Starting...",
    }));
    if (!worker.current)
      worker.current = new Worker(
        new URL("./engine.worker.js", import.meta.url),
        { type: "module" },
      );
    const active = worker.current;
    active.onmessage = ({ data }) => {
      if (worker.current !== active) return;
      if (data.type === "status")
        setState((value) => ({ ...value, status: data.text }));
      else {
        clearTimeout(timer.current);
        if (data.type === "result")
          setState({
            result: data.result,
            busy: false,
            error: "",
            status: "Complete",
            milliseconds: data.milliseconds,
            completedKey,
          });
        else {
          active.terminate();
          worker.current = null;
          setState((value) => ({
            ...value,
            busy: false,
            status: "Error",
            error: data.text,
          }));
        }
      }
    };
    active.onerror = () => {
      clearTimeout(timer.current);
      active.terminate();
      worker.current = null;
      setState((value) => ({
        ...value,
        busy: false,
        status: "Error",
        error: "Worker could not start. Reload and retry.",
      }));
    };
    timer.current = setTimeout(() => {
      active.terminate();
      worker.current = null;
      setState((value) => ({
        ...value,
        busy: false,
        status: "Timed out",
        error: "Execution exceeded 60 seconds. Reduce the input and retry.",
      }));
    }, 60000);
    active.postMessage(params);
  };
  return { ...state, run, stop };
}
export function dataUrl(value) {
  return (
    "data:application/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(value, null, 2))
  );
}
