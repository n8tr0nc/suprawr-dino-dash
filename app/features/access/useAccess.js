"use client";

import { useContext } from "react";
import { AccessContext } from "./AccessProvider";

export function useAccess() {
  return useContext(AccessContext);
}
