import { GestureResponderEvent } from "react-native";
import {
	Coordinate,
	ResponderFN,
	setFingerType,
} from "../components/magnifyingglass";
import { addQueue, send_t_millisecs as queT, deleteLast } from "./keyboarding";
const gestureBufferTolerance = 5;

//helpers (features: cache lastTouch, firstTouch)
const firstTouch = { x: 0, y: 0 };
const lastTouch = { x: 0, y: 0 };
function FT(x: number, y: number) {
	firstTouch.x = x;
	firstTouch.y = y;
}
function LT(x: number, y: number) {
	lastTouch.x = x;
	lastTouch.y = y;
}
export function getDelta(pageX: number, pageY: number) {
	const delta = {
		x: pageX - lastTouch.x,
		y: pageY - lastTouch.y,
	};
	lastTouch.x = pageX;
	lastTouch.y = pageY;
	return delta;
}

//events base fn's
export function TouchStart(ev: GestureResponderEvent | MouseEvent) {
	const e = (ev as GestureResponderEvent).nativeEvent || ev;
	const x = e.pageX,
		y = e.pageY;
	FT(x, y);
	LT(x, y);
}
export function TouchEnd(e: GestureResponderEvent) {
	const x = e.nativeEvent.pageX,
		y = e.nativeEvent.pageY;
	LT(x, y);
	keysHeld = {};
}
export function TouchMove(e: GestureResponderEvent) {
	const x = e.nativeEvent.pageX,
		y = e.nativeEvent.pageY;
	LT(x, y);
	return lastTouch;
}

//longPress / right click (mobile)
let longPressTimeoutRef: NodeJS.Timeout | void;
export function startLongPress() {
	if (OS === "web") return;
	const minTime = 500; //ms
	function longPress() {
		deleteLast();
		addQueue("pr");
		addQueue("rr");
		console.log("long pressed!!!");
	}
	longPressTimeoutRef = setTimeout(
		longPress,
		queT > minTime ? minTime : queT
	);
}
export function endLongPress() {
	if (OS === "web") return;
	longPressTimeoutRef = clearTimeout(longPressTimeoutRef as NodeJS.Timeout);
}

//AddMouseSupport(web)    =    mousewheel scroll  +  right click & drag
export function AddMouseSupport(
	setFinger: setFingerType,
	magnifyingPos: Coordinate,
	TouchStart: ResponderFN,
	TouchEnd: ResponderFN
) {
	if (OS !== "web") return;
	function isMagnifyingGlass(t: EventTarget | null) {
		const tar = t as HTMLElement;
		//either (red dot (DIV)) or the magnifyingImage (IMG) is clickable
		if (!(tar.nodeName === "IMG" || tar.nodeName === "DIV")) return false;
		if (
			(tar.parentNode as HTMLElement).style.position !== "relative" &&
			(tar.parentNode?.parentNode as HTMLElement).style.position !==
				"relative"
		)
			return false; //the container we are targeting has this style (also every img has an extra div container)
		return true;
	}
	window.addEventListener("mousedown", (e) => {
		if (!e.button || !isMagnifyingGlass(e.target)) return; //0 = leftclick, handled by (pan)responder's
		TouchStart(e, setFinger, magnifyingPos, e.button);
	});
	window.addEventListener("mouseup", (e) => {
		if (!e.button || !isMagnifyingGlass(e.target)) return; //0 = leftclick, handled by (pan)responder's
		TouchEnd(e, setFinger, magnifyingPos, e.button);
	});
	//prev contextmenu inside magnifyingGlass
	window.addEventListener("contextmenu", (e) => {
		if (isMagnifyingGlass(e.target)) e.preventDefault();
	});
	//wheel scroll
	function MouseWheel(ev: Event) {
		const e = ev as WheelEvent;
		if (!isMagnifyingGlass(e.target)) return;
		addQueue("scrllms", -e.deltaX, -e.deltaY);
	}
	document.body.addEventListener("mousewheel", MouseWheel);
	document.body.addEventListener("DOMMouseScroll", MouseWheel);
}
