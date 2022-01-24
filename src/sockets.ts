import { themeUpdateType } from "./theme-context";
import { Image } from "react-native";
import * as Clipboard from "expo-clipboard";

const DEFAULTPORT = 8000;
const DEVFALLBACK = "192.168.0.160";

export function updateMeasurements(uri?: string) {
	function calcZoom() {
		global.zoomX = screen_width / server_screen_width;
		global.zoomY = screen_height / server_screen_height;
	}
	global.server_screen_width = 1920;
	global.server_screen_height = 1080;
	calcZoom();
	if (uri) {
		Image.getSize(uri, (width, height) => {
			global.server_screen_width = width;
			global.server_screen_height = height;
			calcZoom();
		});
	}
}

//protocol - define socket events, & begin to listen
let isFirstFrame = true;
function onFirstFrame(uri: string) {
	isFirstFrame = false;
	updateMeasurements(uri);
}
export function initializeSocket(setStore: themeUpdateType) {
	global.ws = new Socket({
		onmessage: (e) => {
			//(r) efresh screen
			if (e.data.startsWith("r|")) {
				const utf8b64 = e.data.substr(2);
				const uri = "data:image/jpeg;base64," + utf8b64;
				setStore((prevStore) => ({
					...prevStore,
					uri,
					isUriLoaded: false,
				}));
				if (isFirstFrame) onFirstFrame(uri);
			} else if (e.data.startsWith("dc|")) {
				Disconnect(0, "forced disconnect / kickall");
			} else if (e.data.startsWith("cp|")) {
				const clipboardContent = e.data.substr(3);
				if (OS === "web") {
					const $copyinput = document.createElement("input");
					$copyinput.value = clipboardContent;
					document.body.appendChild($copyinput);
					$copyinput.select();
					$copyinput.setSelectionRange(0, clipboardContent.length);
					document.execCommand("copy");
					$copyinput.remove(); //todo: setTimeout(refocusInput) //if using textInput to use /copy
				} else Clipboard.setString(clipboardContent);
			}
		},
	});
	ws.send("init"); //send initial message, w/ no specific purpose //todo: find specific purpose
}
function Disconnect(code: number, reason: string) {
	if (OS === "web" || (reason && reason.startsWith("forced")))
		setTimeout(() => document.write("d/c screen - socket died"), 1000);
	console.log("close\ncode,reason: ", code, `"${reason}"`);
}
export class Socket {
	socket: WebSocket | undefined;
	queue: string[];
	processing: boolean;
	connected: boolean;
	constructor({
		onopen,
		onerror,
		onclose,
		onmessage,
	}: {
		onopen?: () => void;
		onerror?: (e: Event) => void;
		onclose?: (e: Event) => void;
		onmessage?: (e: Event) => void;
	}) {
		const self = this;
		let socketUrl = OS === "web" ? window.location.hostname : DEVFALLBACK; //todo: stop hardcode t430 as last resort
		if (isDev) socketUrl = DEVFALLBACK;
		this.socket = new WebSocket(
			`ws://${socketUrl}:${DEFAULTPORT}/sockets/websocket`
		);
		this.socket.onopen = () => {
			this.connected = true;
			console.log("got connected! logging on!");
			if (onopen) onopen();
		};
		this.socket.onerror = (e) => {
			console.log(e.message);
			if (onerror) onerror(e);
		};
		this.socket.onclose = (e) => {
			Disconnect(e.code, e.reason);
			if (onclose) onclose(e);
			if (OS !== "web") {
				(function AutoReconnect() {
					console.log("reconnecting in... 250ms");
					const cachedHandlers = [
						self.socket!.onopen,
						self.socket!.onerror,
						self.socket!.onclose,
						self.socket!.onmessage,
					];
					delete self.socket;
					setTimeout(() => {
						self.socket = new Socket({}).socket;
						self.socket!.onopen = cachedHandlers[0] as
							| ((this: WebSocket, ev: Event) => void)
							| null;
						self.socket!.onerror = cachedHandlers[1] as
							| ((this: WebSocket, ev: Event) => void)
							| null;
						self.socket!.onclose = cachedHandlers[2] as
							| ((this: WebSocket, ev: Event) => void)
							| null;
						self.socket!.onmessage = cachedHandlers[3] as
							| ((this: WebSocket, ev: Event) => void)
							| null;
						console.log("reconnected successfully!");
					}, 250);
				})();
			}
		};
		this.socket.onmessage = (e) => {
			if (!e.data.startsWith("r|")) console.log("<< " + e.data); //todo: remove debug line
			if (onmessage) onmessage(e);
		};
		this.queue = [];
		this.processing = false;
		this.connected = false;
	}
	send(data: string) {
		if (this.socket!.readyState === WebSocket.CONNECTING) {
			return this.sendQueue(data);
		}
		data = "|" + data;
		console.log(">> " + data);
		this.socket!.send(data);
	}
	sendQueue(data: string) {
		this.queue.push(data);
		this.processQueue();
	}
	processQueue() {
		if (this.processing) return;
		this.processing = true;
		setTimeout(() => {
			this.processing = false;
			if (this.socket!.readyState === WebSocket.CONNECTING) {
				return this.processQueue();
			}
			this.send(this.queue.join("\\n"));
			this.queue = [];
		}, 333);
	}
}
