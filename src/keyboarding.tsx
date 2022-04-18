import React, { useState } from "react";
import tw from "twrnc";
import {
	View,
	Text,
	TouchableOpacity,
	GestureResponderEvent,
} from "react-native";
import { KeyCodes } from "../src/keymapping";
import {
	useTheme,
	useThemeUpdate,
	mobileFocus,
	webFocus,
	xType,
} from "../src/theme-context";

//hardcoded "config"
export const send_t_millisecs = 175;
//varying vars
export type keysHeldType = { [keyIndex: string]: boolean };
export const keysHeld: keysHeldType = {};
const queue: QueueEvent[] = [];
let last_send_t = 0;
let key_processing: ReturnType<typeof setTimeout>;
let isBusyCreatingAction: boolean;
export const setBusy = (val: boolean) => (isBusyCreatingAction = val);
interface QueueEvent {
	pressRelease?: string;
	key?: string;
	shift?: boolean;
	t: number;
	info?: InfoType;
}

function processQueue() {
	// console.log(
	// 	"\t\t\t\t\t\t\t\t\t\t\t...\t\t\t\t\t\tprocessing\t\t\t\t\t\t\t\t...\t..."
	// );
	if (!queue.length) return;
	const last = queue[queue.length - 1];
	const deltaT = last.t - last_send_t;
	const curT = new Date().getTime();
	let delay_processing = isBusyCreatingAction;
	function do_process() {
		let dataString = "";
		for (let i in queue) {
			let cur = queue[i];
			let { pressRelease, key, shift, t } = cur;
			dataString += t - queue[0].t + "~"; //add T
			if (!cur.info) {
				//keyboard event
				dataString += pressRelease + "~" + key + "~" + shift + ",";
			} else {
				//mouse event
				let [eventType, x, y] = cur.info as mouseInfoType;
				let prefix = "",
					extraData = "";
				if (!eventType.startsWith("p") && !eventType.startsWith("r"))
					extraData += x.toFixed(3) + "~" + y.toFixed(3);
				if (extraData) prefix = "~";
				dataString += eventType + prefix + extraData + ",";
			}
		}
		dataString = dataString.slice(0, -1);
		ws.send("es|" + dataString);
		last_send_t = curT;
		queue.splice(0, queue.length);
	}
	if (!delay_processing) {
		if (last.pressRelease === "u" || !last.pressRelease /* mouse event */) {
			if (deltaT < send_t_millisecs || curT - send_t_millisecs < 333)
				delay_processing = true;
			else do_process();
		}
	}
	if (last.pressRelease === "d" || delay_processing) {
		if (curT - last.t > send_t_millisecs) return do_process();
		clearTimeout(key_processing);
		key_processing = setTimeout(processQueue, 333 - (curT - deltaT));
	}
}

type UpDown = "u" | "d";
type keyInfoType = [UpDown, string, boolean];
type mouseInfoType =
	| [string, number, number]
	| [string, number, number, true | void];
type InfoType = [string] | keyInfoType | mouseInfoType | [string, true];
export function addQueue(...info: InfoType) {
	const [pressRelease, key, shift] = info;
	const t = new Date().getTime();
	if (typeof key === "string" && typeof shift === "boolean") {
		//keyboard event
		queue.push({
			pressRelease,
			key,
			shift,
			t,
		});
	} else if (
		(typeof pressRelease === "string" && key === true) ||
		arguments[3] === true
	) {
		//add to beginning of queue (all other events mouse move,click,scroll)
		queue.splice(0, 0, { info, t: (queue[0] && queue[0].t) || t });
	} else queue.push({ info, t }); //all other events mouse move,click,scroll
	processQueue();
}
export function queueKey(e: KeyboardEvent) {
	const char = e.data;
	let key =
		e.code ||
		KeyCodes[
			(char && char.charCodeAt(0)) || e.keyCode || e.charCode || e.which
		] ||
		e.key;
	if (key && key.length === 1) {
		if (isNaN(Number(key))) key = "Key" + key;
		else key = "Digit" + key;
	}
	if (!e.shiftKey)
		key = key.substr(0, key.length - 1) + key[key.length - 1].toLowerCase();
	if (!key || key === "WakeUp" || key.startsWith("Shift") || key === "Hyper")
		return; //python library has no fn (aka WakeUp)           same with hyper
	let pressRelease = e.type === "keyup" ? "u" : "d"; //default to "d" since e can be textInput or keydown
	function add2queue() {
		keysHeld[key] = true;
		addQueue(pressRelease as UpDown, key, e.shiftKey);
	}
	if (pressRelease === "u") {
		add2queue();
		delete keysHeld[key];
	} else if (!keysHeld[key]) add2queue();
}
export const getQ = () => queue;

