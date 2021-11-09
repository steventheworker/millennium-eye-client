import ""; //if this line is no longer the only import left, comment/remove it out    aka: (Augmentations for the global scope can only be directly nested in external modules or ambient module declarations.ts(2669))
declare global {
	//shared globals (exist on server/client)
	var isDev: boolean;

	//client globals
	var OS: "web" | "android" | "ios" | "macos" | "windows";
	var ws: import("./src/sockets").Socket;
	var keysHeld: import("./src/keyboarding").keysHeldType;
	//initial calculations
	var screen_width: number;
	var screen_height: number;
	var zoomX: number;
	var zoomY: number;
	var server_screen_width: number;
	var server_screen_height: number;
}
