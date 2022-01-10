import React, { ReactDOM, useEffect, useRef } from "react";
import tw from "twrnc";
import {
	GestureResponderEvent,
	Image,
	PanResponder,
	View,
	ImageSourcePropType,
} from "react-native";

import { addQueue } from "../src/keyboarding";
import {
	AddMouseSupport,
	getDelta,
	startLongPress,
	endLongPress,
} from "../src/touchlibrary";

const FINGER_SIZE = 48; //"crossHair"
const MAG_SIZE = 320; //magnifyingGlass diameter - same as smallest iphone width (se)
export type Coordinate = { x: number; y: number };
export type FingerInfo = Coordinate & { bgx: number; bgy: number };
//define events
function stop(e: GestureResponderEvent | MouseEvent) {
	e.preventDefault();
	e.stopPropagation();
}
export type ResponderFN = (
	e: GestureResponderEvent | MouseEvent,
	setFinger: setFingerType,
	magnifyingPos: Coordinate,
	ButtonType?: number
) => void;
function setMouse(x: number, y: number) {
	addQueue("sm", x / zoomX, y / zoomY); //set mouse coordinate (x, y)
}
function moveMouse(x: number, y: number) {
	//move mouse coordinate (dX, dY)
	addQueue("mm", x / zoomX, y / zoomY);
}

let wasCrossHairClicked = false;
const TouchStart: ResponderFN = (ev, setFinger, magnifyingPos, ButtonType) => {
	const e = (ev as GestureResponderEvent).nativeEvent || ev;
	resetMagnifyingTimer(setFinger);
	startSyncTimer();
	//hover mouse  vs  click/drag
	wasCrossHairClicked = doesCrossHairClick(
		{ x: e.pageX, y: e.pageY },
		magnifyingPos
	);
	if (wasCrossHairClicked) {
		setMouse(e.pageX, e.pageY);
		addQueue("p" + (ButtonType === 2 ? "r" : "l")); //press mouse button (clicking / dragging)
	}
	stop(ev);
	startLongPress();
};
const TouchEnd: ResponderFN = (ev, setFinger, magnifyingPos, ButtonType) => {
	endLongPress();
	const e = (ev as GestureResponderEvent).nativeEvent || ev;
	resetMagnifyingTimer(setFinger);
	const touch = { x: e.pageX, y: e.pageY };
	const obj = { ...magnifyingPos, width: MAG_SIZE, height: MAG_SIZE };
	if (!withinBounds(touch, obj)) return;
	if (wasCrossHairClicked) addQueue("r" + (ButtonType === 2 ? "r" : "l"));
	wasCrossHairClicked = false;
	stop(ev);
	endSyncTimer();
};
const TouchMove: ResponderFN = (e, setFinger, magnifyingPos) => {
	endLongPress();
	e = e as GestureResponderEvent;
	resetMagnifyingTimer(setFinger);
	const { pageX, pageY } = e.nativeEvent;
	const delta = getDelta(pageX, pageY);
	moveMouse(delta.x, delta.y);
	stop(e);
	//update coordinates for mouse syncing
	mouse.x = pageX;
	mouse.y = pageY;
};

//mouse syncing (every 3 secs)
const mouse = { x: 0, y: 0 };
const SYNC_DELAY = 3000;
let syncTimer: NodeJS.Timeout | void;
function syncTimerFn() {
	setMouse(mouse.x, mouse.y);
}
function runSyncTimer() {
	syncTimerFn();
	syncTimer = setTimeout(runSyncTimer, SYNC_DELAY);
}
function startSyncTimer() {
	if (syncTimer) return;
	syncTimer = setTimeout(runSyncTimer, SYNC_DELAY);
}
function endSyncTimer() {
	if (!syncTimer) return;
	syncTimer = clearTimeout(syncTimer);
}

//bind timer to mouse (eg: finger)
let magTimeoutRef: NodeJS.Timeout | void; //magnifying glass hide timeout reference
export type setFingerType = React.Dispatch<
	React.SetStateAction<FingerInfo | null>
