import React from "react";
import { StatusBar, Platform, Dimensions } from "react-native";

//globals import & define
if (process.env.NODE_ENV) global.isDev = process.env.NODE_ENV === "development";
else if (process.argv) {
	let isDev = true;
	process.argv.forEach((val) =>
		val === "--production" ? (isDev = false) : 0
	);
	console.log(
		"starting " + (isDev ? "development" : "production") + " server"
	);
	global.isDev = isDev;
} else if (global.isDev === undefined) console.log("🚭🚭🚭 no bueno 🚭🚭🚭");

global.OS = Platform.OS;
const dimensionType = OS === "web" ? "window" : "screen";
global.screen_width = Dimensions.get(dimensionType).width;
global.screen_height = Dimensions.get(dimensionType).height;
require("./src/sockets").updateMeasurements(); //calc some globals onreceive first frame
global.keysHeld = require("./src/keyboarding").keysHeld;

//import components
import { ThemeProvider } from "./src/theme-context";
import { Screen } from "./components/screen";

//the component
export default function App() {
	return (
		<ThemeProvider>
			<StatusBar hidden={true} />
			<Screen />
		</ThemeProvider>
	);
}

declare global {
	interface Event {
		message: string;
		data: string;
	}
}
