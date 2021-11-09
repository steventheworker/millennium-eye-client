import React, { useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

export type themeUpdateType = React.Dispatch<React.SetStateAction<xType>>;
export type xType = {
  uri: string;
  mode: "command" | "chat";
};
const defaultX: xType = {
  uri: "../assets/blank.jpg",
  mode: Platform.OS === "web" ? "chat" : "command",
};
const xContext = React.createContext(defaultX);
let xUpdateContext = React.createContext((() => {}) as themeUpdateType);

//defaultX = x = useTheme() = import('./themecontext).useTheme();
export function useTheme() {
  return useContext(xContext);
}
export function useThemeUpdate() {
  return useContext(xUpdateContext);
}
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [x, setX] = useState(defaultX);
  return (
    <xContext.Provider value={x}>
      <xUpdateContext.Provider value={setX}>{children}</xUpdateContext.Provider>
    </xContext.Provider>
  );
}
