import { GestureResponderEvent } from "react-native";
import {
	Coordinate,
	ResponderFN,
	setFingerType,
} from "../components/magnifyingglass";
import { addQueue, getQ, send_t_millisecs, setBusy } from "./keyboarding";

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
export function startLongPress(
	wasCrossHairClicked: boolean,
	ButtonType: number
) {
	isLongPressSettled = false; //reset var
	if (OS === "web") {
		if (wasCrossHairClicked) addQueue("p" + (ButtonType === 2 ? "r" : "l")); //press mouse button (clicking / dragging)
		return;
	}
	setBusy(true);
	const minTime = 500; //ms
	function longPress() {
		openContextMenu();
		console.log("long pressed!!!");
		longPressTimeoutRef = undefined;
	}
	longPressTimeoutRef = setTimeout(
		longPress,
		send_t_millisecs > minTime ? minTime : send_t_millisecs
	);
}

let isLongPressSettled = false;
export function endLongPress(wasCrossHairClicked: boolean, ButtonType: number) {
	if (OS === "web") {
		if (wasCrossHairClicked) {
			const q = getQ();
			if (
				((q[q.length - 1] || {}).info || [])[0] === "pr" &&
				ButtonType == 2
			) {
				q.pop(); //undo "pr"
				openContextMenu();
			} else addQueue("r" + (ButtonType === 2 ? "r" : "l"));
		}
		setBusy(false);
		return;
	}
	if (wasCrossHairClicked) {
		//NaN === undefined (from mousemove/touchmove)
		if (isNaN(ButtonType)) {
			//mouseover event
			if (!isLongPressSettled) {
				addQueue("p" + (ButtonType === 2 ? "r" : "l")); //press mouse button (clicking / dragging)
				isLongPressSettled = true;
			}
		} else {
			//touchend
			if (longPressTimeoutRef) {
				addQueue("p" + (ButtonType === 2 ? "r" : "l")); //press mouse button (clicking / dragging)
				addQueue("r" + (ButtonType === 2 ? "r" : "l"));
			} else if (isLongPressSettled)
				addQueue("r" + (ButtonType === 2 ? "r" : "l"));
		}
	}
	longPressTimeoutRef = clearTimeout(longPressTimeoutRef as NodeJS.Timeout);
	setBusy(false);
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
function openContextMenu() {
	addQueue("pl");
	addQueue("rl");
	addQueue("pr");
	addQueue("rr");
}