//listen to desktop (web) Events (keydown, keyup, beforeunload, ...) & stop() e's (prevent from accidentally closing the page, etc.)
export function setWebEvents() {
	if (OS !== "web") return;
	function stop(e: KeyboardEvent) {
		e.preventDefault();
		e.stopPropagation();
		return (
			document.activeElement?.nodeName === "INPUT" ||
			document.activeElement?.nodeName === "TEXTAREA"
		);
	}
	window.addEventListener("keydown", function (e) {
		if (stop(e)) return false;
		queueKey(e);
		return false;
	});
	window.addEventListener("keyup", function (e) {
		if (stop(e)) {
			if (e.key === "Escape") (e.target as HTMLElement).blur();
			return false;
		}
		queueKey(e);
		return false;
	});
	window.addEventListener("beforeunload", function (e) {
		if (Object.keys(keysHeld).length) e.returnValue = "CTRL+W or xClick";
		return e.returnValue;
	});
	const root = document.getElementById("root")!;
	root.setAttribute("contenteditable", "true");
	root.style.userSelect = "text";
	root.style.cursor = "default";
	root.style.caretColor = "transparent";
	window.addEventListener("paste", function (e) {
		if (
			document.activeElement?.nodeName === "INPUT" ||
			document.activeElement?.nodeName === "TEXTAREA"
		)
			return;
		e.stopPropagation();
		e.preventDefault(); //@ts-ignore
		const pasted = e.clipboardData.getData("Text") + "";
		ws.send("/paste " + pasted);
	});
}

//^ Caret Button
let toggleCounter = 0;
function CaretButton({
	toggleHide,
	setToggleHide,
	mode,
	setBorderColor,
}: {
	toggleHide: boolean;
	setToggleHide: React.Dispatch<React.SetStateAction<boolean>>;
	mode: "command" | "chat";
	setBorderColor: React.Dispatch<React.SetStateAction<string>>;
}) {
	const setStore = useThemeUpdate();
	const onClick = (e: GestureResponderEvent) => {
		setToggleHide(!toggleHide);
		toggleCounter++;
		if (toggleCounter % 3 === 0) {
			setStore((prevStore) => ({
				...prevStore,
				mode: mode === "chat" ? "command" : "chat",
			}));
			toggleCounter = 0;
			setBorderColor(mode === "chat" ? mobileFocus : webFocus);
		}
	};
	return (
		<TouchableOpacity
			style={tw`w-[27px] h-[27px] absolute bottom-[-20px] right-[12px] ${
				mode === "chat" ? "bg-green-900" : "bg-red-900"
			} bg-opacity-70 border-2`}
			onPress={onClick}
		>
			<Text
				style={tw`text-center text-white ${
					OS === "web" ? "drop-shadow-2xl" : ""
				} ${toggleHide ? "text-sm" : "font-bold"}`}
			>
				{toggleHide === true ? "v" : "^"}
			</Text>
		</TouchableOpacity>
	);
}

/*
	Chat History
*/
const ChatHistory: string[] = [];
let cwm = ""; //current working message (index === -1)
let inputIndex = -1; //-1 = currently typed message, 0 = prev message sent, n = first message sent
export function getFromHistory(i: number | void) {
	if (i === -1 || (i === undefined && inputIndex === -1)) return cwm;
	return ChatHistory[i === undefined ? inputIndex : i];
}
export function setPrevHistory() {
	if (inputIndex + 1 > ChatHistory.length - 1) return;
	inputIndex++;
}
export function setNextHistory() {
	if (inputIndex - 1 < -1) return;
	inputIndex--;
}
export function logMessage(msg: string) {
	ChatHistory.splice(0, 0, msg);
	cwm = "";
	inputIndex = -1;
}
export function updateCurrentWorkingMessage(msg: string) {
	if (inputIndex === -1) cwm = msg;
}

/*
	Caret  ^   Button Menu
*/
const importantKeys = [
	"MetaLeft",
	"MetaRight",
	"AltLeft",
	"AltRight",
	"ShiftLeft",
	"ShiftRight",
	"ControlLeft",
	"ControlRight",
];
//HeldKeys,   (mobile - "chat" mode) - HistoryUp & HistoryDown buttons,    (mobile - "command" mode) - importantKey(s) buttons (Ctrl, Option, WindowsKey, etc.)
export function HeldKeysComponent({
	setBorderColor,
}: {
	setBorderColor: React.Dispatch<React.SetStateAction<string>>;
}) {
	const { mode } = useTheme();
	const setStore = useThemeUpdate();
	const [toggleHide, setToggleHide] = useState(true);
	return (
		<View style={tw`self-end`}>
			{
				//Array of [Button title  +   4 garbage characters (0000/left) eg: (CtrlLeft,AltLeft,History0000)  ].map()
				(mode === "command"
					? OS === "web"
						? Object.keys(keysHeld).filter(
								(key) => importantKeys.indexOf(key) !== -1
						  )
						: importantKeys.filter((key) => key.endsWith("Left"))
					: ["HistoryUp0000", "HistoryDown0000"]
				).map((key, i) => (
					<TouchableOpacity
						style={tw`bg-opacity-70 ${
							mode === "chat" ? "bg-green-900" : "bg-red-900"
						} self-center border-2 border-black mb-2 opacity-70 p-5 ${
							toggleHide ? "hidden" : "flex"
						}`}
						activeOpacity={0}
						key={i}
						onPress={(e) => {
							if (
								key === "HistoryUp0000" ||
								key === "HistoryDown0000"
							) {
								if (key === "HistoryUp0000") setPrevHistory();
								if (key === "HistoryDown0000") setNextHistory();
								setStore((prev) => ({
									...prev,
									chatVal: getFromHistory(),
								}));
							}
						}}
					>
						<Text>{key.slice(0, -4)}</Text>
					</TouchableOpacity>
				))
			}
			{OS === "web" ? null : (
				<CaretButton
					mode={mode}
					setToggleHide={setToggleHide}
					toggleHide={toggleHide}
					setBorderColor={setBorderColor}
				/>
			)}
		</View>
	);
}
