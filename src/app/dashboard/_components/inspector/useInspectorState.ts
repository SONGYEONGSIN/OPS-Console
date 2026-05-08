"use client";

import { useState, useCallback } from "react";

export type InspectorState<T> = {
  selected: T | null;
  editing: boolean;
  open: (item: T) => void;
  close: () => void;
  toggleEdit: () => void;
};

export function useInspectorState<T>(): InspectorState<T> {
  const [selected, setSelected] = useState<T | null>(null);
  const [editing, setEditing] = useState(false);

  const open = useCallback((item: T) => {
    setSelected(item);
    setEditing(false);
  }, []);

  const close = useCallback(() => {
    setSelected(null);
    setEditing(false);
  }, []);

  const toggleEdit = useCallback(() => {
    setEditing((v) => !v);
  }, []);

  return { selected, editing, open, close, toggleEdit };
}