>;
function resetMagnifyingTimer(setFinger: setFingerType) {
	if (magTimeoutRef) magTimeoutRef = clearTimeout(magTimeoutRef);
	magTimeoutRef = setTimeout(() => setFinger(() => null), 999);
}
export function updateMagnifyingGlass(
	setFinger: setFingerType,
	x: number,
	y: number
) {
	const bgx = x / zoomX - 0.5 * MAG_SIZE;
	const bgy = y / zoomY - 0.5 * MAG_SIZE;
	setFinger(() => ({ x, y, bgx, bgy }));
	resetMagnifyingTimer(setFinger);
}
//component
export function MagnifyingGlass({
	uri,
	hidden,
	x,
	y,
	bgx,
	bgy,
	setFinger,
	onLoadEnd,
}: FingerInfo & {
	uri: ImageSourcePropType;
	hidden: boolean;
	setFinger: setFingerType;
	onLoadEnd: () => void;
}) {
	useEffect(
		() => AddMouseSupport(setFinger, lastPos, TouchStart, TouchEnd),
		[]
	);
	if (x !== 0 && y !== 0) updatePos(x, y);
	const panHandlers =
		OS === "web"
			? {
					onStartShouldSetResponder: () => true,
					onResponderEnd: (e: GestureResponderEvent) =>
						TouchEnd(e, setFinger, lastPos),
					onResponderStart: (e: GestureResponderEvent) =>
						TouchStart(e, setFinger, lastPos),
					onResponderMove: (e: GestureResponderEvent) =>
						TouchMove(e, setFinger, lastPos),
			  }
			: {
					onStartShouldSetPanResponder: () => true,
					onPanResponderGrant: (e: GestureResponderEvent) =>
						TouchStart(e, setFinger, lastPos),
					onPanResponderMove: (e: GestureResponderEvent) =>
						TouchMove(e, setFinger, lastPos),
					onPanResponderRelease: (e: GestureResponderEvent) =>
						TouchEnd(e, setFinger, lastPos),
			  };
	const panResponder =
		OS === "web"
			? { panHandlers }
			: useRef(PanResponder.create(panHandlers)).current;
	return (
		<View
			style={[
				tw`shadow-lg absolute z-20 top-[${
					y - 0.5 * MAG_SIZE
				}px] left-[${x}px] w-[${MAG_SIZE}px] h-[${MAG_SIZE}px] ml-[${
					-0.5 * MAG_SIZE
				}px] bg-red-900 ${
					hidden ? "hidden" : "flex"
				} overflow-hidden rounded-full`,
			]}
			{...panResponder.panHandlers}
		>
			<View
				style={tw`relative w-[${server_screen_width}px] h-[${server_screen_height}px]`}
			>
				<FingerPoint />
				<Image
					style={tw`w-full h-full absolute top-[${-bgy}px] left-[${-bgx}px]`}
					source={{ uri } as ImageSourcePropType}
					onLoadEnd={() => onLoadEnd()}
				/>
			</View>
		</View>
	);
}

//helpers
const lastPos = { x: 0, y: 0 };
function updatePos(x: number, y: number) {
	//last non-zero pos
	lastPos.x = x;
	lastPos.y = y;
}
function withinBounds(
	touch: Coordinate,
	obj: Coordinate & { width: number; height: number }
) {
	return (
		obj.x + obj.width >= touch.x &&
		obj.x <= touch.x + obj.width &&
		obj.y + obj.height >= touch.y &&
		obj.y <= touch.y + obj.height
	);
}

//CrossHair / red dot (in center of magnifyingGlass) - component
function FingerPoint() {
	return (
		<View
			style={tw`rounded-full z-10 absolute bg-red-900/33 w-[${FINGER_SIZE}px] h-[${FINGER_SIZE}px] ml-[${
				0.5 * MAG_SIZE - 0.5 * FINGER_SIZE
			}px] mt-[${0.5 * MAG_SIZE - 0.5 * FINGER_SIZE}px]`}
		></View>
	);
}
function doesCrossHairClick(finger: Coordinate, magnifyingGlass: Coordinate) {
	return (
		finger.x - magnifyingGlass.x <= FINGER_SIZE / 2 &&
		finger.y - magnifyingGlass.y <= FINGER_SIZE / 2
	);
}
