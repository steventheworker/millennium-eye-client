import React, { useEffect, useRef } from "react";
import tw from 'twrnc';
import { GestureResponderEvent, Image, PanResponder, View } from "react-native";
import { addQueue } from "../src/keyboarding";
import {
	AddMouseSupport,
	getDelta,
	startLongPress,
	endLongPress,
} from "../src/touchlibrary";

const size = 200; //magnifyingGlass diameter
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
const TouchStart: ResponderFN = (ev, setFinger, magnifyingPos, ButtonType) => {
	const e = (ev as GestureResponderEvent).nativeEvent || ev;
	resetMagnifyingTimer(setFinger);
	addQueue("sm", e.pageX / zoomX, e.pageY / zoomY); //set mouse coordinate
	addQueue("p" + (ButtonType === 2 ? "r" : "l")); //press mouse button
	stop(ev);
	startLongPress();
};
const TouchEnd: ResponderFN = (ev, setFinger, magnifyingPos, ButtonType) => {
	endLongPress();
	const e = (ev as GestureResponderEvent).nativeEvent || ev;
	resetMagnifyingTimer(setFinger);
	const touch = { x: e.pageX, y: e.pageY };
	const obj = { ...magnifyingPos, width: size, height: size };
	if (!withinBounds(touch, obj)) return;
	addQueue("r" + (ButtonType === 2 ? "r" : "l"));
	stop(ev);
};
const TouchMove: ResponderFN = (e, setFinger, magnifyingPos) => {
	endLongPress();
	e = e as GestureResponderEvent;
	resetMagnifyingTimer(setFinger);
	const { pageX, pageY } = e.nativeEvent;
	const delta = getDelta(pageX, pageY);
	addQueue("mm", delta.x, delta.y);
	stop(e);
};

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
	const bgx = x / zoomX - 0.5 * size;
	const bgy = y / zoomY - 0.5 * size;
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
}: FingerInfo & {
	uri: string;
	hidden: boolean;
	setFinger: setFingerType;
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
		<View style={[tw`shadow-lg absolute z-20 top-[${y - 0.5*size}px] left-[${x}px] w-[${size}px] h-[${size}px] ml-[${-0.5 * size}px] bg-red-900 ${hidden ? "hidden" : "flex"} overflow-hidden rounded-full`]}
			{...panResponder.panHandlers}>
			<View style={tw`relative w-[${server_screen_width}px] h-[${server_screen_height}px]`}>
				<FingerPoint />
				<Image style={ tw`w-full h-full absolute top-[${-bgy}px] left-[${-bgx}px]`}
					source={{ uri }} />
			</View>
		</View>
	);
}

//red dot (in center of magnifyingGlass) - component
const fingerpoint = 4;
function FingerPoint() {
	return (
		<View style={tw`z-10 absolute bg-red-900 w-[${fingerpoint}px] h-[${fingerpoint}px] ml-[${0.5 * size - 0.5 * fingerpoint}px] mt-[${0.5 * size - 0.5 * fingerpoint}px]`}></View>
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
